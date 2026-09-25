import { getDatabase, type Database } from '../../../db/client';
import {
  readOfferValidityPeriodHours,
  validateOfferValidityPeriodHours,
} from '../../offers/config/offer-lifecycle.config';
import { findOfferPhotoIds } from '../../offers/infrastructure/offers.repository';
import { calculateOfferCutoff, systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import type { Locale } from '../../../i18n/config';
import type { SearchOffer } from '../contracts/search.contract';
import { findBuyerVisibleOfferById } from '../infrastructure/search.repository';

export type BuyerOfferPage = SearchOffer & {
  photos: { id: string }[];
  lastConfirmedAt: string;
};

// Read model of the buyer Offer page. Returns null for anything Search would not show right now.
export async function getBuyerOffer(
  offerId: string,
  options: { database?: Database; clock?: Clock; validityPeriodHours?: number; locale?: Locale } = {},
): Promise<BuyerOfferPage | null> {
  const database = options.database ?? getDatabase();
  const validityPeriodHours = options.validityPeriodHours === undefined
    ? readOfferValidityPeriodHours()
    : validateOfferValidityPeriodHours(options.validityPeriodHours);
  const cutoff = calculateOfferCutoff((options.clock ?? systemClock)(), validityPeriodHours);
  const candidate = await findBuyerVisibleOfferById(database, offerId, cutoff, options.locale ?? 'ru');
  if (!candidate) return null;
  const photoIds = await findOfferPhotoIds(database, offerId);
  return {
    ...candidate.offer,
    photos: photoIds.map((id) => ({ id })),
    lastConfirmedAt: candidate.lastConfirmedAt.toISOString(),
  };
}
