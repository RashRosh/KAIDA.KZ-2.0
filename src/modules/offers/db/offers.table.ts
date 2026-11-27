import { sql } from 'drizzle-orm';
import { boolean, char, check, index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from '../../catalog/db/products.table';
import { sellers } from '../../sellers/db/sellers.table';
import { locations } from '../../locations/db/locations.table';
import type { PriceUnitCode } from '../price-unit/price-unit';
import type { PackUnit } from '../pack/pack';
import type { WholesaleContainer } from '../wholesale/wholesale';

export type OfferStatus = 'active' | 'inactive';

export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Optional catalog link (seller-showcase-editor): search by catalog names and aliases; never changes the title.
  productId: uuid('product_id').references(() => products.id),
  // The Seller's own product name and its normalized words for search.
  title: text('title').notNull(),
  titleSearch: text('title_search').notNull(),
  // Offers of one product in several points share card_id and title, unit, pack, comment and photos.
  cardId: uuid('card_id').notNull(),
  // true = this point keeps its own price; a common price change skips it unless the Seller chose it.
  priceOwn: boolean('price_own').notNull().default(false),
  packAmount: numeric('pack_amount'),
  packUnit: text('pack_unit').$type<PackUnit>(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  locationId: uuid('location_id').notNull().references(() => locations.id),
  priceAmount: numeric('price_amount'),
  priceCurrency: char('price_currency', { length: 3 }),
  priceUnitCode: text('price_unit_code').$type<PriceUnitCode>(),
  priceUnitValue: text('price_unit_value'),
  // wholesale-price: the optional wholesale line, shared by the card like the unit and the pack (all null = none).
  wholesalePriceAmount: numeric('wholesale_price_amount'),
  wholesaleBatchCount: integer('wholesale_batch_count'),
  wholesaleContainer: text('wholesale_container').$type<WholesaleContainer>(),
  wholesaleContainerText: text('wholesale_container_text'),
  wholesalePerContainer: numeric('wholesale_per_container'),
  sellerComment: text('seller_comment'),
  sellerCommentVersion: integer('seller_comment_version').notNull().default(1),
  status: text('status').$type<OfferStatus>().notNull(),
  lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }).notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('offers_card_id_idx').on(table.cardId),
  check('offers_title_valid', sql`char_length(btrim(${table.title})) BETWEEN 1 AND 80 AND ${table.title} = btrim(${table.title})`),
  check('offers_pack_valid', sql`(${table.packAmount} IS NULL AND ${table.packUnit} IS NULL)
  OR (${table.packAmount} > 0 AND ${table.packUnit} IN ('g', 'kg', 'ml', 'l') AND ${table.priceUnitCode} IN ('package', 'piece'))`),
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
  check('offers_wholesale_valid', sql`(
    ${table.wholesalePriceAmount} IS NULL AND ${table.wholesaleBatchCount} IS NULL AND ${table.wholesaleContainer} IS NULL
    AND ${table.wholesaleContainerText} IS NULL AND ${table.wholesalePerContainer} IS NULL
  ) OR (
    ${table.wholesalePriceAmount} IS NOT NULL AND ${table.wholesaleBatchCount} IS NOT NULL AND ${table.wholesaleContainer} IS NOT NULL
    AND ${table.wholesalePriceAmount} > 0 AND ${table.wholesalePriceAmount} NOT IN ('NaN'::numeric, 'Infinity'::numeric)
    AND ${table.wholesaleBatchCount} BETWEEN 1 AND 9999
    AND ${table.wholesaleContainer} IN ('box', 'bag', 'carton', 'net', 'package', 'unit', 'other')
    AND (${table.wholesaleContainer} = 'other') = (${table.wholesaleContainerText} IS NOT NULL)
    AND (${table.wholesaleContainerText} IS NULL OR (${table.wholesaleContainerText} = btrim(${table.wholesaleContainerText}) AND char_length(${table.wholesaleContainerText}) BETWEEN 1 AND 20))
    AND (${table.wholesaleContainer} = 'unit') = (${table.wholesalePerContainer} IS NULL)
    AND (${table.wholesalePerContainer} IS NULL OR ${table.wholesalePerContainer} > 0)
    AND ${table.priceUnitCode} IS NOT NULL
  )`),
]);
