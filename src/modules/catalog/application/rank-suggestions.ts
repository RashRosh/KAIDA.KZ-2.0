import { offerTitleSearchText, titleMatchesQuery } from '../../offers/title/offer-title';

// S15B-1: relevance of catalog suggestions. Eligibility (every query word starts a word of a name or alias) is the
// closed word-prefix rule; this only orders the eligible Products. Deterministic, no scoring weights.

export type SuggestionCandidate = {
  id: string;
  name: string; // display name in the interface language
  matched: string; // the canonical / localized name or alias text that was matched
  kind: 'name' | 'alias';
};

export type ProductSuggestion = { id: string; name: string };

// 1 exact name · 2 exact alias · 3 name starts with the whole query · 4 alias starts with it · 5 word-prefix in a name · 6 in an alias.
export function suggestionLevel(candidate: SuggestionCandidate, words: string[]): number | null {
  const text = offerTitleSearchText(candidate.matched);
  if (!titleMatchesQuery(text, words)) return null;
  const titleWords = text.split(' ');
  const exact = text === words.join(' ');
  const leading = words.length <= titleWords.length && words.every((word, index) => titleWords[index]!.startsWith(word));
  const base = exact ? 1 : leading ? 3 : 5;
  return candidate.kind === 'name' ? base : base + 1;
}

const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export function rankSuggestions(candidates: SuggestionCandidate[], words: string[], limit: number): ProductSuggestion[] {
  const best = new Map<string, { id: string; name: string; level: number; length: number }>();
  for (const candidate of candidates) {
    const level = suggestionLevel(candidate, words);
    if (level === null) continue;
    const length = offerTitleSearchText(candidate.matched).length;
    const current = best.get(candidate.id);
    if (!current || level < current.level || (level === current.level && length < current.length)) {
      best.set(candidate.id, { id: candidate.id, name: candidate.name, level, length });
    }
  }
  return [...best.values()]
    .sort((a, b) => a.level - b.level || a.length - b.length
      || compare(offerTitleSearchText(a.name), offerTitleSearchText(b.name)) || compare(a.id, b.id))
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }));
}
