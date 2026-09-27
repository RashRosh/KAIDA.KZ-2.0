import { z } from 'zod';
import type { Locale } from '../../../i18n/config';

// seller-showcase-editor: optional weight or volume of one package or piece («Курага · 500 г»).
export const PACK_UNITS = ['g', 'kg', 'ml', 'l'] as const;
export type PackUnit = typeof PACK_UNITS[number];
export type Pack = { amount: string; unit: PackUnit };

export const PACK_UNIT_LABELS: Record<Locale, Record<PackUnit, string>> = {
  ru: { g: 'г', kg: 'кг', ml: 'мл', l: 'л' },
  kk: { g: 'г', kg: 'кг', ml: 'мл', l: 'л' },
};

export const PACK_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/;

export const packInputSchema = z.object({
  amount: z.string().trim().regex(PACK_AMOUNT_PATTERN).refine((value) => Number(value) > 0, 'Pack amount must be positive'),
  unit: z.enum(PACK_UNITS),
}).strict();

// Only packages and pieces have a pack; kg, l and custom units never do.
export function packAllowedFor(unitCode: string | null | undefined): boolean {
  return unitCode === 'package' || unitCode === 'piece';
}

function canonicalAmount(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed === '' ? String(Number(whole)) : `${Number(whole)}.${trimmed}`;
}

export function packFromColumns(amount: string | null, unit: string | null): Pack | null {
  if (amount === null || unit === null) return null;
  if (!(PACK_UNITS as readonly string[]).includes(unit)) throw new Error('Stored pack unit has an unsupported shape');
  return { amount: canonicalAmount(amount), unit: unit as PackUnit };
}

export function samePack(left: Pack | null, right: Pack | null): boolean {
  if (left === null || right === null) return left === right;
  return left.unit === right.unit && canonicalAmount(left.amount) === canonicalAmount(right.amount);
}

export function formatPack(pack: Pack | null, locale: Locale = 'ru'): string | null {
  if (pack === null) return null;
  return `${canonicalAmount(pack.amount).replace('.', ',')} ${PACK_UNIT_LABELS[locale][pack.unit]}`;
}
