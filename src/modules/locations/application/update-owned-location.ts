import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import type { LocationIdentityInput, LocationView } from '../contracts/location.contract';
import { updateLocationIdentity } from '../infrastructure/locations.repository';
import { LocationNotFoundError } from './location-errors';
import { findActiveAddressDirectoryEntry } from '../../address-directory/infrastructure/address-directory.repository';
import { AddressDirectoryEntryNotFoundError } from '../../address-directory/application/address-directory-errors';

export async function updateOwnedLocation(
  ownerUserId: string,
  locationId: string,
  input: LocationIdentityInput,
  dependencies: { database?: Database } = {},
): Promise<LocationView> {
  const database = dependencies.database ?? getDatabase();
  return database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new LocationNotFoundError();
    const selected = input.addressDirectoryEntryId
      ? await findActiveAddressDirectoryEntry(tx, input.addressDirectoryEntryId)
      : null;
    if (input.addressDirectoryEntryId && !selected) throw new AddressDirectoryEntryNotFoundError();

    const location = await updateLocationIdentity(tx, {
      sellerId: seller.id,
      locationId,
      identity: { ...input, addressText: selected?.addressText ?? input.addressText },
      ...(selected ? { selectedGeo: { latitude: selected.latitude, longitude: selected.longitude } } : {}),
    });
    if (!location) throw new LocationNotFoundError();
    return location;
  });
}
