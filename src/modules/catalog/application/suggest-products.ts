import { getDatabase, type Database } from '../../../db/client';
import { queryWords } from '../../offers/title/offer-title';
import { findCatalogSuggestionCandidates } from '../infrastructure/products.repository';
import { rankSuggestions, type ProductSuggestion } from './rank-suggestions';

export const SUGGESTION_LIMIT = 5;

export type { ProductSuggestion };

// seller-showcase-editor «Name · mixed input»: catalog products whose name or alias has every typed word as a word start,
// ordered by match relevance (S15B-1) — never by an alphabetical cut before ranking.
export async function suggestCatalogProducts(
  database: Pick<Database, 'execute'> = getDatabase(),
  input: string,
  locale: 'ru' | 'kk',
): Promise<ProductSuggestion[]> {
  const words = queryWords(input);
  if (words.length === 0) return [];
  return rankSuggestions(await findCatalogSuggestionCandidates(database, words, locale), words, SUGGESTION_LIMIT);
}
