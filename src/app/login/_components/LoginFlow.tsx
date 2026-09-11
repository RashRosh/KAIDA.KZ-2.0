'use client';

import { FormEvent, useState } from 'react';
import { normalizeKzPhone } from '@/modules/identity/phone/normalize-phone';
import styles from '../page.module.css';

type ErrorPayload = { error?: { message?: string } };

type RequestSuccess = {
  challenge: { id: string; expiresAt: string };
  delivery: { mode: 'test'; code: string };
};

export function LoginFlow() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [canonicalPhone, setCanonicalPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [testCode, setTestCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (!response.ok) {
        const data = await response.json() as ErrorPayload;
        setError(data.error?.message ?? 'Не удалось войти.');
        return;
      }
      window.location.assign('/');
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

  return (
    <section className={styles.card} aria-labelledby="login-heading">
      {step === 'phone' ? (
        <form onSubmit={requestCode} noValidate>
          <h2 id="login-heading">Номер телефона</h2>
          <label htmlFor="phone">Телефон</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 700 123 45 67" disabled={loading} />
          <p className={styles.help}>Поддерживается тестовый +7 ввод.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Получаем…' : 'Получить код'}</button>
        </form>
      ) : (
        <form onSubmit={verifyCode} noValidate>
          <h2 id="login-heading">Введите код</h2>
          <p className={styles.phoneLine}>Номер: <strong>{canonicalPhone}</strong></p>
          <div className={styles.testCode} role="status">Тестовый код: <strong>{testCode}</strong></div>
          <label htmlFor="otp">Код из 6 цифр</label>
          <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={loading} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={loading || code.length !== 6}>{loading ? 'Входим…' : 'Войти'}</button>
            <button type="button" className={styles.secondary} onClick={changePhone} disabled={loading}>Изменить номер</button>
          </div>
        </form>
      )}
    </section>
  );
}
