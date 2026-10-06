import { describe, expect, it } from 'vitest';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import { geoSearchRequestSchema } from '../../src/modules/search/contracts/buyer-location.contract';
import {
  NATURAL_SORT_DIRECTION,
  resolveSortDirection,
  searchSortDirectionSchema,
  searchSortModeSchema,
  type SearchOffer,
  type SearchSortDirection,
  type SearchSortMode,
} from '../../src/modules/search/contracts/search.contract';
import { rankSearchOfferCandidates, type SearchRankingCandidate } from '../../src/modules/search/ranking/search-ranking';

// Stage 6 Rev 3 (docs/slices/search-sort-rev3): the selected criterion is the primary ordering of all buyer-eligible Offers.
const buyer = { latitude: 43.238949, longitude: 76.889709 };
const NEAR = { latitude: 43.239949, longitude: 76.889709 }; // ≈ 111 m
const MID = { latitude: 43.248949, longitude: 76.889709 }; // ≈ 1.1 km
const FAR = { latitude: 43.338949, longitude: 76.889709 }; // ≈ 11 km

const ids = {
  a: '40000000-0000-4000-8000-00000000000a',
  b: '40000000-0000-4000-8000-00000000000b',
  c: '40000000-0000-4000-8000-00000000000c',
  d: '40000000-0000-4000-8000-00000000000d',
  e: '40000000-0000-4000-8000-00000000000e',
};

function candidate(id: string, price: string, unit: string | null, confirmedAt: string, geo: SearchRankingCandidate['locationGeo']): SearchRankingCandidate {
  const offer: SearchOffer = {
    id,
    product: { id: '10000000-0000-4000-8000-000000000001', name: 'Rev 3 product' },
    seller: { id: '20000000-0000-4000-8000-000000000001', displayName: 'Rev 3 seller' },
    location: { id: '30000000-0000-4000-8000-000000000001', name: 'Rev 3 point', addressText: 'Rev 3 address', openingHours: templateOpeningHours() },
    price: { amount: price, currency: 'KZT', unit },
    sellerComment: null,
    routeAvailable: geo !== null,
  };
  return { offer, lastConfirmedAt: new Date(confirmedAt), locationGeo: geo };
}

function order(
  input: readonly SearchRankingCandidate[],
  sort: SearchSortMode,
  direction: SearchSortDirection | undefined,
  location: typeof buyer | null = buyer,
) {
  return rankSearchOfferCandidates(input, location ?? undefined, { sort, direction: resolveSortDirection(sort, direction) }).map((item) => item.offer.id);
}

// Deliberately uncorrelated: the cheapest is neither the nearest nor the freshest, and an old Offer is the nearest.
const OFFERS = [
  candidate(ids.a, '1000', 'kg', '2026-09-13T11:00:00Z', MID), // 1 h old
  candidate(ids.b, '800', 'package', '2026-09-10T11:00:00Z', FAR), // ageing (3 days)
  candidate(ids.c, '2500', 'piece', '2026-09-13T11:50:00Z', NEAR), // freshest
  candidate(ids.d, '1000.50', null, '2026-09-13T08:00:00Z', null), // geo-less
  candidate(ids.e, '1000', 'liter', '2026-09-13T11:30:00Z', null), // geo-less, same price as `a`
];

describe('Rev 3 natural directions and defaults', () => {
  it('uses fresher / cheaper / nearer first and an omitted direction takes the natural one', () => {
    expect(NATURAL_SORT_DIRECTION).toEqual({ relevance: 'desc', actuality: 'desc', price: 'asc', distance: 'asc' });
    expect(resolveSortDirection('actuality', undefined)).toBe('desc');
    expect(resolveSortDirection('price', undefined)).toBe('asc');
    expect(resolveSortDirection('distance', undefined)).toBe('asc');
    expect(resolveSortDirection('price', 'desc')).toBe('desc');
  });

  it('accepts only the four criteria (S15B-4b adds relevance) and the two directions; `cheaper` never existed', () => {
    expect(searchSortModeSchema.options).toEqual(['relevance', 'actuality', 'distance', 'price']);
    expect(searchSortDirectionSchema.options).toEqual(['asc', 'desc']);
    expect(searchSortModeSchema.safeParse('cheaper').success).toBe(false);
    expect(searchSortDirectionSchema.safeParse('down').success).toBe(false);
  });

  it('the POST request is strict: weights and unknown fields are rejected, sort and direction are optional', () => {
    const base = { q: 'баранина', buyerLocation: buyer };
    expect(geoSearchRequestSchema.safeParse(base).success).toBe(true);
    expect(geoSearchRequestSchema.safeParse({ ...base, sort: 'price', direction: 'desc' }).success).toBe(true);
    expect(geoSearchRequestSchema.safeParse({ ...base, sort: 'cheaper' }).success).toBe(false);
    expect(geoSearchRequestSchema.safeParse({ ...base, direction: 'sideways' }).success).toBe(false);
    expect(geoSearchRequestSchema.safeParse({ ...base, weights: [0.5, 0.5] }).success).toBe(false);
  });
});

