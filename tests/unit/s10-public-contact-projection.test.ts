import { describe, expect, it } from 'vitest';
import { searchOfferSchema } from '../../src/modules/search/contracts/search.contract';

type RawPersistedContacts = {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};

type PublicContactProperty = {
  contacts?: {
    phoneE164?: string;
    whatsappPhoneE164?: string;
    telegramUsername?: string;
    instagramUsername?: string;
  };
};

type ProjectionModule = {
  projectSellerPublicContactProperty(input: RawPersistedContacts): PublicContactProperty;
};

async function loadProjector(): Promise<ProjectionModule> {
  const modulePath = '../../src/modules/sellers/contact/project-seller-public-contacts';
  return import(modulePath) as Promise<ProjectionModule>;
}

function raw(overrides: Partial<RawPersistedContacts> = {}): RawPersistedContacts {
  return {
    phoneE164: null,
    whatsappPhoneE164: null,
    telegramUsername: null,
    instagramUsername: null,
    ...overrides,
  };
}

function baseOffer() {
  return {
    id: '40000000-0000-4000-8000-000000001010',
    product: { id: '10000000-0000-4000-8000-000000001010', name: 'Баранина' },
    seller: { id: '20000000-0000-4000-8000-000000001010', displayName: 'Seller 1010' },
    location: { id: '30000000-0000-4000-8000-000000001010', name: 'Point 1010', addressText: 'Алматы' },
    price: { amount: '0', currency: 'KZT', unit: null },
    sellerComment: null,
  };
}

describe('S10 safe public Seller contact projection', () => {
  it('drops a malformed channel independently while preserving valid channels', async () => {
    const { projectSellerPublicContactProperty } = await loadProjector();
    expect(projectSellerPublicContactProperty(raw({
      phoneE164: '+77001234567',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: 'https://t.me/evil',
      instagramUsername: 'kaida.shop',
    }))).toEqual({
      contacts: {
        phoneE164: '+77001234567',
        whatsappPhoneE164: '+447911123456',
        instagramUsername: 'kaida.shop',
      },
    });
  });

  it('does not normalize malformed persisted friendly values on the read path', async () => {
    const { projectSellerPublicContactProperty } = await loadProjector();
    expect(projectSellerPublicContactProperty(raw({
      phoneE164: '8 (700) 123-45-67',
      telegramUsername: '@kaida_shop',
      instagramUsername: 'KAIDA.SHOP',
    }))).toEqual({});
  });

  it('physically omits contacts when every channel is null or invalid', async () => {
    const { projectSellerPublicContactProperty } = await loadProjector();
    const result = projectSellerPublicContactProperty(raw({ telegramUsername: 'bad/path' }));
    expect(result).toEqual({});
    expect(Object.hasOwn(result, 'contacts')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'contacts')).toBe(false);
    expect(JSON.stringify(result)).not.toContain('contacts');
  });

  it('emits a non-empty contacts object when at least one channel is valid', async () => {
    const { projectSellerPublicContactProperty } = await loadProjector();
    const result = projectSellerPublicContactProperty(raw({ telegramUsername: 'kaida_shop' }));
    expect(Object.hasOwn(result, 'contacts')).toBe(true);
    expect(result.contacts).toEqual({ telegramUsername: 'kaida_shop' });
    expect(Object.keys(result.contacts ?? {})).toHaveLength(1);
  });

  it('Search contract preserves a valid structured contacts projection', () => {
    const parsed = searchOfferSchema.parse({
      ...baseOffer(),
      seller: {
        ...baseOffer().seller,
        contacts: {
          phoneE164: '+77001234567',
          whatsappPhoneE164: '+447911123456',
          telegramUsername: 'kaida_shop',
          instagramUsername: 'kaida.shop',
        },
      },
    });
    expect(parsed.seller).toHaveProperty('contacts');
    expect((parsed.seller as unknown as { contacts?: unknown }).contacts).toEqual({
      phoneE164: '+77001234567',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
    });
  });

  it('Search contract rejects an explicitly empty contacts object', () => {
    expect(searchOfferSchema.safeParse({
      ...baseOffer(),
      seller: { ...baseOffer().seller, contacts: {} },
    }).success).toBe(false);
  });
});
