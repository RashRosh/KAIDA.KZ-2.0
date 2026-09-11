import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sellers } from '../../sellers/db/sellers.table';

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  name: text('name').notNull(),
  addressText: text('address_text').notNull(),
  type: text('type').notNull(),
}, (table) => [
  index('locations_seller_id_idx').on(table.sellerId),
  check('locations_name_not_blank', sql`char_length(btrim(${table.name})) >= 1`),
  check('locations_name_max_length', sql`char_length(btrim(${table.name})) <= 120`),
  check('locations_address_text_not_blank', sql`char_length(btrim(${table.addressText})) >= 1`),
  check('locations_address_text_max_length', sql`char_length(btrim(${table.addressText})) <= 500`),
  check('locations_type_allowed', sql`${table.type} IN ('market', 'shop', 'pavilion', 'home', 'other')`),
]);
