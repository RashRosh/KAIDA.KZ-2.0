import { z } from 'zod';
import { getDatabase, type Database } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  translationTargetLocales,
  type SellerCommentTranslator,
  type TranslationTargetLocale,
} from './seller-comment-translator';

export const commentTranslationPreviewBodySchema = z.strictObject({
  text: z.string().trim().min(1).max(500),
});

export type CommentTranslationPreview = {
  translations: { locale: TranslationTargetLocale; text: string }[];
};

export class CommentTranslationDisabledError extends Error {
  readonly code = 'TRANSLATION_DISABLED';
}

export class CommentTranslationSellerRequiredError extends Error {
  readonly code = 'SELLER_REQUIRED';
}

export class CommentTranslationRateLimitedError extends Error {
  readonly code = 'RATE_LIMITED';
}

export class CommentTranslationUnavailableError extends Error {
  readonly code = 'TRANSLATION_UNAVAILABLE';
}

// Fixed window per Seller account, kept in process memory: enough for the modular monolith and never persisted.
export function createPreviewRateLimiter(limit = 20, windowMs = 60_000, now: () => number = Date.now) {
  const windows = new Map<string, { startedAt: number; count: number }>();
  return (key: string) => {
    const time = now();
    const current = windows.get(key);
    if (!current || time - current.startedAt >= windowMs) {
      if (windows.size > 10_000) windows.clear();
      windows.set(key, { startedAt: time, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}

const defaultRateLimiter = createPreviewRateLimiter();

// A read-only draft preview: nothing is stored and no ChangeSet is created. The preview shows the second language —
// the one of ru/kk the draft is not written in; a draft in neither language gets both.
export async function previewSellerCommentTranslation(
  ownerUserId: string,
  text: string,
  dependencies: {
    translator: SellerCommentTranslator | null;
    database?: Database;
    allowRequest?: (key: string) => boolean;
  },
): Promise<CommentTranslationPreview> {
  if (!dependencies.translator) throw new CommentTranslationDisabledError();
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new CommentTranslationSellerRequiredError();
  if (!(dependencies.allowRequest ?? defaultRateLimiter)(seller.id)) throw new CommentTranslationRateLimitedError();

  let result;
  try {
    result = await dependencies.translator.translateComment(text, translationTargetLocales);
  } catch {
    throw new CommentTranslationUnavailableError();
  }

  const translations = translationTargetLocales
    .filter((locale) => locale !== result.detectedSourceLanguage && !result.sameLanguage.includes(locale))
    .flatMap((locale) => {
      const translated = result.translations[locale]?.trim();
      return translated ? [{ locale, text: translated }] : [];
    });
  if (translations.length === 0) throw new CommentTranslationUnavailableError();
  return { translations };
}
