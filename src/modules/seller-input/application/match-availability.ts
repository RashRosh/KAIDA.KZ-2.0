import type { Database } from '../../../db/client';
import type { Locale } from '../../../i18n/config';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { listOwnedOffers } from '../../offers/application/list-owned-offers';
import type { SellerOfferView } from '../../offers/contracts/seller-offer.contract';
import { samePackQuantity } from '../../offers/pack/pack';
import { queryWords, searchWords } from '../../offers/title/offer-title';
import { getWordFormDictionary, wordEvidence, type WordFormDictionary } from '../../search/word-forms/word-forms';
import type {
  AvailabilityCandidate,
  AvailabilityStatement,
  AvailabilityStatementView,
  AvailabilityVariant,
  TrackedAvailabilityItem,
} from '../contracts/availability.contract';

// text-availability §4.1 item 2: which of the Seller's cards at one point a «нет в наличии» statement can mean.
// Channel-independent: any seller-input channel that produces statements uses this function.

// The statement names this offer's product: the exact catalog Product it is linked to, or every word of the statement
// equal to a title word or a reviewed form of one. A bare prefix («лук» → «Лукум») never counts.
export function namesSameProduct(
  statementWords: string[],
  resolvedProductId: string | null,
  offer: { productId: string | null; title: string },
  dictionary: WordFormDictionary = getWordFormDictionary(),
): boolean {
  if (resolvedProductId !== null && offer.productId === resolvedProductId) return true;
  if (statementWords.length === 0) return false;
  const titleWords = new Set(searchWords(offer.title));
  return statementWords.every((word) => wordEvidence(word, titleWords, dictionary) !== 'P');
}

// A named pack decides the offer; a unit named without a pack decides it otherwise; none or uncertain keeps every pack.
export function fitsVariant(variant: AvailabilityVariant, offer: Pick<SellerOfferView, 'pack' | 'price'>): boolean {
  if (variant.state !== 'bound') return true;
  if (variant.pack) return offer.pack !== null && samePackQuantity(offer.pack, variant.pack);
  if (variant.unit) return offer.price?.unitChoice?.code === variant.unit.code;
  return true;
}

export function candidateStatus(
  offer: Pick<SellerOfferView, 'id' | 'status' | 'revision'>,
  tracked: TrackedAvailabilityItem[],
): Pick<AvailabilityCandidate, 'status' | 'selectable'> {
  const mine = tracked.filter((item) => item.offerId === offer.id);
  if (offer.status === 'inactive') {
    return { status: mine.some((item) => item.changeSetStatus === 'confirmed') ? 'off_here' : 'off_before', selectable: false };
  }
  // A proposal made against an older revision can no longer be confirmed, so the card is selectable again.
  if (mine.some((item) => item.changeSetStatus === 'proposed' && item.expectedRevision === offer.revision)) {
    return { status: 'pending', selectable: false };
  }
  return { status: 'live', selectable: true };
}

export async function matchAvailability(
  ownerUserId: string,
  locationId: string | null,
  statements: AvailabilityStatement[],
  tracked: TrackedAvailabilityItem[],
  dependencies: { database: Database; locale?: Locale; now?: Date },
): Promise<AvailabilityStatementView[]> {
  const empty = (statement: AvailabilityStatement, index: number): AvailabilityStatementView => (
    { ...statement, index, candidates: [], others: [] });
  if (statements.length === 0) return [];
  if (locationId === null) return statements.map(empty);

  const { database } = dependencies;
  const clock = dependencies.now ? () => dependencies.now! : undefined;
  // Only the selected point, server-side; archived-stage cards are left out as in «Товары точки».
  const offers = (await listOwnedOffers(ownerUserId, { database, locale: dependencies.locale, clock }))
    .filter((offer) => offer.location.id === locationId && offer.actuality.stage !== 'archived')
    .sort((a, b) => a.product.name.localeCompare(b.product.name, 'ru') || (a.packLabel ?? '').localeCompare(b.packLabel ?? '', 'ru'));
  const dictionary = getWordFormDictionary();

  const views: AvailabilityStatementView[] = [];
  for (const [index, statement] of statements.entries()) {
    const resolution = await resolveProduct(database, statement.label);
    const resolvedId = resolution.status === 'resolved' ? resolution.product.id : null;
    const words = queryWords(statement.label);
    const sameProduct = offers.filter((offer) => namesSameProduct(words, resolvedId, { productId: offer.product.id, title: offer.product.name }, dictionary));
    const view = empty(statement, index);
    for (const offer of sameProduct) {
      if (!fitsVariant(statement.variant, offer)) {
        view.others.push({ offerId: offer.id, title: offer.product.name, packLabel: offer.packLabel });
        continue;
      }
      view.candidates.push({
        offerId: offer.id,
        revision: offer.revision,
        title: offer.product.name,
        packLabel: offer.packLabel,
        price: offer.price ? { amount: offer.price.amount, unit: offer.price.unit } : null,
        ...candidateStatus(offer, tracked),
      });
    }
    views.push(view);
  }
  return views;
}
