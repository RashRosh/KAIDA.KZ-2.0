import { sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';

// S15C / D0 retention (docs/slices/s15c-d0-search-demand-events §3.10): delete search events older than the retention period.
// This is the operator-run mechanism (`pnpm search-events:purge`, scheduled daily outside the app). It is idempotent. The actual
// retention is the period plus the interval between successful runs — the app itself cannot guarantee more.

export type PurgeResult = {
  // Rows removed (or, in a dry run, rows that would be removed).
  deleted: number;
  // The age in whole days of the oldest event that remains, or null when the table is empty.
  oldestRemainingDays: number | null;
};

export async function purgeSearchEvents(
  db: Database,
  options: { retentionDays: number; now?: Date; dryRun?: boolean; maxRows?: number; statementTimeoutMs?: number },
): Promise<PurgeResult> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - options.retentionDays * 86_400_000);
  let deleted = 0;

  if (options.dryRun) {
    const counted = await db.execute<{ count: string }>(sql`select count(*)::text as count from search_events where occurred_at < ${cutoff.toISOString()}::timestamptz`);
    deleted = Number(counted.rows[0]?.count ?? 0);
  } else {
    const batch = options.maxRows ?? 5000;
    for (;;) {
      const removed = await db.transaction(async (tx) => {
        if (options.statementTimeoutMs !== undefined) {
          await tx.execute(sql`select set_config('statement_timeout', ${String(options.statementTimeoutMs)}, true)`);
        }
        const result = await tx.execute(sql`
          delete from search_events
          where id in (select id from search_events where occurred_at < ${cutoff.toISOString()}::timestamptz order by occurred_at limit ${batch})`);
        return result.rowCount ?? 0;
      });
      deleted += removed;
      // a bounded backstop run takes one batch; the command runs until nothing expired is left
      if (removed < batch || options.maxRows !== undefined) break;
    }
  }

  const oldest = await db.execute<{ oldest: string | null }>(sql`select min(occurred_at)::text as oldest from search_events`);
  const oldestValue = oldest.rows[0]?.oldest;
  return {
    deleted,
    oldestRemainingDays: oldestValue ? Math.floor((now.getTime() - new Date(oldestValue).getTime()) / 86_400_000) : null,
  };
}
