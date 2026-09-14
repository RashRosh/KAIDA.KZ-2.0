import { describe, expect, it } from 'vitest';
import {
  NEARBY_RADIUS_METERS_DEFAULT,
  readNearbyRadiusMeters,
  validateNearbyRadiusMeters,
} from '../../src/modules/discovery/config/discovery.config';
import type { NearbyDiscoveryCandidate } from '../../src/modules/discovery/ranking/nearby-discovery';
import { selectNearbyOffers } from '../../src/modules/discovery/ranking/nearby-discovery';
import type { SearchOffer } from '../../src/modules/search/contracts/search.contract';

const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;
const buyerLocation = { latitude: 0, longitude: 0 };

function pointNorthByMeters(meters: number) {
  return {
    latitude: meters / EARTH_MEAN_RADIUS_METERS * 180 / Math.PI,
    longitude: 0,
  };
}

function offer(id: string): SearchOffer {
  return {
    id,
    product: { id: '10000000-0000-4000-8000-000000011000', name: 'S11 unit product' },
    seller: { id: '20000000-0000-4000-8000-000000011000', displayName: 'S11 unit seller' },
    location: { id: '30000000-0000-4000-8000-000000011000', name: 'S11 unit location', addressText: 'S11 unit address' },
    price: null,
    sellerComment: null,
  };
}

function candidate(
  id: string,
  lastConfirmedAt: string,
  locationGeo: NearbyDiscoveryCandidate['locationGeo'],
): NearbyDiscoveryCandidate {
  return { offer: offer(id), lastConfirmedAt: new Date(lastConfirmedAt), locationGeo };
}

describe('S11 Nearby radius policy', () => {
  it('uses a configurable positive integer server-side radius', () => {
    expect(readNearbyRadiusMeters({})).toBe(NEARBY_RADIUS_METERS_DEFAULT);
    expect(readNearbyRadiusMeters({ NEARBY_RADIUS_METERS: '7500' })).toBe(7500);
    expect(validateNearbyRadiusMeters(5000)).toBe(5000);
  });

  it.each([0, -1, 1.5, '0', '-1', '1.5', 'abc'])('rejects invalid radius %j', (value) => {
    expect(() => validateNearbyRadiusMeters(value)).toThrow();
  });
});

describe('S11 Nearby eligibility and ordering', () => {
  const insideId = '40000000-0000-4000-8000-000000011001';
  const boundaryId = '40000000-0000-4000-8000-000000011002';
  const outsideId = '40000000-0000-4000-8000-000000011003';
  const geolessId = '40000000-0000-4000-8000-000000011004';

  it('filters by rounded whole-meter distance with an inclusive boundary and excludes geoless', () => {
    const result = selectNearbyOffers([
      candidate(outsideId, '2026-09-14T10:00:00Z', pointNorthByMeters(5000.6)),
      candidate(boundaryId, '2026-09-14T10:00:00Z', pointNorthByMeters(5000.4)),
      candidate(geolessId, '2026-09-14T10:00:00Z', null),
      candidate(insideId, '2026-09-14T10:00:00Z', pointNorthByMeters(4999.4)),
    ], buyerLocation, 5000);

    expect(result.map(({ id }) => id)).toEqual([insideId, boundaryId]);
    expect(result.map(({ distanceMeters }) => distanceMeters)).toEqual([4999, 5000]);
  });

  it('sorts equal distance by freshness DESC then Offer.id ASC without mutating caller order', () => {
    const id1 = '40000000-0000-4000-8000-000000011011';
    const id2 = '40000000-0000-4000-8000-000000011012';
    const id3 = '40000000-0000-4000-8000-000000011013';
    const point = pointNorthByMeters(1000.2);
    const input = [
      candidate(id3, '2026-09-14T09:00:00Z', point),
      candidate(id2, '2026-09-14T10:00:00Z', point),
      candidate(id1, '2026-09-14T10:00:00Z', point),
    ];
    const original = input.map(({ offer: item }) => item.id);

    const result = selectNearbyOffers(input, buyerLocation, 5000);

    expect(result.map(({ id }) => id)).toEqual([id1, id2, id3]);
    expect(input.map(({ offer: item }) => item.id)).toEqual(original);
    expect(result.every(({ distanceMeters }) => distanceMeters === 1000)).toBe(true);
  });
});
