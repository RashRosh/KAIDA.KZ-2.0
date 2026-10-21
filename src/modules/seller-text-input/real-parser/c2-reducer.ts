// C2 claims-ledger reducer — a line-by-line port of `reduce_claims` and its helpers from the reference script
// (tests/fixtures/seller-text-real-parser/kaida_extract_exp.py, SCRIPT_VERSION 2.2). Deterministic: the same claims and
// message give the same cards. Kept identical to the script; KAIDA-specific safeguards live in c2-safeguards.ts.
//
// What the code checks itself: a price must be a number bound by position to a mention of this product (attachNumbers);
// a quote must be a substring of the message. What it does NOT guarantee: that the model did not take a command in the
// text for a fact, or that a positional binding is semantically right.

import {
  NUMWORDS, W, currencyStatus, fmtNum, isDigits, numbersInMessage, parsePrice, parseUnit,
  pyStr, tokens, wordsToInt, type CurrencyStatus, type Pack, type SaleUnit,
} from './c2-text';

// --- token comparison (stems) ---

const KZ_LETTERS = new Set('әіңғүұқөһ');
const RU_END3 = ['ами', 'ями', 'его', 'ого', 'ому', 'ему', 'ыми', 'ими'];
const RU_END2 = ['ов', 'ев', 'ей', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ою', 'ею', 'ой', 'ий', 'ый',
  'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ью', 'ье', 'ья', 'ых', 'их', 'ым', 'им'];
const RU_END1 = ['а', 'я', 'у', 'ю', 'ы', 'и', 'е', 'о', 'й', 'ь'];
const KZ_END = ['дан', 'ден', 'тан', 'тен', 'нан', 'нен', 'мен', 'бен', 'пен', 'ның', 'нің', 'дың', 'дің',
  'тың', 'тің', 'лар', 'лер', 'дар', 'дер', 'тар', 'тер', 'ды', 'ді', 'ты', 'ті', 'ны', 'ні',
  'ға', 'ге', 'қа', 'ке', 'да', 'де', 'та', 'те'];
const STEM_SYN: Record<string, string> = { со: 'сол', морковк: 'морков', картошк: 'картофел' };

function longestFirst(cands: string[]): string | null {
  let best: string | null = null;
  for (const c of cands) if (best === null || c.length > best.length) best = c;
  return best;
}

function stem(t: string): string {
  if (t.length < 3 || isDigits(t)) return t;
  let ends: string | null = null;
  if ([...t].some((ch) => KZ_LETTERS.has(ch))) {
    ends = longestFirst(KZ_END.filter((e) => t.endsWith(e) && t.length - e.length >= 3));
  } else {
    for (const [group, need] of [[RU_END3, 3], [RU_END2, 3], [RU_END1, 2]] as const) {
      const cand = group.filter((e) => t.endsWith(e) && t.length - e.length >= need);
      if (cand.length > 0) {
        ends = longestFirst(cand);
        break;
      }
    }
    if (ends === 'ь' && t[t.length - 2] === 'н') ends = null;
  }
  let st = ends ? t.slice(0, -ends.length) : t;
  if (st.length >= 4 && st.endsWith('ец')) st = `${st.slice(0, -2)}ц`;
  else if (st.length >= 5 && (st.endsWith('ок') || st.endsWith('ек'))) st = `${st.slice(0, -2)}к`;
  return Object.prototype.hasOwnProperty.call(STEM_SYN, st) ? STEM_SYN[st]! : st;
}

export function tokEq(a: string, b: string): boolean {
  if (a === b) return true;
  return stem(a) === stem(b) && stem(a).length >= 2;
}

function tokMatchAll(ta: string[], tb: string[]): boolean {
  const used = new Set<number>();
  for (const x of ta) {
    let hit: number | null = null;
    for (let j = 0; j < tb.length; j += 1) {
      if (!used.has(j) && tokEq(x, tb[j]!)) {
        hit = j;
        break;
      }
    }
    if (hit === null) return false;
    used.add(hit);
  }
  return true;
}

function toksetEq(ta: string[], tb: string[]): boolean {
  if (ta.length !== tb.length || ta.length === 0) return false;
  return tokMatchAll(ta, tb);
}

