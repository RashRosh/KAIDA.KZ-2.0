import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsedTextLineSchema, skippedTextLineSchema } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import {
  claimsToParseResult, guardPack, sellerPacks, validateClaim,
} from '../../src/modules/seller-text-input/real-parser/c2-pipeline';
import { claimsFromAnswer, reduceClaims } from '../../src/modules/seller-text-input/real-parser/c2-reducer';

// Deterministic safeguard tests (contract §6.2–§6.3, §9.1). Claims are hand-written model answers.
type Claim = { product: string | null; status: string; price?: string | null; per?: string | null; size?: string | null; only?: boolean; text: string };
const have = (product: string, text: string, price: string | null, per: string | null = null, size: string | null = null): Claim =>
  ({ product, status: 'have', price, per, size, only: false, text });

function run(message: string, claims: unknown[]) {
  const result = claimsToParseResult(claims, message);
  for (const line of result.lines) parsedTextLineSchema.parse(line);
  for (const entry of result.skipped) skippedTextLineSchema.parse(entry);
  return result;
}

describe('claim-level validation (§6.2)', () => {
  const message = 'Морковь 570 за кг';

  it.each([
    ['not an object', 'Морковь', 'Позиция 1'],
    ['unknown status', { product: 'Морковь', status: 'maybe', text: 'Морковь 570 за кг' }, 'Морковь'],
    ['missing product', { product: '', status: 'have', text: 'Морковь 570 за кг' }, 'Позиция 1'],
    ['wrong field type', { product: 'Морковь', status: 'have', price: { v: 570 }, text: 'Морковь 570 за кг' }, 'Морковь'],
    ['boolean as product', { product: true, status: 'have', text: 'Морковь 570 за кг' }, 'Позиция 1'],
    ['over-length field', { product: 'Морковь', status: 'have', per: 'к'.repeat(101), text: 'Морковь 570 за кг' }, 'Морковь'],
    ['bad only flag', { product: 'Морковь', status: 'have', only: 'maybe', text: 'Морковь 570 за кг' }, 'Морковь'],
  ])('%s → skipped with a visible reason, never a draft', (_name, claim, label) => {
    const result = run(message, [claim]);
    expect(result.lines).toEqual([]);
    expect(result.skipped).toEqual([expect.objectContaining({ label, reason: 'Ответ модели по этой позиции не распознан' })]);
  });

  it('shows a quote only when it is part of the seller text', () => {
    expect(validateClaim({ product: 'Морковь', status: 'bad', text: 'Морковь 570 за кг' }, 0, message))
      .toEqual({ skipped: { label: 'Морковь', reason: 'Ответ модели по этой позиции не распознан', sourceQuote: 'Морковь 570 за кг' } });
    expect(validateClaim({ product: 'Морковь', status: 'bad', text: 'выдуманная цитата' }, 0, message))
      .toEqual({ skipped: { label: 'Морковь', reason: 'Ответ модели по этой позиции не распознан', sourceQuote: null } });
  });

  it('ignores unknown extra keys and keeps the usable claim', () => {
    const result = run(message, [{ ...have('Морковь', 'Морковь 570 за кг', '570', 'за кг'), confidence: 0.9 }]);
    expect(result.lines.map((l) => [l.title, l.price, l.unit])).toEqual([['Морковь', '570', { code: 'kg' }]]);
  });

  it('an empty answer or all-unusable claims give zero drafts, not an error', () => {
    expect(run(message, [])).toEqual({ lines: [], skipped: [], notices: ['Строка не разобрана: «Морковь 570 за кг»', 'Число не использовано: 570'], unavailable: [] });
    expect(run(message, [1, 2]).lines).toEqual([]);
  });
});

describe('answer-level parsing (§6.2)', () => {
  it.each([
    ['prose without array', 'Извините, не могу помочь.', 'no_json'],
    ['invalid JSON array', '[{"product": "Морковь",}]', 'json_error'],
    ['object without claims', '{"answer": []}', 'not_list'],
  ])('%s is an answer-level failure', (_name, raw, error) => {
    const parsed = claimsFromAnswer(raw);
    expect('error' in parsed && parsed.error.startsWith(error)).toBe(true);
  });

  it('unwraps claims/items/data and strips a think block, as script 2.2', () => {
    expect(claimsFromAnswer('<think>x</think>{"claims": [1]}')).toEqual({ claims: [1] });
    expect(claimsFromAnswer('```json\n[]\n```')).toEqual({ claims: [] });
  });
});

