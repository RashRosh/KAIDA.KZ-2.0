import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';

// operator-post-check: per operator, feed events confirmed up to this moment count as seen.
export const operatorFeedMarks = pgTable('operator_feed_marks', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  seenUntil: timestamp('seen_until', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
