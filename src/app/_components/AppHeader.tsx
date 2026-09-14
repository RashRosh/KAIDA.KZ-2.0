'use client';

import Link from 'next/link';
import { AuthStatus } from './AuthStatus';
import styles from './AppHeader.module.css';

type AppHeaderProps = {
  contextLabel?: string;
  showAuth?: boolean;
};

function PrimaryNav({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="Основная навигация">
      <Link href="/" className={styles.navLink}>Поиск</Link>
      <Link href="/nearby" className={styles.navLink}>Рядом</Link>
      <Link href="/seller" className={styles.navLink}>Продавцу</Link>
    </nav>
  );
}

export function AppHeader({ contextLabel, showAuth = true }: AppHeaderProps) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">KAIDA.KZ</Link>
          <PrimaryNav className={styles.desktopNav} />
          <div className={styles.trailing}>
            {showAuth ? <AuthStatus /> : <span className={styles.context}>{contextLabel}</span>}
          </div>
        </div>
      </header>
      <PrimaryNav className={styles.mobileNav} />
    </>
  );
}
