import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { findVisibleDiscoveryCandidates } from '../../src/modules/discovery/infrastructure/discovery.repository';
import { roadDistancesForOffers } from '../../src/modules/geo/road-distances';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import { searchOffersDetailed } from '../../src/modules/search/application/search-offers';
import { searchOffersWithCorrection } from '../../src/modules/search/application/search-with-correction';
import { rankSearchOfferCandidates, type SearchRankingCandidate } from '../../src/modules/search/ranking/search-ranking';
import { resolveSearchOrder } from '../../src/modules/search/contracts/search.contract';

vi.mock('../../src/modules/geo/road-distances', () => ({ roadDistancesForOffers: vi.fn() }));
vi.mock('../../src/modules/search/application/search-offers', () => ({ searchOffersDetailed: vi.fn() }));
vi.mock('../../src/modules/discovery/infrastructure/discovery.repository', () => ({ findVisibleDiscoveryCandidates: vi.fn() }));

const buyerLocation = { latitude: 43.25, longitude: 76.9 };
const now = new Date('2026-11-20T12:00:00Z');
const db = {} as Database;

function candidate(id: string, locationId: string, latitude: number | null, ageHours = 0): SearchRankingCandidate {
  return {
    offer: {
      id, product: { id: null, name: id }, seller: { id: 'seller', displayName: 'Seller' },
      location: { id: locationId, name: locationId, addressText: locationId, openingHours: templateOpeningHours() },
      price: { amount: '1000', currency: 'KZT', unit: null }, sellerComment: null, routeAvailable: latitude !== null,
    },
    locationGeo: latitude === null ? null : { ...buyerLocation, latitude },
    lastConfirmedAt: new Date(now.getTime() - ageHours * 3600000),
  };
}

const candidates = [
  candidate('close', 'market-a', 43.26),
  candidate('far', 'market-b', 43.274),
  candidate('duplicate', 'market-a', 43.26, 2),
  candidate('ageing', 'market-c', 43.254, 72),
  candidate('out', 'market-d', 43.32),
  candidate('unknown', 'market-e', null),
];
const road = new Map([['market-a', 4200], ['market-b', 3500], ['market-c', 500], ['market-d', 8000]]);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(searchOffersDetailed).mockImplementation(async (query, _, options) => {
    const order = resolveSearchOrder(options?.sort, options?.direction);
    if (!order) throw new Error('Missing test order');
    const ranked = rankSearchOfferCandidates(candidates, options?.buyerLocation, order);
    return {
      resolution: 'resolved',
      response: { query, offers: ranked.map(({ offer, rankingDistanceMeters, lastConfirmedAt }) => ({
        ...offer,
        lastConfirmedAt: lastConfirmedAt.toISOString(),
        ...(rankingDistanceMeters !== null ? { distanceMeters: rankingDistanceMeters } : {}),
      })) },
      distanceCandidates: options?.includeDistanceCandidates ? ranked : undefined,
    };
  });
  vi.mocked(findVisibleDiscoveryCandidates).mockResolvedValue(candidates);
});

describe('Road distances in buyer lists', () => {
  it('switches only the distance criterion, keeps tie-breaks and preserves straight meters', async () => {
    vi.mocked(roadDistancesForOffers).mockResolvedValue(road);
    const ascending = await searchOffersWithCorrection('tea', db, { buyerLocation, sort: 'distance' }, { correct: false });
    const descending = await searchOffersWithCorrection('tea', db, { buyerLocation, sort: 'distance', direction: 'desc' }, { correct: false });
    const actuality = await searchOffersWithCorrection('tea', db, { buyerLocation, sort: 'actuality' }, { correct: false });
    expect(ascending.response.distanceBasis).toBe('road');
    expect(ascending.response.offers.map(({ id }) => id)).toEqual(['ageing', 'far', 'close', 'duplicate', 'out', 'unknown']);
    expect(descending.response.offers.map(({ id }) => id)).toEqual(['out', 'close', 'duplicate', 'far', 'ageing', 'unknown']);
    expect(actuality.response.offers.map(({ id }) => id)).toEqual(['close', 'far', 'out', 'unknown', 'duplicate', 'ageing']);
    expect(ascending.response.offers[2]).toMatchObject({ roadDistanceMeters: 4200, distanceMeters: 1112 });
    expect(ascending.response.offers[3]).toMatchObject({ roadDistanceMeters: 4200, distanceMeters: 1112 });
    expect(ascending.response.offers[5]).not.toHaveProperty('roadDistanceMeters');
    expect(JSON.stringify(ascending)).not.toMatch(/locationGeo|distanceCandidates|latitude|longitude/);
  });

  it('leaves every search distance and its ordering unchanged on fallback', async () => {
    vi.mocked(roadDistancesForOffers).mockResolvedValue(null);
    const result = await searchOffersWithCorrection('tea', db, { buyerLocation, sort: 'distance' }, { correct: false });
    expect(result.response.offers.map(({ id }) => id)).toEqual(['ageing', 'close', 'duplicate', 'far', 'out', 'unknown']);
    expect(result.response).not.toHaveProperty('distanceBasis');
    expect(result.response.offers.every((offer) => offer.roadDistanceMeters === undefined)).toBe(true);
  });

  it('keeps the Nearby radius and ageing tier while switching distance order within each tier', async () => {
    vi.mocked(roadDistancesForOffers).mockResolvedValue(road);
    const options = { clock: () => now, validityPeriodHours: 168, nearbyRadiusMeters: 5000 };
    const measured = await findNearbyOffers(buyerLocation, db, options);
    expect(measured.offers.map(({ id }) => id)).toEqual(['far', 'close', 'duplicate', 'ageing']);
    expect(measured.distanceBasis).toBe('road');
    expect(vi.mocked(roadDistancesForOffers).mock.calls[0][1]).toMatchObject([
      { offer: { id: 'close' } }, { offer: { id: 'far' } }, { offer: { id: 'duplicate' } }, { offer: { id: 'ageing' } },
    ]);
    vi.mocked(roadDistancesForOffers).mockResolvedValue(null);
    const fallback = await findNearbyOffers(buyerLocation, db, options);
    expect(fallback.offers.map(({ id }) => id)).toEqual(['close', 'duplicate', 'far', 'ageing']);
    expect(fallback.distanceBasis).toBeUndefined();
    expect(fallback.offers.every((offer) => offer.roadDistanceMeters === undefined)).toBe(true);
  });
});
