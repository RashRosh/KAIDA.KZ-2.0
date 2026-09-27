import { describe, expect, it } from 'vitest';
import { projectPointPublicContacts } from '../../src/modules/locations/details/point-public-contacts';
import { searchOfferSchema } from '../../src/modules/search/contracts/search.contract';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';

// point-contacts-hours §2: only verified numbers of the point are public; an empty set is omitted.
describe('public point contact projection', () => {
  const verified = new Set(['+77001112233']);

  it('publishes only verified numbers', () => {
    expect(projectPointPublicContacts({ phoneE164: '+77001112233', whatsappPhoneE164: '+77009998877' }, verified))
      .toEqual({ contacts: { phoneE164: '+77001112233' } });
  });

  it('omits contacts entirely when nothing is verified or set', () => {
    expect(projectPointPublicContacts({ phoneE164: '+77009998877', whatsappPhoneE164: null }, verified)).toEqual({});
    expect(projectPointPublicContacts({ phoneE164: null, whatsappPhoneE164: null }, undefined)).toEqual({});
  });

  it('Search contract accepts point contacts and rejects an empty contacts object', () => {
    const offer = {
      id: '10000000-0000-4000-8000-000000000101',
      product: { id: '10000000-0000-4000-8000-000000000102', name: 'Баранина' },
      seller: { id: '10000000-0000-4000-8000-000000000103', displayName: 'Продавец' },
      location: { id: '10000000-0000-4000-8000-000000000104', name: 'Точка', addressText: 'Алматы', openingHours: templateOpeningHours() },
      price: { amount: '100', currency: 'KZT', unit: null },
      sellerComment: null,
    };
    expect(searchOfferSchema.safeParse({ ...offer, location: { ...offer.location, contacts: { phoneE164: '+77001112233' } } }).success).toBe(true);
    expect(searchOfferSchema.safeParse({ ...offer, location: { ...offer.location, contacts: {} } }).success).toBe(false);
    expect(searchOfferSchema.safeParse({ ...offer, seller: { ...offer.seller, contacts: { phoneE164: '+77001112233' } } }).data?.seller).not.toHaveProperty('contacts');
  });
});
