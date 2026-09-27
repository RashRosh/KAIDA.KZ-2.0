import type { Database } from '../../../db/client';
import { offerTitleSearchText, queryWords, titleMatchesQuery } from '../../offers/title/offer-title';
import { findCatalogNamesContaining } from '../infrastructure/products.repository';

export const SUGGESTION_LIMIT = 5;

export type ProductSuggestion = { id: string; name: string };

// seller-showcase-editor «Name · mixed input»: catalog products whose name or alias has every typed word as a word start.
export async function suggestCatalogProducts(
  database: Pick<Database, 'execute'>,
  input: string,
  locale: 'ru' | 'kk',
): Promise<ProductSuggestion[]> {
  const words = queryWords(input);
  if (words.length === 0) return [];
  const probe = words.reduce((longest, word) => word.length > longest.length ? word : longest);
  const rows = await findCatalogNamesContaining(database, probe, locale, 100);
  const suggestions = new Map<string, ProductSuggestion>();
  for (const row of rows) {
    if (suggestions.size >= SUGGESTION_LIMIT) break;
    if (!suggestions.has(row.id) && titleMatchesQuery(offerTitleSearchText(row.matched), words)) {
      suggestions.set(row.id, { id: row.id, name: row.name });
    }
  }
  return [...suggestions.values()];
}
