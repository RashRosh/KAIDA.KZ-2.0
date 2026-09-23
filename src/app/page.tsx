import { AppHeader } from './_components/AppHeader';
import { SearchForm } from './_components/SearchForm';
import styles from './page.module.css';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';

type HomeProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const rawQuery = params.q;
  const initialQuery = Array.isArray(rawQuery) ? (rawQuery[0] ?? '') : (rawQuery ?? '');
  const locale = await getRequestLocale();
  const t = messages[locale];

  return (
    <>
      <AppHeader />
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.intro}>
            <h1>
              {t['home.title.before']} <span className={styles.headingAccent}>{t['home.title.accent']}</span>
            </h1>
            <p className={styles.description}>
              {t['home.description']}
            </p>
          </div>
          <SearchForm key={initialQuery} initialQuery={initialQuery} />
        </main>
        <footer className={styles.footer}>{t['common.disclaimer']}</footer>
      </div>
    </>
  );
}
