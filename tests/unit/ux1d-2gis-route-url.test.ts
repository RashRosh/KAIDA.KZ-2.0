import { describe, expect, it } from 'vitest';
import { build2GisRouteUrl } from '../../src/modules/offers/routing/build-2gis-route-url';

describe('UX1D 2GIS route deeplink', () => {
  it('uses only the seller destination in documented longitude,latitude order', () => {
    const url = build2GisRouteUrl({ latitude: 43.238949, longitude: 76.889709 });
    expect(url).toBe('dgis://2gis.ru/routeSearch/rsType/car/to/76.889709,43.238949');
    expect(url).not.toContain('from/');
    expect(url).not.toContain('key=');
  });

  it('rejects invalid destination coordinates instead of constructing a route', () => {
    expect(() => build2GisRouteUrl({ latitude: 90.000001, longitude: 0 })).toThrow();
    expect(() => build2GisRouteUrl({ latitude: 0, longitude: Number.NaN })).toThrow();
  });
});
