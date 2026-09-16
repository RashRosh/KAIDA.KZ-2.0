import { sql } from 'drizzle-orm';
import { char, check, index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { products } from '../../catalog/db/products.table';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { sellerChangeSets } from './seller-change-sets.table';

export type SellerChangeAction = 'create_offer' | 'update_offer' | 'deactivate_offer' | 'activate_offer';
export type SellerOfferManagementAction = Exclude<SellerChangeAction, 'create_offer'>;

export const sellerChangeItems = pgTable('seller_change_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  changeSetId: uuid('change_set_id').notNull().references(() => sellerChangeSets.id),
  action: text('action').$type<SellerChangeAction>().notNull(),
  productId: uuid('product_id').notNull().references(() => products.id),
  locationId: uuid('location_id').notNull().references(() => locations.id),
  priceAmount: numeric('price_amount'),
  priceCurrency: char('price_currency', { length: 3 }),
  priceUnit: text('price_unit'),
  sellerComment: text('seller_comment'),
  targetOfferId: uuid('target_offer_id').references(() => offers.id),
  expectedOfferRevision: integer('expected_offer_revision'),
  resultOfferId: uuid('result_offer_id').references(() => offers.id),
}, (table) => [
  index('seller_change_items_change_set_id_idx').on(table.changeSetId),
  check('seller_change_items_action_allowed', sql`${table.action} IN ('create_offer', 'update_offer', 'deactivate_offer', 'activate_offer')`),
  check('seller_change_items_price_valid', sql`${table.priceAmount} IS NULL OR (
    ${table.priceAmount} >= 0
    AND ${table.priceAmount} NOT IN ('NaN'::numeric, 'Infinity'::numeric)
    AND scale(${table.priceAmount}) <= 2
    AND ${table.priceAmount} < 1000000000000
  )`),
  check('seller_change_items_price_shape', sql`(
    ${table.priceAmount} IS NULL
    AND ${table.priceCurrency} IS NULL
    AND ${table.priceUnit} IS NULL
  ) OR (
    ${table.priceAmount} IS NOT NULL
    AND ${table.priceCurrency} = 'KZT'
  )`),
  check('seller_change_items_price_unit_valid', sql`${table.priceUnit} IS NULL OR (
    char_length(btrim(${table.priceUnit})) >= 1
    AND char_length(btrim(${table.priceUnit})) <= 32
  )`),
  check('seller_change_items_seller_comment_valid', sql`${table.sellerComment} IS NULL OR (
    char_length(btrim(${table.sellerComment})) >= 1
    AND char_length(btrim(${table.sellerComment})) <= 500
  )`),
  check('seller_change_items_expected_offer_revision_valid', sql`${table.expectedOfferRevision} IS NULL OR ${table.expectedOfferRevision} >= 1`),
  check('seller_change_items_target_consistent', sql`(
    ${table.action} = 'create_offer'
    AND ${table.targetOfferId} IS NULL
    AND ${table.expectedOfferRevision} IS NULL
  ) OR (
    ${table.action} IN ('update_offer', 'deactivate_offer', 'activate_offer')
    AND ${table.targetOfferId} IS NOT NULL
    AND ${table.expectedOfferRevision} IS NOT NULL
  )`),
  check('seller_change_items_future_price_required', sql`${table.priceAmount} IS NOT NULL AND ${table.priceCurrency} = 'KZT'`),
]);
