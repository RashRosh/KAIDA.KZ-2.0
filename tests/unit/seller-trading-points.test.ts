import { describe, expect, it } from 'vitest';
import { automaticLocationId } from '../../src/app/seller/_components/offer-editor-state';
import { locationIdentitySchema, type LocationView } from '../../src/modules/locations/contracts/location.contract';
import type { SellerView } from '../../src/modules/sellers/contracts/seller.contract';

function sellerWith(locations: LocationView[]): SellerView {
  return { id: '20000000-0000-4000-8000-000000000036', displayName: 'Seller 36', locations };
}

function location(id: string): LocationView {
  return { id, name: `Point ${id}`, type: 'shop', addressText: `Address ${id}`, geo: null };
}

describe('Seller Trading Points pure contract logic', () => {
  it('auto-selects exactly one Location and never hides a default for zero or multiple Locations', () => {
    const first = location('30000000-0000-4000-8000-000000000361');
    const second = location('30000000-0000-4000-8000-000000000362');

    expect(automaticLocationId(null)).toBe('');
    expect(automaticLocationId(sellerWith([]))).toBe('');
    expect(automaticLocationId(sellerWith([first]))).toBe(first.id);
    expect(automaticLocationId(sellerWith([first, second]))).toBe('');
  });

  it('trims the strict identity payload and rejects missing, unknown, ownership, contact and coordinate fields', () => {
    expect(locationIdentitySchema.parse({ name: '  Point  ', type: 'market', addressText: '  Address  ' }))
      .toEqual({ name: 'Point', type: 'market', addressText: 'Address' });

    for (const invalid of [
      { name: '', type: 'shop', addressText: 'Address' },
      { name: 'Point', type: 'warehouse', addressText: 'Address' },
      { name: 'Point', type: 'shop', addressText: '' },
      { name: 'Point', type: 'shop', addressText: 'Address', sellerId: 'foreign' },
      { name: 'Point', type: 'shop', addressText: 'Address', phone: '+77000000000' },
      { name: 'Point', type: 'shop', addressText: 'Address', latitude: 43, longitude: 76 },
    ]) {
      expect(locationIdentitySchema.safeParse(invalid).success).toBe(false);
    }
  });
});