function toksetSubset(ta: string[], tb: string[]): boolean {
  if (ta.length === 0) return false;
  return tokMatchAll(ta, tb);
}

const PREPOSITIONS = new Set(['с', 'со', 'из', 'для', 'в', 'на', 'без']);

export function sameProduct(a: string, b: string, loose: boolean): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (toksetEq(ta, tb)) return true;
  if (loose) {
    const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    if (long.some((t) => PREPOSITIONS.has(t)) && !short.some((t) => PREPOSITIONS.has(t))) return false;
    return toksetSubset(short, long);
  }
  return false;
}

// --- binding numbers to products ---

const DIGITS_RE = () => new RegExp(`\\d+(?:[ \\u00a0]\\d{3})*(?:[.,]\\d+)?(?:\\s*(?:к|k|тыс\\.?)(?!${W}))?`, 'gu');
const CLAUSE_RE = () => /[!?;\n]|\.(?=\s|$)/gu;
const SIZE_WORDS = new Set(['кг', 'килограмм', 'килограмма', 'кило', 'г', 'гр', 'грамм', 'грамма', 'граммов', 'мл', 'л', 'литр',
  'литра', 'литров', 'шт', 'штук', 'штуки', 'процент', 'процентов']);
const CORR_MARK_RE = new RegExp(`(?<!${W})(нет|хотя\\s+нет|поправ${W}*|исправ${W}*|уточн${W}*|точнее|ошибс${W}*|ошиб${W}*|`
  + `уже|теперь|стало|а\\s+не)(?!${W})`, 'u');
// Command vocabulary: a heuristic for a «check this» flag, not protection.
export const CMD_RE = new RegExp(`игнорир|забудь|систем${W}*\\s*[:,]|для\\s+(?:эксперимент${W}*|проверк${W}*|теста|тестов${W}*)|`
  + `(?:замени|заменить|поставь|установи|запиши|напиши)\\s+(?:${W}+\\s+){0,3}цен|`
  + `настоящ${W}+\\s+цен|верни\\s+пуст|промпт|prompt|instruction|ignore\\s`, 'iu');

function lower(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е');
}

type TokSpan = [string, number, number];

function tokSpans(low: string): TokSpan[] {
  return [...low.matchAll(new RegExp(`${W}+`, 'gu'))].map((m) => [m[0], m.index!, m.index! + m[0].length]);
}

type Mention = [number, number, number];

function mentions(tspans: TokSpan[], title: string): Mention[] {
  const tt = tokens(title);
  if (tt.length === 0) return [];
  const toks = tspans.map(([t]) => t);
  const n = tt.length;
  const out: Mention[] = [];
  for (let i = 0; i < tspans.length; i += 1) {
    for (let w = n; w < n + 3; w += 1) {
      const win = toks.slice(i, i + w);
      if (win.length < n) break;
      if (tt.some((x) => tokEq(win[0]!, x)) && toksetSubset(tt, win)) {
        let j = i + w;
        while (j - 1 > i && !tt.some((x) => tokEq(toks[j - 1]!, x))) j -= 1;
        out.push([tspans[i]![1], tspans[j - 1]![2], n]);
        break;
      }
    }
  }
  if (out.length > 0) return out;
  return tspans.filter(([t]) => t.length >= 3 && tt.some((x) => tokEq(t, x))).map(([, a, b]) => [a, b, 1]);
}

type NumberOcc = { start: number; end: number; value: string | null; values: Set<string>; isSize: boolean };

