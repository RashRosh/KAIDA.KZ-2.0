// Text, number, unit and size helpers of the C2 reducer — a line-by-line port of the reference script
// (tests/fixtures/seller-text-real-parser/kaida_extract_exp.py, SCRIPT_VERSION 2.2). Behaviour must stay identical to
// the script: tests/unit/seller-text-real-parser-c2.test.ts replays the saved C1/C2 answers through both.
//
// Python → TypeScript notes: Python `\w` on str is Unicode letters, numbers and `_` (W below); `\d` is kept ASCII (no
// other digits occur in the evidence); Decimal arithmetic is exact (Dec), never floating point.

export const W = '[\\p{L}\\p{N}_]';

export function normText(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/gu, ' ').trim();
}

export function tokens(s: string | null | undefined): string[] {
  return normText(s).match(new RegExp(`${W}+`, 'gu')) ?? [];
}

export function isDigits(t: string): boolean {
  return /^\p{Nd}+$/u.test(t);
}

// --- exact decimals (Python Decimal subset) ---

type Dec = { n: bigint; s: number };

function decParse(text: string): Dec {
  const m = /^(\d*)(?:\.(\d+))?$/.exec(text);
  if (!m) throw new Error(`not a decimal: ${text}`);
  const frac = m[2] ?? '';
  return { n: BigInt(`${m[1] || '0'}${frac}`), s: frac.length };
}

function decScale(a: Dec, s: number): bigint {
  return a.n * 10n ** BigInt(s - a.s);
}

function decAdd(a: Dec, b: Dec): Dec {
  const s = Math.max(a.s, b.s);
  return { n: decScale(a, s) + decScale(b, s), s };
}

function decMulInt(a: Dec, k: bigint): Dec {
  return { n: a.n * k, s: a.s };
}

function decIsZero(a: Dec): boolean {
  return a.n === 0n;
}

// _fmt_num: integral → integer string; otherwise normalized, without exponent.
export function fmtNum(x: string | Dec): string {
  const d = typeof x === 'string' ? decParse(x) : x;
  const scale = 10n ** BigInt(d.s);
  const intPart = d.n / scale;
  const frac = d.n % scale;
  if (frac === 0n) return intPart.toString();
  let fracText = frac.toString().padStart(d.s, '0');
  fracText = fracText.replace(/0+$/, '');
  return `${intPart.toString()}.${fracText}`;
}

// --- numbers and prices ---

const UNITS: Record<string, number> = {
  ноль: 0, один: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16,
  семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
};
const TENS: Record<string, number> = {
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
};
const HUND: Record<string, number> = {
  сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800,
  девятьсот: 900,
};
const THOUS = new Set(['тысяча', 'тысячи', 'тысяч', 'тыща', 'тыщи', 'тыщ']);
export const NUMWORDS = new Set([...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(HUND), ...THOUS, 'полторы', 'полтора']);

const has = (o: Record<string, number>, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export const CURRENCY_RE = new RegExp(`(?:тенге|теңге|тг|₸|тнг)(?!${W})\\.?`, 'giu');

export function wordsToInt(toks: string[]): Dec | null {
  if (toks.length === 0) return null;
  let total: Dec = { n: 0n, s: 0 };
  let chunk: Dec = { n: 0n, s: 0 };
  for (const t of toks) {
    if (has(UNITS, t)) chunk = decAdd(chunk, { n: BigInt(UNITS[t]!), s: 0 });
    else if (has(TENS, t)) chunk = decAdd(chunk, { n: BigInt(TENS[t]!), s: 0 });
    else if (has(HUND, t)) chunk = decAdd(chunk, { n: BigInt(HUND[t]!), s: 0 });
    else if (t === 'полторы' || t === 'полтора') chunk = decAdd(chunk, { n: 15n, s: 1 });
    else if (THOUS.has(t)) {
      total = decAdd(total, decMulInt(decIsZero(chunk) ? { n: 1n, s: 0 } : chunk, 1000n));
      chunk = { n: 0n, s: 0 };
    } else return null;
  }
  return decAdd(total, chunk);
}

function pyStrip(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a]!)) a += 1;
  while (b > a && chars.includes(s[b - 1]!)) b -= 1;
  return s.slice(a, b);
}

