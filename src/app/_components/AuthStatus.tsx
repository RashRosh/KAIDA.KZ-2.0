'use client';

import { RefObject, useState } from 'react';
import styles from './AuthStatus.module.css';

type User = { id: string; phone: string };

type AuthStatusProps = {
  user: User | null | undefined;
  loginOpen: boolean;
  loginTriggerRef: RefObject<HTMLButtonElement | null>;
  onLogin: () => void;
  onLoggedOut: () => void;
};

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

export function AuthStatus({ user, loginOpen, loginTriggerRef, onLogin, onLoggedOut }: AuthStatusProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) onLoggedOut();
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
        <button
          ref={loginTriggerRef}
          type="button"
          className={styles.loginLink}
          onClick={onLogin}
          aria-label="Войти"
          aria-haspopup="dialog"
          aria-expanded={loginOpen}
        >
          <AuthIcon type="login" />
          <span>Войти</span>
        </button>
      )}

    </div>
  );
}
