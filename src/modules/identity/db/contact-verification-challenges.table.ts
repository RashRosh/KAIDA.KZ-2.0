import { sql } from 'drizzle-orm';
import { char, check, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.table';

// OTP with the purpose «contact verification»: same code rules as login, separate from login challenges so proving
// a point number never interferes with signing in.
export const contactVerificationChallenges = pgTable('contact_verification_challenges', {
  id: uuid('id').primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  phoneE164: text('phone_e164').notNull(),
  otpDigest: char('otp_digest', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
}, (table) => [
  check('contact_verification_challenges_phone_e164_format', sql`${table.phoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`),
  check('contact_verification_challenges_digest_format', sql`${table.otpDigest} ~ '^[0-9a-f]{64}$'`),
  check('contact_verification_challenges_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
  check('contact_verification_challenges_single_terminal_state', sql`NOT (${table.consumedAt} IS NOT NULL AND ${table.supersededAt} IS NOT NULL)`),
  uniqueIndex('contact_verification_challenges_one_unfinished')
    .on(table.ownerUserId, table.phoneE164)
    .where(sql`${table.consumedAt} IS NULL AND ${table.supersededAt} IS NULL`),
]);
