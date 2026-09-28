import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';
import { sellers } from '../../sellers/db/sellers.table';
import { sellerChangeSets } from '../../seller-input/db/seller-change-sets.table';
import type { RemovalReason } from '../contracts/moderation.contract';

// operator-post-check: an operator removed a whole card (every point) from the showcase. The row is also the service
// log: a return by the operator sets restored_*, a later republish by the Seller sets cleared_*. At most one row per
// card is active (neither restored nor cleared).
export const offerCardRemovals = pgTable('offer_card_removals', {
  id: uuid('id').defaultRandom().primaryKey(),
  cardId: uuid('card_id').notNull(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  reason: text('reason').$type<RemovalReason>().notNull(),
  comment: text('comment'),
  removedByUserId: uuid('removed_by_user_id').notNull().references(() => users.id),
  removedAt: timestamp('removed_at', { withTimezone: true }).notNull().defaultNow(),
  restoredAt: timestamp('restored_at', { withTimezone: true }),
  restoredByUserId: uuid('restored_by_user_id').references(() => users.id),
  clearedAt: timestamp('cleared_at', { withTimezone: true }),
  clearedByChangeSetId: uuid('cleared_by_change_set_id').references(() => sellerChangeSets.id),
}, (table) => [
  uniqueIndex('offer_card_removals_active_card_uq').on(table.cardId).where(sql`${table.restoredAt} IS NULL AND ${table.clearedAt} IS NULL`),
  index('offer_card_removals_seller_id_idx').on(table.sellerId),
  check('offer_card_removals_reason_allowed', sql`${table.reason} IN ('prohibited_item', 'photo_mismatch', 'contacts_or_ads', 'other')`),
  check('offer_card_removals_comment_valid', sql`${table.comment} IS NULL OR (
    char_length(${table.comment}) BETWEEN 1 AND 300 AND ${table.comment} = btrim(${table.comment})
  )`),
  check('offer_card_removals_restore_consistent', sql`(${table.restoredAt} IS NULL) = (${table.restoredByUserId} IS NULL)`),
  check('offer_card_removals_clear_consistent', sql`(${table.clearedAt} IS NULL) = (${table.clearedByChangeSetId} IS NULL)`),
  check('offer_card_removals_single_end', sql`${table.restoredAt} IS NULL OR ${table.clearedAt} IS NULL`),
]);
