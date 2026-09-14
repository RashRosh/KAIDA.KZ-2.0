import {
  sellerContactPhoneE164Schema,
  sellerInstagramUsernameSchema,
  sellerTelegramUsernameSchema,
  type SellerPublicContacts,
} from '../contracts/seller-contact.contract';

export type ContactAction = {
  label: 'Позвонить' | 'WhatsApp' | 'Telegram' | 'Instagram';
  href: string;
};

export function buildContactActions(contacts: SellerPublicContacts): ContactAction[] {
  const actions: ContactAction[] = [];

  const phone = sellerContactPhoneE164Schema.safeParse(contacts.phoneE164);
  if (phone.success) actions.push({ label: 'Позвонить', href: `tel:${phone.data}` });

  const whatsapp = sellerContactPhoneE164Schema.safeParse(contacts.whatsappPhoneE164);
  if (whatsapp.success) actions.push({ label: 'WhatsApp', href: `https://wa.me/${whatsapp.data.slice(1)}` });

  const telegram = sellerTelegramUsernameSchema.safeParse(contacts.telegramUsername);
  if (telegram.success) actions.push({ label: 'Telegram', href: `https://t.me/${encodeURIComponent(telegram.data)}` });

  const instagram = sellerInstagramUsernameSchema.safeParse(contacts.instagramUsername);
  if (instagram.success) actions.push({ label: 'Instagram', href: `https://www.instagram.com/${encodeURIComponent(instagram.data)}/` });

  return actions;
}
