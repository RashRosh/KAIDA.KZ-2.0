import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'KAIDA.KZ | Поиск товаров',
  description: 'Найдите товар и узнайте, где он продаётся.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" className={roboto.variable}><body>{children}</body></html>;
}
