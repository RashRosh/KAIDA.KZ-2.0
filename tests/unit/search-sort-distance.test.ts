import { describe, expect, it } from 'vitest';
import type { SearchOffer } from '../../src/modules/search/contracts/search.contract';
import { rankSearchOfferCandidates, freshnessScore, distanceScore, type SearchRankingCandidate } from '../../src/modules/search/ranking/search-ranking';
import { filterOffersByRadius } from '../../src/modules/search/radius-filter';
import { readSearchRankingPolicy, weightsSumToOne } from '../../src/modules/search/config/search-ranking-policy.config';
import { ageingSince, type ActualityPolicy } from '../../src/modules/offers/actuality/actuality';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';

// stage #5 (Issue #12) — weighted ranking policy of the slice contract §2: freshness tiers first, absolute
// (never result-set-normalized) scores inside a tier, server-side weights, deterministic tie-breakers,
// geo-less semantics and the client-side radius filter.

const H = 60 * 60 * 1000;
const NOW = new Date('2026-09-13T12:00:00Z');
const ACTUALITY: ActualityPolicy = { dueHours: 24, ageingHours: 48, hiddenHours: 168, archiveHours: 336 };
const RANKING = readSearchRankingPolicy();

const buyer = { latitude: 0, longitude: 0 };
const near = { latitude: 0, longitude: 0 };
const far = { latitude: 0.16, longitude: 0 };

let offerSeq = 0;
function candidate(hoursAgo: number, locationGeo: SearchRankingCandidate['locationGeo']): SearchRankingCandidate {
  offerSeq += 1;
  const id = `50000000-0000-4000-8000-${String(offerSeq).padStart(12, '0')}`;
  const offer = {
    id,
    product: { id: '10000000-0000-4000-8000-000000000001', name: 'stage #5 unit product' },
    seller: { id: '20000000-0000-4000-8000-000000000001', displayName: 'stage #5 unit seller' },
    location: { id: '30000000-0000-4000-8000-000000000001', name: 'stage #5 unit location', addressText: 'stage #5 unit address', openingHours: templateOpeningHours() },
    price: { amount: '0', currency: 'KZT', unit: null },
    sellerComment: null,
  } as SearchOffer;
  return { offer, lastConfirmedAt: new Date(NOW.getTime() - hoursAgo * H), locationGeo };
}

function rank(input: readonly SearchRankingCandidate[], mode: 'actuality' | 'distance', buyerLocation?: typeof buyer) {
  return rankSearchOfferCandidates(input, buyerLocation, ageingSince(NOW, ACTUALITY), {
    now: NOW,
    actualityPolicy: ACTUALITY,
    rankingPolicy: RANKING,
    sortMode: mode,
  });
}

function ids(items: readonly { offer: { id: string } }[]) {
  return items.map((item) => item.offer.id);
}

