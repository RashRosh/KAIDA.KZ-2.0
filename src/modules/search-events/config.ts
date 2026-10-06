// S15C / D0: search-event configuration (docs/slices/s15c-d0-search-demand-events §3.5–§3.10).
export type SearchEventsOrigin = 'organic' | 'dev' | 'test' | 'synthetic';

export type SearchEventsConfig = {
  // Where the data comes from. `dev` unless the environment says otherwise; `organic` ONLY by explicit production
  // configuration, after the daily purge is scheduled and verified; `synthetic` is never configurable (test helper only).
  origin: Exclude<SearchEventsOrigin, 'synthetic'>;
  retentionDays: number;
  // An additional bound on how long Search waits for the write — not a guarantee about the whole request time.
  writeBudgetMs: number;
  // Unfinished writes allowed at once; the slot is held until the underlying operation settles.
  maxPendingWrites: number;
};

function positiveInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function readSearchEventsConfig(env: Record<string, string | undefined> = process.env): SearchEventsConfig {
  const origin = env.SEARCH_EVENTS_ORIGIN === 'organic' || env.SEARCH_EVENTS_ORIGIN === 'test' ? env.SEARCH_EVENTS_ORIGIN : 'dev';
  return {
    origin,
    retentionDays: positiveInteger(env.SEARCH_EVENTS_RETENTION_DAYS, 90, 1, 3650),
    writeBudgetMs: positiveInteger(env.SEARCH_EVENTS_WRITE_BUDGET_MS, 250, 20, 5000),
    maxPendingWrites: positiveInteger(env.SEARCH_EVENTS_MAX_PENDING_WRITES, 3, 1, 50),
  };
}
