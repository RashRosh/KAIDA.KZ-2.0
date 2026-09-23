'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from '../cabinet.module.css';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';

export type CabinetSection = 'overview' | 'offers' | 'points' | 'contacts';

const destinations: { section: CabinetSection; href: string; label: MessageKey; icon: 'home' | 'tag' | 'store' | 'contacts' }[] = [
  { section: 'overview', href: '/seller', label: 'cabinet.overview', icon: 'home' },
  { section: 'offers', href: '/seller/offers', label: 'cabinet.offers', icon: 'tag' },
  { section: 'points', href: '/seller/points', label: 'cabinet.points', icon: 'store' },
  { section: 'contacts', href: '/seller/contacts', label: 'cabinet.contacts', icon: 'contacts' },
];

export function CabinetIcon({ name }: { name: 'home' | 'tag' | 'store' | 'contacts' | 'more' | 'logout' | 'plus' | 'clock' | 'check' | 'pause' | 'dots' | 'alert' | 'retry' | 'back' }) {
  const paths: Record<typeof name, React.ReactNode> = {
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z" />,
    tag: <><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
    store: <><path d="M4 10v10h16V10" /><path d="M3 10 5 5h14l2 5" /><path d="M9 20v-5h6v5" /></>,
    contacts: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17c.8-1.8 2.2-2.7 4-2.7s3.2.9 4 2.7" /></>,
    more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    dots: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    logout: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    check: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    pause: <><circle cx="12" cy="12" r="8" /><path d="M10 9v6M14 9v6" /></>,
    alert: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5M12 16h.01" /></>,
    retry: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
  };
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

function useLogout() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        router.push('/');
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  }
  return { loggingOut, logout };
}

// Bottom sheet for the less frequent destinations. Focus moves in once on open, is not re-captured while open,
// and returns to the trigger on close (DESIGN_SYSTEM.md §13.1).
function MoreSheet({ open, onClose, active }: { open: boolean; onClose: () => void; active: CabinetSection | null }) {
  const { t } = useI18n();
  const { loggingOut, logout } = useLogout();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>('a, button')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !sheet) return;
      const focusable = [...sheet.querySelectorAll<HTMLElement>('a, button:not(:disabled)')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('cabinet.more')} onClick={(event) => event.stopPropagation()}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        <Link className={styles.sheetItem} href="/seller/contacts" aria-current={active === 'contacts' ? 'page' : undefined} onClick={onClose}>
          <CabinetIcon name="contacts" />{t('cabinet.contacts')}
        </Link>
        <button type="button" className={styles.sheetItem} onClick={() => void logout()} disabled={loggingOut}>
          <CabinetIcon name="logout" />{loggingOut ? t('cabinet.loggingOut') : t('cabinet.logout')}
        </button>
        <button type="button" className={styles.sheetClose} onClick={onClose}>{t('cabinet.close')}</button>
      </div>
    </div>
  );
}

export function SellerCabinetFrame({ active, children, mobileNav = true }: { active: CabinetSection | null; children: React.ReactNode; mobileNav?: boolean }) {
  const { t } = useI18n();
  const { loggingOut, logout } = useLogout();
  const [moreOpen, setMoreOpen] = useState(false);
  // The cabinet navigation is for signed-in Sellers; an anonymous visitor sees only the login-required content.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? await response.json() as { user: unknown } : null)
      .then((data) => { if (alive && data) setSignedIn(Boolean(data.user)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const showNav = signedIn !== false;
  return (
    <div className={showNav ? styles.frame : styles.frameBare} data-mobile-nav={showNav && mobileNav ? 'true' : 'false'}>
      {showNav && (
        <nav className={styles.sidebar} aria-label={t('cabinet.nav')}>
          <ul>
            {destinations.map((destination) => (
              <li key={destination.section}>
                <Link href={destination.href} className={styles.sideLink} aria-current={active === destination.section ? 'page' : undefined}>
                  <CabinetIcon name={destination.icon} />{t(destination.label)}
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.sideLogout} onClick={() => void logout()} disabled={loggingOut}>
            <CabinetIcon name="logout" />{loggingOut ? t('cabinet.loggingOut') : t('cabinet.logout')}
          </button>
        </nav>
      )}
      <div className={styles.content}>{children}</div>
      {showNav && mobileNav && (
        <>
          <nav className={styles.bottomNav} aria-label={t('cabinet.nav')}>
            {destinations.slice(0, 3).map((destination) => (
              <Link key={destination.section} href={destination.href} className={styles.bottomLink} aria-current={active === destination.section ? 'page' : undefined}>
                <CabinetIcon name={destination.icon} /><span>{t(destination.label)}</span>
              </Link>
            ))}
            <button
              type="button"
              className={styles.bottomLink}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              data-active={active === 'contacts' ? 'true' : undefined}
              onClick={() => setMoreOpen(true)}
            >
              <CabinetIcon name="more" /><span>{t('cabinet.more')}</span>
            </button>
          </nav>
          <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} active={active} />
        </>
      )}
    </div>
  );
}