function numbersWithPos(low: string, tspans: TokSpan[]): NumberOcc[] {
  const occ: NumberOcc[] = [];
  for (const m of low.matchAll(DIGITS_RE())) {
    const start = m.index!;
    const end = start + m[0].length;
    const v = parsePrice(m[0]);
    const vs = new Set<string>(v ? [v] : []);
    for (const part of m[0].match(/\d+(?:[.,]\d+)?/g) ?? []) {
      const v2 = parsePrice(part);
      if (v2) vs.add(v2);
    }
    const tail = new RegExp(`^\\s*([\\p{L}\\p{N}_%]+)`, 'u').exec(low.slice(end));
    const nxt = tail ? tail[1]! : '';
    const isSize = SIZE_WORDS.has(nxt) || nxt.startsWith('%') || low.slice(end, end + 1) === '%';
    if (vs.size > 0) occ.push({ start, end, value: v, values: vs, isSize });
  }
  let i = 0;
  while (i < tspans.length) {
    if (NUMWORDS.has(tspans[i]![0])) {
      let j = i;
      while (j < tspans.length && NUMWORDS.has(tspans[j]![0])) j += 1;
      const val = wordsToInt(tspans.slice(i, j).map(([t]) => t));
      if (val !== null) {
        const nxt = j < tspans.length ? tspans[j]![0] : '';
        const v = fmtNum(val);
        occ.push({ start: tspans[i]![1], end: tspans[j - 1]![2], value: v, values: new Set([v]), isSize: SIZE_WORDS.has(nxt) });
      }
      i = j;
    } else i += 1;
  }
  return occ.map((o, k) => ({ o, k })).sort((a, b) => a.o.start - b.o.start || a.k - b.k).map(({ o }) => o);
}

const GLUE_EXACT = new Set([
  'и', 'а', 'но', 'по', 'за', 'от', 'до', 'на', 'в', 'во', 'у', 'с', 'со', 'из', 'же', 'то', 'тоже', 'также', 'ещё', 'еще',
  'есть', 'всего', 'только', 'остались', 'осталась', 'остался', 'осталось', 'сегодня', 'сейчас', 'теперь', 'наши', 'наш', 'наша',
  'наше', 'цена', 'цене', 'цену', 'ценой', 'цены', 'стоит', 'стоят', 'стоимость', 'тг', 'тенге', 'теңге', 'тнг', 'кг', 'г', 'гр',
  'мл', 'л', 'шт', 'руб', 'рублей', 'рубля', 'двух', 'трех', 'разных', 'вариантах', 'размерах',
  'нет', 'хотя', 'подождите', 'подожди', 'уже', 'стало', 'было', 'поправка', 'поправлю', 'поправил', 'исправлю', 'исправляю',
  'исправил', 'точнее', 'ошибся', 'ошиблась', 'ошибка', 'извините', 'простите', 'не', 'правильно', 'будет',
  'был', 'была', 'были', 'раньше', 'прежде', 'подешевел', 'подешевела', 'подешевели', 'подешевело', 'подорожал', 'подорожала',
  'подорожали', 'подорожало', 'килограмм', 'кило', 'литр', 'пол', 'полкило', 'полкилограмма', 'поллитра',
  'бар', 'жоқ', 'нас', 'изменилась', 'изменилось', 'изменился', 'повысилась', 'снизилась', 'выросла', 'упала', 'поднялась',
]);
const GLUE_PREFIX = ['килограмм', 'кило', 'грамм', 'литр', 'штук', 'штуч', 'пачк', 'пакет', 'упаковк', 'банк', 'баночк', 'бутылк',
  'бутылочк', 'мешок', 'мешк', 'коробк', 'ящик', 'лоток', 'лотк', 'фасовк', 'поправ', 'исправ'];

function isGlue(tok: string): boolean {
  return GLUE_EXACT.has(tok) || GLUE_PREFIX.some((p) => tok.startsWith(p)) || NUMWORDS.has(tok) || isDigits(tok);
}

type NumberSpan = [number, number, boolean];

function gapInfo(low: string, start: number, end: number, numberSpans: NumberSpan[]) {
  const seg = low.slice(start, end).split('');
  let hasNumber = false;
  for (const [ns, ne, isSize] of numberSpans) {
    if (ns >= start && ne <= end) {
      for (let i = ns - start; i < ne - start; i += 1) seg[i] = ' ';
      if (!isSize) hasNumber = true;
    }
  }
  const gap = seg.join('');
  const toks = [...gap.matchAll(new RegExp(`${W}+`, 'gu'))].map((m) => [m[0], m.index!] as const);
  const ng = toks.filter(([t]) => !isGlue(t));
  const firstComma = gap.indexOf(',');
  const ngAfterComma = ng.some(([, i]) => firstComma >= 0 && i > firstComma);
  return { nonGlue: ng.length > 0, ngAfterComma, numberBetween: hasNumber };
}

