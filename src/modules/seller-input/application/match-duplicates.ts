import type { Database } from '../../../db/client';
import type { Locale } from '../../../i18n/config';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { listOwnedOffers } from '../../offers/application/list-owned-offers';
import type { SellerOfferView } from '../../offers/contracts/seller-offer.contract';
import { samePackQuantity } from '../../offers/pack/pack';
import { queryWords, searchWords } from '../../offers/title/offer-title';
import { getWordFormDictionary, wordEvidence, type WordFormDictionary } from '../../search/word-forms/word-forms';
import type {
  DuplicateCandidate,
  DuplicateCheck,
  DuplicateDifference,
  DuplicateLineInput,
  DuplicateOutcome,
} from '../contracts/duplicates.contract';
import { namesSameProduct } from './match-availability';

// text-duplicates §3: the S-TEXT-AVAILABILITY matching only FINDS candidates; this module then compares the supported
// data (name both ways, pack, unit, price) and reports differences. It never decides that a line and a card are the same.

// Every word of `a` equals a word of `b` or a reviewed form of one.
function wordsIn(a: string, b: string, dictionary: WordFormDictionary): boolean {
  const words = searchWords(a);
  const target = new Set(searchWords(b));
  return words.length > 0 && words.every((word) => wordEvidence(word, target, dictionary) !== 'P');
}

export function compareNames(line: string, card: string, dictionary: WordFormDictionary = getWordFormDictionary()): DuplicateDifference | null {
  const lineInCard = wordsIn(line, card, dictionary);
  const cardInLine = wordsIn(card, line, dictionary);
  if (lineInCard && cardInLine) return null;
  if (lineInCard) return { kind: 'nameLonger', cardTitle: card };
  if (cardInLine) return { kind: 'nameShorter', cardTitle: card };
  return { kind: 'nameDiffers', cardTitle: card };
}

const amount = (value: string) => Number(value.replace(',', '.'));
const packKnown = (line: DuplicateLineInput) => line.pack !== null && !line.uncertain.includes('pack');

export function lineDifferences(line: DuplicateLineInput, offer: Pick<SellerOfferView, 'product' | 'pack' | 'price'>,
  dictionary: WordFormDictionary = getWordFormDictionary()): DuplicateDifference[] {
  const differences: DuplicateDifference[] = [];
  if (line.priceChoices && line.priceChoices.length > 1) differences.push({ kind: 'priceConflict', prices: line.priceChoices });
  else if (line.price === null || line.price.trim() === '') differences.push({ kind: 'priceNotStated' });
  else if (line.uncertain.includes('price')) differences.push({ kind: 'priceUncertain' });
  else if (!offer.price || amount(offer.price.amount) !== amount(line.price)) {
    differences.push({ kind: 'price', card: offer.price?.amount ?? '', text: line.price });
  }
  const name = compareNames(line.title, offer.product.name, dictionary);
  if (name) differences.push(name);
  if (line.possiblyMerged || line.uncertain.includes('title')) differences.push({ kind: 'nameUncertain' });
  if (line.uncertain.includes('pack')) differences.push({ kind: 'packUncertain' });
  else if (line.pack === null && offer.pack !== null) differences.push({ kind: 'packNotInText' });
  else if (line.pack !== null && offer.pack === null) differences.push({ kind: 'packNotInCard' });
  const cardUnit = offer.price?.unitChoice?.code ?? null;
  if (line.uncertain.includes('unit')) differences.push({ kind: 'unitUncertain' });
  else if (line.unit === null) { if (line.price) differences.push({ kind: 'unitNotInText' }); }
  else if (line.unit.code !== cardUnit) differences.push({ kind: 'unitDiffers', card: offer.price?.unit ?? null, text: line.unit.code });
  return differences;
}

const CANONICAL_UNITS = new Set(['kg', 'piece', 'liter', 'package']);

// text-price-update §3.1: a new price from this line may be proposed for this card — the card is on sale, the line's
// unit is known and equal to the card's (a unit change is out of scope), and the line has one bound price or a conflict
// to choose from. Whether the chosen price differs from the card's is checked with that price (`priceDiffers`).
export function priceEligible(line: DuplicateLineInput, card: Pick<SellerOfferView, 'status' | 'price'>): boolean {
  if (card.status !== 'active' || !card.price) return false;
  const cardUnit = card.price.unitChoice?.code ?? null;
  if (!line.unit || line.uncertain.includes('unit') || !CANONICAL_UNITS.has(line.unit.code) || line.unit.code !== cardUnit) return false;
  const conflict = (line.priceChoices?.length ?? 0) > 1;
  const single = line.price !== null && line.price.trim() !== '' && !line.uncertain.includes('price');
  return conflict || single;
}

export function priceDiffers(price: string, card: { price: { amount: string } | null }): boolean {
  return card.price !== null && amount(card.price.amount) !== amount(price);
}

