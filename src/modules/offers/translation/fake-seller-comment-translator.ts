import type {
  SellerCommentTranslationResult,
  SellerCommentTranslator,
  TranslationTargetLocale,
} from './seller-comment-translator';

// Deterministic stand-in for the server-side LLM. It never leaves the process, so tests and demos can run the
// translator-on flows without an external service. Known phrases get a real translation; anything else gets a
// visibly marked machine rendering. A comment containing `#translator-fail` makes the request fail.
const phrasebook: ReadonlyArray<Readonly<Record<TranslationTargetLocale, string>>> = [
  { kk: 'Жаңа, таңертеңгі жеткізілім', ru: 'Свежая, утренний привоз' },
  { kk: 'Үйде өсірілген, химиясыз', ru: 'Домашний, без химии' },
  { kk: 'Жеткізу бар', ru: 'Есть доставка' },
];

const kazakhLetters = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;
const cyrillicLetters = /[а-яёА-ЯЁ]/;
const latinLetters = /[a-zA-Z]/;

export function detectFakeCommentLanguage(text: string): string {
  if (kazakhLetters.test(text)) return 'kk';
  if (cyrillicLetters.test(text)) return 'ru';
  if (latinLetters.test(text)) return 'en';
  return 'unknown';
}

function normalize(text: string) {
  return text.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ');
}

function translate(text: string, target: TranslationTargetLocale): string {
  const known = phrasebook.find((entry) => Object.values(entry).some((phrase) => normalize(phrase) === normalize(text)));
  if (known) return known[target];
  return target === 'ru' ? `Автоперевод: ${text.trim()}` : `Аударма: ${text.trim()}`;
}

export const fakeSellerCommentTranslator: SellerCommentTranslator = {
  async translateComment(text, targetLocales): Promise<SellerCommentTranslationResult> {
    if (text.includes('#translator-fail')) throw new Error('Fake translator failure');
    const detectedSourceLanguage = detectFakeCommentLanguage(text);
    const result: SellerCommentTranslationResult = { detectedSourceLanguage, translations: {}, sameLanguage: [] };
    for (const target of targetLocales) {
      if (target === detectedSourceLanguage) result.sameLanguage.push(target);
      else result.translations[target] = translate(text, target);
    }
    return result;
  },
};
