'use client';

import { FormEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeKzPhone } from '@/modules/identity/phone/normalize-phone';
import { useI18n } from '@/i18n/I18nProvider';

type User = { id: string; phone: string };
type ErrorPayload = { error?: { code?: string; message?: string; retryAfterSeconds?: number } };
type RequestSuccess = {
  challenge: { id: string; expiresAt: string };
  delivery: { mode: 'test'; code: string };
  retryAfterSeconds: number;
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
  const [unusableCode, setUnusableCode] = useState(false);
  const [retryPhone, setRetryPhone] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const operation = useRef(0);
  const pending = useRef(false);
  const invalidateOperation = useCallback(() => { operation.current++; pending.current = false; }, []);
  let phoneKey = '';
  try { phoneKey = normalizeKzPhone(step === 'otp' ? canonicalPhone : phone); } catch { /* Existing input validation handles this. */ }
  const wait = phoneKey === retryPhone ? remaining : 0;

  function recordWait(seconds: number | undefined, requestedPhone: string) {
    if (!Number.isSafeInteger(seconds) || !seconds || seconds < 0) return;
    setRetryPhone(requestedPhone);
    setRetryAt(Date.now() + seconds * 1000);
    setRemaining(seconds);
  }

  useEffect(() => {
    if (!open) { invalidateOperation(); return; }
    return invalidateOperation;
  }, [open, invalidateOperation]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [open, retryAt]);

  const resetAndClose = useCallback(() => {
    operation.current++;
    pending.current = false;
    setUnusableCode(false);
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

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (pending.current || wait > 0) return;
    const requestedPhone = step === 'otp' ? canonicalPhone : phone;
    let normalizedPhone: string;
    try { normalizedPhone = normalizeKzPhone(requestedPhone); } catch { setError(t('error.INVALID_PHONE')); return; }
    const current = ++operation.current;
    pending.current = true;
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: requestedPhone }),
      });
      const data = await response.json() as RequestSuccess & ErrorPayload;
      if (current !== operation.current) return;
      if (!response.ok) {
        if (data.error?.code === 'OTP_REQUEST_THROTTLED') {
          recordWait(data.error.retryAfterSeconds, normalizedPhone);
          setError(t('error.OTP_REQUEST_THROTTLED'));
          return;
        }
        if (response.status >= 500 && step === 'otp') {
          setUnusableCode(true); setTestCode(''); setError(t('error.requestCodeUncertain')); return;
        }
        const key = data.error?.code === 'INVALID_PHONE' ? 'error.INVALID_PHONE' : data.error?.code === 'AUTH_UNAVAILABLE' ? 'error.AUTH_UNAVAILABLE' : 'error.requestCode';
        setError(t(key));
        return;
      }
      setCanonicalPhone(normalizedPhone);
      setChallengeId(data.challenge.id);
      setTestCode(data.delivery.code);
      setCode('');
      setUnusableCode(false);
      recordWait(data.retryAfterSeconds, normalizedPhone);
      setStep('otp');
    } catch {
      if (current !== operation.current) return;
      if (step === 'otp') { setUnusableCode(true); setTestCode(''); }
      setError(t('error.requestCodeUncertain'));
    } finally {
      if (current === operation.current) { pending.current = false; setLoading(false); }
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || unusableCode) return;
    const current = ++operation.current;
    pending.current = true;
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json() as VerifySuccess & ErrorPayload;
      if (current !== operation.current) return;
      if (!response.ok) {
        const terminal = {
          OTP_ATTEMPTS_EXHAUSTED: 'error.OTP_ATTEMPTS_EXHAUSTED', OTP_EXPIRED: 'error.OTP_EXPIRED',
          OTP_NOT_ACTIVE: 'error.OTP_NOT_ACTIVE', INVALID_OTP_CHALLENGE: 'error.INVALID_OTP_CHALLENGE',
        } as const;
        if (data.error?.code && Object.hasOwn(terminal, data.error.code)) {
          setUnusableCode(true);
          setError(t(terminal[data.error.code as keyof typeof terminal]));
          return;
        }
        const key = data.error?.code === 'INVALID_AUTH_REQUEST' ? 'error.INVALID_AUTH_REQUEST' : data.error?.code === 'INVALID_OTP' ? 'error.INVALID_OTP' : data.error?.code === 'OTP_EXPIRED' ? 'error.OTP_EXPIRED' : data.error?.code === 'AUTH_UNAVAILABLE' ? 'error.AUTH_UNAVAILABLE' : 'error.signIn';
        setError(t(key));
        return;
      }
      onAuthenticated(data.user);
    } catch {
      if (current === operation.current) setError(t('error.signIn'));
    } finally {
      if (current === operation.current) { pending.current = false; setLoading(false); }
    }
  }

  function changePhone() {
    operation.current++;
    pending.current = false;
    setUnusableCode(false);
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
                {wait > 0 && <p className="c c2" role="status">{t('auth.resendWait', { seconds: wait })}</p>}
                <button type="submit" className="btn btn-p lg w" disabled={loading || wait > 0}>{loading ? t('auth.gettingCode') : t('auth.getCode')}</button>
              </form>
            </>
          ) : (
            <>
              <p id="auth-description" className="c c2">{t('auth.codeFor', { phone: canonicalPhone })}</p>
              <div className="banner info" role="status" style={{ padding: '10px 12px', borderRadius: 12, gap: 2 }}>
                <span className="c">{t('auth.testMode')}</span>
                {testCode && <strong className="ts">{t('auth.testCode', { code: testCode })}</strong>}
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
                    disabled={loading || unusableCode}
                    autoFocus
                  />
                </div>
                {error && <div className="fld"><p className="emsg" role="alert"><span className="ic i-alert" aria-hidden="true" />{error}</p></div>}
                <button type="submit" className="btn btn-p lg w" disabled={loading || unusableCode || code.length !== 6}>{loading ? t('auth.signingIn') : t('auth.signIn')}</button>
                {wait > 0 && <p className="c c2" role="status">{t('auth.resendWait', { seconds: wait })}</p>}
                <button type="button" className="btn btn-g w" onClick={() => void requestCode()} disabled={loading || wait > 0}>{loading ? t('auth.gettingCode') : t('auth.resendCode')}</button>
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
