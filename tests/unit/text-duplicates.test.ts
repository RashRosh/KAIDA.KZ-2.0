import { describe, expect, it } from 'vitest';
import { compareNames, duplicateOutcome, lineDifferences } from '../../src/modules/seller-input/application/match-duplicates';
import type { DuplicateCandidate, DuplicateLineInput } from '../../src/modules/seller-input/contracts/duplicates.contract';
import { mergeRepeatedLines } from '../../src/modules/seller-text-input/application/merge-repeated-lines';
import type { ParsedTextLine } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { parsedTextLineSchema } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { claimsToParseResult } from '../../src/modules/seller-text-input/real-parser/c2-pipeline';

// text-duplicates (docs/slices/text-duplicates/SLICE_CONTRACT.md): comparison, outcomes, one line per product of a
// message, and the parser's «possibly merged» signs.
const line = (title: string, price: string | null, extra: Partial<ParsedTextLine> = {}): ParsedTextLine => ({
  title, price, unit: { code: 'package' }, pack: { amount: '400', unit: 'g' }, confidence: 'high', sourceQuote: `${title} ${price ?? ''}`.trim(), ...extra,
});
const card = (name: string, amount: string, pack: { amount: string; unit: 'g' | 'kg' } | null = { amount: '400', unit: 'g' }) => ({
  product: { id: null, name },
  pack,
  price: { amount, currency: 'KZT' as const, unit: 'упак.', unitChoice: { code: 'package' as const } },
});
const input = (l: ParsedTextLine): DuplicateLineInput => ({
  title: l.title, price: l.price, unit: l.unit, pack: l.pack, uncertain: l.uncertainFields ?? [], priceChoices: l.priceChoices,
});

describe('names: candidates are not proof (§3)', () => {
  it('the same words both ways only; a shorter or longer name is a difference', () => {
    expect(compareNames('Сметана Простоквашино', 'Сметана Простоквашино')).toBeNull();
    expect(compareNames('сметаны', 'Сметана')).toBeNull();
    expect(compareNames('Сметана', 'Сметана Простоквашино')).toEqual({ kind: 'nameLonger', cardTitle: 'Сметана Простоквашино' });
    expect(compareNames('Сметана домашняя', 'Сметана')).toEqual({ kind: 'nameShorter', cardTitle: 'Сметана' });
    expect(compareNames('Картошка', 'Картофель молодой')).toEqual({ kind: 'nameDiffers', cardTitle: 'Картофель молодой' });
  });
});

describe('differences and outcomes (§4.1, D-3)', () => {
  const live = (differences: DuplicateCandidate['differences'], status: 'live' | 'off' = 'live'): DuplicateCandidate =>
    ({ offerId: 'o', cardId: 'c', title: 't', packLabel: null, price: null, status, differences });

  it('same name, pack, unit and price → «Без изменений»', () => {
    const differences = lineDifferences(input(line('Сметана', '1200')), card('Сметана', '1200'));
    expect([differences, duplicateOutcome([live(differences)])]).toEqual([[], 'same']);
  });

  it('no price in the text → «без изменений» only when name, pack and unit match', () => {
    const same = lineDifferences(input(line('Сметана', null)), card('Сметана', '1200'));
    expect(duplicateOutcome([live(same)])).toBe('sameNoPrice');
    const noPack = lineDifferences(input(line('Сметана', null, { pack: null, unit: null })), card('Сметана', '1200'));
    expect(noPack.map((d) => d.kind)).toEqual(['priceNotStated', 'packNotInText']);
    expect(duplicateOutcome([live(noPack)])).toBe('differs');
  });

  it('a price, name, pack or unit difference → «Карточка уже есть» with each difference', () => {
    expect(lineDifferences(input(line('Сметана', '1300')), card('Сметана', '1200'))).toEqual([{ kind: 'price', card: '1200', text: '1300' }]);
    const kinds = lineDifferences(input(line('Сметана', '1200', { unit: { code: 'kg' }, uncertainFields: ['pack'] })), card('Сметана Простоквашино', '1200'))
      .map((d) => d.kind);
    expect(kinds).toEqual(['nameLonger', 'packUncertain', 'unitDiffers']);
  });

  it('several candidates, a switched-off card, no candidate', () => {
    expect(duplicateOutcome([live([]), live([])])).toBe('several');
    expect(duplicateOutcome([live([], 'off')])).toBe('off');
    expect(duplicateOutcome([])).toBe('gone');
  });

  it('a price conflict or a possibly merged item is never «без изменений»', () => {
    const conflict = lineDifferences(input(line('Сметана', null, { priceChoices: ['1200', '1300'] })), card('Сметана', '1200'));
    expect(conflict).toEqual([{ kind: 'priceConflict', prices: ['1200', '1300'] }]);
    expect(duplicateOutcome([live(conflict)])).toBe('differs');
    const merged = lineDifferences({ ...input(line('Сметана', '1200')), possiblyMerged: true }, card('Сметана', '1200'));
    expect(duplicateOutcome([live(merged)])).toBe('differs');
  });
});

describe('one line per product of a message (§4.2)', () => {
  it('same name, pack and unit: one line; two prices → empty price with both choices', () => {
    const merged = mergeRepeatedLines([line('Картошка', '250', { pack: null, unit: { code: 'kg' } }), line('картошка', '300', { pack: null, unit: { code: 'kg' } })]);
    expect(merged).toHaveLength(1);
    expect([merged[0]!.price, merged[0]!.priceChoices, merged[0]!.uncertainFields]).toEqual([null, ['250', '300'], ['price']]);
    parsedTextLineSchema.parse(merged[0]);
    expect(mergeRepeatedLines([line('Сметана', '1200'), line('Сметана', '1200')]).map((l) => l.price)).toEqual(['1200']);
  });

  it('different names, brands or packs are never glued', () => {
    const lines = [line('Сметана Простоквашино', '1200'), line('Сметана домашняя', '1500'), line('Сметана', '900', { pack: { amount: '200', unit: 'g' } })];
    expect(mergeRepeatedLines(lines).map((l) => [l.title, l.price])).toEqual([['Сметана Простоквашино', '1200'], ['Сметана домашняя', '1500'], ['Сметана', '900']]);
  });
});

describe('real parser: possibly merged items (§4.3)', () => {
  const have = (product: string, text: string, price: string) => ({ product, status: 'have', price, per: null, size: null, only: false, text });

  it('two «have» prices for one item → warning, empty price, both choices, original fragments', () => {
    const message = 'Сметана 1200. Сметана 1300.';
    const result = claimsToParseResult([have('сметана', 'Сметана 1200', '1200'), have('сметана', 'Сметана 1300', '1300')], message);
    expect(result.lines).toHaveLength(1);
    const [only] = result.lines;
    expect([only!.price, only!.priceChoices, only!.mergedFragments, only!.uncertainFields?.includes('title')])
      .toEqual([null, ['1200', '1300'], ['Сметана 1200', 'Сметана 1300'], true]);
    expect(only!.notice).toContain('Возможно, здесь несколько товаров. Проверьте название и цену.');
  });

  it('an explicit correction keeps slice 2 («later value»), no warning', () => {
    const message = 'Сметана 1200, нет, 1300.';
    const result = claimsToParseResult([
      have('сметана', 'Сметана 1200', '1200'),
      { product: 'сметана', status: 'fix', price: '1300', per: null, size: null, only: false, text: 'нет, 1300' },
    ], message);
    expect([result.lines[0]!.price, result.lines[0]!.priceChoices]).toEqual(['1300', undefined]);
  });
});