export type Attachment = { pos: number; end: number; value: string | null; values: Set<string>; cross: boolean; weak: boolean; clause: number };
type Kept = [number, number, number, number];

export function attachNumbers(text: string, titlesByGroup: string[][]) {
  const low = lower(text);
  const tspans = tokSpans(low);
  const bounds = [...low.matchAll(CLAUSE_RE())].map((m) => m.index! + m[0].length);
  const clauseOf = (pos: number) => bounds.filter((b) => b <= pos).length;
  const clauseStart = (c: number) => (c > 0 ? bounds[c - 1]! : 0);

  const ments: Kept[] = [];
  titlesByGroup.forEach((titles, gid) => {
    for (const t of titles) for (const [a, b, n] of mentions(tspans, t)) ments.push([a, b, n, gid]);
  });
  const sorted = ments.map((m, k) => ({ m, k })).sort((x, y) => x.m[0] - y.m[0] || y.m[2] - x.m[2] || x.k - y.k).map(({ m }) => m);
  const kept: Kept[] = [];
  for (const m of sorted) {
    if (sorted.some((k) => k[0] < m[1] && m[0] < k[1] && k[2] > m[2])) continue;
    if (!kept.some((k) => k[0] === m[0] && k[3] === m[3])) kept.push(m);
  }
  const own = titlesByGroup.map((titles) => new Set(titles.flatMap((ti) => tokens(ti))));
  own.forEach((toks, gid) => {
    const others = new Set<string>();
    if (own.length > 1) own.forEach((v, g2) => { if (g2 !== gid) for (const x of v) others.add(x); });
    for (const t of toks) {
      if (t.length < 4 || isDigits(t) || [...others].some((o) => tokEq(t, o))) continue;
      for (const [w, a, b] of tspans) {
        if (tokEq(w, t) && !kept.some((k) => k[0] <= a && a < k[1])) kept.push([a, b, 1, gid]);
      }
    }
  });
  const res: Attachment[][] = titlesByGroup.map(() => []);
  const allNums = numbersWithPos(low, tspans);
  const numberSpans: NumberSpan[] = allNums.map((o) => [o.start, o.end, o.isSize]);
  const nums = allNums.filter((o) => !o.isSize);
  const byClause = new Map<number, NumberOcc[]>();
  for (const o of nums) {
    const c = clauseOf(o.start);
    if (!byClause.has(c)) byClause.set(c, []);
    byClause.get(c)!.push(o);
  }
  for (const [c, ns] of byClause) {
    const anchors = kept.filter((m) => clauseOf(m[0]) === c)
      .map((m, k) => ({ m, k })).sort((x, y) => x.m[0] - y.m[0] || x.k - y.k).map(({ m }) => m);
    ns.forEach((o, k) => {
      let gid: number | null = null;
      let cross = false;
      let weak = false;
      if (anchors.length > 0) {
        const before = anchors.filter((a) => a[1] <= o.start);
        if (anchors.length >= 2 && anchors.length === ns.length && anchors.every((a) => a[1] <= ns[0]!.start)) {
          gid = anchors[k]![3];
        } else if (before.length > 0) {
          const a = before[before.length - 1]!;
          const g = gapInfo(low, a[1], o.start, numberSpans);
          if (g.nonGlue && (g.ngAfterComma || g.numberBetween)) gid = null;
          else {
            gid = a[3];
            weak = g.nonGlue;
          }
        } else {
          const a = anchors[0]!;
          const g = gapInfo(low, clauseStart(c), o.start, numberSpans);
          if (!g.nonGlue) {
            gid = a[3];
            weak = true;
          }
        }
      } else {
        const prev = kept.filter((m) => m[1] <= o.start);
        if (prev.length > 0) {
          const g = gapInfo(low, clauseStart(c), o.start, numberSpans);
          if (!g.nonGlue) {
            let best = prev[0]!;
            for (const p of prev) if (p[0] > best[0]) best = p;
            gid = best[3];
            cross = true;
          }
        }
      }
      if (gid !== null) res[gid]!.push({ pos: o.start, end: o.end, value: o.value, values: new Set(o.values), cross, weak, clause: c });
    });
  }
  for (const list of res) list.sort((a, b) => a.pos - b.pos);
  const mcount = titlesByGroup.map((_, gid) => kept.filter((m) => m[3] === gid).length);
  return { attach: res, low, bounds, mcount };
}

