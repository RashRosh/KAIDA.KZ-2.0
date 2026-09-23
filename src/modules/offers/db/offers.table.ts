import { sql } from 'drizzle-orm';
import { char, check, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from '../../catalog/db/products.table';
import { sellers } from '../../sellers/db/sellers.table';
import { locations } from '../../locations/db/locations.table';
import type { PriceUnitCode } from '../price-unit/price-unit';

export type OfferStatus = 'active' | 'inactive';

export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  locationId: uuid('location_id').notNull().references(() => locations.id),
  priceAmount: numeric('price_amount'),
  priceCurrency: char('price_currency', { length: 3 }),
  priceUnitCode: text('price_unit_code').$type<PriceUnitCode>(),
  priceUnitValue: text('price_unit_value'),
  sellerComment: text('seller_comment'),
  sellerCommentVersion: integer('seller_comment_version').notNull().default(1),
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
  check('offers_price_unit_valid', sql`(${table.priceUnitCode} IS NULL AND ${table.priceUnitValue} IS NULL)
  OR (${table.priceUnitCode} IN ('kg', 'piece', 'liter', 'package') AND ${table.priceUnitValue} IS NULL)
  OR (${table.priceUnitCode} = 'other' AND ${table.priceUnitValue} IS NOT NULL AND ${table.priceUnitValue} = btrim(${table.priceUnitValue}) AND char_length(${table.priceUnitValue}) >= 1)`),
  check('offers_seller_comment_version_positive', sql`${table.sellerCommentVersion} >= 1`),
  check('offers_active_price_required', sql`${table.status} <> 'active' OR (
    ${table.priceAmount} IS NOT NULL AND ${table.priceCurrency} = 'KZT'
  )`),
  check('offers_future_price_required', sql`${table.priceAmount} IS NOT NULL AND ${table.priceCurrency} = 'KZT'`),
]);
