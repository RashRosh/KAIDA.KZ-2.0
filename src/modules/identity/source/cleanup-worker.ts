import { setTimeout as sleep } from 'node:timers/promises';
import type { Database } from '../../../db/client';
import { cleanupSources } from './source.repository';
import { SOURCE_CLEANUP_INTERVAL_MS, type SourceProtection } from './source-protection';

export async function runSourceCleanupWorker(db: Database, config: SourceProtection,
  options: { signal?: AbortSignal; intervalMs?: number; clock?: () => Date; onSweep?: (result: Awaited<ReturnType<typeof cleanupSources>>) => void } = {}) {
  while (!options.signal?.aborted) {
    const result = await cleanupSources(db, config, options.clock?.() ?? new Date());
    options.onSweep?.(result);
    try { await sleep(options.intervalMs ?? SOURCE_CLEANUP_INTERVAL_MS, undefined, { signal: options.signal }); }
    catch (error) { if (options.signal?.aborted) return; throw error; }
  }
}
