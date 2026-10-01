import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export type AddressDirectoryImportCounts = {
  addresses: number;
  streets: number;
  marketplaces: number;
  retail: number;
  total: number;
};

export const addressDirectoryImports = pgTable('address_directory_imports', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceUrl: text('source_url').notNull(),
  sourceTimestamp: timestamp('source_timestamp', { withTimezone: true }).notNull(),
  sourceChecksum: text('source_checksum').notNull(),
  importerVersion: text('importer_version').notNull(),
  status: text('status').notNull(),
  entryCount: integer('entry_count').notNull().default(0),
  counts: jsonb('counts').$type<AddressDirectoryImportCounts>().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  failureMessage: text('failure_message'),
}, (table) => [
  uniqueIndex('address_directory_imports_checksum_uq').on(table.sourceChecksum),
  uniqueIndex('address_directory_imports_one_active_uq').on(table.status).where(sql`${table.status} = 'active'`),
  index('address_directory_imports_status_idx').on(table.status),
  check('address_directory_imports_status_allowed', sql`${table.status} IN ('loading', 'active', 'superseded', 'failed')`),
  check('address_directory_imports_checksum_format', sql`${table.sourceChecksum} ~ '^[0-9a-f]{64}$'`),
  check('address_directory_imports_entry_count_nonnegative', sql`${table.entryCount} >= 0`),
]);
