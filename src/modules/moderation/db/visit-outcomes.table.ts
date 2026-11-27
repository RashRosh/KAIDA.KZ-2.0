import { boolean, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { sellers } from '../../sellers/db/sellers.table';
import { offerReports } from './offer-reports.table';
import type { ProblemReason, VisitOutcomeKind } from '../contracts/visit-outcome.contract';

export const visitOutcomes = pgTable('visit_outcomes', {
  id: uuid('id').defaultRandom().primaryKey(),
  offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull(),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  cardVersion: text('card_version').notNull(),
  outcome: text('outcome').$type<VisitOutcomeKind>().notNull(),
  reason: text('reason').$type<ProblemReason | null>(),
  reporterUserId: uuid('reporter_user_id').references(() => users.id),
  visitorKeyHash: text('visitor_key_hash').notNull(),
  isVerified: boolean('is_verified').notNull(),
  hasVisitSignal: boolean('has_visit_signal').notNull().default(false),
  reportId: uuid('report_id').references(() => offerReports.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('visit_outcomes_visitor_key_hash_card_id_card_version_key').on(t.visitorKeyHash, t.cardId, t.cardVersion),
  index('visit_outcomes_seller_location_time').on(t.sellerId, t.locationId, t.createdAt),
  index('visit_outcomes_visitor_time').on(t.visitorKeyHash, t.outcome, t.createdAt),
]);

export const visitOutcomeReceipts = pgTable('visit_outcome_receipts', {
  visitorKeyHash: text('visitor_key_hash').notNull(),
  submissionId: uuid('submission_id').notNull(),
  outcomeId: uuid('outcome_id').notNull().references(() => visitOutcomes.id, { onDelete: 'cascade' }),
  inputDigest: text('input_digest').notNull(),
}, (t) => [
  primaryKey({ columns: [t.visitorKeyHash, t.submissionId] }),
]);
