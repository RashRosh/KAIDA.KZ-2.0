import Link from 'next/link';
import { SearchForm } from './_components/SearchForm';
import { AuthStatus } from './_components/AuthStatus';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">KAIDA.KZ</Link>
        <AuthStatus />
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Поиск товаров</p>
          <h1>Где купить?</h1>
          <p className={styles.description}>Найдите товар и узнайте,<br className={styles.desktopBreak} /> где он продаётся.</p>
        </div>
        <SearchForm />
      </main>
      <footer className={styles.footer}>Предложения и цены в этой версии вымышлены.</footer>
    </div>
  );
}
