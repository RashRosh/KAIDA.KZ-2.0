import { getDatabase } from '../../../db/client';
import { fakeSellerCommentTranslator } from './fake-seller-comment-translator';
import { readSellerCommentTranslatorMode, type SellerCommentTranslationEnvironment } from './seller-comment-translation.config';
import {
  disabledSellerCommentTranslationScheduler,
  type ScheduleSellerCommentTranslations,
  type SellerCommentTranslator,
} from './seller-comment-translator';
import { createSellerCommentTranslationScheduler, translateUntranslatedSellerComments } from './translate-published-seller-comment';

export function getSellerCommentTranslator(
  env: SellerCommentTranslationEnvironment = process.env,
): SellerCommentTranslator | null {
  return readSellerCommentTranslatorMode(env) === 'fake' ? fakeSellerCommentTranslator : null;
}

// `defer` hands the work to the platform's after-response hook, so confirmation never waits for the translator.
export function getSellerCommentTranslationScheduler(
  defer: (task: () => Promise<void>) => void,
): ScheduleSellerCommentTranslations {
  const translator = getSellerCommentTranslator();
  if (!translator) return disabledSellerCommentTranslationScheduler;
  const schedule = createSellerCommentTranslationScheduler(getDatabase(), translator);
  return (comments) => {
    defer(async () => {
      try {
        await schedule(comments);
      } catch {
        console.error('Seller comment translation failed');
      }
    });
  };
}

export async function translateBacklogOnStartup() {
  const translator = getSellerCommentTranslator();
  if (!translator) return;
  try {
    await translateUntranslatedSellerComments(getDatabase(), translator);
  } catch {
    console.error('Seller comment translation backlog failed');
  }
}
