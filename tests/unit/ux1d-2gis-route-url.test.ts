import { describe, expect, it } from 'vitest';
import { build2GisRouteUrl } from '../../src/modules/offers/routing/build-2gis-route-url';

describe('UX1D 2GIS HTTPS route link', () => {
  it('uses the Kazakhstan host and the seller city for the seeded Almaty location', () => {
    const url = build2GisRouteUrl({
      latitude: 43.2636,
      longitude: 76.9568,
      addressText: 'Алматы, Зелёный базар, тестовый павильон 12',
    });
    expect(url).toBe('https://2gis.kz/almaty/directions/points/|76.9568,43.2636');
    expect(new URL(url).protocol).toBe('https:');
    expect(new URL(url).hostname).toBe('2gis.kz');
    expect(url).not.toContain('/from/');
    expect(url).not.toContain('key=');
    expect(url).not.toContain('Зелёный');
  });

  it.each([
    ['г. Алматы, Зелёный базар', 'almaty'],
    ['пр. Абая, 150, Алматы', 'almaty'],
    ['Almaty UX1D eligible', 'almaty'],
    ['Астана, проспект', 'astana'],
    ['Шымкент, улица', 'shymkent'],
  ])('uses supported explicit city in address %s', (addressText, city) => {
    const url = build2GisRouteUrl({ latitude: 43.238949, longitude: 76.889709, addressText });
    expect(url).toBe(`https://2gis.kz/${city}/directions/points/|76.889709,43.238949`);
  });

  it('unknown city never guesses Almaty or injects address into URL', () => {
    const url = build2GisRouteUrl({
      latitude: 49.8, longitude: 73.1, addressText: 'Караганда, тестовая точка',
    });
    expect(url).toBe('https://2gis.kz/directions/points/|73.1,49.8');
    expect(build2GisRouteUrl({ latitude: 1, longitude: 2, addressText: 'https://evil.test/, Алматы' }))
      .toBe('https://2gis.kz/almaty/directions/points/|2,1');
  });

  it('rejects invalid destination coordinates instead of constructing a route', () => {
    expect(() => build2GisRouteUrl({ latitude: 90.000001, longitude: 0 })).toThrow();
    expect(() => build2GisRouteUrl({ latitude: 0, longitude: Number.NaN })).toThrow();
  });
});
