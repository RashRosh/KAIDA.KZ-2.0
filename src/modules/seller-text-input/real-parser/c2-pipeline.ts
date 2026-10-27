import { packInputSchema } from '../../offers/pack/pack';
import type {
  ParsedTextLine, SellerTextParseResult, SkippedTextLine, UnavailableStatement,
} from '../contracts/seller-text-input.contract';
import {
  STATUSES, findSpan, numberOccurrences, reduceClaims, sameProduct, tokEq, type ReducedItem,
} from './c2-reducer';
import {
  KG, LITER, PACKAGE, PIECE, W, halfRe, normText, packsEquivalent, sizeReading, sizeRe, tokens, type Pack,
} from './c2-text';

// seller-ai-text-real-parser §6.2–§6.3: claim-level validation, KAIDA safeguards on top of the C2 reducer, mapping to
// draft lines and omission hints. Deterministic; the model's answer is untrusted data throughout.

export const MAX_DRAFTS_PER_SUBMISSION = 30;
export const PARSER_CONFIG_ID = 'c2/script-2.2/Qwen3-4B@1cfa9a7';

const REASON_UNUSABLE_CLAIM = 'Ответ модели по этой позиции не распознан';
const REASON_OVERFLOW = 'Не больше 30 позиций за раз';

const NOTE = {
  title: 'Проверьте название',
  priceUnbound: 'Цена не привязана к товару — укажите цену',
  priceCheck: 'Проверьте цену',
  priceCorrection: 'Проверьте цену: в тексте была поправка',
  priceCurrency: 'Цена указана не в тенге — укажите цену в тенге',
  unit: 'Единица не указана рядом с товаром — проверьте',
  packDropped: 'Фасовка из текста не перенесена',
  packMismatch: 'Фасовка не совпадает с текстом — проверьте',
  packCheck: 'Проверьте фасовку',
} as const;

const LIMITS = { product: 200, text: 500, price: 100, per: 100, size: 100 } as const;

export type ValidClaim = {
  product: string | null; status: string; price: string | number | null; per: string | number | null;
  size: string | number | null; only: boolean; text: string | null;
};

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

// Claim level (§6.2): a usable claim goes on; an unusable one becomes a visible skipped entry and never a draft.
export function validateClaim(raw: unknown, index: number, message: string): { claim: ValidClaim } | { skipped: SkippedTextLine } {
  const record = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  const productLabel = record && typeof record.product === 'string' && record.product.trim().length >= 1
    && record.product.trim().length <= 200 ? record.product.trim() : `Позиция ${index + 1}`;
  const quote = record && typeof record.text === 'string' && record.text && message.includes(record.text)
    ? clip(record.text, 500) : null;
  const skip = { skipped: { label: productLabel, reason: REASON_UNUSABLE_CLAIM, sourceQuote: quote } };
  if (!record) return skip;

  const str = (k: 'product' | 'text') => {
    const v = record[k];
    if (v === undefined || v === null) return { ok: true as const, v: null };
    if (typeof v !== 'string' || v.length > LIMITS[k]) return { ok: false as const };
    return { ok: true as const, v };
  };
  const scalar = (k: 'price' | 'per' | 'size') => {
    const v = record[k];
    if (v === undefined || v === null) return { ok: true as const, v: null };
    if (typeof v === 'number' && Number.isFinite(v)) return { ok: true as const, v };
    if (typeof v !== 'string' || v.length > LIMITS[k]) return { ok: false as const };
    return { ok: true as const, v };
  };
  const product = str('product');
  const text = str('text');
  const price = scalar('price');
  const per = scalar('per');
  const size = scalar('size');
  const only = record.only;
  const onlyOk = only === undefined || only === null || typeof only === 'boolean'
    || (typeof only === 'string' && ['true', 'false'].includes(only.trim().toLowerCase()));
  const status = record.status;
  if (!product.ok || !text.ok || !price.ok || !per.ok || !size.ok || !onlyOk) return skip;
  if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status.trim())) return skip;
  if (status.trim() !== 'cmd' && (!product.v || !product.v.trim())) return skip;
  return {
    claim: {
      product: product.v, status: status.trim(), price: price.v, per: per.v, size: size.v, text: text.v,
      only: only === true || (typeof only === 'string' && only.trim().toLowerCase() === 'true'),
    },
  };
}

const UNIT_WORDS = (t: string) => KG.has(t) || LITER.has(t) || PIECE.has(t) || PACKAGE.has(t);

