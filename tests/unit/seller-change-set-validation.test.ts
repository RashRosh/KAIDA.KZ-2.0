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

  it('normalizes blank comment to null and keeps an explicit null unit', () => {
    const result = parse({ price: { amount: '4200.00', unit: null }, sellerComment: '   ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toEqual({ amount: '4200.00', unit: null });
      expect(result.data.sellerComment).toBeNull();
    }
  });

  it.each(['kg', 'piece', 'liter', 'package'])('accepts canonical unit %s and rejects a custom value on it', (code) => {
    const result = parse({ price: { amount: '1', unit: { code } } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.price.unit).toEqual({ code });
    expect(parse({ price: { amount: '1', unit: { code, value: 'ведро' } } }).success).toBe(false);
  });

  it('requires a trimmed 1–40 character value for other and rejects free text or unknown codes', () => {
    const trimmed = parse({ price: { amount: '1', unit: { code: 'other', value: '  ведро  ' } } });
    expect(trimmed.success).toBe(true);
    if (trimmed.success) expect(trimmed.data.price.unit).toEqual({ code: 'other', value: 'ведро' });
    expect(parse({ price: { amount: '1', unit: { code: 'other', value: 'x'.repeat(40) } } }).success).toBe(true);
    expect(parse({ price: { amount: '1', unit: { code: 'other', value: 'x'.repeat(41) } } }).success).toBe(false);
    expect(parse({ price: { amount: '1', unit: { code: 'other', value: '   ' } } }).success).toBe(false);
    expect(parse({ price: { amount: '1', unit: { code: 'other' } } }).success).toBe(false);
    expect(parse({ price: { amount: '1', unit: 'кг' } }).success).toBe(false);
    expect(parse({ price: { amount: '1', unit: { code: 'кг' } } }).success).toBe(false);
    expect(parse({ price: { amount: '1', unit: { code: 'gram' } } }).success).toBe(false);
  });

  it('accepts comment boundary and rejects values over it', () => {
    expect(parse({ sellerComment: 'x'.repeat(500) }).success).toBe(true);
    expect(parse({ sellerComment: 'x'.repeat(501) }).success).toBe(false);
  });

  it('keeps unit impossible outside price and rejects client currency', () => {
    expect(parse({ unit: { code: 'kg' } }).success).toBe(false);
    expect(parse({ price: { amount: '4200', unit: { code: 'kg' }, currency: 'USD' } }).success).toBe(false);
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
