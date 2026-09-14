import Link from 'next/link';
import { AppHeader } from './_components/AppHeader';
import { SearchForm } from './_components/SearchForm';
import styles from './page.module.css';

export default function Home() {
  return (
    <>
      <AppHeader />
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Поиск товаров</p>
            <h1>Где купить?</h1>
            <p className={styles.description}>Найдите товар и узнайте,<br className={styles.desktopBreak} /> где он продаётся.</p>
            <Link href="/nearby" className={styles.secondaryLink}>Что есть рядом</Link>
          </div>
          <SearchForm />
        </main>
        <footer className={styles.footer}>Предложения и цены в этой версии вымышлены.</footer>
      </div>
    </>
  );
}
