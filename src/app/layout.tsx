import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import { I18nProvider } from '@/i18n/I18nProvider';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: messages[locale]['meta.title'], description: messages[locale]['meta.description'], robots: { index: false, follow: false } };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return <html lang={locale}><body><I18nProvider initialLocale={locale}>{children}</I18nProvider></body></html>;
}
