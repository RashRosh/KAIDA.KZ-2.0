import { sql } from 'drizzle-orm';
import { boolean, check, doublePrecision, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sellers } from '../../sellers/db/sellers.table';
import { templateOpeningHours, type OpeningHours } from '../hours/opening-hours';

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  name: text('name').notNull(),
  addressText: text('address_text').notNull(),
  type: text('type').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  // Point contacts: public only while the number is verified for the Seller (seller_verified_phones or login phone).
  phoneE164: text('phone_e164'),
  whatsappPhoneE164: text('whatsapp_phone_e164'),
  openingHours: jsonb('opening_hours').$type<OpeningHours>().notNull().default(templateOpeningHours()),
  // True while the hours are the template nobody has saved yet (migration or a point created without hours).
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  openingHoursNeedsReview: boolean('opening_hours_needs_review').notNull().default(true),
}, (table) => [
  index('locations_seller_id_idx').on(table.sellerId),
  check('locations_name_not_blank', sql`char_length(btrim(${table.name})) >= 1`),
  check('locations_name_max_length', sql`char_length(btrim(${table.name})) <= 120`),
  check('locations_address_text_not_blank', sql`char_length(btrim(${table.addressText})) >= 1`),
  check('locations_address_text_max_length', sql`char_length(btrim(${table.addressText})) <= 500`),
  check('locations_type_allowed', sql`${table.type} IN ('market', 'shop', 'pavilion', 'home', 'other')`),
  check('locations_geo_complete_pair', sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)`),
  check('locations_latitude_range', sql`${table.latitude} IS NULL OR ${table.latitude} BETWEEN -90 AND 90`),
  check('locations_phone_e164_format', sql`${table.phoneE164} IS NULL OR ${table.phoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`),
  check('locations_whatsapp_phone_e164_format', sql`${table.whatsappPhoneE164} IS NULL OR ${table.whatsappPhoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`),
  check('locations_opening_hours_object', sql`jsonb_typeof(${table.openingHours}) = 'object'`),
  check('locations_longitude_range', sql`${table.longitude} IS NULL OR ${table.longitude} BETWEEN -180 AND 180`),
]);
