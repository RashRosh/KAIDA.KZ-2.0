import { getDatabase, type Database } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { findCatalogProductById } from '../../catalog/infrastructure/products.repository';
import {
  readOfferValidityPeriodHours,
  validateOfferValidityPeriodHours,
} from '../../offers/config/offer-lifecycle.config';
import {
  calculateOfferCutoff,
  systemClock,
  type Clock,
} from '../../offers/lifecycle/offer-lifecycle';
import type { BuyerLocation } from '../contracts/buyer-location.contract';
import { resolveSearchOrder, searchQuerySchema, type SearchResponse, type SearchSortDirection, type SearchSortMode } from '../contracts/search.contract';
import { findOffersByProductOrTitleWords } from '../infrastructure/search.repository';
import { queryWords } from '../../offers/title/offer-title';
import { rankSearchOfferCandidates } from '../ranking/search-ranking';
import { classifyMatchLevel } from '../ranking/search-relevance';
import { buyerActuality, readActualityPolicy } from '../../offers/actuality/actuality';
import type { Locale } from '../../../i18n/config';

type SearchLifecycleOptions = {
  clock?: Clock;
  validityPeriodHours?: number;
  buyerLocation?: BuyerLocation;
  locale?: Locale;
  commentTranslationEnabled?: boolean;
  // Stage 6 Rev 3: the explicit sort criterion (default actuality) and its direction (default: the natural one).
  sort?: SearchSortMode;
  direction?: SearchSortDirection;
  // S15B-3/4a: the Product the buyer selected from the suggestions; it joins the candidate set as a signal.
  productId?: string;
};

// S15C / D0: how the Search response was reached, for the internal search event only — never part of the public response.
export type SearchResolutionKind = 'selected' | 'resolved' | 'ambiguous' | 'unresolved';
export type SearchOutcome = { response: SearchResponse; resolution: SearchResolutionKind };

export async function searchOffers(
  input: string,
  database?: Database,
  lifecycleOptions: SearchLifecycleOptions = {},
): Promise<SearchResponse> {
  return (await searchOffersDetailed(input, database, lifecycleOptions)).response;
}

export async function searchOffersDetailed(
  input: string,
  database?: Database,
  lifecycleOptions: SearchLifecycleOptions = {},
): Promise<SearchOutcome> {
  const query = searchQuerySchema.parse(input);
  const now = (lifecycleOptions.clock ?? systemClock)();
  const validityPeriodHours = lifecycleOptions.validityPeriodHours === undefined
    ? readOfferValidityPeriodHours()
    : validateOfferValidityPeriodHours(lifecycleOptions.validityPeriodHours);
  const cutoff = calculateOfferCutoff(now, validityPeriodHours);
  const db = database ?? getDatabase();
  // S15B-4a: the candidate set is the union of every deterministic source — the selected Product, the Product the exact
  // resolver finds for the text, and the words of the Seller's own titles. A selected Product is a signal, not a filter;
  // a stale or unknown id contributes nothing and the text search runs as usual.
  const selected = lifecycleOptions.productId === undefined
    ? null
    : await findCatalogProductById(db, lifecycleOptions.productId);
  const resolverResult = await resolveProduct(db, query);
  const resolved = resolverResult.status === 'resolved' ? resolverResult.product : null;
  const known = selected ?? resolved;
  // S15C / D0: a found selected Product wins (as for `resolvedProduct`); a stale id is ignored and the resolver decides.
  const resolution: SearchResolutionKind = selected !== null ? 'selected'
    : resolved !== null ? 'resolved'
      : resolverResult.status === 'ambiguous' ? 'ambiguous' : 'unresolved';
  const resolvedProduct = known === null ? null : { id: known.id, name: known.name };
  const match = {
    productIds: [...new Set([selected?.id, resolved?.id].filter((id): id is string => id !== undefined))],
    words: queryWords(query),
  };
  if (match.productIds.length === 0 && match.words.length === 0) return { response: { query, resolvedProduct, offers: [] }, resolution };

  const { locale, commentTranslationEnabled } = lifecycleOptions;
  const candidates = locale === undefined && commentTranslationEnabled === undefined
    ? await findOffersByProductOrTitleWords(db, match, cutoff)
    : await findOffersByProductOrTitleWords(db, match, cutoff, locale, commentTranslationEnabled);
  const policy = readActualityPolicy();
  // S15B-4b: no sort and no direction → relevance; a direction alone keeps its legacy meaning (actuality).
  const order = resolveSearchOrder(lifecycleOptions.sort, lifecycleOptions.direction);
  if (order === null) throw new Error('A relevance order has no direction');
  const applicableProductId = resolved?.id ?? null;
  const words = match.words;
  const leveled = order.sort === 'relevance'
    ? candidates.map((candidate) => ({
      ...candidate,
      matchLevel: classifyMatchLevel({ title: candidate.offer.product.name, productId: candidate.offer.product.id, applicableProductId, words }),
    }))
    : candidates;
  const ranked = rankSearchOfferCandidates(leveled, lifecycleOptions.buyerLocation, order);
  const offers = ranked.map(({ offer, lastConfirmedAt, rankingDistanceMeters }) => ({
    ...offer,
    actuality: buyerActuality(lastConfirmedAt, now, policy),
    // stage #5: the derived whole-meter distance is public only when the request carried the buyer location;
    // a geo-less Offer (or a location-less request) exposes no distance at all.
    ...(lifecycleOptions.buyerLocation && rankingDistanceMeters !== null
      ? { distanceMeters: rankingDistanceMeters }
      : {}),
  }));
  return { response: { query, resolvedProduct, offers }, resolution };
}
