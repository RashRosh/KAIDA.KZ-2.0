import { getDatabase, type Database } from '../../../db/client';
import {
  readOfferValidityPeriodHours,
  validateOfferValidityPeriodHours,
} from '../config/offer-lifecycle.config';
import {
  calculateOfferCutoff,
  systemClock,
  type Clock,
} from '../lifecycle/offer-lifecycle';
import {
  findBuyerOfferRouteDestination,
  type BuyerOfferRouteDestination,
} from '../infrastructure/buyer-offer-route.repository';

type BuyerOfferRouteOptions = {
  database?: Database;
  clock?: Clock;
  validityPeriodHours?: number;
};

export async function resolveBuyerOfferRoute(
  offerId: string,
  options: BuyerOfferRouteOptions = {},
): Promise<BuyerOfferRouteDestination | null> {
  const now = (options.clock ?? systemClock)();
  const validityPeriodHours = options.validityPeriodHours === undefined
    ? readOfferValidityPeriodHours()
    : validateOfferValidityPeriodHours(options.validityPeriodHours);
  const cutoff = calculateOfferCutoff(now, validityPeriodHours);
  return findBuyerOfferRouteDestination(options.database ?? getDatabase(), offerId, cutoff);
}
