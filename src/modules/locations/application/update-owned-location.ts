import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import type { LocationIdentityInput, LocationView } from '../contracts/location.contract';
import { updateLocationIdentity } from '../infrastructure/locations.repository';
import { LocationNotFoundError } from './location-errors';

export async function updateOwnedLocation(
  ownerUserId: string,
  locationId: string,
  input: LocationIdentityInput,
  dependencies: { database?: Database } = {},
): Promise<LocationView> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new LocationNotFoundError();

  const location = await updateLocationIdentity(database, {
    sellerId: seller.id,
    locationId,
    identity: input,
  });
  if (!location) throw new LocationNotFoundError();
  return location;
}
