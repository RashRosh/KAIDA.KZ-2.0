import { describe, expect, it } from 'vitest';
import { sellerSetupBodySchema } from '../../src/modules/sellers/contracts/seller.contract';

function body(overrides: Record<string, unknown> = {}) {
  return {
    seller: { displayName: '  Seller X  ' },
    location: { name: '  Point Y  ', type: 'shop', addressText: '  Address Z  ' },
    ...overrides,
  };
}

describe('S3 seller setup validation', () => {
  it('trims valid string fields', () => {
    const parsed = sellerSetupBodySchema.parse(body());
    expect(parsed).toEqual({
      seller: { displayName: 'Seller X' },
      location: { name: 'Point Y', type: 'shop', addressText: 'Address Z' },
    });
  });

  it.each([
    ['', false],
    ['   ', false],
    ['x'.repeat(120), true],
    ['x'.repeat(121), false],
  ])('validates Seller.displayName boundary %#', (displayName, valid) => {
    expect(sellerSetupBodySchema.safeParse(body({ seller: { displayName } })).success).toBe(valid);
  });

  it.each([
    ['', false],
    ['   ', false],
    ['x'.repeat(120), true],
    ['x'.repeat(121), false],
  ])('validates Location.name boundary %#', (name, valid) => {
    expect(sellerSetupBodySchema.safeParse(body({ location: { name, type: 'shop', addressText: 'Address' } })).success).toBe(valid);
  });

  it.each([
    ['', false],
    ['   ', false],
    ['x'.repeat(500), true],
    ['x'.repeat(501), false],
  ])('validates Location.addressText boundary %#', (addressText, valid) => {
    expect(sellerSetupBodySchema.safeParse(body({ location: { name: 'Point', type: 'shop', addressText } })).success).toBe(valid);
  });

  it.each(['market', 'shop', 'pavilion', 'home', 'other'])('accepts Location.type %s', (type) => {
    expect(sellerSetupBodySchema.safeParse(body({ location: { name: 'Point', type, addressText: 'Address' } })).success).toBe(true);
  });

  it('rejects invalid Location.type', () => {
    expect(sellerSetupBodySchema.safeParse(body({ location: { name: 'Point', type: 'warehouse', addressText: 'Address' } })).success).toBe(false);
  });

  it('is strict at root level', () => {
    expect(sellerSetupBodySchema.safeParse({ ...body(), userId: '50000000-0000-4000-8000-000000000001' }).success).toBe(false);
  });

  it('is strict at seller level and rejects ownership spoofing', () => {
    expect(sellerSetupBodySchema.safeParse(body({
      seller: { displayName: 'Seller', ownerUserId: '50000000-0000-4000-8000-000000000001' },
    })).success).toBe(false);
  });

  it('is strict at location level and rejects Seller id spoofing', () => {
    expect(sellerSetupBodySchema.safeParse(body({
      location: { name: 'Point', type: 'shop', addressText: 'Address', sellerId: '20000000-0000-4000-8000-000000000001' },
    })).success).toBe(false);
  });
});
