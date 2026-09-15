'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthStatus } from './AuthStatus';
import { HeaderSearch } from './HeaderSearch';
import styles from './AppHeader.module.css';

type AppHeaderProps = {
  contextLabel?: string;
  showAuth?: boolean;
};

type NavItem = {
  href: '/' | '/nearby' | '/seller';
  label: 'Поиск' | 'Рядом' | 'Продавцу';
  icon: 'search' | 'pin' | 'store';
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Поиск', icon: 'search' },
  { href: '/nearby', label: 'Рядом', icon: 'pin' },
  { href: '/seller', label: 'Продавцу', icon: 'store' },
];

function BrandMark() {
  return (
    <span className={styles.brandMark} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" focusable="false">
        <path d="M12 3L20 8V16L12 21L4 16V8L12 3Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    </span>
  );
}

function NavIcon({ icon }: { icon: NavItem['icon'] }) {
  if (icon === 'search') {
    return (
      <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.25 4.25" />
      </svg>
    );
  }

  if (icon === 'pin') {
    return (
      <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    );
  }

  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 5l8 5.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M9.5 19v-5h5v5" />
    </svg>
  );
}

function isActive(pathname: string, href: NavItem['href']) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PrimaryNav({
  className,
  pathname,
  onNavigate,
}: {
  className: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className={className} aria-label="Основная навигация">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            <NavIcon icon={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ) : (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function AppHeader({ contextLabel, showAuth = true }: AppHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.topRow} data-testid="primary-header-row">
          <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">
            <BrandMark />
            <span className={styles.wordmarkText}>KAIDA<span className={styles.wordmarkAccent}>.KZ</span></span>
          </Link>

          <HeaderSearch />

          <div className={styles.trailing}>
            {showAuth ? <AuthStatus /> : <span className={styles.context}>{contextLabel}</span>}
            <button
              type="button"
              className={styles.mobileMenuButton}
              aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-primary-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        <div className={styles.desktopNavRow}>
          <PrimaryNav className={styles.desktopNav} pathname={pathname} />
        </div>
      </div>

      {mobileOpen ? (
        <div className={styles.mobilePanel} id="mobile-primary-navigation">
          <PrimaryNav
            className={styles.mobileNav}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      ) : null}
    </header>
  );
}
