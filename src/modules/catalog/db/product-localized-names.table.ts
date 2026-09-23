import { sql } from 'drizzle-orm';
import { check, primaryKey, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { products } from './products.table';

export const productLocalizedNames = pgTable('product_localized_names', {
  productId: uuid('product_id').notNull().references(() => products.id),
  locale: text('locale').notNull(),
  name: text('name').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
}, (table) => [
  primaryKey({ name: 'product_localized_names_product_locale_pk', columns: [table.productId, table.locale] }),
  uniqueIndex('product_localized_names_locale_name_normalized_unique').on(
    table.locale,
    sql`normalize(casefold(normalize(btrim(${table.name}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast`,
  ),
  check('product_localized_names_locale_supported', sql`${table.locale} IN ('ru', 'kk')`),
  check('product_localized_names_name_not_empty', sql`length(btrim(${table.name})) > 0`),
]);
