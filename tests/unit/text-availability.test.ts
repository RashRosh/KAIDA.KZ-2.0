import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { samePackQuantity } from '../../src/modules/offers/pack/pack';
import { candidateStatus, fitsVariant, namesSameProduct } from '../../src/modules/seller-input/application/match-availability';
import type { TrackedAvailabilityItem } from '../../src/modules/seller-input/contracts/availability.contract';
import { parseFakeSellerText } from '../../src/modules/seller-text-input/parsers/fake-seller-text-parser';
import { claimsToParseResult } from '../../src/modules/seller-text-input/real-parser/c2-pipeline';
import { claimsFromAnswer, reduceClaims } from '../../src/modules/seller-text-input/real-parser/c2-reducer';
import { queryWords } from '../../src/modules/offers/title/offer-title';

// text-availability (docs/slices/text-availability/SLICE_CONTRACT.md): parse routing, variant states, matching rules.
type Claim = { product: string; status: string; price: string | null; per: string | null; size: string | null; only: boolean; text: string };
const none = (product: string, text: string, per: string | null = null, size: string | null = null): Claim =>
  ({ product, status: 'none', price: null, per, size, only: false, text });
const have = (product: string, text: string, price: string, per: string | null = null): Claim =>
  ({ product, status: 'have', price, per, size: null, only: false, text });

describe('parse result: «нет в наличии» statements (§4.1 item 1)', () => {
  it('a statement becomes `unavailable`, never a draft or a skipped entry', () => {
    const result = claimsToParseResult([none('Изюм', 'Изюм закончился')], 'Изюм закончился');
    expect([result.lines, result.skipped]).toEqual([[], []]);
    expect(result.unavailable).toEqual([{ label: 'Изюм', sourceQuote: 'Изюм закончился', variant: { state: 'none' } }]);
  });

  it('no pack words → none; words of another item in the same sentence are not this statement\'s', () => {
    const message = 'Картошка 250 за кг, сметаны нет.';
    const result = claimsToParseResult([have('Картошка', 'Картошка 250 за кг', '250', 'за кг'), none('сметана', 'сметаны нет')], message);
    expect(result.lines.map((line) => line.title)).toEqual(['Картошка']);
    expect(result.unavailable![0]!.variant).toEqual({ state: 'none' });
  });

  it('a recognised pack is bound, in the Seller\'s unit', () => {
    const message = 'Пельменей по 1 кг нет.';
    const result = claimsToParseResult([none('пельмени', 'Пельменей по 1 кг нет', null, '1 кг')], message);
    expect(result.unavailable![0]!.variant).toEqual({ state: 'bound', unit: null, pack: { amount: '1', unit: 'kg' } });
  });

  it('a unit named without a pack is bound', () => {
    const message = 'Картошки на кг нет.';
    const result = claimsToParseResult([none('картошка', 'Картошки на кг нет', 'кг')], message);
    expect(result.unavailable![0]!.variant).toEqual({ state: 'bound', unit: { code: 'kg' }, pack: null });
  });

  it.each([
    ['two packs where one is bound', 'Сметаны 0,4 кг и 1 кг нет.', none('сметана', 'Сметаны 0,4 кг и 1 кг нет', null, '0,4 кг')],
    ['a pack written but not taken by the model', 'Пельменей по 1 кг нет.', none('пельмени', 'Пельменей по 1 кг нет')],
    ['a pack the quote does not contain', 'Пельменей нет.', none('пельмени', 'Пельменей нет', null, '1 кг')],
    ['a unit outside the quote (dropped by the unit guard)', 'Сметаны нет, на кг тоже.', none('сметана', 'Сметаны нет', 'кг')],
    ['a quote that is not in the text', 'Сметаны нет.', none('сметана', 'Сметаны больше нет')],
  ])('uncertain: %s', (_name, message, claim) => {
    const result = claimsToParseResult([claim], message);
    expect(result.unavailable![0]!.variant.state).toBe('uncertain');
  });

  it('the uncertain warning quotes the Seller\'s own pack words', () => {
    const message = 'Сметаны 0,4 кг и 1 кг нет.';
    const result = claimsToParseResult([none('сметана', 'Сметаны 0,4 кг и 1 кг нет', null, '0,4 кг')], message);
    expect(result.unavailable![0]!.variant).toEqual({ state: 'uncertain', words: '0,4 кг, 1 кг' });
  });

  it('on the 28 saved C2 answers every out-of-stock item is a statement and drafts are unchanged', () => {
    const rows = (JSON.parse(readFileSync(join(__dirname, '../fixtures/seller-text-real-parser/control28.json'), 'utf8')) as {
      raw_and_cards: { condition: string; id: string; input: string; raw_output: string }[];
    }).raw_and_cards.filter((row) => row.condition === 'C2');
    const statements: string[] = [];
    for (const row of rows) {
      const parsed = claimsFromAnswer(row.raw_output);
      if ('error' in parsed) throw new Error(`saved C2 answer ${row.id} must parse`);
      const reduced = reduceClaims(parsed.claims, row.input).items;
      const result = claimsToParseResult(parsed.claims, row.input);
      expect(result.lines).toHaveLength(reduced.filter((item) => item.available !== false).length);
      expect(result.unavailable).toHaveLength(reduced.filter((item) => item.available === false).length);
      expect(result.skipped.some((entry) => entry.reason.includes('нет в наличии'))).toBe(false);
      for (const statement of result.unavailable ?? []) statements.push(`${row.id}: ${statement.label} ${statement.variant.state}`);
    }
    expect(statements.length).toBeGreaterThan(0);
    expect(statements.every((line) => line.endsWith(' none'))).toBe(true);
  });
});

