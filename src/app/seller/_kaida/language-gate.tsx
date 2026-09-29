import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, localeFromAcceptLanguage, parseLocale } from '../../../i18n/config';
import { LanguageChoice } from './LanguageChoice';

// The first visit shows the language choice instead of the page; once the choice is saved the page renders.
export async function LanguageGate({ children }: { children: React.ReactNode }) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  if (parseLocale(cookieStore.get(LOCALE_COOKIE)?.value)) return children;
  return <LanguageChoice suggested={localeFromAcceptLanguage(headerStore.get('accept-language'))} />;
}
