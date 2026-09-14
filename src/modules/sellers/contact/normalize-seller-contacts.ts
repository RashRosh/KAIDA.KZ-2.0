import {
  sellerContactPhoneE164Schema,
  sellerContactsInputSchema,
  sellerInstagramUsernameSchema,
  sellerTelegramUsernameSchema,
  type SellerContacts,
} from '../contracts/seller-contact.contract';

function normalizeOptionalPhone(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (sellerContactPhoneE164Schema.safeParse(trimmed).success) return trimmed;
  if (!/^[0-9+ ()-]+$/.test(trimmed)) throw new Error('Invalid Seller contact phone');

  const compact = trimmed.replace(/[ ()-]/g, '');
  let candidate: string;
  if (/^\+7[0-9]{10}$/.test(compact)) candidate = compact;
  else if (/^7[0-9]{10}$/.test(compact)) candidate = `+${compact}`;
  else if (/^8[0-9]{10}$/.test(compact)) candidate = `+7${compact.slice(1)}`;
  else throw new Error('Invalid Seller contact phone');

  return sellerContactPhoneE164Schema.parse(candidate);
}

function normalizeOptionalHandle(
  value: string | null,
  schema: typeof sellerTelegramUsernameSchema | typeof sellerInstagramUsernameSchema,
): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const withoutOptionalAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return schema.parse(withoutOptionalAt.toLowerCase());
}

export function normalizeSellerContacts(input: unknown): SellerContacts {
  const parsed = sellerContactsInputSchema.parse(input);
  return {
    phoneE164: normalizeOptionalPhone(parsed.phone),
    whatsappPhoneE164: normalizeOptionalPhone(parsed.whatsappPhone),
    telegramUsername: normalizeOptionalHandle(parsed.telegramUsername, sellerTelegramUsernameSchema),
    instagramUsername: normalizeOptionalHandle(parsed.instagramUsername, sellerInstagramUsernameSchema),
  };
}
