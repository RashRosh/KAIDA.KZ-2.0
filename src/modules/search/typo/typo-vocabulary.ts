import { desc, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { offers } from '../../offers/db/offers.table';
import { readOfferValidityPeriodHours } from '../../offers/config/offer-lifecycle.config';
import { calculateOfferCutoff } from '../../offers/lifecycle/offer-lifecycle';
import { buyerVisibleOffersPredicate } from '../../offers/visibility/buyer-offer-visibility';
import { buildVocabulary, type TypoVocabulary } from './typo-rules';
import { TYPO_WORK_STATEMENT_TIMEOUT_MS } from './typo-config';

// search-typo-suggestions (contract rev 3 §3.3, §3.11): the dictionary of PUBLIC words only — the names, localized names and
// aliases of the catalog and the search text of the Offers that are visible to buyers right now (the same visibility as
// Search). Never seller names or comments, phones, buyer queries, search events or any personal data. Bounded and refreshed
// by time; one load at a time.
export const VOCABULARY_LIMITS = {
  maxWords: 20_000,
  catalogRows: 20_000,
  offerRows: 5_000,
  ttlMs: 300_000,
  retryAfterFailureMs: 30_000,
} as const;

export function rawWordsOf(text: string): string[] {
  return text.toLocaleLowerCase('ru').split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
}

export type VocabularyLoader = () => Promise<TypoVocabulary>;

// The refresh policy, independent of the database: fresh → as is; stale → the old dictionary keeps serving while one refresh
// runs; none yet → one load, awaited by whoever needs it; after a failure no new attempt within the retry interval.
export function createVocabularyCache(load: VocabularyLoader, options: { ttlMs?: number; retryAfterFailureMs?: number; clock?: () => number } = {}) {
  const ttlMs = options.ttlMs ?? VOCABULARY_LIMITS.ttlMs;
  const retryMs = options.retryAfterFailureMs ?? VOCABULARY_LIMITS.retryAfterFailureMs;
  const clock = options.clock ?? (() => Date.now());
  let cached: { vocabulary: TypoVocabulary; loadedAt: number } | null = null;
  let inflight: Promise<TypoVocabulary | null> | null = null;
  let lastFailureAt = Number.NEGATIVE_INFINITY;
  let loads = 0;

  function start(): Promise<TypoVocabulary | null> {
    if (inflight !== null) return inflight;
    if (clock() - lastFailureAt < retryMs) return Promise.resolve(cached?.vocabulary ?? null);
    loads += 1;
    inflight = load().then(
      (vocabulary) => { cached = { vocabulary, loadedAt: clock() }; return vocabulary; },
      () => { lastFailureAt = clock(); console.error('Typo vocabulary load failed'); return cached?.vocabulary ?? null; },
    ).finally(() => { inflight = null; });
    return inflight;
  }

  return {
    // null → no dictionary available now (the correction is simply skipped).
    async get(): Promise<TypoVocabulary | null> {
      if (cached !== null && clock() - cached.loadedAt < ttlMs) return cached.vocabulary;
      if (cached !== null) { void start(); return cached.vocabulary; }
      return start();
    },
    loadCount: () => loads,
    reset() { cached = null; inflight = null; lastFailureAt = Number.NEGATIVE_INFINITY; loads = 0; },
  };
}

async function loadFromDatabase(db: Database): Promise<TypoVocabulary> {
  const cutoff = calculateOfferCutoff(new Date(), readOfferValidityPeriodHours());
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('statement_timeout', ${String(TYPO_WORK_STATEMENT_TIMEOUT_MS)}, true)`);
    const catalog = await tx.execute<{ name: string }>(sql`
      select name from (
        select name from products
        union all select name from product_localized_names
        union all select name from product_aliases
      ) n limit ${VOCABULARY_LIMITS.catalogRows}
    `);
    const titles = await tx.select({ text: offers.titleSearch }).from(offers)
      .where(buyerVisibleOffersPredicate(cutoff))
      .orderBy(desc(offers.lastConfirmedAt))
      .limit(VOCABULARY_LIMITS.offerRows);
    // catalog words first, then the words of visible Offers; the total is capped
    const words = [...catalog.rows.flatMap((row) => rawWordsOf(row.name)), ...titles.flatMap((row) => rawWordsOf(row.text))];
    return buildVocabulary(words, VOCABULARY_LIMITS.maxWords);
  });
}

let databaseCache: ReturnType<typeof createVocabularyCache> | null = null;
let databaseCacheFor: Database | null = null;

// One dictionary per process (and per database connection object).
export function typoVocabularyFor(db: Database): ReturnType<typeof createVocabularyCache> {
  if (databaseCache === null || databaseCacheFor !== db) {
    databaseCacheFor = db;
    databaseCache = createVocabularyCache(() => loadFromDatabase(db));
  }
  return databaseCache;
}
