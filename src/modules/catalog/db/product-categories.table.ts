import { sql } from 'drizzle-orm';
import { check, pgTable, text } from 'drizzle-orm/pg-core';

export const productCategories = pgTable('product_categories', {
  code: text('code').primaryKey(),
  labelRu: text('label_ru').notNull(),
  labelKk: text('label_kk').notNull(),
}, (table) => [
  check('product_categories_code_format', sql`${table.code} ~ '^[A-Z0-9_]+$'`),
  check('product_categories_label_ru_not_empty', sql`length(btrim(${table.labelRu})) > 0`),
  check('product_categories_label_kk_not_empty', sql`length(btrim(${table.labelKk})) > 0`),
]);
