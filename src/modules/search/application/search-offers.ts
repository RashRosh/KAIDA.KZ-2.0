import { getDatabase, type Database } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
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
import { searchQuerySchema, type SearchResponse } from '../contracts/search.contract';
import { findOffersByProductOrTitleWords } from '../infrastructure/search.repository';
import { queryWords } from '../../offers/title/offer-title';
import { rankSearchOfferCandidates } from '../ranking/search-ranking';
import { ageingSince, buyerActuality, readActualityPolicy } from '../../offers/actuality/actuality';
import { readSearchRankingPolicy, type SearchSortMode } from '../config/search-ranking-policy.config';
import type { Locale } from '../../../i18n/config';

type SearchLifecycleOptions = {
  clock?: Clock;
  validityPeriodHours?: number;
  buyerLocation?: BuyerLocation;
  locale?: Locale;
  commentTranslationEnabled?: boolean;
  // stage #5: the buyer picks only the mode; the server-side SearchRankingPolicy maps it onto the current weights.
  sortMode?: SearchSortMode;
};

export async function searchOffers(
  input: string,
  database?: Database,
  lifecycleOptions: SearchLifecycleOptions = {},
): Promise<SearchResponse> {
  const query = searchQuerySchema.parse(input);
  const now = (lifecycleOptions.clock ?? systemClock)();
  const validityPeriodHours = lifecycleOptions.validityPeriodHours === undefined
    ? readOfferValidityPeriodHours()
    : validateOfferValidityPeriodHours(lifecycleOptions.validityPeriodHours);
  const cutoff = calculateOfferCutoff(now, validityPeriodHours);
  const db = database ?? getDatabase();
  // seller-showcase-editor: the catalog (names and aliases) and the words of the Seller's own titles both find Offers.
  const resolution = await resolveProduct(db, query);
  const match = {
    productId: resolution.status === 'resolved' ? resolution.product.id : null,
    words: queryWords(query),
  };
  if (match.productId === null && match.words.length === 0) return { query, offers: [] };

  const { locale, commentTranslationEnabled } = lifecycleOptions;
  const candidates = locale === undefined && commentTranslationEnabled === undefined
    ? await findOffersByProductOrTitleWords(db, match, cutoff)
    : await findOffersByProductOrTitleWords(db, match, cutoff, locale, commentTranslationEnabled);
  const policy = readActualityPolicy();
  const actuality = ageingSince(now, policy);
  const ranked = rankSearchOfferCandidates(candidates, lifecycleOptions.buyerLocation, actuality, {
    now,
    actualityPolicy: policy,
    rankingPolicy: readSearchRankingPolicy(),
    sortMode: lifecycleOptions.sortMode ?? 'actuality',
  });
  const offers = ranked.map(({ offer, lastConfirmedAt, rankingDistanceMeters }) => ({
    ...offer,
    actuality: buyerActuality(lastConfirmedAt, now, policy),
    // stage #5: the derived whole-meter distance is public only when the request carried the buyer location;
    // a geo-less Offer (or a location-less request) exposes no distance at all.
    ...(lifecycleOptions.buyerLocation && rankingDistanceMeters !== null
      ? { distanceMeters: rankingDistanceMeters }
      : {}),
  }));
  return { query, offers };
}
