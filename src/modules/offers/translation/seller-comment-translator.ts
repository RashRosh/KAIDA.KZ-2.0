export const translationTargetLocales = ['ru', 'kk'] as const;

export type TranslationTargetLocale = typeof translationTargetLocales[number];

export type SellerCommentTranslationResult = {
  detectedSourceLanguage: string;
  translations: Partial<Record<TranslationTargetLocale, string>>;
  sameLanguage: TranslationTargetLocale[];
};

export interface SellerCommentTranslator {
  translateComment(
    text: string,
    targetLocales: readonly TranslationTargetLocale[],
  ): Promise<SellerCommentTranslationResult>;
}

export type PublishedSellerComment = {
  offerId: string;
  commentVersion: number;
  comment: string;
};

export type ScheduleSellerCommentTranslations = (
  comments: readonly PublishedSellerComment[],
) => void | Promise<void>;

export const disabledSellerCommentTranslationScheduler: ScheduleSellerCommentTranslations = () => {};
