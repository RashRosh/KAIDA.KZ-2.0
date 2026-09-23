import { z } from 'zod';
import type { Locale } from '../../../i18n/config';

// offer-price-unit: one owner for canonical unit codes, their localized labels and the structured input rule.
export const CANONICAL_PRICE_UNIT_CODES = ['kg', 'piece', 'liter', 'package'] as const;
export const PRICE_UNIT_CODES = [...CANONICAL_PRICE_UNIT_CODES, 'other'] as const;
export const PRICE_UNIT_CUSTOM_MAX_LENGTH = 40;

export type CanonicalPriceUnitCode = (typeof CANONICAL_PRICE_UNIT_CODES)[number];
export type PriceUnitCode = (typeof PRICE_UNIT_CODES)[number];
export type PriceUnit = { code: CanonicalPriceUnitCode } | { code: 'other'; value: string };

export const PRICE_UNIT_LABELS: Record<Locale, Record<PriceUnitCode, string>> = {
  ru: { kg: 'кг', piece: 'шт', liter: 'л', package: 'упак.', other: 'другое' },
  kk: { kg: 'кг', piece: 'дана', liter: 'л', package: 'қапт.', other: 'басқа' },
};

export const priceUnitInputSchema = z.union([
  z.object({ code: z.enum(CANONICAL_PRICE_UNIT_CODES) }).strict(),
  z.object({
    code: z.literal('other'),
    value: z.string().trim().min(1).max(PRICE_UNIT_CUSTOM_MAX_LENGTH),
  }).strict(),
]).nullable()
  .optional()
  .transform((value): PriceUnit | null => value ?? null);

function isCanonicalCode(code: string): code is CanonicalPriceUnitCode {
  return (CANONICAL_PRICE_UNIT_CODES as readonly string[]).includes(code);
}

export function priceUnitFromColumns(code: string | null, value: string | null): PriceUnit | null {
  if (code === null) return null;
  if (code === 'other' && value !== null) return { code: 'other', value };
  if (isCanonicalCode(code)) return { code };
  throw new Error('Stored price unit has an unsupported shape');
}

export function priceUnitToColumns(unit: PriceUnit | null): { priceUnitCode: PriceUnitCode | null; priceUnitValue: string | null } {
  if (unit === null) return { priceUnitCode: null, priceUnitValue: null };
  return unit.code === 'other'
    ? { priceUnitCode: 'other', priceUnitValue: unit.value }
    : { priceUnitCode: unit.code, priceUnitValue: null };
}

export function formatPriceUnit(unit: PriceUnit | null, locale: Locale = 'ru'): string | null {
  if (unit === null) return null;
  return unit.code === 'other' ? unit.value : PRICE_UNIT_LABELS[locale][unit.code];
}

export function samePriceUnit(left: PriceUnit | null, right: PriceUnit | null): boolean {
  if (left === null || right === null) return left === right;
  if (left.code !== right.code) return false;
  return left.code !== 'other' || left.value === (right as { value: string }).value;
}
