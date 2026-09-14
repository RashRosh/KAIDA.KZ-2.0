import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import type { SellerContacts } from '../contracts/seller-contact.contract';
import { findSellerContactsByOwner } from '../infrastructure/seller-contacts.repository';

export async function getOwnedSellerContacts(
  ownerUserId: string,
  dependencies: { database?: Database } = {},
): Promise<SellerContacts | null> {
  const database = dependencies.database ?? getDatabase();
  return findSellerContactsByOwner(database, ownerUserId);
}
