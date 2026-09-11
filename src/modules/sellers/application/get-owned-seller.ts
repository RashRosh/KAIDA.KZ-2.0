import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { listLocationsBySeller } from '../../locations/infrastructure/locations.repository';
import type { SellerView } from '../contracts/seller.contract';
import { findSellerByOwner } from '../infrastructure/sellers.repository';

export async function getOwnedSeller(
  ownerUserId: string,
  dependencies: { database?: Database } = {},
): Promise<SellerView | null> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) return null;
  const locations = await listLocationsBySeller(database, seller.id);
  return { ...seller, locations };
}
