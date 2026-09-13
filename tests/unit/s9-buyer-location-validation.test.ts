import { describe, expect, it } from 'vitest';
import {
  buyerLocationSchema,
  geoSearchRequestSchema,
} from '../../src/modules/search/contracts/buyer-location.contract';

describe('S9 buyer location validation', () => {
  it.each([
    [{ latitude: 0, longitude: 0 }],
    [{ latitude: -90, longitude: -180 }],
    [{ latitude: 90, longitude: 180 }],
    [{ latitude: 43.238949, longitude: 76.889709 }],
  ])('accepts a complete finite point: %j', (point) => {
    expect(buyerLocationSchema.parse(point)).toEqual(point);
  });

  it.each([
    [{ longitude: 76.8 }],
    [{ latitude: 43.2 }],
    [{ latitude: '43.2', longitude: 76.8 }],
    [{ latitude: 43.2, longitude: '76.8' }],
    [{ latitude: null, longitude: 76.8 }],
    [{ latitude: 43.2, longitude: null }],
    [{ latitude: [], longitude: 76.8 }],
    [{ latitude: 43.2, longitude: {} }],
    [{ latitude: -90.000001, longitude: 0 }],
    [{ latitude: 90.000001, longitude: 0 }],
    [{ latitude: 0, longitude: -180.000001 }],
    [{ latitude: 0, longitude: 180.000001 }],
    [{ latitude: Number.NaN, longitude: 0 }],
    [{ latitude: Number.POSITIVE_INFINITY, longitude: 0 }],
    [{ latitude: Number.NEGATIVE_INFINITY, longitude: 0 }],
    [{ latitude: 0, longitude: Number.NaN }],
    [{ latitude: 0, longitude: Number.POSITIVE_INFINITY }],
    [{ latitude: 0, longitude: Number.NEGATIVE_INFINITY }],
    [{ latitude: 43.2, longitude: 76.8, accuracy: 10 }],
  ])('rejects an invalid or non-strict point: %j', (point) => {
    expect(buyerLocationSchema.safeParse(point).success).toBe(false);
  });

  it('uses the existing Search query semantics and rejects unknown root fields', () => {
    expect(geoSearchRequestSchema.parse({
      q: '  БАРАНИНА  ',
      buyerLocation: { latitude: 43.238949, longitude: 76.889709 },
    })).toEqual({
      q: 'БАРАНИНА',
      buyerLocation: { latitude: 43.238949, longitude: 76.889709 },
    });

    expect(geoSearchRequestSchema.safeParse({
      q: 'баранина',
      buyerLocation: { latitude: 43.238949, longitude: 76.889709 },
      extra: true,
    }).success).toBe(false);
  });

  it.each([
    {},
    { q: 'баранина' },
    { buyerLocation: { latitude: 43.2, longitude: 76.8 } },
    { q: '   ', buyerLocation: { latitude: 43.2, longitude: 76.8 } },
    { q: 'баранина', buyerLocation: { latitude: 43.2 } },
    { q: 'баранина', buyerLocation: { longitude: 76.8 } },
  ])('rejects incomplete geo-aware Search input: %j', (input) => {
    expect(geoSearchRequestSchema.safeParse(input).success).toBe(false);
  });
});
