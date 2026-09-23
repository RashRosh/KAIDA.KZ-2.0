import { and, asc, eq, exists, isNotNull, ne, notExists, or, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { offerCommentTranslations } from '../db/offer-comment-translations.table';
import { offers } from '../db/offers.table';
import {
  translationTargetLocales,
  type PublishedSellerComment,
  type SellerCommentTranslator,
  type TranslationTargetLocale,
} from './seller-comment-translator';

function currentCommentPredicate(comment: PublishedSellerComment) {
  return and(
    eq(offers.id, comment.offerId),
    eq(offers.sellerCommentVersion, comment.commentVersion),
    eq(offers.sellerComment, comment.comment),
  );
}

async function isCurrent(database: Database, comment: PublishedSellerComment) {
  const rows = await database.select({ id: offers.id })
    .from(offers)
    .where(currentCommentPredicate(comment))
    .limit(1);
  return rows.length === 1;
}

async function writeStatus(
  database: Database,
  comment: PublishedSellerComment,
  locale: TranslationTargetLocale,
  values: {
    status: 'available' | 'same-language' | 'failed';
    translatedText: string | null;
    detectedSourceLanguage: string;
  },
) {
  await database.update(offerCommentTranslations).set({
    ...values,
    updatedAt: new Date(),
  }).where(and(
    eq(offerCommentTranslations.offerId, comment.offerId),
    eq(offerCommentTranslations.commentVersion, comment.commentVersion),
    eq(offerCommentTranslations.targetLocale, locale),
    exists(database.select({ value: sql`1` }).from(offers).where(currentCommentPredicate(comment))),
  ));
}

export async function translatePublishedSellerComment(
  database: Database,
  translator: SellerCommentTranslator,
  comment: PublishedSellerComment,
) {
  if (!await isCurrent(database, comment)) return;

  await database.insert(offerCommentTranslations).values(translationTargetLocales.map((targetLocale) => ({
    offerId: comment.offerId,
    commentVersion: comment.commentVersion,
    targetLocale,
    status: 'pending' as const,
  }))).onConflictDoNothing();

  try {
    const result = await translator.translateComment(comment.comment, translationTargetLocales);
    for (const locale of translationTargetLocales) {
      const sameLanguage = result.sameLanguage.includes(locale);
      const translatedText = result.translations[locale]?.trim();
      await writeStatus(database, comment, locale, sameLanguage
        ? { status: 'same-language', translatedText: null, detectedSourceLanguage: result.detectedSourceLanguage }
        : translatedText
          ? { status: 'available', translatedText, detectedSourceLanguage: result.detectedSourceLanguage }
          : { status: 'failed', translatedText: null, detectedSourceLanguage: result.detectedSourceLanguage });
    }
  } catch {
    for (const locale of translationTargetLocales) {
      await writeStatus(database, comment, locale, {
        status: 'failed',
        translatedText: null,
        detectedSourceLanguage: 'unknown',
      });
    }
  }
}

// Comments without a settled translation of their current version: saved before this slice, confirmed while the
// translator was off, or left `pending` by an interrupted process. Failed versions are not retried here.
export async function findUntranslatedSellerComments(database: Database, limit: number): Promise<PublishedSellerComment[]> {
  const rows = await database.select({
    offerId: offers.id,
    commentVersion: offers.sellerCommentVersion,
    comment: offers.sellerComment,
  }).from(offers)
    .where(and(
      isNotNull(offers.sellerComment),
      notExists(database.select({ value: sql`1` }).from(offerCommentTranslations).where(and(
        eq(offerCommentTranslations.offerId, offers.id),
        eq(offerCommentTranslations.commentVersion, offers.sellerCommentVersion),
        or(
          ne(offerCommentTranslations.status, 'pending'),
          sql`${offerCommentTranslations.updatedAt} > now() - interval '10 minutes'`,
        ),
      ))),
    ))
    .orderBy(asc(offers.id))
    .limit(limit);
  return rows.flatMap((row) => row.comment ? [{ ...row, comment: row.comment }] : []);
}

// Sequential on purpose: enabling the translator must not turn the backlog into a request storm.
export async function translateUntranslatedSellerComments(
  database: Database,
  translator: SellerCommentTranslator,
  options: { batchSize?: number; maxComments?: number } = {},
) {
  const batchSize = options.batchSize ?? 50;
  const maxComments = options.maxComments ?? 5000;
  let processed = 0;
  while (processed < maxComments) {
    const batch = await findUntranslatedSellerComments(database, Math.min(batchSize, maxComments - processed));
    if (batch.length === 0) break;
    for (const comment of batch) await translatePublishedSellerComment(database, translator, comment);
    processed += batch.length;
  }
  return processed;
}

export function createSellerCommentTranslationScheduler(
  database: Database,
  translator: SellerCommentTranslator,
) {
  return async (comments: readonly PublishedSellerComment[]) => {
    await Promise.all(comments.map((comment) => translatePublishedSellerComment(database, translator, comment)));
  };
}
