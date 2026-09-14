import { AppHeader } from './_components/AppHeader';
import { SearchForm } from './_components/SearchForm';
import styles from './page.module.css';

type HomeProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const rawQuery = params.q;
  const initialQuery = Array.isArray(rawQuery) ? (rawQuery[0] ?? '') : (rawQuery ?? '');

  return (
    <>
      <AppHeader />
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.intro}>
            <h1>
              Найди где товар есть <span className={styles.headingAccent}>сейчас</span>
            </h1>
            <p className={styles.description}>
              KAIDA.KZ — не магазин. Найдите актуальное предложение продавца и свяжитесь напрямую без посредников.
            </p>
          </div>
          <SearchForm key={initialQuery} initialQuery={initialQuery} />
        </main>
        <footer className={styles.footer}>Предложения и цены в этой версии вымышлены.</footer>
      </div>
    </>
  );
}
