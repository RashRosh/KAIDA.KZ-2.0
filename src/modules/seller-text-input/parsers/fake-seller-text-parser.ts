import type {
  ParsedTextLine, SellerTextParseResult, SkippedTextLine, UnavailableStatement,
} from '../contracts/seller-text-input.contract';

const FIXTURES: Record<string, SellerTextParseResult> = {
  'switch-on-no-price': { lines: [{ title: 'Кефир', price: null, unit: { code: 'package' }, pack: { amount: '1', unit: 'l' }, confidence: 'high', sourceQuote: 'Кефир за упаковку 1 л' }], skipped: [] },
  'e2e-catalog': {
    lines: [{ title: 'Баранина', price: '4500', unit: { code: 'kg' }, pack: null, confidence: 'high', sourceQuote: 'Баранина 4500 за кг' }],
    skipped: [],
  },
  'e2e-free-title': {
    lines: [{
      title: 'Наши пельмени',
      price: '1400',
      unit: { code: 'package' },
      pack: { amount: '500', unit: 'g' },
      confidence: 'high',
      sourceQuote: 'Наши пельмени 1400 упаковка 500 г',
    }],
    skipped: [],
  },
  'e2e-multi': {
    lines: [
      { title: 'Баранина', price: '4500', unit: { code: 'kg' }, pack: null, confidence: 'high', sourceQuote: 'Баранина 4500 кг' },
      { title: 'Укроп', price: '200', unit: { code: 'piece' }, pack: null, confidence: 'high', sourceQuote: 'Укроп 200 шт' },
    ],
    skipped: [],
  },
  'e2e-skipped': {
    lines: [{ title: 'Баранина', price: '4500', unit: { code: 'kg' }, pack: null, confidence: 'high', sourceQuote: 'Баранина 4500 кг' }],
    skipped: [{ label: 'Виноград', reason: 'Товар упомянут, но не распознан', sourceQuote: 'виноград ещё ждём' }],
  },
  'e2e-uncertain': {
    lines: [{
      title: 'Огурцы',
      price: '700',
      unit: null,
      pack: null,
      confidence: 'low',
      sourceQuote: 'Огурцы 700',
    }],
    skipped: [],
  },
};

function fixtureKey(text: string): string | null {
  const marker = text.match(/\[fixture:([a-z0-9-]+)\]/i);
  return marker?.[1] ?? null;
}

function parseUnit(word: string | undefined): ParsedTextLine['unit'] {
  if (!word) return null;
  const w = word.toLowerCase().replace(/\./g, '');
  if (['кг', 'кило', 'килограмм', 'kg'].includes(w)) return { code: 'kg' };
  if (['л', 'литр', 'liter', 'l'].includes(w)) return { code: 'liter' };
  if (['шт', 'штук', 'штука', 'piece'].includes(w)) return { code: 'piece' };
  if (w.startsWith('упак') || w.startsWith('пачк')) return { code: 'package' };
  return null;
}

function parsePack(text: string): ParsedTextLine['pack'] {
  // `\w` is ASCII-only in JavaScript, so «упаковку 400 г» needs `\p{L}` (text-duplicates acceptance texts).
  const m = text.match(/(?:упаковк\p{L}*|пачк\p{L}*|pack)\s*(\d+(?:[.,]\d+)?)\s*(г|кг|g|kg|мл|л|ml|l)/iu);
  if (!m) return null;
  const amount = m[1].replace(',', '.');
  const rawUnit = m[2].toLowerCase();
  const unit = rawUnit === 'г' || rawUnit === 'g' ? 'g'
    : rawUnit === 'кг' || rawUnit === 'kg' ? 'kg'
      : rawUnit === 'мл' || rawUnit === 'ml' ? 'ml' : 'l';
  return { amount, unit };
}

