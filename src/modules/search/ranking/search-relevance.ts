import { searchWords } from '../../offers/title/offer-title';
import { wordEvidence } from '../word-forms/word-forms';
import type { SearchMatchLevel } from './search-ranking';

// S15B-4b + search-word-forms: deterministic match levels for the `relevance` order — evidence kinds, not probabilities and
// not weights.
//   1  the Offer is linked to the Product the query is (an exact resolver hit: canonical name, localized name or alias);
//   2  every query word equals a whole word of the Offer title;
//   3  every query word equals a title word or is another grammatical form of it (reviewed dictionary), at least one by form;
//   4  any other eligible Offer (word prefixes, or a candidate that only a non-applicable selected Product brought in).
// A selected Product that the text does not agree with stays a candidate but never earns level 1 by the selection itself:
// only `applicableProductId` — the resolver's own result for the text — does. The level never depends on the interface language.
export function classifyMatchLevel(input: {
  title: string;
  productId: string | null;
  applicableProductId: string | null;
  words: readonly string[];
}): SearchMatchLevel {
  if (input.applicableProductId !== null && input.productId === input.applicableProductId) return 1;
  if (input.words.length === 0) return 4;
  const titleWords = new Set(searchWords(input.title));
  const evidence = input.words.map((word) => wordEvidence(word, titleWords));
  if (evidence.every((kind) => kind === 'E')) return 2;
  if (evidence.every((kind) => kind !== 'P')) return 3;
  return 4;
}
