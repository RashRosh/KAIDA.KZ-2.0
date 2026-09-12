import { describe, expect, it } from 'vitest';
import { offerUpdateIsNoOp } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import {
  sellerOfferChangeBodySchema,
  sellerOfferIdSchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';

function parse(value: unknown) {
  return sellerOfferChangeBodySchema.safeParse(value);
}

describe('S5 seller offer management validation', () => {
  it('accepts full-state update and trims unit/comment', () => {
    const result = parse({
      action: 'update_offer',
      price: { amount: '4500.00', unit: '  кг  ' },
      sellerComment: '  Новая партия  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        action: 'update_offer',
        price: { amount: '4500.00', unit: 'кг' },
        sellerComment: 'Новая партия',
      });
    }
  });

  it('accepts explicit nulls as clear operations', () => {
    expect(parse({ action: 'update_offer', price: null, sellerComment: null })).toMatchObject({
      success: true,
      data: { action: 'update_offer', price: null, sellerComment: null },
    });
  });

  it('requires both update keys and has no partial patch semantics', () => {
    expect(parse({ action: 'update_offer', price: null }).success).toBe(false);
    expect(parse({ action: 'update_offer', sellerComment: null }).success).toBe(false);
    expect(parse({ action: 'update_offer' }).success).toBe(false);
  });

  it.each(['0', '1', '4200', '4200.5', '4200.50', '999999999999.99'])('accepts S4-compatible price %s', (amount) => {
    expect(parse({ action: 'update_offer', price: { amount }, sellerComment: null }).success).toBe(true);
  });

  it.each(['-1', '+1', '1e3', 'NaN', 'Infinity', '1.234', '1000000000000', '12,50', 'abc'])('rejects invalid price %s', (amount) => {
    expect(parse({ action: 'update_offer', price: { amount }, sellerComment: null }).success).toBe(false);
  });

  it('normalizes blank update unit/comment to null', () => {
    const result = parse({ action: 'update_offer', price: { amount: '12.50', unit: '   ' }, sellerComment: '   ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toEqual({ amount: '12.50', unit: null });
      expect(result.data.sellerComment).toBeNull();
    }
  });

  it('allows only exact status action shapes', () => {
    expect(parse({ action: 'deactivate_offer' }).success).toBe(true);
    expect(parse({ action: 'activate_offer' }).success).toBe(true);
    expect(parse({ action: 'deactivate_offer', sellerComment: null }).success).toBe(false);
    expect(parse({ action: 'activate_offer', price: null }).success).toBe(false);
  });

  it.each([
    'sellerId',
    'userId',
    'productId',
    'locationId',
    'targetOfferId',
    'expectedOfferRevision',
    'revision',
    'currency',
    'status',
    'resultOfferId',
  ])('rejects forbidden client field %s', (field) => {
    expect(parse({ action: 'activate_offer', [field]: 'spoof' }).success).toBe(false);
  });

  it('detects normalized semantic no-op instead of raw string equality', () => {
    const parsed = sellerOfferChangeBodySchema.parse({
      action: 'update_offer',
      price: { amount: '4500.0', unit: ' кг ' },
      sellerComment: ' Свежая партия ',
    });
    if (parsed.action !== 'update_offer') throw new Error('unexpected action');

    expect(offerUpdateIsNoOp({
      priceAmount: '4500.00',
      priceCurrency: 'KZT',
      priceUnit: 'кг',
      sellerComment: 'Свежая партия',
    }, parsed)).toBe(true);

    expect(offerUpdateIsNoOp({
      priceAmount: null,
      priceCurrency: null,
      priceUnit: null,
      sellerComment: null,
    }, sellerOfferChangeBodySchema.parse({ action: 'update_offer', price: null, sellerComment: null }) as Extract<typeof parsed, { action: 'update_offer' }>)).toBe(true);

    expect(offerUpdateIsNoOp({
      priceAmount: '4501.00',
      priceCurrency: 'KZT',
      priceUnit: 'кг',
      sellerComment: 'Свежая партия',
    }, parsed)).toBe(false);
  });

  it('validates offer UUID path values', () => {
    expect(sellerOfferIdSchema.safeParse('40000000-0000-4000-8000-000000000001').success).toBe(true);
    expect(sellerOfferIdSchema.safeParse('bad-id').success).toBe(false);
  });
});
