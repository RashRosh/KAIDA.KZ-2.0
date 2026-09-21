import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import type { LocationIdentityInput, LocationView } from '../contracts/location.contract';
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

  return createLocation(database, {
    sellerId: seller.id,
    name: input.name,
    type: input.type,
    addressText: input.addressText,
  });
}