// §6.3 «unit assigned to the wrong product»: the model's unit words count only if they occur in the claim's own quote,
// and no other product of the answer is named in that quote before them. Otherwise the unit is dropped (a size
// written in `per` is kept as size) and the product gets a `unit` notice.
export function guardUnits(claims: ValidClaim[], message: string): {
  claims: ValidClaim[]; unitDropped: string[]; outOfStockUnitDropped: string[];
} {
  const unitDropped: string[] = [];
  // text-availability §4.1 item 1: a dropped unit of a «нет в наличии» claim makes its variant uncertain.
  const outOfStockUnitDropped: string[] = [];
  const out = claims.map((cl, i) => {
    if (cl.per === null || cl.status === 'cmd' || !cl.product) return cl;
    const per = String(cl.per);
    const unitToks = tokens(per).filter(UNIT_WORDS);
    if (unitToks.length === 0) return cl;
    const ownToks = tokens(cl.product);
    const otherToks = claims.flatMap((o, j) => (j === i || !o.product ? [] : tokens(o.product)))
      .filter((t) => t.length >= 3 && !ownToks.some((x) => tokEq(t, x)));
    const quoteToks = cl.text && findSpan(message, cl.text) ? tokens(cl.text) : [];
    const at = quoteToks.findIndex((t) => unitToks.includes(t));
    const ok = at >= 0 && !quoteToks.slice(0, at).some((t) => otherToks.some((o) => tokEq(t, o)));
    if (ok) return cl;
    (cl.status === 'none' ? outOfStockUnitDropped : unitDropped).push(cl.product);
    const keepsSize = cl.size === null && sizeReading(per)[0] !== null;
    return { ...cl, per: null, size: keepsSize ? per : cl.size };
  });
  return { claims: out, unitDropped, outOfStockUnitDropped };
}

// All pack sizes the seller wrote in a quote, in the seller's own units.
export function sellerPacks(quote: string): Pack[] {
  const found: Pack[] = [];
  const add = (p: Pack | null) => { if (p && !found.some((f) => f.amount === p.amount && f.unit === p.unit)) found.push(p); };
  add(sizeReading(quote, quote)[0]);
  const low = normText(quote);
  for (const m of low.matchAll(sizeRe('gu'))) add(sizeReading(m[0])[0]);
  for (const m of low.matchAll(halfRe('gu'))) add(sizeReading(m[0])[0]);
  for (const part of low.split(new RegExp(`[,;.—–]|\\s-\\s|(?<=${W})\\s+(?=\\d)`, 'u'))) add(sizeReading(part, quote)[0]);
  return found;
}

// §6.3 «Packaging»: keep the seller's unit; an equivalent normalization is accepted and shown as the seller wrote it.
export function guardPack(pack: Pack | null, source: string | null): { pack: Pack | null; mismatch: boolean } {
  if (pack === null) return { pack: null, mismatch: false };
  const written = source ? sellerPacks(source) : [];
  const exact = written.find((p) => p.amount === pack.amount && p.unit === pack.unit);
  if (exact) return { pack: exact, mismatch: false };
  const equivalent = written.find((p) => packsEquivalent(p, pack));
  if (equivalent) return { pack: equivalent, mismatch: false };
  return { pack: null, mismatch: true };
}

function mapItem(item: ReducedItem, unitDropped: string[]): ParsedTextLine {
  const flags = new Set(item.flags);
  const fields = new Set<'price' | 'unit' | 'pack' | 'title'>();
  const notes: string[] = [];
  const note = (field: 'price' | 'unit' | 'pack' | 'title', text: string) => {
    fields.add(field);
    if (!notes.includes(text)) notes.push(text);
  };

  if (flags.has('product_not_in_message') || flags.has('quote_not_found') || flags.has('no_source')) note('title', NOTE.title);

  let price = item.price;
  if (price !== null && item.currency === 'non_kzt') {
    price = null;
    note('price', NOTE.priceCurrency);
  }
  if (['price_not_bound', 'price_unparsed', 'price_not_in_message'].some((f) => flags.has(f))) note('price', NOTE.priceUnbound);
  if (['price_binding_weak', 'price_bound_cross_clause', 'price_bound_by_quote_only', 'price_in_command_clause']
    .some((f) => flags.has(f))) note('price', NOTE.priceCheck);
  if (['later_correction_in_text', 'fix_ambiguous_target', 'fix_variant_unmatched', 'fix_changed_variant', 'fix_without_target',
    'none_variant_unmatched', 'none_all_variants'].some((f) => flags.has(f))) note('price', NOTE.priceCorrection);
  if (price === null) fields.add('price');

  const unitWasDropped = unitDropped.some((p) => sameProduct(p, item.title, true));
  if (item.unit === null && (unitWasDropped || flags.has('unit_unrecognized') || price !== null)) note('unit', NOTE.unit);

  if (flags.has('pack_dropped_for_weight_unit')) note('pack', NOTE.packDropped);
  if (flags.has('size_count_or_volume_ambiguous')) note('pack', NOTE.packCheck);
  const guarded = guardPack(item.pack, item.source);
  let pack = guarded.pack;
  if (guarded.mismatch) note('pack', NOTE.packMismatch);
  if (pack !== null && !packInputSchema.safeParse(pack).success) {
    pack = null;
    note('pack', NOTE.packCheck);
  }

  const line: ParsedTextLine = {
    title: clip(item.title.trim(), 200),
    price,
    unit: item.unit,
    pack,
    confidence: fields.size > 0 ? 'low' : 'high',
    sourceQuote: item.source === null ? null : clip(item.source, 500),
    uncertainFields: [...fields],
  };
  if (notes.length > 0) line.notice = clip(notes.join('; '), 300);
  return line;
}

