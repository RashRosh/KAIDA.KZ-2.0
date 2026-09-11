import { getDatabase, type Database } from '../../../db/client';
import { searchQuerySchema, type SearchResponse } from '../contracts/search.contract';
import { findOffersByProductName } from '../infrastructure/search.repository';

export async function searchOffers(input: string, database?: Database): Promise<SearchResponse> {
  const query = searchQuerySchema.parse(input);
  const offers = await findOffersByProductName(database ?? getDatabase(), query);
  return { query, offers };
}
