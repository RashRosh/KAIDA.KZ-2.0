'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from '../../../i18n/config';
import { useI18n } from '../../../i18n/I18nProvider';
import { Ic } from './ui';

// Stage 6D (PROJECT_RULES.md §18.4 «Язык» and «Выбор interaction pattern»): the language row of «Ещё» for the buyer and
// the Seller — «Язык» and, in the same row, the small `РУС | ҚАЗ` pill of the mockup; applied at once, no sheet, radio or
// «Готово». The saving (cookie, `<html lang>`) and the «route and input stay» rule are the existing locale semantics.
// The pill shows the short marks; screen readers get the full names in their own language.
const LANGUAGES: { locale: Locale; short: string; name: string }[] = [
  { locale: 'ru', short: 'РУС', name: 'Русский' },
  { locale: 'kk', short: 'ҚАЗ', name: 'Қазақша' },
];

export function InlineLanguage() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();

  // The active language is a no-op; another one applies at once and the page re-renders in place.
  function choose(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    router.refresh();
  }

  return (
    <div className="li">
      <Ic name="globe" className="c2" />
      <div className="mid"><div className="ts">{t('more.language')}</div></div>
      <div className="lang lang-row" role="group" aria-label={t('more.language')}>
        {LANGUAGES.map((language) => (
          <button
            key={language.locale}
            type="button"
            lang={language.locale}
            aria-label={language.name}
            aria-pressed={locale === language.locale}
            onClick={() => choose(language.locale)}
          >
            {language.short}
          </button>
        ))}
      </div>
    </div>
  );
}
