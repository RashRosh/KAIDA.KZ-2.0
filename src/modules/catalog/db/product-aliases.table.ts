import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { products } from './products.table';

export const productAliases = pgTable('product_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  locale: text('locale'),
}, (table) => [
  uniqueIndex('product_aliases_name_product_normalized_unique').on(
    sql`normalize(casefold(normalize(btrim(${table.name}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast`,
    table.productId,
  ),
  check('product_aliases_name_not_empty', sql`length(btrim(${table.name})) > 0`),
  check('product_aliases_locale_supported', sql`${table.locale} IS NULL OR ${table.locale} IN ('ru', 'kk')`),
]);