export function parsePrice(text: unknown): string | null {
  if (text === null || text === undefined) return null;
  let s = normText(pyStr(text));
  s = pyStrip(s.replace(CURRENCY_RE, ' '), ' .,:;-—');
  s = s.replace(/₸/g, ' ').trim();
  if (!s) return null;
  if (/^\d{1,3}(?:[  ]\d{3})+$/.test(s)) return s.replace(/[  ]/g, '');
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return s.replace(/[.,]/g, '');
  const m = /^(\d+(?:[.,]\d+)?)\s*(к|k|тыс|тыс\.|тысяч|тысячи)?$/u.exec(s);
  if (m) {
    let val = decParse(m[1]!.replace(',', '.'));
    if (m[2]) val = decMulInt(val, 1000n);
    return fmtNum(val);
  }
  const toks = s.split(/\s+/u).filter(Boolean);
  if (toks.length > 0 && toks.every((t) => NUMWORDS.has(t))) {
    const v = wordsToInt(toks);
    if (v !== null) return fmtNum(v);
  }
  return null;
}

// str(x) for the scalar values that can reach the reducer from parsed JSON.
export function pyStr(x: unknown): string {
  if (typeof x === 'string') return x;
  if (typeof x === 'boolean') return x ? 'True' : 'False';
  if (x === null || x === undefined) return 'None';
  return String(x);
}

const DIGIT_RUN = '\\d+(?:[ \\u00a0]\\d{3})*(?:[.,]\\d+)?(?:\\s*(?:к|k|тыс\\.?)(?!' + W + '))?';

export function numbersInMessage(msg: string): Set<string> {
  const out = new Set<string>();
  const low = normText(msg);
  for (const m of low.matchAll(new RegExp(DIGIT_RUN, 'gu'))) {
    const v = parsePrice(m[0]);
    if (v) out.add(v);
    for (const part of m[0].match(/\d+(?:[.,]\d+)?/g) ?? []) {
      const v2 = parsePrice(part);
      if (v2) out.add(v2);
    }
  }
  const toks = low.match(new RegExp(`${W}+`, 'gu')) ?? [];
  let i = 0;
  while (i < toks.length) {
    if (NUMWORDS.has(toks[i]!)) {
      let j = i;
      while (j < toks.length && NUMWORDS.has(toks[j]!)) j += 1;
      for (let a = i; a < j; a += 1) {
        for (let b = a + 1; b <= j; b += 1) {
          const v = wordsToInt(toks.slice(a, b));
          if (v !== null) out.add(fmtNum(v));
        }
      }
      i = j;
    } else i += 1;
  }
  return out;
}

// --- units and pack sizes ---

export const KG = new Set(['кг', 'кило', 'килограмм', 'килограмма', 'килограммов', 'килограмы', 'килосы', 'килограммы', 'kg']);
export const LITER = new Set(['л', 'литр', 'литра', 'литров', 'литрі', 'литры']);
export const PIECE = new Set(['бутылка', 'бутылки', 'бутылке', 'бутылках', 'бутылку', 'бутылочка', 'бутылочки',
  'банка', 'банки', 'банке', 'банках', 'банку', 'баночка', 'баночки', 'баночке',
  'штука', 'штуки', 'штуку', 'шт', 'штучно', 'дана']);
export const PACKAGE = new Set(['пачка', 'пачки', 'пачку', 'пачке', 'пачках', 'упаковка', 'упаковки', 'упаковку',
  'пакет', 'пакета', 'пакете', 'пакетах', 'мешок', 'мешка', 'мешке', 'коробка',
  'коробки', 'коробку', 'ящик', 'ящика', 'лоток', 'лотка']);

