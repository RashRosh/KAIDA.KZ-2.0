import type { PointPublicContacts } from '../../locations/details/point-public-contacts';

export type ContactAction = {
  label: 'Позвонить' | 'WhatsApp';
  href: string;
};

// KAIDA builds the targets from verified structured numbers (S10 rule, point-contacts-hours revision).
export function buildContactActions(contacts: PointPublicContacts): ContactAction[] {
  const actions: ContactAction[] = [];
  if (contacts.phoneE164) actions.push({ label: 'Позвонить', href: `tel:${contacts.phoneE164}` });
  if (contacts.whatsappPhoneE164) actions.push({ label: 'WhatsApp', href: `https://wa.me/${contacts.whatsappPhoneE164.slice(1)}` });
  return actions;
}
