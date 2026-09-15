import { and, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { locations } from '../../locations/db/locations.table';
import { sellers } from '../../sellers/db/sellers.table';
import { offers } from '../db/offers.table';
import { buyerVisibleOffersPredicate } from '../visibility/buyer-offer-visibility';

export type BuyerOfferRouteDestination = {
  latitude: number;
  longitude: number;
};

export async function findBuyerOfferRouteDestination(
  database: Database,
  offerId: string,
  cutoff: Date,
): Promise<BuyerOfferRouteDestination | null> {
  const rows = await database.select({
    latitude: locations.latitude,
    longitude: locations.longitude,
  }).from(offers)
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(locations, eq(locations.id, offers.locationId))
    .where(and(
      eq(offers.id, offerId),
      buyerVisibleOffersPredicate(cutoff),
    ))
    .limit(1);

  const row = rows[0];
  if (!row || row.latitude === null || row.longitude === null) return null;
  return { latitude: row.latitude, longitude: row.longitude };
}
