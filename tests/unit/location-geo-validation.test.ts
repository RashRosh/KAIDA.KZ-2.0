import { describe, expect, it } from 'vitest';
import { locationGeoSchema } from '../../src/modules/locations/contracts/location.contract';

describe('S8 Location geo validation', () => {
  it.each([
    { latitude: 43.238949, longitude: 76.889709 },
    { latitude: -90, longitude: -180 },
    { latitude: -90, longitude: 180 },
    { latitude: 90, longitude: -180 },
    { latitude: 90, longitude: 180 },
  ])('accepts complete finite point %#', (value) => {
    expect(locationGeoSchema.parse(value)).toEqual(value);
  });

  it.each([
    ['latitude below range', { latitude: -90.000001, longitude: 0 }],
    ['latitude above range', { latitude: 90.000001, longitude: 0 }],
    ['longitude below range', { latitude: 0, longitude: -180.000001 }],
    ['longitude above range', { latitude: 0, longitude: 180.000001 }],
    ['latitude string', { latitude: '43.2', longitude: 76.8 }],
    ['longitude string', { latitude: 43.2, longitude: '76.8' }],
    ['latitude null', { latitude: null, longitude: 76.8 }],
    ['longitude null', { latitude: 43.2, longitude: null }],
    ['missing latitude', { longitude: 76.8 }],
    ['missing longitude', { latitude: 43.2 }],
    ['NaN latitude', { latitude: Number.NaN, longitude: 76.8 }],
    ['Infinity latitude', { latitude: Number.POSITIVE_INFINITY, longitude: 76.8 }],
    ['-Infinity latitude', { latitude: Number.NEGATIVE_INFINITY, longitude: 76.8 }],
    ['NaN longitude', { latitude: 43.2, longitude: Number.NaN }],
    ['Infinity longitude', { latitude: 43.2, longitude: Number.POSITIVE_INFINITY }],
    ['-Infinity longitude', { latitude: 43.2, longitude: Number.NEGATIVE_INFINITY }],
    ['unknown field', { latitude: 43.2, longitude: 76.8, accuracy: 10 }],
  ])('rejects %s', (_case, value) => {
    expect(locationGeoSchema.safeParse(value).success).toBe(false);
  });
});
