import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';

// actuality-reminders: one browser push subscription per device, tied to the login that enabled it.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('push_subscriptions_user_id_idx').on(table.userId),
]);
