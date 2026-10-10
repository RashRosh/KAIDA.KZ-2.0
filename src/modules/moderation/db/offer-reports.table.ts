import { index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';
import { offers } from '../../offers/db/offers.table';
import { photos } from '../../media/db/photos.table';
import { offerCardRemovals } from './offer-card-removals.table';
import type { ReportEvidence, ReportReason, ResolveReport } from '../contracts/report.contract';

export const offerReports = pgTable('offer_reports', {
  id:uuid('id').defaultRandom().primaryKey(),reporterUserId:uuid('reporter_user_id').notNull().references(()=>users.id),
  offerId:uuid('offer_id').notNull().references(()=>offers.id),cardId:uuid('card_id').notNull(),cardVersion:text('card_version').notNull(),
  reason:text('reason').$type<ReportReason>().notNull(),buyerText:text('buyer_text').notNull().default(''),
  selectedPhotoId:uuid('selected_photo_id').references(()=>photos.id),evidence:jsonb('evidence').$type<ReportEvidence>().notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),closedAt:timestamp('closed_at',{withTimezone:true}),
  closedByUserId:uuid('closed_by_user_id').references(()=>users.id),disposition:text('disposition').$type<ResolveReport['disposition']>(),
  rationale:text('rationale'),moderationId:uuid('moderation_id').references(()=>offerCardRemovals.id),decisionDigest:text('decision_digest'),
},t=>[uniqueIndex('offer_reports_reporter_user_id_card_id_card_version_key').on(t.reporterUserId,t.cardId,t.cardVersion),
  index('offer_reports_user_time').on(t.reporterUserId,t.createdAt),index('offer_reports_queue').on(t.closedAt,t.createdAt,t.id)]);
export const offerReportPhotos=pgTable('offer_report_photos',{
  reportId:uuid('report_id').notNull().references(()=>offerReports.id,{onDelete:'cascade'}),photoId:uuid('photo_id').notNull().references(()=>photos.id),
},t=>[primaryKey({columns:[t.reportId,t.photoId]})]);
export const offerReportReceipts=pgTable('offer_report_receipts',{
  userId:uuid('user_id').notNull().references(()=>users.id),submissionId:uuid('submission_id').notNull(),
  reportId:uuid('report_id').notNull().references(()=>offerReports.id,{onDelete:'cascade'}),inputDigest:text('input_digest').notNull(),
},t=>[primaryKey({columns:[t.userId,t.submissionId]})]);
