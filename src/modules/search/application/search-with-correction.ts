import { sql } from 'drizzle-orm';
import { getDatabase, type Database } from '../../../db/client';
import type { SearchResponse } from '../contracts/search.contract';
import { readTypoCorrectionConfig, TYPO_WORK_STATEMENT_TIMEOUT_MS, type TypoCorrectionConfig } from '../typo/typo-config';
import { runCorrectionPass } from '../typo/typo-limiter';
import { proposeCorrection } from '../typo/typo-rules';
import { typoVocabularyFor } from '../typo/typo-vocabulary';
import { searchOffersDetailed, type SearchOutcome } from './search-offers';

// search-typo-suggestions (contract rev 3 §3.2): the original Search always runs first and unchanged. Only a Search that found
// nothing and recognised no product may be corrected, once, and only when the corrected text really returns Offers.
type SearchOptions = NonNullable<Parameters<typeof searchOffersDetailed>[2]>;

// The original intent stays in the outcome (what D0 records); the corrected text and its Offers are what the buyer is shown.
export type CorrectedSearchOutcome = SearchOutcome & {
  correction?: { from: string; to: string; offerCount: number };
};

export async function searchOffersWithCorrection(
  input: string,
  database: Database | undefined,
  options: SearchOptions,
  settings: { correct: boolean; config?: TypoCorrectionConfig },
): Promise<CorrectedSearchOutcome> {
  const original = await searchOffersDetailed(input, database, options);
  const config = settings.config ?? readTypoCorrectionConfig();
  if (
    !settings.correct || !config.enabled
    || original.response.offers.length > 0
    || original.response.resolvedProduct != null
    || original.resolution !== 'unresolved'
    || options.productId !== undefined
  ) return original;

  const db = database ?? getDatabase();
  const pass = await runCorrectionPass(async () => {
    const vocabulary = await typoVocabularyFor(db).get();
    if (vocabulary === null) return null;
    const proposal = proposeCorrection(original.response.query, vocabulary);
    if (proposal === null) return null;
    // One verification search by the same rules (visibility, window, sort, direction, location); never with a product id.
    // A short transaction with its own statement timeout: the work ends by itself even if the response was sent long ago.
    const verified = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('statement_timeout', ${String(TYPO_WORK_STATEMENT_TIMEOUT_MS)}, true)`);
      return searchOffersDetailed(proposal.to, tx as unknown as Database, { ...options, productId: undefined });
    });
    return { proposal, verified };
  }, config.budgetMs, config.maxPasses);

  if (pass.status !== 'done' || pass.value === null) return original;
  const { proposal, verified } = pass.value;
  // A corrected text without Offers, or one that only lands on a known product, is never substituted.
  if (verified.response.offers.length === 0) return original;
  const response: SearchResponse = {
    query: original.response.query,
    resolvedProduct: verified.response.resolvedProduct ?? null,
    offers: verified.response.offers,
    correction: { from: original.response.query, to: proposal.to },
  };
  return { response, resolution: original.resolution, correction: { from: original.response.query, to: proposal.to, offerCount: verified.response.offers.length } };
}
