import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import type { LocationView } from '../contracts/location.contract';
import { listLocationsBySeller } from '../infrastructure/locations.repository';
import { SellerRequiredError } from './location-errors';

// The trading points of the signed-in owner only; another Seller's points are never part of the result.
export async function listOwnedLocations(ownerUserId: string, dependencies: { database?: Database } = {}): Promise<LocationView[]> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new SellerRequiredError();
  return listLocationsBySeller(database, seller.id);
}