function parseSegment(segment: string): ParsedTextLine | null {
  const trimmed = segment.trim();
  if (trimmed.length < 2) return null;
  const priceMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(?:тенге|₸|тг)?(?:\s*(?:за\s+)?(кг|кило|килограмм|л|литр|шт\.?|штук\w*|упаковк\w*|пачк\w*))?/iu);
  if (!priceMatch) return null;
  const price = priceMatch[1].replace(',', '.');
  const unit = parseUnit(priceMatch[2]);
  const beforePrice = trimmed.slice(0, priceMatch.index).replace(/[,\-–—]+$/u, '').trim();
  const title = beforePrice.replace(/^(есть|в наличии)\s+/iu, '').trim();
  if (title.length < 1) return null;
  const pack = parsePack(trimmed);
  const confidence = unit ? 'high' : 'low';
  return {
    title,
    price,
    unit,
    pack,
    confidence,
    sourceQuote: trimmed,
  };
}

// text-availability: the test parser's «нет в наличии» — «Сметаны нет», «Пельменей по 1 кг нет», «Сметаны 0,4 кг и 1 кг
// нет». A small genitive → title map keeps CI and the acceptance stand deterministic; the real parser does not use it.
const FAKE_TITLES: Record<string, string> = {
  сметаны: 'Сметана', пельменей: 'Пельмени', сыра: 'Сыр', чеснока: 'Чеснок', моркови: 'Морковь', лука: 'Лук',
  перца: 'Перец', молока: 'Молоко', картошки: 'Картошка', баранины: 'Баранина',
};
const OUT_OF_STOCK_RE = /^(.+?)\s+(?:нет(?:\s+в\s+наличии)?|закончил(?:ся|ась|ось|ись))[.!]?$/iu;
const FAKE_PACK_RE = /(\d+(?:[.,]\d+)?)\s*(кг|г|мл|л)(?![\p{L}])/giu;

function parseOutOfStock(segment: string): UnavailableStatement | null {
  const match = segment.trim().match(OUT_OF_STOCK_RE);
  if (!match) return null;
  const head = match[1]!;
  const packs = [...head.matchAll(FAKE_PACK_RE)];
  const name = head.replace(FAKE_PACK_RE, ' ').replace(/(^|\s)(?:по|и|в)(?=\s|$)/giu, ' ').replace(/\s+/gu, ' ').trim();
  if (name.length < 2) return null;
  const label = FAKE_TITLES[name.toLowerCase()] ?? name;
  const units: Record<string, 'g' | 'kg' | 'ml' | 'l'> = { г: 'g', кг: 'kg', мл: 'ml', л: 'l' };
  const variant: UnavailableStatement['variant'] = packs.length === 0
    ? { state: 'none' }
    : packs.length === 1
      ? { state: 'bound', unit: null, pack: { amount: packs[0]![1]!.replace(',', '.'), unit: units[packs[0]![2]!.toLowerCase()]! } }
      : { state: 'uncertain', words: packs.map((p) => p[0]).join(', ') };
  return { label, sourceQuote: segment.trim().replace(/[.!]$/u, ''), variant };
}

function heuristicParse(text: string): SellerTextParseResult {
  const skipped: SkippedTextLine[] = [];
  const unavailable: UnavailableStatement[] = [];
  const grape = text.match(/виноград[^.;\n]*/iu);
  if (grape && !/виноград\s+\d+/iu.test(text)) {
    skipped.push({ label: 'Виноград', reason: 'Товар упомянут, но не распознан', sourceQuote: grape[0].trim() });
  }

  const segments = text.split(/[\n;]+|(?<=\.)\s+/u).map((s) => s.trim()).filter(Boolean);
  const lines: ParsedTextLine[] = [];
  for (const segment of segments) {
    if (/виноград/iu.test(segment) && !/\d/.test(segment)) continue;
    const outOfStock = parseOutOfStock(segment);
    if (outOfStock) {
      unavailable.push(outOfStock);
      continue;
    }
    const parsed = parseSegment(segment);
    if (parsed) lines.push(parsed);
  }
  return { lines, skipped, unavailable };
}

export function parseFakeSellerText(text: string): SellerTextParseResult {
  const key = fixtureKey(text);
  if (key && FIXTURES[key]) return FIXTURES[key];
  return heuristicParse(text);
}
