import { describe, expect, it } from 'vitest';
import { apiLocale, localeFromAcceptLanguage, parseLocale, resolveLocale } from '../../src/i18n/config';
import { confirmedAt, offerCount } from '../../src/i18n/format';
import { kk, ru } from '../../src/i18n/messages';
import { hasUnsupportedQuery, localeFromApiRequest } from '../../src/i18n/api';

describe('localization foundation', () => {
  it('resolves cookie before browser language and defaults safely', () => {
    expect(resolveLocale('ru', 'kk-KZ')).toBe('ru');
    expect(resolveLocale('kk', 'ru-RU')).toBe('kk');
    expect(resolveLocale('broken', 'kk-KZ,ru;q=0.8')).toBe('kk');
    expect(resolveLocale(undefined, 'en-US')).toBe('ru');
    expect(localeFromAcceptLanguage('ru;q=0.8,kk;q=0.9')).toBe('kk');
    expect(parseLocale('en')).toBeNull();
  });

  it('keeps API locale explicit and defaults unsupported values to Russian', () => {
    expect(apiLocale('kk')).toBe('kk');
    expect(apiLocale(undefined)).toBe('ru');
    expect(apiLocale('en')).toBe('ru');
    expect(localeFromApiRequest(new Request('https://kaida.test/api/search?locale=kk'))).toBe('kk');
    expect(localeFromApiRequest(new Request('https://kaida.test/api/search?locale=en'))).toBe('ru');
    expect(hasUnsupportedQuery(new URLSearchParams('locale=kk'), [])).toBe(false);
    expect(hasUnsupportedQuery(new URLSearchParams('locale=kk&extra=1'), [])).toBe(true);
  });

  it('has a non-empty Kazakh value for every Russian key', () => {
    expect(Object.keys(kk).sort()).toEqual(Object.keys(ru).sort());
    for (const key of Object.keys(ru) as Array<keyof typeof ru>) {
      expect(ru[key].trim(), `${key} ru`).not.toBe('');
      expect(kk[key].trim(), `${key} kk`).not.toBe('');
    }
  });

  it('formats Russian offer plurals and Kazakh noun form', () => {
    expect(offerCount('ru', 1)).toBe('Найдено 1 предложение');
    expect(offerCount('ru', 3)).toBe('Найдено 3 предложения');
    expect(offerCount('ru', 5)).toBe('Найдено 5 предложений');
    expect(offerCount('ru', 11)).toBe('Найдено 11 предложений');
    expect(offerCount('kk', 3)).toBe('3 ұсыныс табылды');
  });

  it('formats a Kazakh date phrase as a whole template', () => {
    const value = new Date('2026-09-12T09:40:00+05:00');
    expect(confirmedAt('kk', value)).toContain('расталды');
  });
});
