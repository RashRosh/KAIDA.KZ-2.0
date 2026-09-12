import { sql } from 'drizzle-orm';
import { char, check, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from '../../catalog/db/products.table';
import { sellers } from '../../sellers/db/sellers.table';
import { locations } from '../../locations/db/locations.table';

export type OfferStatus = 'active' | 'inactive';

export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  locationId: uuid('location_id').notNull().references(() => locations.id),
  priceAmount: numeric('price_amount'),
  priceCurrency: char('price_currency', { length: 3 }),
  priceUnit: text('price_unit'),
  sellerComment: text('seller_comment'),
  status: text('status').$type<OfferStatus>().notNull(),
  lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }).notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('offers_price_non_negative_finite', sql`${table.priceAmount} IS NULL OR (
    ${table.priceAmount} >= 0 AND ${table.priceAmount} NOT IN ('NaN'::numeric, 'Infinity'::numeric)
  )`),
  check('offers_price_requires_currency', sql`${table.priceAmount} IS NULL OR (
    ${table.priceCurrency} IS NOT NULL AND ${table.priceCurrency} ~ '^[A-Z]{3}$'
  )`),
  check('offers_status_allowed', sql`${table.status} IN ('active', 'inactive')`),
]);