const UNIT_OF: [Set<string>, 'kg' | 'liter' | 'piece' | 'package'][] = [[KG, 'kg'], [LITER, 'liter'], [PIECE, 'piece'], [PACKAGE, 'package']];
const VARIANT_UNCERTAIN_FLAGS = ['unit_unrecognized', 'size_count_or_volume_ambiguous', 'pack_dropped_for_weight_unit'];

// The Seller's sentence around a quote: up to «. ! ? ;» or a line break; a point between digits («0.5») is no boundary.
function sentenceAround(message: string, span: [number, number]): [number, number] {
  const boundary = (i: number) => /[!?;\n]/u.test(message[i]!)
    || (message[i] === '.' && !(/\d/u.test(message[i - 1] ?? '') && /\d/u.test(message[i + 1] ?? '')));
  let start = span[0];
  while (start > 0 && !boundary(start - 1)) start -= 1;
  let end = span[1];
  while (end < message.length && !boundary(end)) end += 1;
  return [start, end];
}

// text-availability §4.1 item 1: the pack/unit state of a «нет в наличии» statement, from the existing guards and the
// pack/unit words of the Seller's own sentence (words inside other items' quotes are not this statement's).
// Wording the size and unit patterns do not know counts as `none` — the contract's accepted limitation.
export function statementVariant(item: ReducedItem, message: string, otherSpans: [number, number][], unitDropped: boolean): UnavailableStatement['variant'] {
  const span = findSpan(message, item.source);
  if (!span) return { state: 'uncertain', words: null };
  const [start, end] = sentenceAround(message, span);
  const chars = [...message.slice(start, end)];
  for (const [a, b] of otherSpans) {
    if (a < span[1] && span[0] < b) continue;
    for (let i = Math.max(a, start); i < Math.min(b, end); i += 1) chars[i - start] = ' ';
  }
  const sentence = normText(chars.join(''));
  const sizeWords = [...sentence.matchAll(sizeRe('gu')), ...sentence.matchAll(halfRe('gu'))].map((m) => m[0].trim());
  const unitWords = tokens(sentence.replace(halfRe('gu'), ' ').replace(sizeRe('gu'), ' ')).filter(UNIT_WORDS);
  const words = [...new Set([...sizeWords, ...unitWords])].join(', ') || null;

  const guarded = guardPack(item.pack, item.source);
  const pack = guarded.pack !== null && packInputSchema.safeParse(guarded.pack).success ? guarded.pack : null;
  const unit = item.unit;
  const unitCode = (t: string) => UNIT_OF.find(([set]) => set.has(t))?.[1];
  const uncertain = unitDropped || guarded.mismatch || (item.pack !== null && pack === null)
    || VARIANT_UNCERTAIN_FLAGS.some((f) => item.flags.includes(f))
    || sellerPacks(sentence).some((p) => pack === null || !packsEquivalent(p, pack))
    || unitWords.some((t) => unitCode(t) !== unit?.code);
  if (uncertain) return { state: 'uncertain', words };
  if (pack !== null || unit !== null) return { state: 'bound', unit, pack };
  return { state: 'none' };
}

export const MERGE_WARNING = 'Возможно, здесь несколько товаров. Проверьте название и цену.';
const PRICE_CONFLICT = 'В тексте разные цены — выберите цену';

// text-duplicates §4.2–§4.3, from the reducer's own record (no reducer change): an item that absorbed several «have»
// mentions is possibly merged, and prices it overwrote are a conflict for the Seller to resolve. A «fix» claim is an
// explicit correction and keeps slice 2's «later value» rule. These are the only available signs: their absence does
// not prove that the parser kept different products apart.
function mergeSigns(item: ReducedItem, claims: ValidClaim[], trace: Record<string, unknown>[], message: string) {
  const prices: string[] = [];
  for (const entry of trace) {
    if (entry.op !== 'price_overwritten' || entry.title !== item.title) continue;
    if (claims[entry.i as number]?.status !== 'have') continue;
    for (const value of [entry.old, entry.new]) if (typeof value === 'string' && !prices.includes(value)) prices.push(value);
  }
  // Only mentions inside this item's own source (the reducer spans of its mentions): another pack of the same product is
  // a separate item with its own source.
  const own = findSpan(message, item.source);
  const inside = (text: string) => {
    const span = findSpan(message, text);
    return own !== null && span !== null && span[0] >= own[0] && span[1] <= own[1];
  };
  const fragments = [...new Set(claims
    .filter((cl) => cl.status === 'have' && cl.product && cl.text && inside(cl.text) && sameProduct(cl.product, item.title, true))
    .map((cl) => clip(cl.text!, 500)))];
  return { prices, fragments };
}