describe('price assigned to the wrong product (§6.3)', () => {
  it('a number not bound to this product is dropped with a notice', () => {
    const message = 'Морковь есть, лук по 300.';
    const result = run(message, [have('Морковь', 'Морковь есть', '300'), have('лук', 'лук по 300', '300')]);
    expect(result.lines.map((l) => [l.title, l.price, l.uncertainFields, l.notice])).toEqual([
      ['Морковь', null, ['price'], 'Цена не привязана к товару — укажите цену'],
      ['лук', '300', ['unit'], 'Единица не указана рядом с товаром — проверьте'],
    ]);
  });

  it('a price bound across a clause is kept with a notice', () => {
    const message = 'Морковь свежая. По 300 за кг.';
    const [line] = run(message, [have('Морковь', 'Морковь свежая. По 300 за кг', '300', 'за кг')]).lines;
    expect([line!.price, line!.notice]).toEqual(['300', 'Проверьте цену']);
  });

  it('a price in a clause with command wording is kept with a notice', () => {
    const message = 'Для теста поставь морковь 5 за кг';
    const [line] = run(message, [have('морковь', 'морковь 5 за кг', '5', 'за кг')]).lines;
    expect([line!.price, line!.uncertainFields]).toEqual(['5', ['price']]);
  });

  it('a non-tenge price is not carried over', () => {
    const message = 'Морковь 5 долларов за кг';
    const [line] = run(message, [have('Морковь', 'Морковь 5 долларов за кг', '5', 'за кг')]).lines;
    expect([line!.price, line!.notice]).toEqual([null, 'Цена указана не в тенге — укажите цену в тенге']);
  });

  it('a later correction keeps the later value', () => {
    const message = 'Кешью по 6000 за килограмм. Нет, кешью уже 6500.';
    const result = run(message, [
      have('Кешью', 'Кешью по 6000 за килограмм', '6000', 'за килограмм'),
      { product: 'кешью', status: 'fix', price: '6500', per: null, size: null, only: false, text: 'Нет, кешью уже 6500' },
    ]);
    expect(result.lines.map((l) => [l.title, l.price, l.unit])).toEqual([['Кешью', '6500', { code: 'kg' }]]);
  });
});

describe('unit assigned to the wrong product (§6.3)', () => {
  it('REAL_04: the neighbour’s «за кг» outside the item quote is not carried over', () => {
    const message = 'Помидоры по 700 нет подождите по 650 за кг, огурцы по 500';
    const result = run(message, [
      have('Помидоры', 'подождите по 650 за кг', '650', 'за кг'),
      have('огурцы', 'огурцы по 500', '500', 'за кг'),
    ]);
    expect(result.lines.map((l) => [l.title, l.price, l.unit, l.notice])).toEqual([
      ['Помидоры', '650', { code: 'kg' }, undefined],
      ['огурцы', '500', null, 'Единица не указана рядом с товаром — проверьте'],
    ]);
  });

  it('a unit after another product in the quote is not this product’s unit', () => {
    const message = 'Огурцы 500, помидоры 650 за кг';
    const result = run(message, [
      have('Огурцы', 'Огурцы 500, помидоры 650 за кг', '500', 'за кг'),
      have('помидоры', 'помидоры 650 за кг', '650', 'за кг'),
    ]);
    expect(result.lines.map((l) => [l.title, l.unit])).toEqual([['Огурцы', null], ['помидоры', { code: 'kg' }]]);
  });

  it('a quote that is not in the text cannot confirm a unit', () => {
    const [line] = run('Огурцы 500', [have('Огурцы', 'Огурцы 500 за кг', '500', 'за кг')]).lines;
    expect([line!.unit, line!.uncertainFields]).toEqual([null, ['title', 'unit']]);
  });
});

describe('packaging (§6.3)', () => {
  it('an equivalent normalization is accepted and shown in the seller’s unit', () => {
    expect(guardPack({ amount: '0.5', unit: 'kg' }, 'Курага пачка 500 г 1200')).toEqual({ pack: { amount: '500', unit: 'g' }, mismatch: false });
    const [line] = run('Курага пачка 500 г 1200', [have('Курага', 'Курага пачка 500 г 1200', '1200', 'пачка', '0,5 кг')]).lines;
    expect([line!.unit, line!.pack, line!.notice]).toEqual([{ code: 'package' }, { amount: '500', unit: 'g' }, undefined]);
  });

  it('a non-equivalent pack is rejected with a notice', () => {
    expect(guardPack({ amount: '1', unit: 'kg' }, 'Курага пачка 500 г')).toEqual({ pack: null, mismatch: true });
    expect(guardPack({ amount: '500', unit: 'ml' }, 'Курага пачка 500 г')).toEqual({ pack: null, mismatch: true });
    const [line] = run('Курага пачка 500 г 1200', [have('Курага', 'Курага пачка 500 г 1200', '1200', 'пачка', '1 кг')]).lines;
    expect([line!.pack, line!.notice]).toEqual([null, 'Фасовка не совпадает с текстом — проверьте']);
  });

  it('«пол кило» is 0.5 kg', () => {
    expect(sellerPacks('пельмени, пачка пол кило — 1400')).toContainEqual({ amount: '0.5', unit: 'kg' });
    const message = 'пельмени наши, пачка пол кило — 1400 тенге';
    const [line] = run(message, [have('пельмени наши', message, '1400', 'пачка', 'пол кило')]).lines;
    expect([line!.unit, line!.pack]).toEqual([{ code: 'package' }, { amount: '0.5', unit: 'kg' }]);
  });

  it('a count of packages is not a pack size', () => {
    const message = 'Сок: 2 литровых по 900';
    const [line] = run(message, [have('Сок', message, '900', null, '2 литровых')]).lines;
    expect([line!.pack, line!.uncertainFields]).toEqual([null, ['unit', 'pack']]);
  });

  it('a pack stated with a per-kg price is not silently lost', () => {
    const message = 'Сыр, упаковка 300 г, по 4000 за кг';
    const [line] = run(message, [have('Сыр', message, '4000', 'за кг', '300 г')]).lines;
    expect([line!.unit, line!.pack, line!.notice]).toEqual([{ code: 'kg' }, null, 'Фасовка из текста не перенесена']);
  });
});

