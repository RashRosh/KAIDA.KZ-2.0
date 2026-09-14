import { describe, expect, it } from 'vitest';

type RawSellerContacts = {
  phone: string | null;
  whatsappPhone: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};

type CanonicalSellerContacts = {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};

type NormalizeModule = {
  normalizeSellerContacts(input: unknown): CanonicalSellerContacts;
};

async function loadNormalizer(): Promise<NormalizeModule> {
  const modulePath = '../../src/modules/sellers/contact/normalize-seller-contacts';
  return import(modulePath) as Promise<NormalizeModule>;
}

function body(overrides: Partial<RawSellerContacts> = {}): RawSellerContacts {
  return {
    phone: null,
    whatsappPhone: null,
    telegramUsername: null,
    instagramUsername: null,
    ...overrides,
  };
}

describe('S10 Seller public contact validation and normalization', () => {
  it.each([
    '+447911123456',
    '+12025550123',
    '+77001234567',
  ])('accepts generic canonical E.164 %s unchanged', async (phone) => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(normalizeSellerContacts(body({ phone })).phoneE164).toBe(phone);
  });

  it.each([
    ['+7 700 123 45 67', '+77001234567'],
    ['7 700 123 45 67', '+77001234567'],
    ['8 700 123 45 67', '+77001234567'],
    ['8 (700) 123-45-67', '+77001234567'],
  ])('normalizes KZ convenience form %s', async (input, expected) => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(normalizeSellerContacts(body({ phone: input })).phoneE164).toBe(expected);
  });

  it.each([
    '7700123456',
    '+07001234567',
    '+7abc001234567',
    '+44 7911 123456',
    '00 44 7911 123456',
    '8 700 123 45 67 ext 2',
    'tel:+77001234567',
    'https://wa.me/77001234567',
  ])('rejects malformed phone input %s', async (phone) => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(() => normalizeSellerContacts(body({ phone }))).toThrow();
  });

  it('keeps ordinary phone and WhatsApp phone independent', async () => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(normalizeSellerContacts(body({
      phone: '8 (700) 123-45-67',
      whatsappPhone: '+447911123456',
    }))).toMatchObject({
      phoneE164: '+77001234567',
      whatsappPhoneE164: '+447911123456',
    });
  });

  it('normalizes blank and null values to null independently', async () => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(normalizeSellerContacts({
      phone: '   ',
      whatsappPhone: null,
      telegramUsername: '\t',
      instagramUsername: '',
    })).toEqual({
      phoneE164: null,
      whatsappPhoneE164: null,
      telegramUsername: null,
      instagramUsername: null,
    });
  });

  it.each([
    ['@Kaida_Shop', 'kaida_shop'],
    [' KAIDA_SHOP ', 'kaida_shop'],
    ['a', 'a'],
    ['x'.repeat(64), 'x'.repeat(64)],
  ])('normalizes safe Telegram token %s', async (input, expected) => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(normalizeSellerContacts(body({ telegramUsername: input })).telegramUsername).toBe(expected);
  });

  it.each([
    'https://t.me/kaida_shop',
    't.me/kaida_shop',
    'javascript:alert',
    '/kaida_shop',
    'kaida_shop?x=1',
    'kaida_shop#x',
    '@@kaida_shop',
    'kaida-shop',
    'x'.repeat(65),
  ])('rejects unsafe Telegram input %s', async (telegramUsername) => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(() => normalizeSellerContacts(body({ telegramUsername }))).toThrow();
  });

  it.each([
    ['@Kaida.Shop', 'kaida.shop'],
    [' KAIDA_SHOP ', 'kaida_shop'],
    ['.leading', '.leading'],
    ['trailing.', 'trailing.'],
    ['two..dots', 'two..dots'],
    ['x'.repeat(64), 'x'.repeat(64)],
  ])('normalizes safe Instagram token without unapproved dot rules: %s', async (input, expected) => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(normalizeSellerContacts(body({ instagramUsername: input })).instagramUsername).toBe(expected);
  });

  it.each([
    'https://instagram.com/kaida.shop',
    'instagram.com/kaida.shop',
    'javascript:alert',
    '/kaida.shop',
    'kaida.shop?x=1',
    'kaida.shop#x',
    '@@kaida.shop',
    'kaida-shop',
    'x'.repeat(65),
  ])('rejects unsafe Instagram input %s', async (instagramUsername) => {
    const { normalizeSellerContacts } = await loadNormalizer();
    expect(() => normalizeSellerContacts(body({ instagramUsername }))).toThrow();
  });

  it('requires a strict full-replacement object with all four managed keys', async () => {
    const { normalizeSellerContacts } = await loadNormalizer();
    const valid = body();
    expect(() => normalizeSellerContacts({ ...valid, url: 'https://evil.example' })).toThrow();
    expect(() => normalizeSellerContacts({ ...valid, href: 'javascript:alert(1)' })).toThrow();
    expect(() => normalizeSellerContacts({ ...valid, sellerId: '20000000-0000-4000-8000-000000000001' })).toThrow();
    expect(() => normalizeSellerContacts({ ...valid, ownerUserId: '50000000-0000-4000-8000-000000000001' })).toThrow();
    expect(() => normalizeSellerContacts({
      phone: valid.phone,
      whatsappPhone: valid.whatsappPhone,
      telegramUsername: valid.telegramUsername,
    })).toThrow();
  });
});
