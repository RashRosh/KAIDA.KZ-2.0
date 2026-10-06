import { searchWords } from '../../offers/title/offer-title';
import type { SearchMatchLevel } from './search-ranking';

// S15B-4b: deterministic match levels for the `relevance` order — evidence kinds, not probabilities and not weights.
//   1  the Offer is linked to the Product the query is (an exact resolver hit: canonical name, localized name or alias);
//   2  every query word equals a whole word of the Offer title;
//   3  any other eligible Offer (word prefixes, or a candidate that only a non-applicable selected Product brought in).
// A selected Product that the text does not agree with stays a candidate but never earns level 1 by the selection itself:
// only `applicableProductId` — the resolver's own result for the text — does.
export function classifyMatchLevel(input: {
  title: string;
  productId: string | null;
  applicableProductId: string | null;
  words: readonly string[];
}): SearchMatchLevel {
  if (input.applicableProductId !== null && input.productId === input.applicableProductId) return 1;
  if (input.words.length > 0) {
    const titleWords = new Set(searchWords(input.title));
    if (input.words.every((word) => titleWords.has(word))) return 2;
  }
  return 3;
}
