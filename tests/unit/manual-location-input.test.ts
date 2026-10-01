import { describe, expect, it } from 'vitest';
import { parseManualLocationInput } from '../../src/modules/locations/contracts/manual-location-input';

describe('Seller Location manual geo input', () => {
  it.each([
    ['raw pair', '43.238949, 76.889709', { latitude: 43.238949, longitude: 76.889709, source: 'coordinates' }],
    ['raw pair with trailing label', '43.238949, 76.889709 Алматы', { latitude: 43.238949, longitude: 76.889709, source: 'coordinates' }],
    ['Google Maps path', 'https://www.google.com/maps/place/Almaty/@43.238949,76.889709,17z', { latitude: 43.238949, longitude: 76.889709, source: 'google-maps' }],
    ['Google Maps query', 'https://maps.google.com/?q=43.238949,76.889709', { latitude: 43.238949, longitude: 76.889709, source: 'google-maps' }],
    ['Yandex Maps ll', 'https://yandex.kz/maps/?ll=76.889709%2C43.238949&z=16', { latitude: 43.238949, longitude: 76.889709, source: 'yandex-maps' }],
    ['2GIS query', 'https://2gis.kz/almaty?m=76.889709%2C43.238949%2F16', { latitude: 43.238949, longitude: 76.889709, source: '2gis' }],
    ['2GIS geo path', 'https://2gis.kz/almaty/geo/70000001000000000/76.889709,43.238949', { latitude: 43.238949, longitude: 76.889709, source: '2gis' }],
  ])('parses %s', (_case, input, expected) => {
    expect(parseManualLocationInput(input)).toEqual(expected);
  });

  it.each([
    '',
    'not coordinates',
    '91, 76',
    '43, 181',
    'https://example.com/place/43.238949,76.889709',
    'https://goo.gl/maps/short-link-without-coordinates',
    'https://yandex.kz/maps/-/short-link',
    'https://2gis.kz/almaty/firm/short-link-without-coordinates',
  ])('rejects input that cannot be resolved locally: %s', (input) => {
    expect(parseManualLocationInput(input)).toBeNull();
  });
});
