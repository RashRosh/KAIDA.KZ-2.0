import { z } from 'zod';

export const sellerContactPhoneE164Schema = z.string().regex(/^\+[1-9][0-9]{1,14}$/);
export const sellerTelegramUsernameSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);
export const sellerInstagramUsernameSchema = z.string().regex(/^[a-z0-9._]{1,64}$/);

export const sellerContactsSchema = z.object({
  phoneE164: sellerContactPhoneE164Schema.nullable(),
  whatsappPhoneE164: sellerContactPhoneE164Schema.nullable(),
  telegramUsername: sellerTelegramUsernameSchema.nullable(),
  instagramUsername: sellerInstagramUsernameSchema.nullable(),
}).strict();

// PUT /api/seller/contacts is a complete replacement, never a patch.
export const sellerContactsReplacementSchema = sellerContactsSchema;

export const sellerPublicContactsSchema = z.object({
  phoneE164: sellerContactPhoneE164Schema.optional(),
  whatsappPhoneE164: sellerContactPhoneE164Schema.optional(),
  telegramUsername: sellerTelegramUsernameSchema.optional(),
  instagramUsername: sellerInstagramUsernameSchema.optional(),
}).strict().refine((contacts) => Object.keys(contacts).length > 0, {
  message: 'At least one Seller contact channel is required',
});

export type SellerContacts = z.infer<typeof sellerContactsSchema>;
export type SellerPublicContacts = z.infer<typeof sellerPublicContactsSchema>;
