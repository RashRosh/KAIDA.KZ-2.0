'use client';

import { FormEvent, MouseEvent, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeKzPhone } from '@/modules/identity/phone/normalize-phone';
import styles from './AuthModal.module.css';
import { useI18n } from '@/i18n/I18nProvider';

type User = { id: string; phone: string };
type ErrorPayload = { error?: { code?: string; message?: string } };
type RequestSuccess = {
  challenge: { id: string; expiresAt: string };
  delivery: { mode: 'test'; code: string };
};
type VerifySuccess = { user: User };

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
  description?: string;
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

// Live display grouping only; normalizeKzPhone already strips spaces/()/- server-side.
function formatKzPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const national = (digits.startsWith('8') || digits.startsWith('7') ? `7${digits.slice(1)}` : `7${digits}`).slice(0, 11);
  const rest = national.slice(1);
  const groups = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);
  return groups.length ? `+7 ${groups.join(' ')}` : '+7';
}

export function AuthModal({ open, onClose, onAuthenticated, description }: AuthModalProps) {
  const { t } = useI18n();
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
        const key = data.error?.code === 'INVALID_PHONE' ? 'error.INVALID_PHONE' : data.error?.code === 'AUTH_UNAVAILABLE' ? 'error.AUTH_UNAVAILABLE' : 'error.requestCode';
        setError(t(key));
        return;
      }
      setCanonicalPhone(normalizeKzPhone(phone));
      setChallengeId(data.challenge.id);
      setTestCode(data.delivery.code);
      setCode('');
      setStep('otp');
    } catch {
      setError(t('error.requestCode'));
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
        const key = data.error?.code === 'INVALID_AUTH_REQUEST' ? 'error.INVALID_AUTH_REQUEST' : data.error?.code === 'INVALID_OTP' ? 'error.INVALID_OTP' : data.error?.code === 'OTP_EXPIRED' ? 'error.OTP_EXPIRED' : data.error?.code === 'AUTH_UNAVAILABLE' ? 'error.AUTH_UNAVAILABLE' : 'error.signIn';
        setError(t(key));
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError(t('error.signIn'));
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
        <button type="button" className={styles.close} onClick={resetAndClose} aria-label={t('auth.close')}>
          <CloseIcon />
        </button>

        <div className={styles.titleRow}>
          <span className={styles.brandMark}><ShieldIcon /></span>
          <h2 id="auth-title">{t('auth.title')}</h2>
        </div>

        {step === 'phone' ? (
          <>
            <p id="auth-description" className={styles.description}>{description ?? t('auth.defaultDescription')}</p>
            <form className={styles.form} onSubmit={requestCode} noValidate>
              <div>
                <label className={styles.label} htmlFor="auth-phone">{t('auth.phone')}</label>
                <div className={styles.field}>
                  <span className={styles.fieldIcon}><PhoneIcon /></span>
                  <input
                    id="auth-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(formatKzPhoneInput(event.target.value))}
                    placeholder="+7 700 123 45 67"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={loading}>
                <span>{loading ? t('auth.gettingCode') : t('auth.getCode')}</span>
                {!loading && <span className={styles.buttonIcon}><ArrowIcon /></span>}
              </button>
            </form>
          </>
        ) : (
          <>
            <p id="auth-description" className={styles.description}>{t('auth.codeFor', { phone: canonicalPhone })}</p>
            <div className={styles.testCode} role="status">
              <span>{t('auth.testMode')}</span>
              <strong>{t('auth.testCode', { code: testCode })}</strong>
            </div>
            <form className={styles.form} onSubmit={verifyCode} noValidate>
              <div>
                <label className={styles.label} htmlFor="auth-otp">{t('auth.otp')}</label>
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
              <button type="submit" className={styles.primary} disabled={loading || code.length !== 6}>{loading ? t('auth.signingIn') : t('auth.signIn')}</button>
              <button type="button" className={styles.secondary} onClick={changePhone} disabled={loading}>{t('auth.changePhone')}</button>
            </form>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
