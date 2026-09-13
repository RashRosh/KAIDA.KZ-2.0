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
    location: { id: '30000000-0000-4000-8000-000000000001', name: 'S9 unit location', addressText: 'S9 unit address' },
    price: null,
    sellerComment: null,
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

describe('S9 deterministic ranking', () => {
  const id1 = '40000000-0000-4000-8000-000000000001';
  const id2 = '40000000-0000-4000-8000-000000000002';
  const id3 = '40000000-0000-4000-8000-000000000003';
  const id4 = '40000000-0000-4000-8000-000000000004';

  it('ranks known geo before geoless and distance before freshness', () => {
    const input = [
      candidate(id1, '2026-09-13T10:00:00Z', near),
      candidate(id2, '2026-09-13T11:59:00Z', far),
      candidate(id3, '2026-09-13T11:59:30Z', null),
    ];
    expect(ids(rankSearchOfferCandidates(input, buyer))).toEqual([id1, id2, id3]);
  });

  it('uses freshness then Offer.id for equal rounded distance', () => {
    const input = [
      candidate(id2, '2026-09-13T11:00:00Z', near),
      candidate(id3, '2026-09-13T10:00:00Z', near),
      candidate(id1, '2026-09-13T11:00:00Z', near),
    ];
    expect(ids(rankSearchOfferCandidates(input, buyer))).toEqual([id1, id2, id3]);
  });

  it('orders geoless Offers by freshness then Offer.id', () => {
    const input = [
      candidate(id3, '2026-09-13T10:00:00Z', null),
      candidate(id2, '2026-09-13T11:00:00Z', null),
      candidate(id1, '2026-09-13T11:00:00Z', null),
    ];
    expect(ids(rankSearchOfferCandidates(input, buyer))).toEqual([id1, id2, id3]);
  });

  it('without Buyer location ignores geo presence and uses freshness then Offer.id', () => {
    const input = [
      candidate(id4, '2026-09-13T09:00:00Z', near),
      candidate(id3, '2026-09-13T12:00:00Z', null),
      candidate(id2, '2026-09-13T11:00:00Z', far),
      candidate(id1, '2026-09-13T11:00:00Z', near),
    ];
    expect(ids(rankSearchOfferCandidates(input))).toEqual([id3, id1, id2, id4]);
  });

  it('does not mutate caller order and is permutation-stable', () => {
    const base = [
      candidate(id4, '2026-09-13T09:00:00Z', null),
      candidate(id2, '2026-09-13T11:00:00Z', near),
      candidate(id3, '2026-09-13T10:00:00Z', far),
      candidate(id1, '2026-09-13T11:00:00Z', near),
    ];
    const original = ids(base);
    const expected = ids(rankSearchOfferCandidates(base, buyer));
    expect(ids(base)).toEqual(original);

    const permutations = [
      [base[3]!, base[2]!, base[1]!, base[0]!],
      [base[1]!, base[0]!, base[3]!, base[2]!],
      [base[2]!, base[3]!, base[0]!, base[1]!],
    ];
    for (const permutation of permutations) {
      expect(ids(rankSearchOfferCandidates(permutation, buyer))).toEqual(expected);
    }
  });
});
