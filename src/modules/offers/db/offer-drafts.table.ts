import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sellers } from '../../sellers/db/sellers.table';
import type { OfferDraftPayload } from '../drafts/offer-draft.contract';

// seller-showcase-editor: an unsent new card, private to its Seller; any field may be empty.
export const offerDrafts = pgTable('offer_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  payload: jsonb('payload').$type<OfferDraftPayload>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('offer_drafts_seller_id_idx').on(table.sellerId),
]);
