'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthModal } from './AuthModal';
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
  const [loginOpen, setLoginOpen] = useState(false);
  const loginTriggerRef = useRef<HTMLButtonElement>(null);

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

  function closeLogin() {
    setLoginOpen(false);
    requestAnimationFrame(() => loginTriggerRef.current?.focus());
  }

  function handleAuthenticated(nextUser: User) {
    setUser(nextUser);
    setLoginOpen(false);
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
        <button
          ref={loginTriggerRef}
          type="button"
          className={styles.loginLink}
          onClick={() => setLoginOpen(true)}
          aria-label="Войти"
          aria-haspopup="dialog"
          aria-expanded={loginOpen}
        >
          <AuthIcon type="login" />
          <span>Войти</span>
        </button>
      )}

      {loginOpen ? <AuthModal open onClose={closeLogin} onAuthenticated={handleAuthenticated} /> : null}
    </div>
  );
}
