'use client';

import { FormEvent, MouseEvent, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeKzPhone } from '@/modules/identity/phone/normalize-phone';
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

  // buyer-screens-mockup: the sign-in sheet in the mockup's classes (AI-B04 · Auth); flows, texts and ids unchanged.
  // It is portalled to the page body, so it carries its own .kaida frame (kaida-app.css .kaida-portal).
  return createPortal(
    <div className="kaida kaida-portal">
      <div className="portal-col">
        <div className="scrim" data-testid="auth-backdrop" onMouseDown={handleBackdrop} />
        <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
          <div className="grab" />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2 className="h3" id="auth-title" style={{ flex: 1 }}>{t('auth.title')}</h2>
            <button type="button" className="ib" onClick={resetAndClose} aria-label={t('auth.close')}><span className="ic i-close" aria-hidden="true" /></button>
          </div>

          {step === 'phone' ? (
            <>
              <p id="auth-description" className="c c2">{description ?? t('auth.defaultDescription')}</p>
              <form onSubmit={requestCode} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="fld">
                  <label htmlFor="auth-phone">{t('auth.phone')}</label>
                  <input
                    id="auth-phone"
                    className="inp"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(formatKzPhoneInput(event.target.value))}
                    placeholder="+7 700 123 45 67"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                {error && <div className="fld"><p className="emsg" role="alert"><span className="ic i-alert" aria-hidden="true" />{error}</p></div>}
                <button type="submit" className="btn btn-p lg w" disabled={loading}>{loading ? t('auth.gettingCode') : t('auth.getCode')}</button>
              </form>
            </>
          ) : (
            <>
              <p id="auth-description" className="c c2">{t('auth.codeFor', { phone: canonicalPhone })}</p>
              <div className="banner info" role="status" style={{ padding: '10px 12px', borderRadius: 12, gap: 2 }}>
                <span className="c">{t('auth.testMode')}</span>
                <strong className="ts">{t('auth.testCode', { code: testCode })}</strong>
              </div>
              <form onSubmit={verifyCode} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="fld">
                  <label htmlFor="auth-otp">{t('auth.otp')}</label>
                  <input
                    id="auth-otp"
                    className="inp otp"
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
                {error && <div className="fld"><p className="emsg" role="alert"><span className="ic i-alert" aria-hidden="true" />{error}</p></div>}
                <button type="submit" className="btn btn-p lg w" disabled={loading || code.length !== 6}>{loading ? t('auth.signingIn') : t('auth.signIn')}</button>
                <button type="button" className="btn btn-g w" onClick={changePhone} disabled={loading}>{t('auth.changePhone')}</button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}
