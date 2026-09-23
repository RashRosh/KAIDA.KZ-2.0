import { and, eq } from 'drizzle-orm';
import { offerCommentTranslations, type OfferCommentTranslationStatus } from '../db/offer-comment-translations.table';
import { offers } from '../db/offers.table';
import type { TranslationTargetLocale } from './seller-comment-translator';

export type BuyerCommentTranslation =
  | { status: 'translated'; text: string; locale: TranslationTargetLocale; originalLocale?: TranslationTargetLocale }
  | { status: 'unavailable' };

// Joins only the translation of the Offer's *current* comment version, so a stale or late result is never read.
export function currentCommentTranslationJoin(locale: TranslationTargetLocale) {
  return and(
    eq(offerCommentTranslations.offerId, offers.id),
    eq(offerCommentTranslations.commentVersion, offers.sellerCommentVersion),
    eq(offerCommentTranslations.targetLocale, locale),
  );
}

export const currentCommentTranslationSelection = {
  commentTranslationStatus: offerCommentTranslations.status,
  commentTranslationText: offerCommentTranslations.translatedText,
  commentTranslationSourceLanguage: offerCommentTranslations.detectedSourceLanguage,
};

// Absent result → the original is shown as written, without a label.
export function projectBuyerCommentTranslation(input: {
  enabled: boolean;
  locale: TranslationTargetLocale;
  sellerComment: string | null;
  status: OfferCommentTranslationStatus | null;
  translatedText: string | null;
  detectedSourceLanguage: string | null;
}): BuyerCommentTranslation | undefined {
  if (!input.enabled || !input.sellerComment) return undefined;
  if (input.status === 'same-language') return undefined;
  if (input.status === 'available' && input.translatedText) {
    const source = input.detectedSourceLanguage;
    return {
      status: 'translated',
      text: input.translatedText,
      locale: input.locale,
      ...(source === 'ru' || source === 'kk' ? { originalLocale: source } : {}),
    };
  }
  return { status: 'unavailable' };
}
