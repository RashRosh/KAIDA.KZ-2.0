export const supportedLocales = ['ru', 'kk'] as const;

export type Locale = (typeof supportedLocales)[number];

export const DEFAULT_LOCALE: Locale = 'ru';
export const LOCALE_COOKIE = 'kaida_locale';

export function parseLocale(value: string | null | undefined): Locale | null {
  return value === 'ru' || value === 'kk' ? value : null;
}

export function localeFromAcceptLanguage(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;

  const requested = value
    .split(',')
    .map((part) => {
      const [tag = '', ...parameters] = part.trim().split(';');
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const q = quality ? Number.parseFloat(quality.split('=')[1] ?? '0') : 1;
      return { language: tag.toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const entry of requested) {
    if (entry.language === 'kk') return 'kk';
    if (entry.language === 'ru') return 'ru';
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  return parseLocale(cookieValue) ?? localeFromAcceptLanguage(acceptLanguage);
}

export function apiLocale(value: string | null | undefined): Locale {
  return parseLocale(value) ?? DEFAULT_LOCALE;
}
