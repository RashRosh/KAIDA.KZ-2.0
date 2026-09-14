import Link from 'next/link';
import { AuthStatus } from '../_components/AuthStatus';
import { NearbyFeed } from './NearbyFeed';
import styles from '../page.module.css';

export default function NearbyPage() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">KAIDA.KZ</Link>
        <AuthStatus />
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Рядом</p>
          <h1>Что есть рядом?</h1>
          <p className={styles.description}>Посмотрите актуальные предложения поблизости без поискового запроса.</p>
          <Link href="/" className={styles.secondaryLink}>Искать конкретный товар</Link>
        </div>
        <NearbyFeed />
      </main>
      <footer className={styles.footer}>Предложения и цены в этой версии вымышлены.</footer>
    </div>
  );
}
