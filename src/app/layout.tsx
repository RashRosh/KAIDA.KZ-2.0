import type { Metadata } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'KAIDA.KZ | Поиск товаров',
  description: 'Найдите товар и узнайте, где он продаётся.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
