'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from '../../../i18n/config';
import { useI18n } from '../../../i18n/I18nProvider';
import { Ic } from './ui';

// Stage 6D (PROJECT_RULES.md §18.4 «Язык» and «Выбор interaction pattern»): the language row of «Ещё» for the buyer and
// the Seller — two options in place, applied at once, no sheet, radio or «Готово». The saving (cookie, `<html lang>`) and
// the «route and input stay» rule are the existing locale semantics; the names are written in their own language.
const LANGUAGES: { locale: Locale; name: string }[] = [
  { locale: 'ru', name: 'Русский' },
  { locale: 'kk', name: 'Қазақша' },
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
    <div className="li" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '12px 0', height: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ic name="globe" className="c2" /><div className="ts">{t('more.language')}</div>
      </div>
      <div className="lang lang-inline" role="group" aria-label={t('more.language')}>
        {LANGUAGES.map((language) => (
          <button
            key={language.locale}
            type="button"
            lang={language.locale}
            aria-pressed={locale === language.locale}
            onClick={() => choose(language.locale)}
          >
            {language.name}
          </button>
        ))}
      </div>
    </div>
  );
}
