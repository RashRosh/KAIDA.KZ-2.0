'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { LocationType, LocationView } from '@/modules/locations/contracts/location.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerChangeSetCreate } from './SellerChangeSetCreate';
import { SellerContactSettings } from './SellerContactSettings';
import { SellerOfferManagement } from './SellerOfferManagement';
import styles from '../page.module.css';

type ApiError = { error?: { code?: string; message?: string } };
type SellerResponse = { seller: SellerView | null };
type LocationGeoResponse = { location: LocationView };

const typeLabels: Record<LocationType, string> = {
  market: 'Рынок',
  shop: 'Магазин',
  pavilion: 'Павильон',
  home: 'Домашняя точка',
  other: 'Другое',
};

function browserGeoErrorMessage(error: GeolocationPositionError): string {
  if (error.code === 1) return 'Доступ к геопозиции запрещён. Разрешите его в настройках браузера и попробуйте снова.';
  if (error.code === 2) return 'Не удалось определить местоположение. Проверьте службы геолокации и попробуйте снова.';
  if (error.code === 3) return 'Не удалось определить местоположение за 15 секунд. Попробуйте снова.';
  return 'Не удалось определить местоположение. Попробуйте снова.';
}

export function SellerSetup() {
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('shop');
  const [addressText, setAddressText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [geoBusyLocationId, setGeoBusyLocationId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<{ locationId: string; message: string } | null>(null);

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

  function requestLocationGeo(locationId: string) {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError({ locationId, message: 'Браузер не поддерживает определение местоположения.' });
      return;
    }

    setGeoBusyLocationId(locationId);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const response = await fetch(`/api/seller/locations/${locationId}/geo`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            });
            const data = await response.json() as LocationGeoResponse & ApiError;
            if (!response.ok) {
              setGeoError({ locationId, message: data.error?.message ?? 'Не удалось сохранить местоположение.' });
              return;
            }

            setSeller((current) => current ? {
              ...current,
              locations: current.locations.map((location) => location.id === locationId ? data.location : location),
            } : current);
          } catch {
            setGeoError({ locationId, message: 'Не удалось сохранить местоположение.' });
          } finally {
            setGeoBusyLocationId(null);
          }
        })();
      },
      (geoPositionError) => {
        setGeoBusyLocationId(null);
        setGeoError({ locationId, message: browserGeoErrorMessage(geoPositionError) });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
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
            {seller.locations.map((location) => {
              const geoBusy = geoBusyLocationId === location.id;
              return (
                <article key={location.id} className={styles.locationCard}>
                  <h3>{location.name}</h3>
                  <p>{typeLabels[location.type]}</p>
                  <p>{location.addressText}</p>
                  <p>{location.geo ? 'Местоположение сохранено' : 'Местоположение не задано'}</p>
                  <p>Нажимайте, находясь в точке продажи.</p>
                  {geoError?.locationId === location.id && <p className={styles.error} role="alert">{geoError.message}</p>}
                  <div className={styles.actions}>
                    <button type="button" disabled={geoBusy} onClick={() => requestLocationGeo(location.id)}>
                      {geoBusy ? 'Определяем…' : location.geo ? 'Обновить местоположение' : 'Использовать моё местоположение'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <SellerContactSettings />
        <SellerChangeSetCreate seller={seller} />
        <SellerOfferManagement />
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
