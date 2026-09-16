import { describe, expect, it } from 'vitest';
import { sellerChangeSetCreateBodySchema, sellerChangeSetIdSchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';

const locationId = '30000000-0000-4000-8000-000000000901';

function parse(overrides: Record<string, unknown> = {}) {
  return sellerChangeSetCreateBodySchema.safeParse({
    productName: '  Баранина  ',
    locationId,
    price: { amount: '1' },
    ...overrides,
  });
}

describe('S4 Seller Change Set validation after Mandatory Offer Price', () => {
  it('requires price and trims Product while normalizing optional unit/comment', () => {
    expect(sellerChangeSetCreateBodySchema.safeParse({ productName: 'Баранина', locationId }).success).toBe(false);
    expect(parse({ price: null }).success).toBe(false);

    const result = parse();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        productName: 'Баранина',
        locationId,
        price: { amount: '1', unit: null },
        sellerComment: null,
      });
    }
  });

  it.each(['0', '1', '4200', '4200.5', '4200.50', '999999999999.99'])('accepts price amount %s', (amount) => {
    const result = parse({ price: { amount } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.price).toEqual({ amount, unit: null });
  });

  it.each(['-1', '+1', '1e3', 'NaN', 'Infinity', '1.234', '1000000000000', '12,50', 'abc'])('rejects price amount %s', (amount) => {
    expect(parse({ price: { amount } }).success).toBe(false);
  });

  it('normalizes blank unit and comment to null', () => {
    const result = parse({ price: { amount: '4200.00', unit: '   ' }, sellerComment: '   ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toEqual({ amount: '4200.00', unit: null });
      expect(result.data.sellerComment).toBeNull();
    }
  });

  it('accepts unit/comment boundaries and rejects values over them', () => {
    expect(parse({ price: { amount: '1', unit: 'x'.repeat(32) }, sellerComment: 'x'.repeat(500) }).success).toBe(true);
    expect(parse({ price: { amount: '1', unit: 'x'.repeat(33) } }).success).toBe(false);
    expect(parse({ sellerComment: 'x'.repeat(501) }).success).toBe(false);
  });

  it('keeps unit impossible outside price and rejects client currency', () => {
    expect(parse({ unit: 'кг' }).success).toBe(false);
    expect(parse({ price: { amount: '4200', unit: 'кг', currency: 'USD' } }).success).toBe(false);
  });

  it.each([
    { sellerId: '20000000-0000-4000-8000-000000000001' },
    { ownerUserId: '50000000-0000-4000-8000-000000000001' },
    { status: 'confirmed' },
    { resultOfferId: '40000000-0000-4000-8000-000000000001' },
  ])('rejects spoofed or unknown root fields', (extra) => {
    expect(parse(extra).success).toBe(false);
  });

  it('rejects blank Product and invalid Location UUID', () => {
    expect(parse({ productName: '   ' }).success).toBe(false);
    expect(parse({ locationId: 'not-a-uuid' }).success).toBe(false);
  });

  it('validates Change Set UUID path values', () => {
    expect(sellerChangeSetIdSchema.safeParse('60000000-0000-4000-8000-000000000001').success).toBe(true);
    expect(sellerChangeSetIdSchema.safeParse('bad-id').success).toBe(false);
  });
});
