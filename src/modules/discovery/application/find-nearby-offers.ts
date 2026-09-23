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
import { buyerLocationSchema, type BuyerLocation } from '../../search/contracts/buyer-location.contract';
import {
  readNearbyRadiusMeters,
  validateNearbyRadiusMeters,
} from '../config/discovery.config';
import type { NearbyResponse } from '../contracts/discovery.contract';
import { findVisibleDiscoveryCandidates } from '../infrastructure/discovery.repository';
import { selectNearbyOffers } from '../ranking/nearby-discovery';
import type { Locale } from '../../../i18n/config';

type NearbyDiscoveryOptions = {
  clock?: Clock;
  validityPeriodHours?: number;
  nearbyRadiusMeters?: number;
  locale?: Locale;
  commentTranslationEnabled?: boolean;
};

export async function findNearbyOffers(
  input: BuyerLocation,
  database?: Database,
  options: NearbyDiscoveryOptions = {},
): Promise<NearbyResponse> {
  const buyerLocation = buyerLocationSchema.parse(input);
  const now = (options.clock ?? systemClock)();
  const validityPeriodHours = options.validityPeriodHours === undefined
    ? readOfferValidityPeriodHours()
    : validateOfferValidityPeriodHours(options.validityPeriodHours);
  const nearbyRadiusMeters = options.nearbyRadiusMeters === undefined
    ? readNearbyRadiusMeters()
    : validateNearbyRadiusMeters(options.nearbyRadiusMeters);
  const cutoff = calculateOfferCutoff(now, validityPeriodHours);
  const db = database ?? getDatabase();
  const candidates = options.locale === undefined && options.commentTranslationEnabled === undefined
    ? await findVisibleDiscoveryCandidates(db, cutoff)
    : await findVisibleDiscoveryCandidates(db, cutoff, options.locale, options.commentTranslationEnabled);

  return {
    offers: selectNearbyOffers(candidates, buyerLocation, nearbyRadiusMeters),
  };
}
