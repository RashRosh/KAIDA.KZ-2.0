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
import { searchQuerySchema, type SearchResponse } from '../contracts/search.contract';
import { findOffersByProductId } from '../infrastructure/search.repository';

type SearchLifecycleOptions = {
  clock?: Clock;
  validityPeriodHours?: number;
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
  const offers = await findOffersByProductId(db, resolution.product.id, cutoff);
  return { query, offers };
}