// --- reducer ---

export const STATUSES = ['have', 'none', 'fix', 'cmd'] as const;
type Status = typeof STATUSES[number];

export type Span = [number, number];

export function findSpan(message: string, text: unknown): Span | null {
  if (!text || typeof text !== 'string') return null;
  const i = message.indexOf(text);
  if (i >= 0) return [i, i + text.length];
  const low = message.toLowerCase().indexOf(text.toLowerCase());
  if (low >= 0 && message.toLowerCase().length === message.length) return [low, low + text.length];
  return null;
}

const packEq = (a: Pack | null, b: Pack | null) => (a === null || b === null ? a === b : a.amount === b.amount && a.unit === b.unit);
const keyOf = (unit: SaleUnit | null, pack: Pack | null) => [unit, pack ? [pack.amount, pack.unit] : null] as const;
const keyText = (unit: SaleUnit | null, pack: Pack | null) => JSON.stringify(keyOf(unit, pack));

export type SanitizedClaim = Record<string, unknown> & {
  status: string | null; product: string | null; price: string | null; per: string | null; size: string | null;
  text: string | null; only: boolean;
};

function sanitize(cl: Record<string, unknown>): SanitizedClaim {
  const st = (x: unknown): string | null => {
    if (x === null || x === undefined || typeof x === 'boolean' || typeof x === 'object') return null;
    const s = pyStr(x).trim();
    return s && s.toLowerCase() !== 'null' ? s : null;
  };
  const o = cl.only;
  return {
    ...cl,
    status: st(cl.status), product: st(cl.product), price: st(cl.price), per: st(cl.per), size: st(cl.size),
    text: st(cl.text), only: o === true || (typeof o === 'string' && o.trim().toLowerCase() === 'true'),
  };
}

function bindPrice(attach: Attachment[][], mcount: number[], message: string, gid: number, pv: string, span: Span | null):
  [{ pos: number } | null, Set<string>] {
  const hit = attach[gid]!.filter((o) => o.values.has(pv));
  if (hit.length > 0) {
    const o = hit.map((h, k) => ({ h, k })).sort((a, b) => Number(a.h.cross) - Number(b.h.cross)
      || Number(a.h.weak) - Number(b.h.weak) || a.h.pos - b.h.pos || a.k - b.k)[0]!.h;
    const fl = new Set<string>();
    if (o.cross) fl.add('price_bound_cross_clause');
    if (o.weak) fl.add('price_binding_weak');
    return [o, fl];
  }
  if (mcount[gid] === 0 && span !== null) {
    const ql = lower(message.slice(span[0], span[1]));
    const qn = numbersWithPos(ql, tokSpans(ql)).filter((o) => !o.isSize);
    if (qn.length === 1 && qn[0]!.values.has(pv)) return [{ pos: span[0] + qn[0]!.start }, new Set(['price_bound_by_quote_only'])];
  }
  return [null, new Set(['price_not_bound'])];
}

const variantMatch = (card: Card, unit: SaleUnit | null, pack: Pack | null) =>
  !(unit !== null && card.unit !== unit) && !(pack !== null && !packEq(card.pack, pack));
const variantFits = (card: Card, unit: SaleUnit | null, pack: Pack | null) =>
  !(unit !== null && card.unit !== null && card.unit !== unit) && !(pack !== null && card.pack !== null && !packEq(card.pack, pack));

type Card = {
  title: string; price: string | null; unit: SaleUnit | null; pack: Pack | null; available: boolean | null;
  spans: Span[]; flags: Set<string>; order: number; gid: number; pricePos: number | null;
};

