import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { products } from './products.table';

export const productAliases = pgTable('product_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  locale: text('locale'),
  kbAliasId: text('kb_alias_id'),
}, (table) => [
  uniqueIndex('product_aliases_name_product_normalized_unique').on(
    sql`normalize(casefold(normalize(btrim(${table.name}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast`,
    table.productId,
  ),
  uniqueIndex('product_aliases_kb_alias_id_unique').on(table.kbAliasId).where(sql`${table.kbAliasId} IS NOT NULL`),
  check('product_aliases_name_not_empty', sql`length(btrim(${table.name})) > 0`),
  check('product_aliases_locale_supported', sql`${table.locale} IS NULL OR ${table.locale} IN ('ru', 'kk')`),
  check('product_aliases_kb_alias_id_format', sql`${table.kbAliasId} IS NULL OR ${table.kbAliasId} ~ '^A-[0-9]{5}$'`),
]);
