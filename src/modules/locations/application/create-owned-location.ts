import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import type { LocationIdentityInput, LocationView } from '../contracts/location.contract';
import { findLatestPointDetails } from '../details/point-details.repository';
import { createLocation } from '../infrastructure/locations.repository';
import { SellerRequiredError } from './location-errors';
import { findActiveAddressDirectoryEntry } from '../../address-directory/infrastructure/address-directory.repository';
import { AddressDirectoryEntryNotFoundError } from '../../address-directory/application/address-directory-errors';

export async function createOwnedLocation(
  ownerUserId: string,
  input: LocationIdentityInput,
  dependencies: { database?: Database } = {},
): Promise<LocationView> {
  const database = dependencies.database ?? getDatabase();
  return database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new SellerRequiredError();
    const selected = input.addressDirectoryEntryId
      ? await findActiveAddressDirectoryEntry(tx, input.addressDirectoryEntryId)
      : null;
    if (input.addressDirectoryEntryId && !selected) throw new AddressDirectoryEntryNotFoundError();

    // point-contacts-hours §2: a new point starts with the contacts and hours of the Seller's latest point.
    const latest = await findLatestPointDetails(tx, seller.id);
    return createLocation(tx, {
      sellerId: seller.id,
      name: input.name,
      type: input.type,
      addressText: selected?.addressText ?? input.addressText,
      ...(selected ? { geo: { latitude: selected.latitude, longitude: selected.longitude } } : {}),
      ...(latest ? {
        details: {
          phoneE164: latest.phoneE164,
          whatsappPhoneE164: latest.whatsappPhoneE164,
          openingHours: latest.openingHours,
          openingHoursNeedsReview: latest.openingHoursNeedsReview,
        },
      } : {}),
    });
  });
}
