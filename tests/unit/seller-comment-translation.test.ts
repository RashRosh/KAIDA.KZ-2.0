import { describe, expect, it, vi } from 'vitest';
import { projectBuyerCommentTranslation } from '../../src/modules/offers/translation/buyer-comment-translation.projection';
import { detectFakeCommentLanguage, fakeSellerCommentTranslator } from '../../src/modules/offers/translation/fake-seller-comment-translator';
import { createPreviewRateLimiter } from '../../src/modules/offers/translation/preview-seller-comment-translation';
import { readSellerCommentTranslatorMode } from '../../src/modules/offers/translation/seller-comment-translation.config';

const base = {
  enabled: true,
  locale: 'ru' as const,
  sellerComment: 'Жаңа, таңертеңгі жеткізілім',
  status: null,
  translatedText: null,
  detectedSourceLanguage: null,
};

describe('Seller comment translation', () => {
  it('is off unless configured, and a wrong value degrades to off', () => {
    expect(readSellerCommentTranslatorMode({})).toBe('off');
    expect(readSellerCommentTranslatorMode({ SELLER_COMMENT_TRANSLATOR: '' })).toBe('off');
    expect(readSellerCommentTranslatorMode({ SELLER_COMMENT_TRANSLATOR: 'fake' })).toBe('fake');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(readSellerCommentTranslatorMode({ SELLER_COMMENT_TRANSLATOR: 'gpt' })).toBe('off');
    error.mockRestore();
  });

  it('projects each buyer card variant', () => {
    expect(projectBuyerCommentTranslation({ ...base, enabled: false, status: 'available', translatedText: 'x' })).toBeUndefined();
    expect(projectBuyerCommentTranslation({ ...base, sellerComment: null })).toBeUndefined();
    expect(projectBuyerCommentTranslation({ ...base, status: 'same-language' })).toBeUndefined();
    expect(projectBuyerCommentTranslation(base)).toEqual({ status: 'unavailable' });
    expect(projectBuyerCommentTranslation({ ...base, status: 'pending' })).toEqual({ status: 'unavailable' });
    expect(projectBuyerCommentTranslation({ ...base, status: 'failed' })).toEqual({ status: 'unavailable' });
    expect(projectBuyerCommentTranslation({ ...base, status: 'available', translatedText: 'Свежая', detectedSourceLanguage: 'kk' }))
      .toEqual({ status: 'translated', text: 'Свежая', locale: 'ru', originalLocale: 'kk' });
    expect(projectBuyerCommentTranslation({ ...base, status: 'available', translatedText: 'Fresh', detectedSourceLanguage: 'en' }))
      .toEqual({ status: 'translated', text: 'Fresh', locale: 'ru' });
  });

  it('fake adapter detects the language from the text only', async () => {
    expect(detectFakeCommentLanguage('Жаңа сүт, свежее молоко')).toBe('kk');
    expect(detectFakeCommentLanguage('Свежее молоко')).toBe('ru');
    expect(detectFakeCommentLanguage('Fresh milk')).toBe('en');
    expect(detectFakeCommentLanguage('123')).toBe('unknown');
    await expect(fakeSellerCommentTranslator.translateComment('Свежая, утренний привоз', ['ru', 'kk'])).resolves.toEqual({
      detectedSourceLanguage: 'ru',
      translations: { kk: 'Жаңа, таңертеңгі жеткізілім' },
      sameLanguage: ['ru'],
    });
  });

  it('rate-limits previews per Seller in a fixed window', () => {
    let now = 0;
    const allow = createPreviewRateLimiter(2, 1000, () => now);
    expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true]);
    now = 1000;
    expect(allow('a')).toBe(true);
  });
});