describe('Rev 3 actuality sorting', () => {
  it('desc is fresher first and asc is older first, directly by age (no tier, no score)', () => {
    expect(order(OFFERS, 'actuality', 'desc')).toEqual([ids.c, ids.e, ids.a, ids.d, ids.b]);
    expect(order(OFFERS, 'actuality', 'asc')).toEqual([ids.b, ids.d, ids.a, ids.e, ids.c]);
  });

  it('equal actuality falls back to the stable Offer.id', () => {
    const tie = [
      candidate(ids.b, '1', null, '2026-09-13T11:00:00Z', null),
      candidate(ids.a, '1', null, '2026-09-13T11:00:00Z', null),
    ];
    expect(order(tie, 'actuality', 'desc')).toEqual([ids.a, ids.b]);
    expect(order(tie, 'actuality', 'asc')).toEqual([ids.a, ids.b]);
  });

  it('works without a buyer location', () => {
    expect(order(OFFERS, 'actuality', 'desc', null)).toEqual([ids.c, ids.e, ids.a, ids.d, ids.b]);
  });
});

describe('Rev 3 price sorting', () => {
  it('compares the nominal KZT amount only: units and pack sizes are never normalized', () => {
    // 800 ₸ / упак. precedes 1000 ₸ / кг; 1000.50 follows 1000.
    expect(order(OFFERS, 'price', 'asc')).toEqual([ids.b, ids.e, ids.a, ids.d, ids.c]);
    expect(order(OFFERS, 'price', 'desc')).toEqual([ids.c, ids.d, ids.e, ids.a, ids.b]);
  });

  it('a price tie keeps «fresher first → Offer.id» for both directions', () => {
    // a and e cost 1000: e (11:30) is fresher than a (11:00) in both directions.
    expect(order(OFFERS, 'price', 'asc').indexOf(ids.e)).toBeLessThan(order(OFFERS, 'price', 'asc').indexOf(ids.a));
    expect(order(OFFERS, 'price', 'desc').indexOf(ids.e)).toBeLessThan(order(OFFERS, 'price', 'desc').indexOf(ids.a));
  });

  it('is independent of the buyer location and keeps the geo-less Offers in the order', () => {
    expect(order(OFFERS, 'price', 'asc', null)).toEqual(order(OFFERS, 'price', 'asc'));
  });
});

describe('Rev 3 distance sorting', () => {
  it('asc is nearer first and desc is farther first inside the geo-known group', () => {
    expect(order(OFFERS, 'distance', 'asc').slice(0, 3)).toEqual([ids.c, ids.a, ids.b]);
    expect(order(OFFERS, 'distance', 'desc').slice(0, 3)).toEqual([ids.b, ids.a, ids.c]);
  });

  it('every geo-known Offer precedes every geo-less one for BOTH directions; geo-less keep «fresher first → id»', () => {
    for (const direction of ['asc', 'desc'] as const) {
      const result = order(OFFERS, 'distance', direction);
      expect(result.slice(3)).toEqual([ids.e, ids.d]);
    }
  });

  it('never fabricates a distance for a geo-less Offer', () => {
    const ranked = rankSearchOfferCandidates(OFFERS, buyer, { sort: 'distance', direction: 'asc' });
    expect(ranked.filter((item) => item.locationGeo === null).map((item) => item.rankingDistanceMeters)).toEqual([null, null]);
  });

  it('a distance tie keeps «fresher first → Offer.id»', () => {
    const tie = [
      candidate(ids.a, '1', null, '2026-09-13T10:00:00Z', NEAR),
      candidate(ids.b, '1', null, '2026-09-13T11:00:00Z', NEAR),
    ];
    expect(order(tie, 'distance', 'asc')).toEqual([ids.b, ids.a]);
    expect(order(tie, 'distance', 'desc')).toEqual([ids.b, ids.a]);
  });

  it('refuses to rank by distance without the buyer location instead of ordering otherwise', () => {
    expect(() => order(OFFERS, 'distance', 'asc', null)).toThrow();
  });
});

describe('Rev 3 explicit criterion beats the old tier and weights', () => {
  it('an ageing cheap Offer precedes a fresh expensive one under price asc', () => {
    // `b` is in the old ageing tier yet cheapest; the explicit price order is primary.
    expect(order(OFFERS, 'price', 'asc')[0]).toBe(ids.b);
  });

  it('an old nearest Offer precedes a fresh far one under distance asc', () => {
    const input = [
      candidate(ids.a, '1', null, '2026-09-13T11:59:00Z', FAR),
      candidate(ids.b, '1', null, '2026-09-10T08:00:00Z', NEAR),
    ];
    expect(order(input, 'distance', 'asc')).toEqual([ids.b, ids.a]);
  });
});
