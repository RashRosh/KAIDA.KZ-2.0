import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import { describe, expect, it } from 'vitest';
import type { SearchOffer } from '../../src/modules/search/contracts/search.contract';
import {
  distanceMetersForRanking,
  haversineDistanceMeters,
  rankSearchOfferCandidates,
  type SearchRankingCandidate,
} from '../../src/modules/search/ranking/search-ranking';

function offer(id: string): SearchOffer {
  return {
    id,
    product: { id: '10000000-0000-4000-8000-000000000001', name: 'S9 unit product' },
    seller: { id: '20000000-0000-4000-8000-000000000001', displayName: 'S9 unit seller' },
    location: { id: '30000000-0000-4000-8000-000000000001', name: 'S9 unit location', addressText: 'S9 unit address', openingHours: templateOpeningHours() },
    price: { amount: '0', currency: 'KZT', unit: null },
    sellerComment: null,
    routeAvailable: true,
  };
}

function candidate(
  id: string,
  lastConfirmedAt: string,
  locationGeo: SearchRankingCandidate['locationGeo'],
): SearchRankingCandidate {
  return { offer: offer(id), lastConfirmedAt: new Date(lastConfirmedAt), locationGeo };
}

const buyer = { latitude: 43.238949, longitude: 76.889709 };
const near = { latitude: 43.238949, longitude: 76.889709 };
const far = { latitude: 43.338949, longitude: 76.989709 };

function rank(
  input: readonly SearchRankingCandidate[],
  location?: typeof buyer,
  sort: 'actuality' | 'distance' | 'price' = 'actuality',
  direction: 'asc' | 'desc' = sort === 'actuality' ? 'desc' : 'asc',
) {
  return rankSearchOfferCandidates(input, location, { sort, direction });
}

function ids(items: readonly SearchRankingCandidate[]) {
  return items.map((item) => item.offer.id);
}

describe('S9 Haversine distance', () => {
  it('returns zero for the same point and is symmetric', () => {
    expect(haversineDistanceMeters(buyer, buyer)).toBe(0);
    const a = haversineDistanceMeters(buyer, far);
    const b = haversineDistanceMeters(far, buyer);
    expect(a).toBeCloseTo(b, 9);
  });

  it('matches a known one-degree equatorial fixture', () => {
    expect(haversineDistanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    )).toBeCloseTo(111195.0802, 3);
  });

  it('uses whole meters for ranking', () => {
    expect(distanceMetersForRanking(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    )).toBe(111195);
  });
});

describe('S9 deterministic ranking (explicit sorting, stage 6 Rev 3)', () => {
  const id1 = '40000000-0000-4000-8000-000000000001';
  const id2 = '40000000-0000-4000-8000-000000000002';
  const id3 = '40000000-0000-4000-8000-000000000003';
  const id4 = '40000000-0000-4000-8000-000000000004';

  it('does not mutate the caller order and is permutation-stable for every criterion', () => {
    const base = [
      candidate(id4, '2026-09-13T09:00:00Z', null),
      candidate(id2, '2026-09-13T11:00:00Z', near),
      candidate(id3, '2026-09-13T10:00:00Z', far),
      candidate(id1, '2026-09-13T11:00:00Z', near),
    ];
    const original = ids(base);
    for (const sort of ['actuality', 'distance', 'price'] as const) {
      const expected = ids(rank(base, buyer, sort));
      expect(ids(base)).toEqual(original);
      const permutations = [
        [base[3]!, base[2]!, base[1]!, base[0]!],
        [base[1]!, base[0]!, base[3]!, base[2]!],
        [base[2]!, base[3]!, base[0]!, base[1]!],
      ];
      for (const permutation of permutations) expect(ids(rank(permutation, buyer, sort))).toEqual(expected);
    }
  });

  it('the whole-meter distance is attached only when the request has a buyer location', () => {
    const input = [candidate(id1, '2026-09-13T11:00:00Z', near), candidate(id2, '2026-09-13T11:00:00Z', null)];
    expect(rank(input, buyer).map((item) => item.rankingDistanceMeters)).toEqual([0, null]);
    expect(rank(input).map((item) => item.rankingDistanceMeters)).toEqual([null, null]);
  });
});
