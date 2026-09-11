'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './AuthStatus.module.css';

type User = { id: string; phone: string };

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
      <span className={styles.testLabel}>Тестовая версия</span>
      {user === undefined ? <span className={styles.authMuted}>Проверяем вход…</span> : user ? (
        <div className={styles.authRow}>
          <span className={styles.phone}>{user.phone}</span>
          <button type="button" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Выходим…' : 'Выйти'}</button>
        </div>
      ) : <Link href="/login" className={styles.loginLink}>Войти</Link>}
    </div>
  );
}
