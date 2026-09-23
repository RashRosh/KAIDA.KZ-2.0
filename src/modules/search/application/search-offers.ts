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
import { findOffersByProductId } from '../infrastructure/search.repository';
import { rankSearchOfferCandidates } from '../ranking/search-ranking';
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
  const resolution = await resolveProduct(db, query);
  if (resolution.status !== 'resolved') return { query, offers: [] };

  const { locale, commentTranslationEnabled } = lifecycleOptions;
  const candidates = locale === undefined && commentTranslationEnabled === undefined
    ? await findOffersByProductId(db, resolution.product.id, cutoff)
    : await findOffersByProductId(db, resolution.product.id, cutoff, locale, commentTranslationEnabled);
  const offers = rankSearchOfferCandidates(candidates, lifecycleOptions.buyerLocation)
    .map(({ offer }) => offer);
  return { query, offers };
}
