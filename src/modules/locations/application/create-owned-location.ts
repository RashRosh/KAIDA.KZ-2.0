import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import type { LocationIdentityInput, LocationView } from '../contracts/location.contract';
import { findLatestPointDetails } from '../details/point-details.repository';
import { createLocation } from '../infrastructure/locations.repository';
import { SellerRequiredError } from './location-errors';

export async function createOwnedLocation(
  ownerUserId: string,
  input: LocationIdentityInput,
  dependencies: { database?: Database } = {},
): Promise<LocationView> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new SellerRequiredError();

  // point-contacts-hours §2: a new point starts with the contacts and hours of the Seller's latest point.
  const latest = await findLatestPointDetails(database, seller.id);
  return createLocation(database, {
    sellerId: seller.id,
    name: input.name,
    type: input.type,
    addressText: input.addressText,
    ...(latest ? {
      details: {
        phoneE164: latest.phoneE164,
        whatsappPhoneE164: latest.whatsappPhoneE164,
        openingHours: latest.openingHours,
        openingHoursNeedsReview: latest.openingHoursNeedsReview,
      },
    } : {}),
  });
}
