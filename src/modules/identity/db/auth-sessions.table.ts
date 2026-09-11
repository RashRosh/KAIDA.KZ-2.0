import { sql } from 'drizzle-orm';
import { char, check, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.table';

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenDigest: char('token_digest', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  check('auth_sessions_digest_format', sql`${table.tokenDigest} ~ '^[0-9a-f]{64}$'`),
  check('auth_sessions_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
]);