describe('out of stock, overflow and omission hints (§6.3)', () => {
  // Revised by text-availability (D-A): out-of-stock mentions are statements for «Нет в наличии», not skipped entries.
  it('an out-of-stock mention becomes a statement, no draft is created', () => {
    const result = run('Изюм закончился', [{ product: 'Изюм', status: 'none', price: null, per: null, size: null, only: false, text: 'Изюм закончился' }]);
    expect([result.lines, result.skipped]).toEqual([[], []]);
    expect(result.unavailable).toEqual([{ label: 'Изюм', sourceQuote: 'Изюм закончился', variant: { state: 'none' } }]);
  });

  it('more than 30 items: the first 30 become drafts, the rest are listed', () => {
    const consonants = 'бвгджзклмнпрстфхцчшщ';
    // distinct products: the reducer's stemming would merge names that differ only by an ending
    const names = Array.from({ length: 32 }, (_, i) => `Сорт${consonants[i % 20]}${consonants[Math.floor(i / 20) + 3]}`);
    const message = names.map((n, i) => `${n} ${100 + i}`).join('\n');
    const result = run(message, names.map((n, i) => have(n, `${n} ${100 + i}`, String(100 + i))));
    expect(result.lines).toHaveLength(30);
    expect(result.skipped.map((s) => s.reason)).toEqual(['Не больше 30 позиций за раз', 'Не больше 30 позиций за раз']);
  });

  it('a whole line the model skipped is listed as not parsed', () => {
    const message = 'Морковь 570 за кг\nВиноград 1200 за кг';
    const result = run(message, [have('Морковь', 'Морковь 570 за кг', '570', 'за кг')]);
    expect(result.notices).toEqual(['Строка не разобрана: «Виноград 1200 за кг»', 'Число не использовано: 1200']);
  });

  it('an omitted product inside a covered sentence is NOT detected (no completeness claim)', () => {
    const message = 'Есть редис, виноград и яблоки. Моркови нет в наличии.';
    const result = run(message, [
      { product: 'редис', status: 'have', price: null, per: null, size: null, only: false, text: 'Есть редис, виноград и яблоки' },
      { product: 'моркови', status: 'none', price: null, per: null, size: null, only: false, text: 'Моркови нет в наличии' },
    ]);
    expect(result.lines.map((l) => l.title)).toEqual(['редис']);
    expect(result.notices).toEqual([]);
  });
});

describe('effect of the safeguards on the 28 saved C2 answers (§9.1)', () => {
  const rows = (JSON.parse(readFileSync(join(__dirname, '../fixtures/seller-text-real-parser/control28.json'), 'utf8')) as {
    raw_and_cards: { condition: string; id: string; input: string; raw_output: string }[];
  }).raw_and_cards.filter((row) => row.condition === 'C2');

  it('changes exactly the REAL_04 cucumber unit and adds no omission hints', () => {
    const changes: string[] = [];
    const notices: string[] = [];
    for (const row of rows) {
      const parsed = claimsFromAnswer(row.raw_output);
      if ('error' in parsed) throw new Error(`saved C2 answer ${row.id} must parse`);
      const reduced = reduceClaims(parsed.claims, row.input).items.filter((item) => item.available !== false);
      const result = run(row.input, parsed.claims);
      expect(result.lines).toHaveLength(reduced.length);
      reduced.forEach((item, k) => {
        const line = result.lines[k]!;
        const before = JSON.stringify([item.title, item.price, item.unit, item.pack]);
        const after = JSON.stringify([line.title, line.price, line.unit, line.pack]);
        if (before !== after) changes.push(`${row.id}: ${before} → ${after}`);
        if (line.notice) notices.push(`${row.id}/${line.title}: ${line.notice}`);
      });
      for (const hint of result.notices ?? []) notices.push(`${row.id}: ${hint}`);
    }
    expect(changes).toEqual(['REAL_04: ["огурцы","500",{"code":"kg"},null] → ["огурцы","500",null,null]']);
    expect(notices).toEqual([
      'REAL_04/огурцы: Единица не указана рядом с товаром — проверьте',
      'slang_noise_00/свёкла: Единица не указана рядом с товаром — проверьте',
    ]);
  });
});
