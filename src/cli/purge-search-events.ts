import 'dotenv/config';
import { createDatabase } from '../db/client';
import { purgeSearchEvents } from '../modules/search-events/application/purge-search-events';
import { readSearchEventsConfig } from '../modules/search-events/config';

// Operator command (docs/slices/s15c-d0-search-demand-events §3.10): delete search events older than SEARCH_EVENTS_RETENTION_DAYS
// (default 90). Run it daily from an external scheduler; `--dry-run` only reports. Prints counts and ages, never query text.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const dryRun = process.argv.includes('--dry-run');
  const { retentionDays } = readSearchEventsConfig();
  const { db, pool } = createDatabase(url);
  try {
    const result = await purgeSearchEvents(db, { retentionDays, dryRun });
    console.log(`Search events ${dryRun ? 'that would be removed' : 'removed'} (older than ${retentionDays} days): ${result.deleted}. Oldest remaining: ${result.oldestRemainingDays === null ? 'none' : `${result.oldestRemainingDays} days`}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Search events purge failed');
  process.exitCode = 1;
});
