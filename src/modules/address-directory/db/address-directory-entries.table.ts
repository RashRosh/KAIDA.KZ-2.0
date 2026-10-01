import { sql } from 'drizzle-orm';
import { check, doublePrecision, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { addressDirectoryImports } from './address-directory-imports.table';

export const addressDirectoryEntries = pgTable('address_directory_entries', {
  importId: uuid('import_id').notNull().references(() => addressDirectoryImports.id, { onDelete: 'cascade' }),
  sourceKey: text('source_key').notNull(),
  kind: text('kind').notNull(),
  displayName: text('display_name').notNull(),
  addressText: text('address_text').notNull(),
  searchText: text('search_text').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
}, (table) => [
  primaryKey({ columns: [table.importId, table.sourceKey], name: 'address_directory_entries_pk' }),
  index('address_directory_entries_import_id_idx').on(table.importId),
  index('address_directory_entries_kind_idx').on(table.kind),
  check('address_directory_entries_kind_allowed', sql`${table.kind} IN ('address', 'street', 'marketplace', 'retail')`),
  check('address_directory_entries_display_not_blank', sql`char_length(btrim(${table.displayName})) >= 1`),
  check('address_directory_entries_address_not_blank', sql`char_length(btrim(${table.addressText})) >= 1`),
  check('address_directory_entries_search_not_blank', sql`char_length(btrim(${table.searchText})) >= 1`),
  check('address_directory_entries_latitude_range', sql`${table.latitude} BETWEEN -90 AND 90`),
  check('address_directory_entries_longitude_range', sql`${table.longitude} BETWEEN -180 AND 180`),
]);
