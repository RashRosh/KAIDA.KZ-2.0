'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from '../../../i18n/config';
import { useI18n } from '../../../i18n/I18nProvider';
import { Phone } from './ui';

// PROJECT_RULES.md §18.4 «Язык» (PO, 2026-09-29): the language is chosen once, at the first visit of a buyer or seller
// page; later it changes only in «Ещё». Both names are always shown in their own language.
const choices: { locale: Locale; name: string }[] = [
  { locale: 'ru', name: 'Русский' },
  { locale: 'kk', name: 'Қазақша' },
];

export function LanguageChoice({ suggested }: { suggested: Locale }) {
  const { setLocale } = useI18n();
  const router = useRouter();
  const ordered = [...choices].sort((a, b) => Number(b.locale === suggested) - Number(a.locale === suggested));
  return (
    <Phone>
      <main className="body" style={{ justifyContent: 'center', gap: 24, padding: '24px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
          <h1 className="h1">KAIDA</h1>
          <p className="t c2" lang="ru">Выберите язык</p>
          <p className="t c2" lang="kk">Тілді таңдаңыз</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} role="group" aria-label="Язык · Тіл">
          {ordered.map((choice) => (
            <button
              key={choice.locale}
              type="button"
              lang={choice.locale}
              className={`btn lg w ${choice.locale === suggested ? 'btn-p' : 'btn-o'}`}
              onClick={() => { setLocale(choice.locale); router.refresh(); }}
              data-autofocus={choice.locale === suggested || undefined}
            >
              {choice.name}
            </button>
          ))}
        </div>
      </main>
    </Phone>
  );
}
