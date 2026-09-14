import { describe, expect, it } from 'vitest';
import { sellerContactsReplacementSchema } from '../../src/modules/sellers/contracts/seller-contact.contract';

type SellerContactsReplacement = {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};

function body(overrides: Partial<SellerContactsReplacement> = {}): SellerContactsReplacement {
  return {
    phoneE164: null,
    whatsappPhoneE164: null,
    telegramUsername: null,
    instagramUsername: null,
    ...overrides,
  };
}

describe('S10 canonical Seller contacts replacement validation', () => {
  it.each([
    '+447911123456',
    '+12025550123',
    '+77001234567',
  ])('accepts canonical full E.164 %s', (phoneE164) => {
    expect(sellerContactsReplacementSchema.parse(body({ phoneE164 })).phoneE164).toBe(phoneE164);
  });

  it.each([
    '8 (700) 123-45-67',
    '77001234567',
    '+7 700 123 45 67',
    '+07001234567',
    '+7abc001234567',
    'tel:+77001234567',
    'https://wa.me/77001234567',
    '+1234567890123456',
  ])('rejects non-canonical phone value %s', (phoneE164) => {
    expect(sellerContactsReplacementSchema.safeParse(body({ phoneE164 })).success).toBe(false);
  });

  it('keeps ordinary phone and WhatsApp phone independent', () => {
    expect(sellerContactsReplacementSchema.parse(body({
      phoneE164: '+12025550123',
      whatsappPhoneE164: '+447911123456',
    }))).toEqual({
      phoneE164: '+12025550123',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: null,
      instagramUsername: null,
    });
  });

  it.each(['kaida_shop', 'a', 'x'.repeat(64)])('accepts canonical Telegram username %s', (telegramUsername) => {
    expect(sellerContactsReplacementSchema.safeParse(body({ telegramUsername })).success).toBe(true);
  });

  it.each([
    '@kaida_shop',
    'Kaida_Shop',
    'https://t.me/kaida_shop',
    't.me/kaida_shop',
    '/kaida_shop',
    'kaida_shop?x=1',
    'kaida_shop#x',
    'kaida-shop',
    'x'.repeat(65),
  ])('rejects non-canonical or URL-like Telegram value %s', (telegramUsername) => {
    expect(sellerContactsReplacementSchema.safeParse(body({ telegramUsername })).success).toBe(false);
  });

  it.each(['kaida.shop', 'kaida_shop', '.leading', 'trailing.', 'two..dots', 'x'.repeat(64)])(
    'accepts canonical Instagram username %s',
    (instagramUsername) => {
      expect(sellerContactsReplacementSchema.safeParse(body({ instagramUsername })).success).toBe(true);
    },
  );

  it.each([
    '@kaida.shop',
    'Kaida.Shop',
    'https://instagram.com/kaida.shop',
    'instagram.com/kaida.shop',
    '/kaida.shop',
    'kaida.shop?x=1',
    'kaida.shop#x',
    'kaida-shop',
    'x'.repeat(65),
  ])('rejects non-canonical or URL-like Instagram value %s', (instagramUsername) => {
    expect(sellerContactsReplacementSchema.safeParse(body({ instagramUsername })).success).toBe(false);
  });

  it('requires all four full-replacement keys and rejects ownership or target extras', () => {
    const valid = body();
    expect(sellerContactsReplacementSchema.safeParse(valid).success).toBe(true);
    expect(sellerContactsReplacementSchema.safeParse({
      phoneE164: null,
      whatsappPhoneE164: null,
      telegramUsername: null,
    }).success).toBe(false);
    for (const extra of [
      { sellerId: '20000000-0000-4000-8000-000000000001' },
      { ownerUserId: '50000000-0000-4000-8000-000000000001' },
      { url: 'https://evil.example' },
      { href: 'javascript:alert(1)' },
    ]) {
      expect(sellerContactsReplacementSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });
});
