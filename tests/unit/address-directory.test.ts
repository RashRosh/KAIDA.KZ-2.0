import { describe, expect, it } from 'vitest';
import { addressSearchText, normalizeAddressSearch } from '../../src/modules/address-directory/search/normalize-address-search';
import { deduplicateAddressDirectoryEntries, transformOsmFeature } from '../../src/modules/address-directory/import/osm-feature-transform';

describe('address directory pure data preparation', () => {
  it('normalizes case, ё and punctuation for deterministic search', () => {
    expect(normalizeAddressSearch('  ЖЁЛТОҚСАН — 12/3 ')).toBe('желтоқсан 12 3');
    expect(addressSearchText(['Абая', 'абая', ' Алматы, Абая '])).toBe('абая алматы абая');
  });

  it('keeps seller-relevant addresses, named streets and markets while rejecting generic objects', () => {
    expect(transformOsmFeature({ id: 'n1', geometry: { coordinates: [76.91, 43.25] }, properties: {
      '@id': 'n1', 'addr:street': 'Абая', 'addr:housenumber': '10',
    } })).toMatchObject({ sourceKey: 'osm:n1', kind: 'address', displayName: 'Абая, 10', addressText: 'Алматы, Абая, 10' });
    expect(transformOsmFeature({ id: 'r2', geometry: { coordinates: [[[76.9, 43.2], [76.92, 43.24]]] }, properties: {
      '@id': 'r2', amenity: 'marketplace', name: 'Зелёный базар',
    } })).toMatchObject({ sourceKey: 'osm:r2', kind: 'marketplace', displayName: 'Зелёный базар' });
    expect(transformOsmFeature({ id: 'w3', geometry: { coordinates: [[76.9, 43.2], [76.91, 43.21]] }, properties: {
      '@id': 'w3', highway: 'residential', name: 'Улица Жёлтоксан',
    } })).toMatchObject({ sourceKey: 'street:улица желтоксан', kind: 'street' });
    expect(transformOsmFeature({ id: 'n4', geometry: { coordinates: [76.9, 43.2] }, properties: { '@id': 'n4', amenity: 'bench' } })).toBeNull();
  });

  it('deduplicates repeated visible objects and street segments', () => {
    const first = transformOsmFeature({ id: 'w1', geometry: { coordinates: [[76.9, 43.2], [76.91, 43.21]] }, properties: { '@id': 'w1', highway: 'primary', name: 'Абая' } })!;
    const second = transformOsmFeature({ id: 'w2', geometry: { coordinates: [[76.92, 43.22], [76.93, 43.23]] }, properties: { '@id': 'w2', highway: 'primary', name: 'Абая' } })!;
    expect(deduplicateAddressDirectoryEntries([first, second])).toEqual([first]);
  });
});
