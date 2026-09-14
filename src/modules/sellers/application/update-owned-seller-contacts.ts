import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { sellerContactsReplacementSchema, type SellerContacts } from '../contracts/seller-contact.contract';
import { replaceSellerContactsByOwner } from '../infrastructure/seller-contacts.repository';

export async function updateOwnedSellerContacts(
  ownerUserId: string,
  input: unknown,
  dependencies: { database?: Database } = {},
): Promise<SellerContacts | null> {
  const contacts = sellerContactsReplacementSchema.parse(input);
  const database = dependencies.database ?? getDatabase();
  return replaceSellerContactsByOwner(database, ownerUserId, contacts);
}