const ADJ_END = '(?:ый|ая|ое|ые|ой|ого|ому|ую|ых|ым|ыми)';
const SIZE_SRC = `(\\d+(?:[.,]\\d+)?)\\s*(кг|килограмм${W}*|кило|гр|г|грамм${W}*|мл|миллилитр${W}*|л|литр(?!ов${ADJ_END})${W}*)(?!${W})`;
const HALF_SRC = `(?<!${W})(пол\\s*-?\\s*кило(?:грамма)?|полкило(?:грамма)?|пол\\s*-?\\s*литра|поллитра)(?!${W})`;
export const sizeRe = (flags = 'u') => new RegExp(SIZE_SRC, flags);
export const halfRe = (flags = 'u') => new RegExp(HALF_SRC, flags);
const NUMW: Record<string, number> = { один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10 };
const NUMW_RE = Object.keys(NUMW).sort((a, b) => b.length - a.length).join('|');
const COMPOUND: Record<string, number> = { одно: 1, двух: 2, трех: 3, четырех: 4, пяти: 5, шести: 6, семи: 7, восьми: 8, девяти: 9, десяти: 10 };
const VOL_ADJ_RE = new RegExp(`(?<!${W})(\\d+(?:[.,]\\d+)?)\\s*-\\s*(?:х\\s*)?литров${ADJ_END}(?!${W})|(?<!${W})(\\d+)х\\s*литров${ADJ_END}(?!${W})`, 'u');
const VOL_WORD_RE = new RegExp(`(?<!${W})(${Object.keys(COMPOUND).sort((a, b) => b.length - a.length).join('|')})-?литров${ADJ_END}(?!${W})`, 'u');
const COUNT_ADJ_RE = new RegExp(`(?<![\\p{L}\\p{N}_-])(\\d+|${NUMW_RE})\\s+литров${ADJ_END}(?!${W})(.*)$`, 'u');
const BARE_ADJ_RE = new RegExp(`(?<![\\p{L}\\p{N}_-])литров${ADJ_END}(?!${W})`, 'u');
const CONTAINER_NOUN = new RegExp(`(?<!${W})(?:бутыл${W}*|банк${W}*|баноч${W}*|канистр${W}*|пакет${W}*|штук${W}*|шт|упаковк${W}*|пачк${W}*|коробк${W}*|ящик${W}*)`, 'u');

export type PackUnit = 'g' | 'kg' | 'ml' | 'l';
export type Pack = { amount: string; unit: PackUnit };
export type SaleUnit = 'kg' | 'liter' | 'piece' | 'package';