export function returnEligible(line: DuplicateLineInput, card: Pick<SellerOfferView, 'status' | 'price' | 'removal'>): boolean {
  if (card.status !== 'inactive' || card.removal || !card.price) return false;
  const unit = line.unit?.code;
  if (!unit || line.uncertain.includes('unit') || !CANONICAL_UNITS.has(unit) || unit !== card.price.unitChoice?.code) return false;
  return (line.priceChoices?.length ?? 0) > 1 || line.price === null || line.price.trim() === '' || !line.uncertain.includes('price');
}

export function preselectedForReturn(line: DuplicateLineInput, candidates: DuplicateCandidate[]): string | null {
  if (candidates.length !== 1 || line.possiblyMerged || (line.priceChoices?.length ?? 0) > 1) return null;
  const only = candidates[0]!;
  if (!only.returnEligible || only.blocked || !only.packKnown || !packKnown(line)) return null;
  return only.differences.every((d) => d.kind === 'price' || d.kind === 'priceNotStated') ? only.offerId : null;
}

// text-price-update §3.2 (D-1): pre-selected only for exactly one candidate whose name, pack and unit are KNOWN on both
// sides and equal, with only the price different; unknown is never a match, a pack missing in the text never
// pre-selects, nor does a possibly merged line or a price taken from a conflict.
export function preselectedForPrice(line: DuplicateLineInput, candidates: DuplicateCandidate[]): string | null {
  if (candidates.length !== 1 || line.possiblyMerged || (line.priceChoices?.length ?? 0) > 1) return null;
  const [only] = candidates;
  if (!only!.priceEligible || !only!.packKnown || line.pack === null || line.uncertain.includes('pack')) return null;
  const kinds = only!.differences.map((difference) => difference.kind);
  return kinds.length === 1 && kinds[0] === 'price' ? only!.offerId : null;
}

// «Без изменений» only when name, pack and unit were compared and match, and the price is the same or not stated (D-3).
export function duplicateOutcome(candidates: DuplicateCandidate[]): DuplicateOutcome {
  if (candidates.length === 0) return 'gone';
  if (candidates.length > 1) return 'several';
  const [only] = candidates;
  if (only!.status === 'off') return 'off';
  if (only!.differences.length === 0) return 'same';
  if (only!.differences.every((difference) => difference.kind === 'priceNotStated')) return 'sameNoPrice';
  return 'differs';
}

// Candidates of each line among this Seller's cards at the point (archived stage excluded, as «Товары точки»). A card of
// the same product in another KNOWN pack is never a candidate; it is listed in `otherPacks` for a note.
export async function checkDuplicates(
  ownerUserId: string,
  locationId: string | null,
  lines: DuplicateLineInput[],
  dependencies: { database: Database; locale?: Locale },
): Promise<DuplicateCheck[]> {
  if (lines.length === 0) return [];
  if (locationId === null) return lines.map(() => ({ candidates: [], otherPacks: [] }));
  const { database } = dependencies;
  const offers = (await listOwnedOffers(ownerUserId, { database, locale: dependencies.locale }))
    .filter((offer) => offer.location.id === locationId && offer.actuality.stage !== 'archived')
    .sort((a, b) => a.product.name.localeCompare(b.product.name, 'ru') || (a.packLabel ?? '').localeCompare(b.packLabel ?? '', 'ru'));
  const dictionary = getWordFormDictionary();
  const checks: DuplicateCheck[] = [];
  for (const line of lines) {
    const resolution = await resolveProduct(database, line.title);
    const resolvedId = resolution.status === 'resolved' ? resolution.product.id : null;
    const words = queryWords(line.title);
    const check: DuplicateCheck = { candidates: [], otherPacks: [] };
    for (const offer of offers) {
      if (!namesSameProduct(words, resolvedId, { productId: offer.product.id, title: offer.product.name }, dictionary)) continue;
      if (packKnown(line) && offer.pack !== null && !samePackQuantity(offer.pack, line.pack!)) {
        check.otherPacks.push({ offerId: offer.id, title: offer.product.name, packLabel: offer.packLabel });
        continue;
      }
      check.candidates.push({
        offerId: offer.id,
        revision: offer.revision,
        cardId: offer.cardId,
        title: offer.product.name,
        packLabel: offer.packLabel,
        price: offer.price ? { amount: offer.price.amount, unit: offer.price.unit, unitChoice: offer.price.unitChoice } : null,
        status: offer.status === 'active' ? 'live' : 'off',
        differences: lineDifferences(line, offer, dictionary),
        priceEligible: priceEligible(line, offer),
        returnEligible: returnEligible(line, offer),
        packKnown: offer.pack !== null,
      });
    }
    checks.push(check);
  }
  return checks;
}
