import { getWordFormDictionary, type WordFormDictionary } from '../word-forms/word-forms';
import { queryWords } from '../../offers/title/offer-title';

// search-typo-suggestions (docs/slices/search-typo-suggestions, contract rev 3 §3.4, §3.11): pure rules of the automatic
// correction of a mistyped word. No locale, no language detection: only the letters of the word and exact membership in
// the dictionary of public words decide. Nothing here touches the database.

export const TYPO_LIMITS = {
  minWordLength: 5,
  maxWordLength: 40,
  maxWords: 6,
  maxCorrectedWords: 2,
  lengthWindow: 2,
  // a better candidate must beat the next different word by at least this much
  margin: 0.5,
  // bounded retrieval and CPU (contract §3.11)
  maxComparisonsPerWord: 3000,
  maxComparisonsPerQuery: 6000,
  cpuBudgetMs: 25,
  cpuCheckEvery: 256,
} as const;

// Only the letters а–я (after ё→е) are corrected or used as candidates: a word with Kazakh letters, digits, Latin or any
// other character is never touched (and never a candidate). This tests a character set, it does not detect a language.
const CORRECTABLE = /^[а-я]+$/u;
export function isCorrectableWord(word: string): boolean {
  return word.length >= TYPO_LIMITS.minWordLength && word.length <= TYPO_LIMITS.maxWordLength && CORRECTABLE.test(word);
}
export function isCandidateWord(word: string): boolean {
  return word.length >= TYPO_LIMITS.minWordLength && word.length <= TYPO_LIMITS.maxWordLength && CORRECTABLE.test(word);
}

// Cheap vowel confusions heard rather than seen: а↔о, е↔и, и↔ы.
const VOWEL_PAIRS = new Set(['ао', 'оа', 'еи', 'ие', 'иы', 'ыи']);

// The allowed classes only: one missing or extra letter, one swap of neighbours, vowel-pair replacements (0.5). A replacement of
// a letter by another one outside those pairs exists only as «missing + extra» (cost 2), which the cost limit allows for long
// words (≥ 8 letters) and never for words of 5–7 letters. Returns Infinity when the cost exceeds `limit`.
export function editCost(typed: string, candidate: string, limit: number): number {
  const n = typed.length;
  const m = candidate.length;
  if (Math.abs(n - m) > limit) return Infinity;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  d[0]![0] = 0;
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      const here = d[i]![j]!;
      if (here === Infinity || here > limit) continue;
      if (i < n && j < m) {
        const a = typed[i]!;
        const b = candidate[j]!;
        if (a === b) d[i + 1]![j + 1] = Math.min(d[i + 1]![j + 1]!, here);
        else if (VOWEL_PAIRS.has(a + b)) d[i + 1]![j + 1] = Math.min(d[i + 1]![j + 1]!, here + 0.5);
      }
      if (i < n) d[i + 1]![j] = Math.min(d[i + 1]![j]!, here + 1);
      if (j < m) d[i]![j + 1] = Math.min(d[i]![j + 1]!, here + 1);
      if (i + 1 < n && j + 1 < m && typed[i] === candidate[j + 1] && typed[i + 1] === candidate[j]) {
        d[i + 2]![j + 2] = Math.min(d[i + 2]![j + 2]!, here + 1);
      }
    }
  }
  const cost = d[n]![m]!;
  return cost <= limit ? cost : Infinity;
}

export function costLimit(wordLength: number): number {
  if (wordLength < TYPO_LIMITS.minWordLength) return -1;
  return wordLength <= 7 ? 1 : 2;
}

// The in-memory dictionary of public words (contract §3.3). `known` holds every word (any letters) and is only a guard;
// `candidates` holds the а–я words, indexed by their first letter. `display` keeps the spelling of the source (with ё).
export type TypoVocabulary = {
  readonly known: ReadonlySet<string>;
  readonly sortedKnown: readonly string[];
  readonly candidates: ReadonlyMap<string, readonly string[]>;
  readonly display: ReadonlyMap<string, string>;
  readonly wordCount: number;
};

