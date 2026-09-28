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
import type { Locale } from '../../../i18n/config';

type SearchLifecycleOptions = {
  clock?: Clock;
  validityPeriodHours?: number;
  buyerLocation?: BuyerLocation;
  locale?: Locale;
  commentTranslationEnabled?: boolean;
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
  const offers = rankSearchOfferCandidates(candidates, lifecycleOptions.buyerLocation, ageingSince(now, policy))
    .map(({ offer, lastConfirmedAt }) => ({ ...offer, actuality: buyerActuality(lastConfirmedAt, now, policy) }));
  return { query, offers };
}
