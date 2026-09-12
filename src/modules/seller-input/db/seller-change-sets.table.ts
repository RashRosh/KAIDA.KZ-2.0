import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sellers } from '../../sellers/db/sellers.table';

export type SellerChangeSetStatus = 'proposed' | 'confirmed';

export const sellerChangeSets = pgTable('seller_change_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  status: text('status').$type<SellerChangeSetStatus>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
}, (table) => [
  check('seller_change_sets_status_allowed', sql`${table.status} IN ('proposed', 'confirmed')`),
  check('seller_change_sets_confirmation_consistent', sql`(
    ${table.status} = 'proposed' AND ${table.confirmedAt} IS NULL
  ) OR (
    ${table.status} = 'confirmed' AND ${table.confirmedAt} IS NOT NULL
  )`),
]);
