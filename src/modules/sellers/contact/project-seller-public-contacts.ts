import {
  sellerContactPhoneE164Schema,
  sellerInstagramUsernameSchema,
  sellerTelegramUsernameSchema,
  type SellerPublicContacts,
} from '../contracts/seller-contact.contract';

export type RawPersistedSellerContacts = {
  phoneE164: unknown;
  whatsappPhoneE164: unknown;
  telegramUsername: unknown;
  instagramUsername: unknown;
};

export type SellerPublicContactProperty = {} | { contacts: SellerPublicContacts };

export function projectSellerPublicContactProperty(
  input: RawPersistedSellerContacts,
): SellerPublicContactProperty {
  const contacts: Record<string, string> = {};

  const phone = sellerContactPhoneE164Schema.safeParse(input.phoneE164);
  if (phone.success) contacts.phoneE164 = phone.data;

  const whatsapp = sellerContactPhoneE164Schema.safeParse(input.whatsappPhoneE164);
  if (whatsapp.success) contacts.whatsappPhoneE164 = whatsapp.data;

  const telegram = sellerTelegramUsernameSchema.safeParse(input.telegramUsername);
  if (telegram.success) contacts.telegramUsername = telegram.data;

  const instagram = sellerInstagramUsernameSchema.safeParse(input.instagramUsername);
  if (instagram.success) contacts.instagramUsername = instagram.data;

  if (Object.keys(contacts).length === 0) return {};
  return { contacts: contacts as SellerPublicContacts };
}
