import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  kbProductId: text('kb_product_id'),
}, (table) => [
  uniqueIndex('products_name_normalized_unique').on(
    sql`normalize(casefold(normalize(btrim(${table.name}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast`,
  ),
  uniqueIndex('products_kb_product_id_unique').on(table.kbProductId).where(sql`${table.kbProductId} IS NOT NULL`),
  check('products_name_not_empty', sql`length(btrim(${table.name})) > 0`),
  check('products_kb_product_id_format', sql`${table.kbProductId} IS NULL OR ${table.kbProductId} ~ '^KAIDA-P[0-9]{4}$'`),
]);
