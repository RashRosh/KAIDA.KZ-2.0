import { getDatabase, type Database } from '../../../db/client';
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
import { findOffersByProductName } from '../infrastructure/search.repository';

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
  const offers = await findOffersByProductName(database ?? getDatabase(), query, cutoff);
  return { query, offers };
}
