import { describe, expect, it } from 'vitest';
import { queryWords } from '../../src/modules/offers/title/offer-title';
import { rankSuggestions, suggestionLevel, type SuggestionCandidate } from '../../src/modules/catalog/application/rank-suggestions';

// S15B-1: deterministic relevance of catalog suggestions.

const name = (id: string, text: string, display = text): SuggestionCandidate => ({ id, name: display, matched: text, kind: 'name' });
const alias = (id: string, text: string, display: string): SuggestionCandidate => ({ id, name: display, matched: text, kind: 'alias' });
const rank = (candidates: SuggestionCandidate[], query: string, limit = 5) => rankSuggestions(candidates, queryWords(query), limit).map((s) => s.id);

describe('suggestionLevel', () => {
  const words = queryWords('баран');
  it('orders exact name, exact alias, leading name, leading alias, inner name, inner alias', () => {
    expect(suggestionLevel(name('1', 'Баран'), words)).toBe(1);
    expect(suggestionLevel(alias('1', 'баран', 'X'), words)).toBe(2);
    expect(suggestionLevel(name('1', 'Баранина для плова'), words)).toBe(3);
    expect(suggestionLevel(alias('1', 'баранья нога', 'X'), words)).toBe(4);
    expect(suggestionLevel(name('1', 'Мясо барана'), words)).toBe(5);
    expect(suggestionLevel(alias('1', 'мясо барана', 'X'), words)).toBe(6);
  });
  it('keeps the closed word-prefix eligibility: substrings and one-letter words do not match', () => {
    expect(suggestionLevel(name('1', 'Баранина'), queryWords('аранина'))).toBeNull();
    expect(suggestionLevel(name('1', 'Баранина'), queryWords('б'))).toBeNull();
    expect(suggestionLevel(name('1', 'Мёд горный'), queryWords('мед гор'))).toBe(3);
  });
});

describe('rankSuggestions', () => {
  const pool = [
    name('a', 'Барабулька'), name('b', 'Бараний рубец'), name('c', 'Бараний фарш'), name('d', 'Баранина для плова'),
    name('e', 'Баранина'), name('f', 'Барбарис'), alias('e', 'мясо барана', 'Баранина'),
  ];
  it('puts the shorter, more general match first instead of alphabetical order', () => {
    expect(rank(pool, 'баран')).toEqual(['e', 'c', 'b', 'd']);
    expect(rank(pool, 'баранина')).toEqual(['e', 'd']);
  });
  it('lets a strong match beat a weak one regardless of order, one suggestion per product, at most the limit', () => {
    expect(rank([name('x', 'Мясо барана'), name('y', 'Баранина')], 'баран')).toEqual(['y', 'x']);
    expect(rank([alias('p', 'мясо барана', 'P'), name('p', 'Баранина')], 'баран')).toEqual(['p']);
    expect(rank(pool, 'бар', 3)).toHaveLength(3);
  });
  it('is deterministic whatever the candidate order, with display name then id as tie-breakers', () => {
    const tied = [name('2', 'Яблоко', 'Яблоко'), name('1', 'Яблоко', 'Яблоко'), name('3', 'Ябло', 'Ябло')];
    expect(rank(tied, 'ябл')).toEqual(['3', '1', '2']);
    expect(rank([...tied].reverse(), 'ябл')).toEqual(['3', '1', '2']);
    expect(rank([...pool].reverse(), 'баран')).toEqual(rank(pool, 'баран'));
  });
});