describe('fake parser statements (CI and the acceptance stand)', () => {
  it('reads the three variant states and keeps drafts for the rest', () => {
    const result = parseFakeSellerText('Картошка 250 за кг. Сметаны нет. Пельменей по 1 кг нет. Сметаны 0,4 кг и 1 кг нет.');
    expect(result.lines.map((line) => line.title)).toEqual(['Картошка']);
    expect(result.unavailable).toEqual([
      { label: 'Сметана', sourceQuote: 'Сметаны нет', variant: { state: 'none' } },
      { label: 'Пельмени', sourceQuote: 'Пельменей по 1 кг нет', variant: { state: 'bound', unit: null, pack: { amount: '1', unit: 'kg' } } },
      { label: 'Сметана', sourceQuote: 'Сметаны 0,4 кг и 1 кг нет', variant: { state: 'uncertain', words: '0,4 кг, 1 кг' } },
    ]);
  });
});

describe('matching rules (§4.1 item 2)', () => {
  it('the same product by a reviewed word form or the catalog link; a bare prefix never counts', () => {
    expect(namesSameProduct(queryWords('сметаны'), null, { productId: null, title: 'Сметана' })).toBe(true);
    expect(namesSameProduct(queryWords('пельменей'), null, { productId: null, title: 'Пельмени домашние' })).toBe(true);
    expect(namesSameProduct(queryWords('лук'), null, { productId: null, title: 'Лукум' })).toBe(false);
    expect(namesSameProduct(queryWords('картошка'), 'p-1', { productId: 'p-1', title: 'Картофель молодой' })).toBe(true);
    expect(namesSameProduct(queryWords('картошка'), 'p-1', { productId: null, title: 'Картофель молодой' })).toBe(false);
  });

  it('a bound pack equal in base units decides the offer; none and uncertain keep every pack', () => {
    const kg1 = { pack: { amount: '1', unit: 'kg' as const }, price: null };
    const g500 = { pack: { amount: '500', unit: 'g' as const }, price: null };
    const bound = { state: 'bound' as const, unit: null, pack: { amount: '1000', unit: 'g' as const } };
    expect([fitsVariant(bound, kg1), fitsVariant(bound, g500)]).toEqual([true, false]);
    expect([fitsVariant({ state: 'none' }, g500), fitsVariant({ state: 'uncertain', words: null }, g500)]).toEqual([true, true]);
    const perKg = { pack: null, price: { amount: '300', currency: 'KZT' as const, unit: 'кг', unitChoice: { code: 'kg' as const } } };
    expect(fitsVariant({ state: 'bound', unit: { code: 'kg' }, pack: null }, perKg)).toBe(true);
    expect(fitsVariant({ state: 'bound', unit: { code: 'piece' }, pack: null }, perKg)).toBe(false);
  });

  it('pack quantities compare in base units, mass never equals volume', () => {
    expect(samePackQuantity({ amount: '0.5', unit: 'kg' }, { amount: '500', unit: 'g' })).toBe(true);
    expect(samePackQuantity({ amount: '0.5', unit: 'l' }, { amount: '500', unit: 'g' })).toBe(false);
    expect(samePackQuantity({ amount: '0.4', unit: 'kg' }, { amount: '1', unit: 'kg' })).toBe(false);
  });

  it('status: live, pending only at the proposal\'s revision, switched off here or before', () => {
    const tracked = (status: 'proposed' | 'confirmed', expectedRevision: number): TrackedAvailabilityItem[] =>
      [{ changeSetId: 'c', changeSetStatus: status, offerId: 'o', expectedRevision }];
    expect(candidateStatus({ id: 'o', status: 'active', revision: 3 }, [])).toEqual({ status: 'live', selectable: true });
    expect(candidateStatus({ id: 'o', status: 'active', revision: 3 }, tracked('proposed', 3))).toEqual({ status: 'pending', selectable: false });
    expect(candidateStatus({ id: 'o', status: 'active', revision: 4 }, tracked('proposed', 3))).toEqual({ status: 'live', selectable: true });
    expect(candidateStatus({ id: 'o', status: 'inactive', revision: 4 }, tracked('confirmed', 3))).toEqual({ status: 'off_here', selectable: false });
    expect(candidateStatus({ id: 'o', status: 'inactive', revision: 4 }, [])).toEqual({ status: 'off_before', selectable: false });
  });
});
