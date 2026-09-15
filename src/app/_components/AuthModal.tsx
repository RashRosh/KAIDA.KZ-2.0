'use client';

import { FormEvent, MouseEvent, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeKzPhone } from '@/modules/identity/phone/normalize-phone';
import styles from './AuthModal.module.css';

type User = { id: string; phone: string };
type ErrorPayload = { error?: { message?: string } };
type RequestSuccess = {
  challenge: { id: string; expiresAt: string };
  delivery: { mode: 'test'; code: string };
};
type VerifySuccess = { user: User };

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
};

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.2 3.8 10 8 8.3 9.7c1.1 2.3 3 4.2 5.3 5.3l1.7-1.7 4.2 2.8-.9 3.6c-.2.8-1 1.4-1.8 1.3C9.6 20.1 3.9 14.4 3 7.2c-.1-.8.5-1.6 1.3-1.8l2.9-.7Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [canonicalPhone, setCanonicalPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [testCode, setTestCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetAndClose = useCallback(() => {
    setStep('phone');
    setPhone('');
    setCanonicalPhone('');
    setChallengeId('');
    setTestCode('');
    setCode('');
    setError('');
    setLoading(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') resetAndClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, resetAndClose]);

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) resetAndClose();
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json() as RequestSuccess & ErrorPayload;
      if (!response.ok) {
        setError(data.error?.message ?? 'Не удалось получить код.');
        return;
      }
      setCanonicalPhone(normalizeKzPhone(phone));
      setChallengeId(data.challenge.id);
      setTestCode(data.delivery.code);
      setCode('');
      setStep('otp');
    } catch {
      setError('Не удалось получить код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json() as VerifySuccess & ErrorPayload;
      if (!response.ok) {
        setError(data.error?.message ?? 'Не удалось войти.');
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError('Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function changePhone() {
    setStep('phone');
    setChallengeId('');
    setTestCode('');
    setCode('');
    setError('');
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.overlay} data-testid="auth-backdrop" onMouseDown={handleBackdrop}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
        <button type="button" className={styles.close} onClick={resetAndClose} aria-label="Закрыть">
          <CloseIcon />
        </button>

        <div className={styles.titleRow}>
          <span className={styles.brandMark}><ShieldIcon /></span>
          <h2 id="auth-title">Вход в KAIDA.KZ</h2>
        </div>

        {step === 'phone' ? (
          <>
            <p id="auth-description" className={styles.description}>Введите номер телефона — получите код подтверждения.</p>
            <form className={styles.form} onSubmit={requestCode} noValidate>
              <div>
                <label className={styles.label} htmlFor="auth-phone">Телефон</label>
                <div className={styles.field}>
                  <span className={styles.fieldIcon}><PhoneIcon /></span>
                  <input
                    id="auth-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+7 700 123 45 67"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={loading}>
                <span>{loading ? 'Получаем…' : 'Получить код'}</span>
                {!loading && <span className={styles.buttonIcon}><ArrowIcon /></span>}
              </button>
            </form>
          </>
        ) : (
          <>
            <p id="auth-description" className={styles.description}>Код для <strong>{canonicalPhone}</strong></p>
            <div className={styles.testCode} role="status">
              <span>Тестовый режим: код показан в интерфейсе</span>
              <strong>Тестовый код: {testCode}</strong>
            </div>
            <form className={styles.form} onSubmit={verifyCode} noValidate>
              <div>
                <label className={styles.label} htmlFor="auth-otp">Код из 6 цифр</label>
                <input
                  id="auth-otp"
                  className={styles.otpInput}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={loading}
                  autoFocus
                />
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={loading || code.length !== 6}>{loading ? 'Входим…' : 'Войти'}</button>
              <button type="button" className={styles.secondary} onClick={changePhone} disabled={loading}>Изменить номер</button>
            </form>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
