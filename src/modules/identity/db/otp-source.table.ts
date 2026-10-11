import { sql } from 'drizzle-orm';
import { char, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const otpSourceEvents = pgTable('auth_otp_source_events', {
  id: uuid('id').primaryKey(),
  sourceDigest: char('source_digest', { length: 64 }).notNull(),
  keyGeneration: char('key_generation', { length: 64 }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
}, t => [index('otp_source_digest_time').on(t.sourceDigest, t.acceptedAt), index('otp_source_cleanup_time').on(t.acceptedAt),
  check('otp_source_digest_format', sql`${t.sourceDigest} ~ '^[0-9a-f]{64}$'`),
  check('otp_source_generation_format', sql`${t.keyGeneration} ~ '^[0-9a-f]{64}$'`)]);

export const otpSourceMaintenance = pgTable('auth_otp_source_maintenance', {
  id: text('id').primaryKey(),
  keyGeneration: char('key_generation', { length: 64 }).notNull(),
  lastCleanupAt: timestamp('last_cleanup_at', { withTimezone: true }),
  quarantineUntil: timestamp('quarantine_until', { withTimezone: true }),
  retentionIncidentAt: timestamp('retention_incident_at', { withTimezone: true }),
}, t => [check('otp_source_single_maintenance', sql`${t.id} = 'singleton'`),
  check('otp_source_maintenance_generation_format', sql`${t.keyGeneration} ~ '^[0-9a-f]{64}$'`)]);
