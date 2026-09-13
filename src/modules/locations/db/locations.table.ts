import { sql } from 'drizzle-orm';
import { check, doublePrecision, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sellers } from '../../sellers/db/sellers.table';

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  name: text('name').notNull(),
  addressText: text('address_text').notNull(),
  type: text('type').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
}, (table) => [
  index('locations_seller_id_idx').on(table.sellerId),
  check('locations_name_not_blank', sql`char_length(btrim(${table.name})) >= 1`),
  check('locations_name_max_length', sql`char_length(btrim(${table.name})) <= 120`),
  check('locations_address_text_not_blank', sql`char_length(btrim(${table.addressText})) >= 1`),
  check('locations_address_text_max_length', sql`char_length(btrim(${table.addressText})) <= 500`),
  check('locations_type_allowed', sql`${table.type} IN ('market', 'shop', 'pavilion', 'home', 'other')`),
  check('locations_geo_complete_pair', sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)`),
  check('locations_latitude_range', sql`${table.latitude} IS NULL OR ${table.latitude} BETWEEN -90 AND 90`),
  check('locations_longitude_range', sql`${table.longitude} IS NULL OR ${table.longitude} BETWEEN -180 AND 180`),
]);
