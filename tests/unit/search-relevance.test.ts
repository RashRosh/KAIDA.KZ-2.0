import { describe, expect, it } from 'vitest';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import { geoSearchRequestSchema } from '../../src/modules/search/contracts/buyer-location.contract';
import { orderRequestFields, resolveSearchOrder, type SearchOffer } from '../../src/modules/search/contracts/search.contract';
import { rankSearchOfferCandidates, type SearchMatchLevel, type SearchRankingCandidate } from '../../src/modules/search/ranking/search-ranking';
import { classifyMatchLevel } from '../../src/modules/search/ranking/search-relevance';

// S15B-4b (docs/slices/s15b4b-relevance-sort): deterministic match levels, the relevance order and the order resolution.
const LAMB = '10000000-0000-4000-8000-000000000001';
const BEEF = '10000000-0000-4000-8000-000000000002';

describe('match levels', () => {
  const words = ['баранина'];
  it('level 1: linked to the Product the query is (resolved), whatever the title says', () => {
    expect(classifyMatchLevel({ title: 'Баранина', productId: LAMB, applicableProductId: LAMB, words })).toBe(1);
    expect(classifyMatchLevel({ title: 'Лопатка на кости', productId: LAMB, applicableProductId: LAMB, words })).toBe(1);
  });
  it('level 2: every query word is a whole title word', () => {
    expect(classifyMatchLevel({ title: 'Баранина на кости', productId: null, applicableProductId: LAMB, words })).toBe(2);
    expect(classifyMatchLevel({ title: 'Баранина на кости', productId: null, applicableProductId: null, words: ['баранина', 'на', 'кости'] })).toBe(2);
    expect(classifyMatchLevel({ title: 'Ёлка', productId: null, applicableProductId: null, words: ['елка'] })).toBe(2);
  });
  it('level 3: prefix-only matches and candidates only a non-applicable Product brought in', () => {
    expect(classifyMatchLevel({ title: 'Баранина', productId: null, applicableProductId: null, words: ['бара'] })).toBe(3);
    expect(classifyMatchLevel({ title: 'Баранки', productId: null, applicableProductId: null, words: ['бара'] })).toBe(3);
    // a selected Product that the text does not agree with: no applicable Product, the title does not match the words
    expect(classifyMatchLevel({ title: 'Баранина', productId: LAMB, applicableProductId: null, words: ['баранина', 'на', 'кости'] })).toBe(3);
    // a Product-linked card of another Product than the applicable one
    expect(classifyMatchLevel({ title: 'Говядина', productId: BEEF, applicableProductId: LAMB, words })).toBe(3);
  });
});

function candidate(id: string, confirmedAt: string, matchLevel: SearchMatchLevel | undefined): SearchRankingCandidate {
  const offer: SearchOffer = {
    id,
    product: { id: null, name: id },
    seller: { id: '20000000-0000-4000-8000-000000000001', displayName: 's' },
    location: { id: '30000000-0000-4000-8000-000000000001', name: 'p', addressText: 'a', openingHours: templateOpeningHours() },
    price: { amount: '1000', currency: 'KZT', unit: null },
    sellerComment: null,
    routeAvailable: false,
  };
  return { offer, lastConfirmedAt: new Date(confirmedAt), locationGeo: null, ...(matchLevel === undefined ? {} : { matchLevel }) };
}

describe('relevance order', () => {
  const id = (n: number) => `40000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
  const rank = (items: SearchRankingCandidate[]) => rankSearchOfferCandidates(items, undefined, { sort: 'relevance', direction: 'desc' }).map((item) => item.offer.id);

  it('orders by level, then fresher first, then the stable Offer id', () => {
    const items = [
      candidate(id(1), '2026-09-13T08:00:00Z', 3),
      candidate(id(2), '2026-09-13T09:00:00Z', 2),
      candidate(id(3), '2026-09-13T07:00:00Z', 1), // the oldest, yet level 1
      candidate(id(4), '2026-09-13T11:00:00Z', 3), // the freshest, yet level 3
      candidate(id(6), '2026-09-13T09:00:00Z', 2), // same level and time as id(2): the id decides
      candidate(id(5), '2026-09-13T10:00:00Z', 2),
    ];
    expect(rank(items)).toEqual([id(3), id(5), id(2), id(6), id(4), id(1)]);
  });

  it('matches the actuality (desc) order inside a level', () => {
    const items = [candidate(id(1), '2026-09-13T08:00:00Z', 2), candidate(id(2), '2026-09-13T09:00:00Z', 2), candidate(id(3), '2026-09-13T09:00:00Z', 2)];
    const actuality = rankSearchOfferCandidates(items, undefined, { sort: 'actuality', direction: 'desc' }).map((item) => item.offer.id);
    expect(rank(items)).toEqual(actuality);
  });
});

describe('order resolution (S15B-4b)', () => {
  it('no sort and no direction → relevance', () => {
    expect(resolveSearchOrder(undefined, undefined)).toEqual({ sort: 'relevance', direction: 'desc' });
  });
  it('a direction alone keeps its legacy meaning: actuality in that direction', () => {
    expect(resolveSearchOrder(undefined, 'asc')).toEqual({ sort: 'actuality', direction: 'asc' });
    expect(resolveSearchOrder(undefined, 'desc')).toEqual({ sort: 'actuality', direction: 'desc' });
  });
  it('explicit sorts keep their natural directions; relevance with a direction is invalid', () => {
    expect(resolveSearchOrder('price', undefined)).toEqual({ sort: 'price', direction: 'asc' });
    expect(resolveSearchOrder('actuality', undefined)).toEqual({ sort: 'actuality', direction: 'desc' });
    expect(resolveSearchOrder('distance', 'desc')).toEqual({ sort: 'distance', direction: 'desc' });
    expect(resolveSearchOrder('relevance', undefined)).toEqual({ sort: 'relevance', direction: 'desc' });
    expect(resolveSearchOrder('relevance', 'asc')).toBeNull();
  });
  it('a relevance request carries no direction; the others do', () => {
    expect(orderRequestFields('relevance', 'desc')).toEqual({ sort: 'relevance' });
    expect(orderRequestFields('price', 'desc')).toEqual({ sort: 'price', direction: 'desc' });
  });
  it('the strict POST schema rejects an explicit relevance with a direction', () => {
    const base = { q: 'баранина', buyerLocation: { latitude: 43.2, longitude: 76.9 } };
    expect(geoSearchRequestSchema.safeParse({ ...base, sort: 'relevance' }).success).toBe(true);
    expect(geoSearchRequestSchema.safeParse({ ...base, sort: 'relevance', direction: 'desc' }).success).toBe(false);
    expect(geoSearchRequestSchema.safeParse({ ...base, direction: 'asc' }).success).toBe(true);
  });
});