export function sizeReading(text: string | null | undefined, context?: string | null): [Pack | null, string | null] {
  const s = normText(text);
  if (!s) return [null, null];
  if (new RegExp(`(?<!${W})(?:полулитров${W}*|пол-литров${W}*)`, 'u').test(s)) return [{ amount: '0.5', unit: 'l' }, null];
  let m = VOL_ADJ_RE.exec(s);
  if (m) return [{ amount: fmtNum((m[1] ?? m[2])!.replace(',', '.')), unit: 'l' }, null];
  m = VOL_WORD_RE.exec(s);
  if (m) return [{ amount: String(COMPOUND[m[1]!]), unit: 'l' }, null];
  m = COUNT_ADJ_RE.exec(s);
  if (m) {
    const num = m[1]!;
    const tail = m[2]!;
    if (has(NUMW, num) || num === '1') return [{ amount: '1', unit: 'l' }, null];
    if (CONTAINER_NOUN.test(tail)) return [{ amount: '1', unit: 'l' }, null];
    const ctx = normText(context ?? '');
    const cm = ctx ? COUNT_ADJ_RE.exec(ctx) : null;
    if (cm && CONTAINER_NOUN.test(cm[2]!)) return [{ amount: '1', unit: 'l' }, null];
    return [null, 'size_count_or_volume_ambiguous'];
  }
  if (BARE_ADJ_RE.test(s) && !sizeRe().test(s)) return [{ amount: '1', unit: 'l' }, null];
  const h = halfRe().exec(s);
  const m2 = sizeRe().exec(s);
  if (h && (!m2 || h.index <= m2.index)) {
    const w = h[1]!;
    return [{ amount: '0.5', unit: w.includes('литр') ? 'l' : 'kg' }, null];
  }
  if (m2) {
    const amount = fmtNum(m2[1]!.replace(',', '.'));
    const u = m2[2]!;
    let unit: PackUnit;
    if (u.startsWith('кг') || u.startsWith('килограмм') || u === 'кило') unit = 'kg';
    else if (u.startsWith('мл') || u.startsWith('миллилитр')) unit = 'ml';
    else if (u.startsWith('гр') || u === 'г' || u.startsWith('грамм')) unit = 'g';
    else unit = 'l';
    return [{ amount, unit }, null];
  }
  return [null, null];
}

export function parseUnit(per: string | null, size: string | null, context?: string | null): [SaleUnit | null, Pack | null, string[]] {
  const flags: string[] = [];
  const perS = normText(per ?? '');
  const sizeS = normText(size ?? '');
  const perWords = perS.replace(halfRe('gu'), ' ').replace(sizeRe('gu'), ' ');
  let container: SaleUnit | null = null;
  let weight: SaleUnit | null = null;
  for (const t of perWords.match(new RegExp(`${W}+`, 'gu')) ?? []) {
    if (PIECE.has(t) && container === null) container = 'piece';
    else if (PACKAGE.has(t) && container === null) container = 'package';
    else if (KG.has(t) && weight === null) weight = 'kg';
    else if (LITER.has(t) && weight === null) weight = 'liter';
  }
  let [pack, amb] = sizeReading(sizeS, context);
  if (pack === null) {
    const [pack2, amb2] = sizeReading(perS, context);
    pack = pack2;
    amb = amb || amb2;
  }
  if (amb && pack === null) flags.push(amb);
  const code = container ?? weight;
  if ((code === 'kg' || code === 'liter') && pack !== null) {
    pack = null;
    flags.push('pack_dropped_for_weight_unit');
  }
  if ((perS || sizeS) && code === null && pack === null) flags.push('unit_unrecognized');
  return [code, pack, flags];
}

// Quantity of one pack in base units (g or ml), exact: «500 г» and «0,5 кг» are equal, «0,5 л» and «500 г» are not.
export function packBase(p: Pack): { dim: 'mass' | 'volume'; amount: string } {
  const factor = p.unit === 'kg' || p.unit === 'l' ? 1000n : 1n;
  return { dim: p.unit === 'g' || p.unit === 'kg' ? 'mass' : 'volume', amount: fmtNum(decMulInt(decParse(p.amount), factor)) };
}

export function packsEquivalent(a: Pack, b: Pack): boolean {
  const x = packBase(a);
  const y = packBase(b);
  return x.dim === y.dim && x.amount === y.amount;
}

export type CurrencyStatus ='non_kzt' | 'explicit_kzt' | 'assumed_kzt';

export function currencyStatus(message: string, claimText?: string | null): CurrencyStatus {
  const low = normText(message);
  if (/руб|₽|доллар|\$|евро|usd|rub|eur/u.test(low)) return 'non_kzt';
  if (/(все\s+)?цены\s+в\s+тенге|цены\s+в\s+теңге|в\s+тенге\s+все/u.test(low)) return 'explicit_kzt';
  if (claimText && new RegExp(CURRENCY_RE.source, 'iu').test(normText(claimText))) return 'explicit_kzt';
  return 'assumed_kzt';
}