export type ReducedItem = {
  title: string; price: string | null; unit: { code: SaleUnit } | null; pack: Pack | null; available: boolean | null;
  source: string | null; flags: string[]; currency: CurrencyStatus;
};
export type RejectedClaim = { claim: unknown; reason: 'not_object' | 'bad_status' | 'no_product' };
export type ReduceResult = { items: ReducedItem[]; rejected: RejectedClaim[]; trace: Record<string, unknown>[] };

export function reduceClaims(claims: unknown[], message: string): ReduceResult {
  const cards: Card[] = [];
  const rejected: RejectedClaim[] = [];
  const trace: Record<string, unknown>[] = [];
  const numbers = numbersInMessage(message);

  let pre: { idx: number; cl: SanitizedClaim & { product: string }; span: Span | null }[] = [];
  claims.forEach((raw, idx) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      rejected.push({ claim: raw, reason: 'not_object' });
      return;
    }
    const cl = sanitize(raw as Record<string, unknown>);
    if (!(STATUSES as readonly string[]).includes(cl.status ?? '')) {
      rejected.push({ claim: cl, reason: 'bad_status' });
      return;
    }
    if (cl.status === 'cmd') {
      trace.push({ i: idx, op: 'cmd_ignored', text: cl.text });
      return;
    }
    if (!cl.product || !cl.product.trim()) {
      rejected.push({ claim: cl, reason: 'no_product' });
      return;
    }
    cl.product = cl.product.trim();
    pre.push({ idx, cl: cl as SanitizedClaim & { product: string }, span: findSpan(message, cl.text) });
  });

  let last = -1;
  const keys = pre.map((p, n) => {
    const pos = p.span !== null ? p.span[0] : last;
    last = pos;
    return [pos, n] as const;
  });
  const order = [...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, n]) => n);
  if (order.some((n, k) => n !== k)) trace.push({ op: 'reordered_by_text_position' });
  pre = order.map((n) => pre[n]!);

  const groups: string[][] = [];
  const gidOf = (prod: string) => {
    for (let i = 0; i < groups.length; i += 1) {
      const titles = groups[i]!;
      if (titles.some((t) => sameProduct(prod, t, true))) {
        if (!titles.includes(prod)) titles.push(prod);
        return i;
      }
    }
    groups.push([prod]);
    return groups.length - 1;
  };
  const gids = pre.map((p) => gidOf(p.cl.product));
  const { attach, low, bounds, mcount } = attachNumbers(message, groups);

  const clauseText = (pos: number) => {
    const c = bounds.filter((b) => b <= pos).length;
    const a0 = c > 0 ? bounds[c - 1]! : 0;
    const b0 = c < bounds.length ? bounds[c]! : low.length;
    return low.slice(a0, b0);
  };
  const newCard = (title: string, order_: number, gid: number) => {
    const c: Card = { title, price: null, unit: null, pack: null, available: null, spans: [], flags: new Set(), order: order_, gid, pricePos: null };
    cards.push(c);
    return c;
  };
  const matching = (prod: string, loose: boolean) => cards.filter((c) => sameProduct(prod, c.title, loose));
  const removeCard = (o: Card) => cards.splice(cards.indexOf(o), 1);
  const addFlags = (c: Card, flags: Iterable<string>) => { for (const f of flags) c.flags.add(f); };

  pre.forEach(({ idx, cl, span }, k) => {
    const gid = gids[k]!;
    const status = cl.status as Status;
    const prod = cl.product;
    const flags = new Set<string>();
    if (span === null) flags.add('quote_not_found');
    let price: string | null = null;
    let pricePos: number | null = null;
    const rawPrice = cl.price;
    if (rawPrice !== null && !['', 'null'].includes(pyStr(rawPrice).trim()) && status !== 'none') {
      const pv = parsePrice(rawPrice);
      if (pv === null) flags.add('price_unparsed');
      else if (!numbers.has(pv)) flags.add('price_not_in_message');
      else {
        const [occ, fl] = bindPrice(attach, mcount, message, gid, pv, span);
        addFlagsSet(flags, fl);
        if (occ !== null) {
          price = pv;
          pricePos = occ.pos;
        }
      }
    }
    const [unit, pack, uflags] = parseUnit(cl.per, cl.size, cl.text);
    addFlagsSet(flags, uflags);
    const only = cl.only;

    if (status === 'none') {
      const cands = matching(prod, true);
      const variantGiven = unit !== null || pack !== null;
      const targets = variantGiven ? cands.filter((c) => variantMatch(c, unit, pack)) : cands;
      if (targets.length > 0) {
        if (!variantGiven && new Set(targets.map((c) => keyText(c.unit, c.pack))).size > 1) flags.add('none_all_variants');
        for (const c of targets) {
          c.available = false;
          if (span) c.spans.push(span);
          addFlags(c, flags);
        }
      } else {
        const c = newCard(prod, idx, gid);
        c.available = false;
        if (variantGiven) {
          c.unit = unit;
          c.pack = pack;
          if (cands.length > 0) flags.add('none_variant_unmatched');
        }
        if (span) c.spans.push(span);
        addFlags(c, flags);
      }
      return;
    }

    let target: Card | null = null;
    if (status === 'fix') {
      const ts = matching(prod, true);
      const variantNamed = unit !== null || pack !== null;
      if (ts.length === 0) flags.add('fix_without_target');
      else {
        let cand = variantNamed ? ts.filter((c) => variantMatch(c, unit, pack)) : ts;
        if (variantNamed && cand.length === 0) cand = ts.filter((c) => variantFits(c, unit, pack));
        if (variantNamed && cand.length === 0) flags.add('fix_variant_unmatched');
        else if (cand.length === 1) target = cand[0]!;
        else {
          target = cand[cand.length - 1]!;
          flags.add('fix_ambiguous_target');
          for (const c of cand) c.flags.add('fix_ambiguous_target');
          trace.push({ i: idx, op: 'fix_ambiguous_target', title: prod, chosen: cand[cand.length - 1]!.title,
            candidates: cand.map((c) => keyOf(c.unit, c.pack)) });
        }
      }
    } else {
      const ts = matching(prod, false);
      const same = ts.filter((c) => keyText(c.unit, c.pack) === keyText(unit, pack));
      if (same.length > 0) target = same[same.length - 1]!;
      else if (ts.length > 0 && unit === null && pack === null) target = ts[ts.length - 1]!;
      else if (ts.length > 0 && ts.every((c) => c.available === false)) target = ts[ts.length - 1]!;
    }

    if (target === null) {
      const c = newCard(prod, idx, gid);
      c.price = price; c.unit = unit; c.pack = pack; c.available = true; c.pricePos = pricePos;
      if (span) c.spans.push(span);
      addFlags(c, flags);
      if (only) {
        for (const o of matching(prod, true)) {
          if (o !== c) {
            removeCard(o);
            trace.push({ i: idx, op: 'superseded', title: o.title });
          }
        }
      }
      return;
    }

    const tkey = keyText(target.unit, target.pack);
    const ckey = keyText(unit, pack);
    const variantGiven = unit !== null || pack !== null;
    if (variantGiven && status === 'fix' && variantFits(target, unit, pack) && !variantMatch(target, unit, pack)) {
      if (target.unit === null && unit !== null) target.unit = unit;
      if (target.pack === null && pack !== null) target.pack = pack;
    } else if (variantGiven && !variantMatch(target, unit, pack) && ckey !== tkey) {
      const targetEmpty = target.unit === null && target.pack === null;
      if (targetEmpty) {
        target.unit = unit;
        target.pack = pack;
      } else if (only) {
        for (const o of matching(prod, true)) {
          if (o !== target) {
            removeCard(o);
            trace.push({ i: idx, op: 'superseded', title: o.title });
          }
        }
        target.unit = unit;
        target.pack = pack;
      } else {
        const c = newCard(prod, idx, gid);
        c.price = price; c.unit = unit; c.pack = pack; c.available = true; c.pricePos = pricePos;
        if (span) c.spans.push(span);
        addFlags(c, flags);
        c.flags.add('fix_changed_variant');
        return;
      }
    } else if (only) {
      for (const o of matching(prod, true)) {
        if (o !== target && keyText(o.unit, o.pack) !== tkey) {
          removeCard(o);
          trace.push({ i: idx, op: 'superseded', title: o.title });
        }
      }
    }
    if (price !== null) {
      if (target.price !== null && target.price !== price) {
        flags.add('price_overwritten');
        trace.push({ i: idx, op: 'price_overwritten', title: target.title, old: target.price, new: price });
      }
      target.price = price;
      target.pricePos = pricePos;
    }
    target.available = true;
    if (span) target.spans.push(span);
    addFlags(target, flags);
  });

  const groupKeys = new Map<number, Set<string>>();
  for (const c of cards) {
    if (!groupKeys.has(c.gid)) groupKeys.set(c.gid, new Set());
    groupKeys.get(c.gid)!.add(keyText(c.unit, c.pack));
  }

  const items: ReducedItem[] = [];
  const ordered = cards.map((c, k) => ({ c, k })).sort((a, b) => a.c.order - b.c.order || a.k - b.k).map(({ c }) => c);
  for (const c of ordered) {
    let source: string | null;
    if (c.spans.length > 0) {
      const s0 = Math.min(...c.spans.map(([a]) => a));
      const s1 = Math.max(...c.spans.map(([, b]) => b));
      source = message.slice(s0, s1);
    } else {
      source = null;
      c.flags.add('no_source');
    }
    const fl = new Set(c.flags);
    if ((mcount[c.gid] ?? 0) === 0) fl.add('product_not_in_message');
    if (c.available && c.price === null) fl.add('price_missing');
    if (c.price !== null && c.unit === null) fl.add('unit_not_stated');
    if (c.price !== null && c.pricePos !== null) {
      if (CMD_RE.test(clauseText(c.pricePos))) fl.add('price_in_command_clause');
      if ((groupKeys.get(c.gid)?.size ?? 0) <= 1) {
        for (const o of attach[c.gid]!) {
          if (o.pos > c.pricePos && !o.values.has(c.price)) {
            const cs = bounds.filter((b) => b <= o.pos).length;
            const a0 = cs > 0 ? bounds[cs - 1]! : 0;
            if (CORR_MARK_RE.test(low.slice(Math.max(a0, o.pos - 40), o.pos))) {
              fl.add('later_correction_in_text');
              break;
            }
          }
        }
      }
    }
    items.push({
      title: c.title, price: c.price, unit: c.unit ? { code: c.unit } : null, pack: c.pack, available: c.available,
      source, flags: [...fl].sort(), currency: currencyStatus(message, source),
    });
  }
  return { items, rejected, trace };
}