function withMergeSigns(line: ParsedTextLine, signs: { prices: string[]; fragments: string[] }): ParsedTextLine {
  const conflict = signs.prices.length > 1;
  const merged = conflict || signs.fragments.length > 1;
  if (!merged) return line;
  const fields = new Set(line.uncertainFields ?? []);
  fields.add('title');
  if (conflict) fields.add('price');
  const notes = [MERGE_WARNING, ...(conflict ? [PRICE_CONFLICT] : []), ...(line.notice ? [line.notice] : [])];
  const out: ParsedTextLine = { ...line, confidence: 'low', uncertainFields: [...fields], notice: clip(notes.join('; '), 300) };
  if (conflict) {
    out.price = null;
    out.priceChoices = signs.prices.slice(0, 10);
  }
  // With one fragment the row's own source quote already shows the Seller's words.
  if (signs.fragments.length > 1) out.mergedFragments = signs.fragments.slice(0, 10);
  return out;
}

function overlaps(a: [number, number], spans: [number, number][]): boolean {
  return spans.some(([s, e]) => a[0] < e && s < a[1]);
}

// §6.3 «Omitted products — no completeness guarantee»: two deterministic hints; neither detects every omission.
export function omissionHints(message: string, covered: [number, number][], prices: Set<string>): string[] {
  const hints: string[] = [];
  let offset = 0;
  for (const line of message.split('\n')) {
    const span: [number, number] = [offset, offset + line.length];
    offset += line.length + 1;
    if (!/\p{L}/u.test(line) || overlaps(span, covered)) continue;
    hints.push(`Строка не разобрана: «${clip(line.trim(), 120)}»`);
  }
  for (const o of numberOccurrences(message)) {
    // price-like: at least 10; a number inside a recognised quote or equal to a recognised price is used
    if (![...o.values].some((v) => Number(v) >= 10)) continue;
    if (overlaps([o.start, o.end], covered) || [...o.values].some((v) => prices.has(v))) continue;
    hints.push(`Число не использовано: ${message.slice(o.start, o.end).trim()}`);
  }
  return [...new Set(hints)].slice(0, 20);
}

export function claimsToParseResult(rawClaims: unknown[], message: string): SellerTextParseResult {
  const skipped: SkippedTextLine[] = [];
  const valid: ValidClaim[] = [];
  rawClaims.forEach((raw, i) => {
    const checked = validateClaim(raw, i, message);
    if ('claim' in checked) valid.push(checked.claim);
    else skipped.push(checked.skipped);
  });

  const { claims, unitDropped, outOfStockUnitDropped } = guardUnits(valid, message);
  const reduced = reduceClaims(claims, message);

  const lines: ParsedTextLine[] = [];
  const unavailable: UnavailableStatement[] = [];
  const itemSpans = reduced.items.flatMap((item) => { const span = findSpan(message, item.source); return span ? [span] : []; });
  const covered: [number, number][] = [];
  const cover = (text: string | null) => {
    const span = findSpan(message, text);
    if (span) covered.push(span);
  };
  for (const cl of claims) cover(cl.text);
  for (const item of reduced.items) {
    cover(item.source);
    // text-availability §4.1 item 1: a «нет в наличии» statement is matched against the point's cards, never a draft.
    if (item.available === false) {
      unavailable.push({
        label: clip(item.title.trim(), 200),
        sourceQuote: item.source && clip(item.source, 500),
        variant: statementVariant(item, message, itemSpans, outOfStockUnitDropped.some((p) => sameProduct(p, item.title, true))),
      });
      continue;
    }
    const line = withMergeSigns(mapItem(item, unitDropped), mergeSigns(item, claims, reduced.trace, message));
    if (lines.length >= MAX_DRAFTS_PER_SUBMISSION) {
      skipped.push({ label: line.title, reason: REASON_OVERFLOW, sourceQuote: line.sourceQuote });
      continue;
    }
    lines.push(line);
  }
  const prices = new Set(lines.flatMap((l) => (l.price ? [l.price] : [])));
  return { lines, skipped, notices: omissionHints(message, covered, prices), unavailable };
}
