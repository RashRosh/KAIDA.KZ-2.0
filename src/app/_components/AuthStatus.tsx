'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './AuthStatus.module.css';

type User = { id: string; phone: string };

function AuthIcon({ type }: { type: 'login' | 'logout' }) {
  return type === 'login' ? (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6H5v12h5" />
      <path d="M13 8l4 4-4 4" />
      <path d="M8 12h9" />
    </svg>
  ) : (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 6h5v12h-5" />
      <path d="M11 8l-4 4 4 4" />
      <path d="M16 12H7" />
    </svg>
  );
}

export function AuthStatus() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ user: User | null }> : { user: null })
      .then((data) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) setUser(null);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className={styles.group}>
      {user === undefined ? <span className={styles.authMuted}>Проверяем вход…</span> : user ? (
        <div className={styles.authRow}>
          <span className={styles.phone}>{user.phone}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label={loggingOut ? 'Выходим…' : 'Выйти'}
          >
            <AuthIcon type="logout" />
            <span>{loggingOut ? 'Выходим…' : 'Выйти'}</span>
          </button>
        </div>
      ) : (
        <Link href="/login" className={styles.loginLink}>
          <AuthIcon type="login" />
          <span>Войти</span>
        </Link>
      )}
    </div>
  );
}
