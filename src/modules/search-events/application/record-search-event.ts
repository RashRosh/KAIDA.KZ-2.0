import { sql } from 'drizzle-orm';
import { getDatabase, type Database } from '../../../db/client';
import { readSearchEventsConfig, type SearchEventsConfig } from '../config';
import { searchEvents } from '../db/search-events.table';
import { eventQueryOf } from '../event-query';
import { purgeSearchEvents } from './purge-search-events';

// S15C / D0 (docs/slices/s15c-d0-search-demand-events §3.5, §3.8): a best-effort, bounded, awaited write of one search event.
// Never throws; never turns a successful Search into an error; no queue, no retry. At most one event per request (a lost response
// followed by a retry may duplicate it; a failed or skipped write loses it).

export type SearchEntry = 'submit' | 'suggestion' | 'chip';
export type SearchResolution = 'selected' | 'resolved' | 'ambiguous' | 'unresolved';

export type SearchEventInput = {
  entry: SearchEntry;
  // The raw query: reduced to the normalized form (and possibly refused) here; the raw text is never stored or logged.
  query: string;
  resolvedProductId: string | null;
  resolution: SearchResolution;
  // The number of Offers in the returned response.
  resultCount: number;
};

export type RecordSearchEventStatus = 'written' | 'pending' | 'skipped' | 'failed' | 'ignored';

// Writes that have been started and not settled yet. `Promise.race` does not cancel a write, so a slot is held until the
// underlying operation settles — a slow database cannot make unfinished writes pile up without bound.
let unfinishedWrites = 0;
export function unfinishedSearchEventWrites(): number {
  return unfinishedWrites;
}

// The log line carries no query, no product and no error details.
function logFailure() {
  console.error('Search event failed');
}

const BACKSTOP_PURGE_PROBABILITY = 0.02;
const BACKSTOP_PURGE_BATCH = 500;

export async function runBoundedWrite(
  write: () => Promise<void>,
  budgetMs: number,
  maxUnfinished: number,
): Promise<Exclude<RecordSearchEventStatus, 'ignored'>> {
  if (unfinishedWrites >= maxUnfinished) return 'skipped';
  unfinishedWrites += 1;
  let settled: Promise<'written' | 'failed'>;
  try {
    settled = write().then(() => 'written' as const, () => { logFailure(); return 'failed' as const; });
  } catch {
    // a synchronous failure of the write function itself
    unfinishedWrites -= 1;
    logFailure();
    return 'failed';
  }
  // Always handled: a late failure after the wait budget is caught by the handlers above, never an unhandled rejection.
  const done = settled.finally(() => { unfinishedWrites -= 1; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<'pending'>((resolve) => { timer = setTimeout(() => resolve('pending'), budgetMs); });
  try {
    return await Promise.race([done, budget]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function hourStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
}

export async function recordSearchEvent(
  input: SearchEventInput,
  options: { database?: Database; config?: SearchEventsConfig; now?: () => Date; random?: () => number } = {},
): Promise<RecordSearchEventStatus> {
  try {
    const queryNormalized = eventQueryOf(input.query);
    if (queryNormalized === null) return 'ignored';
    const config = options.config ?? readSearchEventsConfig();
    const db = options.database ?? getDatabase();
    const now = (options.now ?? (() => new Date()))();
    const random = options.random ?? Math.random;
    return await runBoundedWrite(async () => {
      // A short transaction: the timeouts are local to it, so the pooled connection is left clean, and it always ends
      // (COMMIT or ROLLBACK) — also when a statement times out.
      await db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('statement_timeout', ${String(config.writeBudgetMs)}, true)`);
        await tx.execute(sql`select set_config('lock_timeout', ${String(config.writeBudgetMs)}, true)`);
        await tx.execute(sql`select set_config('idle_in_transaction_session_timeout', ${String(Math.max(1000, config.writeBudgetMs * 4))}, true)`);
        await tx.insert(searchEvents).values({
          occurredAt: hourStart(now),
          entry: input.entry,
          queryNormalized,
          resolvedProductId: input.resolvedProductId,
          resolution: input.resolution,
          resultCount: Math.max(0, Math.trunc(input.resultCount)),
          origin: config.origin,
        });
      });
      // A backstop only (the operator-run command is the retention mechanism): now and then a small expired batch goes too.
      if (random() < BACKSTOP_PURGE_PROBABILITY) {
        try {
          await purgeSearchEvents(db, { retentionDays: config.retentionDays, now, maxRows: BACKSTOP_PURGE_BATCH, statementTimeoutMs: config.writeBudgetMs * 4 });
        } catch {
          // the event itself is already written; a failed backstop is not a failed write
        }
      }
    }, config.writeBudgetMs, config.maxPendingWrites);
  } catch {
    logFailure();
    return 'failed';
  }
}
