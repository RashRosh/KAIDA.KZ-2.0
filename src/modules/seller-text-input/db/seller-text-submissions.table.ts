import { sql } from 'drizzle-orm';
import { char, check, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sellers } from '../../sellers/db/sellers.table';
import type { SkippedTextLine, UncertainDraftNotice, UnavailableStatement } from '../contracts/seller-text-input.contract';

export type SellerTextSubmissionStatus = 'processing' | 'succeeded' | 'failed';

// What a replay needs: the drafts this submission created (in order) and what the Seller was told about the text.
export type SellerTextSubmissionResult = {
  draftIds: string[];
  skipped: SkippedTextLine[];
  uncertain: UncertainDraftNotice[];
  notices: string[];
  // Connected journey (contract §16): the trading point the drafts were prepared for, and drafts of this submission
  // that were later published (recorded by the confirm step) — so a missing draft is told apart as published or deleted.
  locationId?: string | null;
  publishedDraftIds?: string[];
  // text-availability §4.1 items 3 and 5: the «нет в наличии» statements (candidates are recomputed from current data on
  // every read) and the switch-off proposals created from this review (bookkeeping only).
  unavailable?: UnavailableStatement[];
  availabilityChangeSetIds?: string[];
};

// seller-ai-text-real-parser §6.4: durable retry protection for 24 hours. Holds a salted digest of the text, never the
// text itself; rows are deleted after `expires_at`.
export const sellerTextSubmissions = pgTable('seller_text_submissions', {
  sellerId: uuid('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  textDigest: char('text_digest', { length: 64 }).notNull(),
  parser: text('parser').$type<'fake' | 'real'>().notNull(),
  status: text('status').$type<SellerTextSubmissionStatus>().notNull(),
  attemptId: uuid('attempt_id').notNull(),
  attemptStartedAt: timestamp('attempt_started_at', { withTimezone: true }).notNull(),
  failureCode: text('failure_code'),
  result: jsonb('result').$type<SellerTextSubmissionResult>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ name: 'seller_text_submissions_pkey', columns: [t.sellerId, t.requestId] }),
  index('seller_text_submissions_expiry').on(t.expiresAt),
  check('seller_text_submissions_status_allowed', sql`${t.status} IN ('processing', 'succeeded', 'failed')`),
  check('seller_text_submissions_parser_allowed', sql`${t.parser} IN ('fake', 'real')`),
  check('seller_text_submissions_digest_format', sql`${t.textDigest} ~ '^[0-9a-f]{64}$'`),
  check('seller_text_submissions_outcome_consistent', sql`(
    ${t.status} = 'succeeded' AND ${t.result} IS NOT NULL AND ${t.completedAt} IS NOT NULL AND ${t.failureCode} IS NULL
  ) OR (
    ${t.status} = 'failed' AND ${t.result} IS NULL AND ${t.failureCode} IS NOT NULL
  ) OR (
    ${t.status} = 'processing' AND ${t.result} IS NULL AND ${t.failureCode} IS NULL
  )`),
  check('seller_text_submissions_expiry_after_creation', sql`${t.expiresAt} > ${t.createdAt}`),
]);
