import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { offers } from '../../offers/db/offers.table';
import { sellers } from '../../sellers/db/sellers.table';

// actuality-reminders: a reminder moment (hours) already sent for one point in one confirmation cycle — the
// cycle is the confirmation time it was sent for, so a new confirmation starts a new cycle.
export const actualityRemindersSent = pgTable('actuality_reminders_sent', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  momentHours: integer('moment_hours').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('actuality_reminders_sent_cycle_uq').on(table.offerId, table.momentHours, table.confirmedAt),
  check('actuality_reminders_sent_moment_positive', sql`${table.momentHours} > 0`),
]);
