import { sql } from 'drizzle-orm';
import { check, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { offers } from './offers.table';

export type OfferCommentTranslationStatus = 'pending' | 'available' | 'same-language' | 'failed';

export const offerCommentTranslations = pgTable('offer_comment_translations', {
  offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  commentVersion: integer('comment_version').notNull(),
  targetLocale: text('target_locale').notNull(),
  translatedText: text('translated_text'),
  detectedSourceLanguage: text('detected_source_language').notNull().default('unknown'),
  provenance: text('provenance').notNull().default('machine'),
  status: text('status').$type<OfferCommentTranslationStatus>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: 'offer_comment_translations_version_locale_pk', columns: [table.offerId, table.commentVersion, table.targetLocale] }),
  check('offer_comment_translations_version_positive', sql`${table.commentVersion} >= 1`),
  check('offer_comment_translations_target_locale_supported', sql`${table.targetLocale} IN ('ru', 'kk')`),
  check('offer_comment_translations_provenance_machine', sql`${table.provenance} = 'machine'`),
  check('offer_comment_translations_status_allowed', sql`${table.status} IN ('pending', 'available', 'same-language', 'failed')`),
  check('offer_comment_translations_text_consistent', sql`(
    ${table.status} = 'available' AND ${table.translatedText} IS NOT NULL AND length(btrim(${table.translatedText})) > 0
  ) OR (
    ${table.status} <> 'available' AND ${table.translatedText} IS NULL
  )`),
]);
