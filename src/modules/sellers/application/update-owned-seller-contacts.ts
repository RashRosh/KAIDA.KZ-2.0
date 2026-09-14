import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import type { SellerContacts } from '../contracts/seller-contact.contract';
import { normalizeSellerContacts } from '../contact/normalize-seller-contacts';
import { replaceSellerContactsByOwner } from '../infrastructure/seller-contacts.repository';

export async function updateOwnedSellerContacts(
  ownerUserId: string,
  input: unknown,
  dependencies: { database?: Database } = {},
): Promise<SellerContacts | null> {
  const contacts = normalizeSellerContacts(input);
  const database = dependencies.database ?? getDatabase();
  return replaceSellerContactsByOwner(database, ownerUserId, contacts);
}
