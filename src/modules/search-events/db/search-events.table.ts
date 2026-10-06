import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from '../../catalog/db/products.table';

// S15C / D0 (docs/slices/s15c-d0-search-demand-events): one row per intentional buyer search — search events, not people.
// Deliberately NO user id, session/device key, IP, user agent, locale, raw spelling or geolocation. `occurred_at` is
// truncated to the hour. `query_normalized` is free text and may still hold personal data despite the length/digit filters,
// so the table is internal only and its rows are purged after the retention period (operator-run command).
export const searchEvents = pgTable('search_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  entry: text('entry').notNull(),
  queryNormalized: text('query_normalized').notNull(),
  // The Product the Search response reported (not a proven preference, not necessarily the S15B-4b level-1 Product).
  resolvedProductId: uuid('resolved_product_id').references(() => products.id, { onDelete: 'set null' }),
  resolution: text('resolution').notNull(),
  // The number of Offers in the returned response (not «all matches»).
  resultCount: integer('result_count').notNull(),
  // organic = real production demand; dev / test / synthetic must never be read as demand.
  origin: text('origin').notNull(),
}, (table) => [
  index('search_events_origin_occurred_at_idx').on(table.origin, table.occurredAt),
  check('search_events_entry_check', sql`${table.entry} IN ('submit','suggestion','chip')`),
  check('search_events_resolution_check', sql`${table.resolution} IN ('selected','resolved','ambiguous','unresolved')`),
  check('search_events_origin_check', sql`${table.origin} IN ('organic','dev','test','synthetic')`),
  check('search_events_query_check', sql`length(${table.queryNormalized}) BETWEEN 1 AND 100`),
  check('search_events_result_count_check', sql`${table.resultCount} >= 0`),
]);
