import { sql } from 'drizzle-orm';
import { check, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
}, (table) => [
  check('products_name_not_empty', sql`length(btrim(${table.name})) > 0`),
]);
