import { describe, expect, it } from 'vitest';
import {
  formatPriceUnit,
  priceUnitFromColumns,
  priceUnitInputSchema,
  priceUnitToColumns,
  samePriceUnit,
} from '../../src/modules/offers/price-unit/price-unit';
import { offerUpdateIsNoOp } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';

describe('offer-price-unit model', () => {
  it('treats a missing or null unit as no unit', () => {
    expect(priceUnitInputSchema.parse(undefined)).toBeNull();
    expect(priceUnitInputSchema.parse(null)).toBeNull();
  });

  it.each([
    ['kg', 'кг', 'кг'],
    ['piece', 'шт', 'дана'],
    ['liter', 'л', 'л'],
    ['package', 'упак.', 'қапт.'],
  ] as const)('renders canonical %s as %s in ru and %s in kk', (code, ru, kk) => {
    expect(formatPriceUnit({ code }, 'ru')).toBe(ru);
    expect(formatPriceUnit({ code }, 'kk')).toBe(kk);
    expect(formatPriceUnit({ code })).toBe(ru);
  });

  it('shows a custom value as written in every locale', () => {
    expect(formatPriceUnit({ code: 'other', value: 'ведро' }, 'ru')).toBe('ведро');
    expect(formatPriceUnit({ code: 'other', value: 'ведро' }, 'kk')).toBe('ведро');
    expect(formatPriceUnit(null, 'kk')).toBeNull();
  });

  it('round-trips through storage columns', () => {
    for (const unit of [null, { code: 'kg' as const }, { code: 'package' as const }, { code: 'other' as const, value: 'ведро' }]) {
      const columns = priceUnitToColumns(unit);
      expect(priceUnitFromColumns(columns.priceUnitCode, columns.priceUnitValue)).toEqual(unit);
    }
    expect(priceUnitToColumns({ code: 'kg' })).toEqual({ priceUnitCode: 'kg', priceUnitValue: null });
    expect(() => priceUnitFromColumns('gram', null)).toThrow();
    expect(() => priceUnitFromColumns('other', null)).toThrow();
  });

  it('compares units by code and custom value', () => {
    expect(samePriceUnit(null, null)).toBe(true);
    expect(samePriceUnit({ code: 'kg' }, null)).toBe(false);
    expect(samePriceUnit({ code: 'kg' }, { code: 'kg' })).toBe(true);
    expect(samePriceUnit({ code: 'kg' }, { code: 'piece' })).toBe(false);
    expect(samePriceUnit({ code: 'other', value: 'ведро' }, { code: 'other', value: 'ведро' })).toBe(true);
    expect(samePriceUnit({ code: 'other', value: 'ведро' }, { code: 'other', value: 'мешок' })).toBe(false);
  });

  it('treats a unit change as a real update', () => {
    const offer = { priceAmount: '100.00', priceCurrency: 'KZT', priceUnit: { code: 'kg' as const }, sellerComment: null };
    const same = sellerOfferChangeBodySchema.parse({ action: 'update_offer', price: { amount: '100', unit: { code: 'kg' } }, sellerComment: null });
    const changed = sellerOfferChangeBodySchema.parse({ action: 'update_offer', price: { amount: '100', unit: { code: 'piece' } }, sellerComment: null });
    if (same.action !== 'update_offer' || changed.action !== 'update_offer') throw new Error('unexpected action');
    expect(offerUpdateIsNoOp(offer, same)).toBe(true);
    expect(offerUpdateIsNoOp(offer, changed)).toBe(false);
  });
});
