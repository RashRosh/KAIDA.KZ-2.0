import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import type { SellerContacts } from '../contracts/seller-contact.contract';
import { sellers } from '../db/sellers.table';

export type SellerContactsDb = Pick<Database, 'select' | 'update'>;

const contactSelection = {
  phoneE164: sellers.contactPhoneE164,
  whatsappPhoneE164: sellers.whatsappPhoneE164,
  telegramUsername: sellers.telegramUsername,
  instagramUsername: sellers.instagramUsername,
};

export async function findSellerContactsByOwner(
  database: SellerContactsDb,
  ownerUserId: string,
): Promise<SellerContacts | null> {
  const rows = await database
    .select(contactSelection)
    .from(sellers)
    .where(eq(sellers.ownerUserId, ownerUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function replaceSellerContactsByOwner(
  database: SellerContactsDb,
  ownerUserId: string,
  contacts: SellerContacts,
): Promise<SellerContacts | null> {
  const rows = await database
    .update(sellers)
    .set({
      contactPhoneE164: contacts.phoneE164,
      whatsappPhoneE164: contacts.whatsappPhoneE164,
      telegramUsername: contacts.telegramUsername,
      instagramUsername: contacts.instagramUsername,
    })
    .where(eq(sellers.ownerUserId, ownerUserId))
    .returning(contactSelection);
  return rows[0] ?? null;
}
