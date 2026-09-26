import { z } from 'zod';

const e164 = z.string().regex(/^\+[1-9][0-9]{1,14}$/);

// Buyer-facing contacts of a point: only numbers the Seller has verified; an empty set is omitted, never `{}`.
export const pointPublicContactsSchema = z.object({
  phoneE164: e164.optional(),
  whatsappPhoneE164: e164.optional(),
}).strict().refine((contacts) => Object.keys(contacts).length > 0, { message: 'At least one point contact is required' });

export type PointPublicContacts = z.infer<typeof pointPublicContactsSchema>;

export function projectPointPublicContacts(
  point: { phoneE164: string | null; whatsappPhoneE164: string | null },
  verified: Set<string> | undefined,
): { contacts?: PointPublicContacts } {
  const contacts: PointPublicContacts = {};
  if (point.phoneE164 && verified?.has(point.phoneE164)) contacts.phoneE164 = point.phoneE164;
  if (point.whatsappPhoneE164 && verified?.has(point.whatsappPhoneE164)) contacts.whatsappPhoneE164 = point.whatsappPhoneE164;
  return Object.keys(contacts).length > 0 ? { contacts } : {};
}