function addFlagsSet(target: Set<string>, flags: Iterable<string>) {
  for (const f of flags) target.add(f);
}

// --- model answer parsing (C2 rule) ---

export function stripThink(raw: string): string {
  return raw.includes('</think>') ? raw.split('</think>').pop()! : raw;
}

export function extractJsonArray(raw: string | null): [unknown, string | null] {
  if (raw === null) return [null, 'empty'];
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return [JSON.parse(s), null];
  } catch {
    // fall through to the first-array rule
  }
  const i = s.indexOf('[');
  const j = s.lastIndexOf(']');
  if (i >= 0 && j > i) {
    try {
      return [JSON.parse(s.slice(i, j + 1)), null];
    } catch (e) {
      return [null, `json_error:${String((e as Error).message).slice(0, 80)}`];
    }
  }
  return [null, 'no_json'];
}

// parse_output for the ledger conditions: → claims array, or an error (answer-level failure, contract §6.2).
export function claimsFromAnswer(raw: string): { claims: unknown[] } | { error: string } {
  const [obj0, err] = extractJsonArray(stripThink(raw));
  let obj = obj0;
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key of ['claims', 'items', 'data']) {
      const v = (obj as Record<string, unknown>)[key];
      if (Array.isArray(v)) {
        obj = v;
        break;
      }
    }
  }
  if (err || !Array.isArray(obj)) return { error: err ?? 'not_list' };
  return { claims: obj };
}

// Non-size number occurrences of the message (for the «unused number» omission hint; contract §6.3).
export function numberOccurrences(message: string): { start: number; end: number; values: Set<string> }[] {
  const low = lower(message);
  return numbersWithPos(low, tokSpans(low)).filter((o) => !o.isSize).map((o) => ({ start: o.start, end: o.end, values: o.values }));
}