describe('stage #5 weighted ranking', () => {
  it('keeps the fresh tier above the ageing tier regardless of distance and weights', () => {
    const freshFar = candidate(1, far);
    const ageingNear = candidate(60, near);
    expect(ids(rank([ageingNear, freshFar], 'actuality', buyer))).toEqual([freshFar.offer.id, ageingNear.offer.id]);
    expect(ids(rank([ageingNear, freshFar], 'distance', buyer))).toEqual([freshFar.offer.id, ageingNear.offer.id]);
  });

  it('inside one tier «Актуальнее» ranks a fresher-but-farther Offer above an older-but-nearer one', () => {
    const freshFar = candidate(1, far);
    const oldNear = candidate(47, near);
    expect(ids(rank([oldNear, freshFar], 'actuality', buyer))).toEqual([freshFar.offer.id, oldNear.offer.id]);
  });

  it('inside the same tier «Ближе» swaps that pair', () => {
    const freshFar = candidate(1, far);
    const oldNear = candidate(47, near);
    expect(ids(rank([oldNear, freshFar], 'distance', buyer))).toEqual([oldNear.offer.id, freshFar.offer.id]);
  });

  it('changing an unrelated third Offer does not change the score order of the pair (no result-set normalization)', () => {
    const freshFar = candidate(1, far);
    const oldNear = candidate(47, near);
    const unrelated = candidate(20, { latitude: 0.05, longitude: 0.05 });
    const pairIds = [freshFar.offer.id, oldNear.offer.id];
    const withoutActual = ids(rank([freshFar, oldNear], 'actuality', buyer));
    const withThirdActual = ids(rank([unrelated, freshFar, oldNear], 'actuality', buyer)).filter((id) => pairIds.includes(id));
    expect(withThirdActual).toEqual(withoutActual);
    const withoutDistance = ids(rank([oldNear, freshFar], 'distance', buyer));
    const withThirdDistance = ids(rank([oldNear, freshFar, unrelated], 'distance', buyer)).filter((id) => pairIds.includes(id));
    expect(withThirdDistance).toEqual(withoutDistance);
  });

  it('an exact weighted-score tie falls back to freshness and then Offer.id', () => {
    // Identical confirmation time and identical location make both score components exactly equal in float.
    const a = candidate(5, near);
    const b = candidate(5, near);
    expect(a.offer.id < b.offer.id).toBe(true);
    expect(ids(rank([b, a], 'actuality', buyer))).toEqual([a.offer.id, b.offer.id]);
    expect(ids(rank([b, a], 'distance', buyer))).toEqual([a.offer.id, b.offer.id]);
  });

  it('a geo-less Offer gets no distance component: it cannot win by proximity in either mode', () => {
    const geoless = candidate(1, null);
    const geoNear = candidate(2, near);
    expect(ids(rank([geoNear, geoless], 'actuality', buyer))).toEqual([geoNear.offer.id, geoless.offer.id]);
    expect(ids(rank([geoNear, geoless], 'distance', buyer))).toEqual([geoNear.offer.id, geoless.offer.id]);
  });

  it('without Buyer location ranks by pure freshness semantics, ignoring weights and mode', () => {
    const older = candidate(10, near);
    const newer = candidate(2, far);
    expect(ids(rank([older, newer], 'actuality'))).toEqual([newer.offer.id, older.offer.id]);
    expect(ids(rank([older, newer], 'distance'))).toEqual([newer.offer.id, older.offer.id]);
  });
});

describe('stage #5 scoring functions', () => {
  it('freshnessScore is absolute, monotonic inside a tier and exact at the boundaries', () => {
    expect(freshnessScore(NOW, NOW, ACTUALITY)).toBe(1);
    expect(freshnessScore(new Date(NOW.getTime() - 24 * H), NOW, ACTUALITY)).toBeCloseTo(0.5, 12);
    expect(freshnessScore(new Date(NOW.getTime() - 47 * H), NOW, ACTUALITY)).toBeGreaterThan(0);
    expect(freshnessScore(new Date(NOW.getTime() - 48 * H), NOW, ACTUALITY)).toBe(1);
    expect(freshnessScore(new Date(NOW.getTime() - 96 * H), NOW, ACTUALITY)).toBeCloseTo(0.6, 12);
    expect(freshnessScore(new Date(NOW.getTime() - 168 * H), NOW, ACTUALITY)).toBe(0);
    const oneHour = freshnessScore(new Date(NOW.getTime() - 1 * H), NOW, ACTUALITY);
    const twoHours = freshnessScore(new Date(NOW.getTime() - 2 * H), NOW, ACTUALITY);
    const sixtyHours = freshnessScore(new Date(NOW.getTime() - 60 * H), NOW, ACTUALITY);
    const ninetyHours = freshnessScore(new Date(NOW.getTime() - 90 * H), NOW, ACTUALITY);
    expect(oneHour).toBeGreaterThan(twoHours);
    expect(sixtyHours).toBeGreaterThan(ninetyHours);
  });

  it('distanceScore decays absolutely from ≈1 at 0 km and never depends on the other Offers', () => {
    expect(distanceScore(0)).toBe(1);
    expect(distanceScore(1000)).toBeCloseTo(0.5, 12);
    expect(distanceScore(9000)).toBeCloseTo(0.1, 12);
    expect(distanceScore(1000)).toBeGreaterThan(distanceScore(2000));
  });
});

