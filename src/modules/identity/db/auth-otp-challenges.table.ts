import { sql } from 'drizzle-orm';
import { char, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const authOtpChallenges = pgTable('auth_otp_challenges', {
  id: uuid('id').primaryKey(),
  phoneE164: text('phone_e164').notNull(),
  otpDigest: char('otp_digest', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  failedAttempts: integer('failed_attempts').notNull().default(0),
}, (table) => [
  check('auth_otp_challenges_phone_e164_format', sql`${table.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`),
  check('auth_otp_challenges_digest_format', sql`${table.otpDigest} ~ '^[0-9a-f]{64}$'`),
  check('auth_otp_challenges_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
  check('auth_otp_challenges_single_terminal_state', sql`NOT (${table.consumedAt} IS NOT NULL AND ${table.supersededAt} IS NOT NULL)`),
  check('auth_otp_challenges_failed_attempts_nonnegative', sql`${table.failedAttempts} >= 0`),
  index('auth_otp_challenges_phone_created_at').on(table.phoneE164, table.createdAt),
  uniqueIndex('auth_otp_challenges_one_unfinished_per_phone')
    .on(table.phoneE164)
    .where(sql`${table.consumedAt} IS NULL AND ${table.supersededAt} IS NULL`),
]);
