import type { PointPublicContacts } from '../../locations/details/point-public-contacts';
import { TELEGRAM_USERNAME_PATTERN, telegramLink } from '../../locations/details/telegram-username';

export type ContactAction = {
  label: 'Позвонить' | 'WhatsApp' | 'Telegram';
  href: string;
};

// KAIDA builds the targets from verified structured numbers (S10 rule, point-contacts-hours revision).
export function buildContactActions(contacts: PointPublicContacts): ContactAction[] {
  const actions: ContactAction[] = [];
  if (contacts.phoneE164) actions.push({ label: 'Позвонить', href: `tel:${contacts.phoneE164}` });
  if (contacts.whatsappPhoneE164) actions.push({ label: 'WhatsApp', href: `https://wa.me/${contacts.whatsappPhoneE164.slice(1)}` });
  // The host is always t.me and the username must be a valid one: nothing Seller-typed can change scheme or host.
  if (contacts.telegramUsername && TELEGRAM_USERNAME_PATTERN.test(contacts.telegramUsername)) actions.push({ label: 'Telegram', href: telegramLink(contacts.telegramUsername) });
  return actions;
}