describe('stage #5 ranking policy configuration', () => {
  it('maps each mode onto the validated MVP defaults when configuration is missing', () => {
    const policy = readSearchRankingPolicy({});
    expect(policy.actuality).toEqual({ freshnessWeight: 0.7, distanceWeight: 0.3 });
    expect(policy.distance).toEqual({ freshnessWeight: 0.3, distanceWeight: 0.7 });
    expect(weightsSumToOne(policy.actuality)).toBe(true);
    expect(weightsSumToOne(policy.distance)).toBe(true);
  });

  it('accepts a valid explicitly supplied configuration', () => {
    const policy = readSearchRankingPolicy({ SEARCH_RANKING_WEIGHTS_ACTUALITY: '0.6,0.4', SEARCH_RANKING_WEIGHTS_DISTANCE: '0.4,0.6' });
    expect(policy.actuality).toEqual({ freshnessWeight: 0.6, distanceWeight: 0.4 });
    expect(policy.distance).toEqual({ freshnessWeight: 0.4, distanceWeight: 0.6 });
  });

  it('fails fast on explicitly supplied invalid configuration', () => {
    expect(() => readSearchRankingPolicy({ SEARCH_RANKING_WEIGHTS_ACTUALITY: '0.6,0.6' })).toThrow();
    expect(() => readSearchRankingPolicy({ SEARCH_RANKING_WEIGHTS_ACTUALITY: '1.2,0' })).toThrow();
    expect(() => readSearchRankingPolicy({ SEARCH_RANKING_WEIGHTS_ACTUALITY: 'abc,0.5' })).toThrow();
    expect(() => readSearchRankingPolicy({ SEARCH_RANKING_WEIGHTS_DISTANCE: '0.5' })).toThrow();
    expect(() => readSearchRankingPolicy({ SEARCH_RANKING_WEIGHTS_DISTANCE: '-0.2,1.2' })).toThrow();
  });
});

describe('stage #5 radius presentation filter', () => {
  let seq = 0;
  function radiusOffer(distanceMeters?: number): SearchOffer {
    seq += 1;
    return {
      id: `60000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
      product: { id: '10000000-0000-4000-8000-000000000001', name: 'radius unit product' },
      seller: { id: '20000000-0000-4000-8000-000000000001', displayName: 'radius unit seller' },
      location: { id: '30000000-0000-4000-8000-000000000001', name: 'radius unit location', addressText: 'radius unit address', openingHours: templateOpeningHours() },
      price: { amount: '0', currency: 'KZT', unit: null },
      sellerComment: null,
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
    };
  }

  const inside = radiusOffer(999);
  const boundary = radiusOffer(1000);
  const outside = radiusOffer(1001);
  const geoless = radiusOffer();

  it('keeps Offers exactly on the boundary and hides everything beyond it', () => {
    const filtered = filterOffersByRadius([inside, boundary, outside], 1000);
    expect(filtered.map((offer) => offer.id)).toEqual([inside.id, boundary.id]);
  });

  it('hides geo-less Offers under a finite radius and shows everything for «Любое»', () => {
    expect(filterOffersByRadius([inside, boundary, outside, geoless], 1000).map((offer) => offer.id)).toEqual([inside.id, boundary.id]);
    expect(filterOffersByRadius([inside, boundary, outside, geoless], null)).toHaveLength(4);
  });

  it('preserves the response order (ranking stays the server authority)', () => {
    expect(filterOffersByRadius([outside, boundary, inside], null).map((offer) => offer.id)).toEqual([outside.id, boundary.id, inside.id]);
  });
});