// A word is known when it is a public word, the start of one (Search finds it by prefix anyway) or a form of the reviewed
// word-forms dictionary.
export function isKnownWord(word: string, vocabulary: TypoVocabulary, forms: WordFormDictionary = getWordFormDictionary()): boolean {
  if (vocabulary.known.has(word) || forms.formsOf(word) !== null) return true;
  const sorted = vocabulary.sortedKnown;
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted[mid]! < word) low = mid + 1;
    else high = mid;
  }
  return low < sorted.length && sorted[low]!.startsWith(word);
}

export function buildVocabulary(rawWords: Iterable<string>, maxWords: number): TypoVocabulary {
  const known = new Set<string>();
  const display = new Map<string, string>();
  const candidates = new Map<string, string[]>();
  for (const raw of rawWords) {
    if (known.size >= maxWords) break;
    const word = raw.replace(/ё/gu, 'е');
    if (word.length < 2 || word.length > TYPO_LIMITS.maxWordLength || known.has(word)) continue;
    known.add(word);
    if (raw !== word) display.set(word, raw);
    if (isCandidateWord(word)) {
      const list = candidates.get(word[0]!);
      if (list === undefined) candidates.set(word[0]!, [word]);
      else list.push(word);
    }
  }
  return { known, sortedKnown: [...known].sort(), candidates, display, wordCount: known.size };
}

export type CorrectionProposal = { from: string; to: string };

type WordDecision = { kind: 'keep' } | { kind: 'fix'; replacement: string };

// The correction of a query, or null when no sufficiently confident, unambiguous correction exists (contract §3.4).
// `now` is the monotonic clock of the CPU budget (injectable for tests).
export function proposeCorrection(
  query: string,
  vocabulary: TypoVocabulary,
  options: { now?: () => number; forms?: WordFormDictionary } = {},
): CorrectionProposal | null {
  const now = options.now ?? (() => performance.now());
  const forms = options.forms ?? getWordFormDictionary();
  const words = queryWords(query);
  if (words.length === 0 || words.length > TYPO_LIMITS.maxWords) return null;
  const started = now();
  let perQuery = 0;
  let sinceCheck = 0;
  let outOfBudget = false;
  const decisions: WordDecision[] = [];
  let fixed = 0;
  for (const word of words) {
    if (isKnownWord(word, vocabulary, forms)) { decisions.push({ kind: 'keep' }); continue; }
    if (!isCorrectableWord(word) || fixed >= TYPO_LIMITS.maxCorrectedWords) return null;
    const limit = costLimit(word.length);
    if (now() - started >= TYPO_LIMITS.cpuBudgetMs) return null;
    const pool = vocabulary.candidates.get(word[0]!) ?? [];
    // best cost per group of word forms (forms of one word are one candidate)
    const groups = new Map<unknown, { word: string; cost: number }>();
    let perWord = 0;
    for (const candidate of pool) {
      if (Math.abs(candidate.length - word.length) > TYPO_LIMITS.lengthWindow) continue;
      perWord += 1;
      perQuery += 1;
      sinceCheck += 1;
      if (perWord > TYPO_LIMITS.maxComparisonsPerWord || perQuery > TYPO_LIMITS.maxComparisonsPerQuery) return null;
      if (sinceCheck >= TYPO_LIMITS.cpuCheckEvery) {
        sinceCheck = 0;
        if (now() - started >= TYPO_LIMITS.cpuBudgetMs) outOfBudget = true;
      }
      if (outOfBudget) return null;
      const cost = editCost(word, candidate, limit);
      if (cost === Infinity) continue;
      const key = forms.formsOf(candidate) ?? candidate;
      const best = groups.get(key);
      if (best === undefined || cost < best.cost || (cost === best.cost && candidate < best.word)) groups.set(key, { word: candidate, cost });
    }
    const ranked = [...groups.values()].sort((a, b) => a.cost - b.cost || (a.word < b.word ? -1 : 1));
    const best = ranked[0];
    if (best === undefined) return null;
    const second = ranked[1];
    if (second !== undefined && second.cost - best.cost < TYPO_LIMITS.margin) return null;
    decisions.push({ kind: 'fix', replacement: vocabulary.display.get(best.word) ?? best.word });
    fixed += 1;
  }
  if (fixed === 0) return null;
  const to = words.map((word, index) => {
    const decision = decisions[index]!;
    return decision.kind === 'fix' ? decision.replacement : word;
  }).join(' ');
  return { from: words.join(' '), to };
}
