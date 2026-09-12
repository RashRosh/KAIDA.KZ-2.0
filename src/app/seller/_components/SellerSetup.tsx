'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { LocationType } from '@/modules/locations/contracts/location.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerChangeSetCreate } from './SellerChangeSetCreate';
import styles from '../page.module.css';

type ApiError = { error?: { code?: string; message?: string } };
type SellerResponse = { seller: SellerView | null };

const typeLabels: Record<LocationType, string> = {
  market: 'Рынок',
  shop: 'Магазин',
  pavilion: 'Павильон',
  home: 'Домашняя точка',
  other: 'Другое',
};

export function SellerSetup() {
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('shop');
  const [addressText, setAddressText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/seller/me', { cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) {
          setState('anonymous');
          return;
        }
        const data = await response.json() as SellerResponse & ApiError;
        if (!response.ok) {
          setError(data.error?.message ?? 'Не удалось загрузить данные продавца.');
          setState('ready');
          return;
        }
        setSeller(data.seller);
        setState('ready');
      } catch {
        if (!active) return;
        setError('Не удалось загрузить данные продавца.');
        setState('ready');
      }
    })();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/seller/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller: { displayName },
          location: { name: locationName, type: locationType, addressText },
        }),
      });
      const data = await response.json() as SellerResponse & ApiError;
      if (!response.ok) {
        if (data.error?.code === 'SELLER_ALREADY_EXISTS') {
          setError('Продавец уже создан. Обновите страницу, чтобы загрузить его данные.');
        } else {
          setError(data.error?.message ?? 'Не удалось сохранить данные продавца.');
        }
        return;
      }
      setSeller(data.seller);
    } catch {
      setError('Не удалось сохранить данные продавца.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') return <section className={styles.card}><p>Загружаем…</p></section>;

  if (state === 'anonymous') {
    return (
      <section className={styles.card}>
        <h2>Нужно войти</h2>
        <p>Чтобы создать продавца и первую точку, войдите по телефону.</p>
        <Link className={styles.primaryLink} href="/login">Войти</Link>
      </section>
    );
  }

  if (seller) {
    return (
      <div className={styles.stack}>
        <section className={styles.card} aria-labelledby="seller-summary-heading">
          <p className={styles.eyebrow}>Продавец создан</p>
          <h2 id="seller-summary-heading">{seller.displayName}</h2>
          <div className={styles.locations}>
            {seller.locations.map((location) => (
              <article key={location.id} className={styles.locationCard}>
                <h3>{location.name}</h3>
                <p>{typeLabels[location.type]}</p>
                <p>{location.addressText}</p>
              </article>
            ))}
          </div>
        </section>
        <SellerChangeSetCreate seller={seller} />
      </div>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="seller-setup-heading">
      <p className={styles.eyebrow}>Первичная настройка</p>
      <h2 id="seller-setup-heading">Продавец и первая точка</h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label htmlFor="seller-display-name">Название продавца</label>
        <input id="seller-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} disabled={submitting} />

        <label htmlFor="location-name">Название точки</label>
        <input id="location-name" value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={120} disabled={submitting} />

        <label htmlFor="location-type">Тип точки</label>
        <select id="location-type" value={locationType} onChange={(event) => setLocationType(event.target.value as LocationType)} disabled={submitting}>
          <option value="market">Рынок</option>
          <option value="shop">Магазин</option>
          <option value="pavilion">Павильон</option>
          <option value="home">Домашняя точка</option>
          <option value="other">Другое</option>
        </select>

        <label htmlFor="location-address">Адрес</label>
        <textarea id="location-address" value={addressText} onChange={(event) => setAddressText(event.target.value)} maxLength={500} rows={4} disabled={submitting} />

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? 'Сохраняем…' : 'Создать продавца'}</button>
      </form>
    </section>
  );
}
