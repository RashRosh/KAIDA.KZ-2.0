import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  phoneE164: text('phone_e164').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (table) => [
  check('users_phone_e164_format', sql`${table.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`),
]);
