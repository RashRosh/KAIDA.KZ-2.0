import { searchWords } from '../../offers/title/offer-title';
import { getWordFormDictionary, type WordFormDictionary } from '../../search/word-forms/word-forms';
import type { ParsedTextLine } from '../contracts/seller-text-input.contract';

// text-duplicates §4.2: one line per product of a message. Two lines are the same line only when their names have the
// same words both ways (equal or a reviewed form), the same pack and the same unit; different names, brands,
// characteristics or packs stay separate. Different prices are never resolved here: the line keeps both as choices and
// an empty price, so its draft cannot be published until the Seller chooses.

export const PRICE_CONFLICT_NOTICE = 'В тексте разные цены — выберите цену';

function nameKey(title: string, dictionary: WordFormDictionary): string {
  const canonical = searchWords(title).map((word) => [...(dictionary.formsOf(word) ?? [word])].sort()[0]!);
  return [...new Set(canonical)].sort().join(' ');
}

function packKey(pack: ParsedTextLine['pack']): string {
  if (!pack) return '-';
  const factor = pack.unit === 'kg' || pack.unit === 'l' ? 1000 : 1;
  return `${pack.unit === 'ml' || pack.unit === 'l' ? 'v' : 'm'}${Math.round(Number(pack.amount) * factor * 1000)}`;
}

function unitKey(unit: ParsedTextLine['unit']): string {
  if (!unit) return '-';
  return unit.code === 'other' ? `other:${unit.value.toLowerCase()}` : unit.code;
}

function withConflict(line: ParsedTextLine, prices: string[]): ParsedTextLine {
  const fields = new Set(line.uncertainFields ?? []);
  fields.add('price');
  const notice = [line.notice, PRICE_CONFLICT_NOTICE].filter(Boolean).join('; ');
  return { ...line, price: null, priceChoices: prices, uncertainFields: [...fields], confidence: 'low', notice: notice.slice(0, 300) };
}

export function mergeRepeatedLines(lines: ParsedTextLine[], dictionary: WordFormDictionary = getWordFormDictionary()): ParsedTextLine[] {
  const groups = new Map<string, ParsedTextLine[]>();
  const order: string[] = [];
  for (const line of lines) {
    const key = `${nameKey(line.title, dictionary)}|${packKey(line.pack)}|${unitKey(line.unit)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(line);
  }
  return order.map((key) => {
    const group = groups.get(key)!;
    const first = group[0]!;
    const prices = [...new Set(group.flatMap((line) => [...(line.priceChoices ?? []), ...(line.price ? [line.price] : [])]))];
    const quotes = [...new Set(group.map((line) => line.sourceQuote).filter((quote): quote is string => Boolean(quote)))];
    // Same name, pack and unit: one line by this rule, not a «possibly merged» parser item (that comes from the parser).
    const merged: ParsedTextLine = group.length === 1 ? first : { ...first, sourceQuote: quotes.join(' … ').slice(0, 500) || null };
    if (prices.length > 1) return withConflict(merged, prices);
    return group.length === 1 ? first : { ...merged, price: prices[0] ?? null };
  });
}
