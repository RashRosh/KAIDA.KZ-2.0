'use client';

import { FormEvent, useState } from 'react';
import type { LocationType, LocationView } from '@/modules/locations/contracts/location.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { ClearableInput } from './ClearableInput';
import styles from '../page.module.css';

type ApiError = { error?: { message?: string } };
type LocationResponse = { location?: LocationView } & ApiError;
type SellerResponse = { seller?: SellerView } & ApiError;

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

type Props = {
  seller: SellerView | null;
  onSellerChange: (seller: SellerView) => void;
  autoOpenAdd?: boolean;
  onLocationCreated?: () => void;
};

export function SellerTradingPoints({ seller, onSellerChange, autoOpenAdd = false, onLocationCreated }: Props) {
  const locations = seller?.locations ?? [];
  const [mode, setMode] = useState<'closed' | 'add' | 'edit'>(() => autoOpenAdd && locations.length === 0 ? 'add' : 'closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sellerDisplayName, setSellerDisplayName] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('shop');
  const [addressText, setAddressText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [geoBusyId, setGeoBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  function resetForm() {
    setName('');
    setType('shop');
    setAddressText('');
    setEditingId(null);
    setError('');
  }

  function beginAdd() {
    resetForm();
    setStatus('');
    setMode('add');
  }

  function beginEdit(location: LocationView) {
    setName(location.name);
    setType(location.type);
    setAddressText(location.addressText);
    setEditingId(location.id);
    setError('');
    setStatus('');
    setMode('edit');
  }

  function closeForm() {
    resetForm();
    setMode('closed');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStatus('');
    const normalizedName = name.trim();
    const normalizedAddress = addressText.trim();
    if (!normalizedName) {
      setError('Укажите название торговой точки.');
      return;
    }
    if (!normalizedAddress) {
      setError('Укажите адрес торговой точки.');
      return;
    }

    const previous = mode === 'edit' ? locations.find((location) => location.id === editingId) : undefined;
    setSubmitting(true);
    try {
      const firstSetup = !seller;
      const response = await fetch(firstSetup ? '/api/seller/setup' : mode === 'edit' ? `/api/seller/locations/${editingId}` : '/api/seller/locations', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firstSetup
          ? { seller: { displayName: sellerDisplayName.trim() || normalizedName }, location: { name: normalizedName, type, addressText: normalizedAddress } }
          : { name: normalizedName, type, addressText: normalizedAddress }),
      });
      const data = await response.json() as LocationResponse & SellerResponse;
      const savedSeller = firstSetup ? data.seller : null;
      const savedLocation = firstSetup ? savedSeller?.locations[0] : data.location;
      if (!response.ok || !savedLocation) {
        setError(data.error?.message ?? 'Не удалось сохранить торговую точку.');
        return;
      }

      const nextSeller = savedSeller ?? {
        ...seller!,
        locations: mode === 'edit'
          ? locations.map((location) => location.id === savedLocation.id ? savedLocation : location)
          : [...locations, savedLocation],
      };
      onSellerChange(nextSeller);
      const addressChangedWithGeo = Boolean(previous?.geo && previous.addressText !== savedLocation.addressText);
      setStatus(addressChangedWithGeo
        ? 'Данные точки сохранены. Сохранённая геопозиция не изменилась: обновите её отдельно, если точка переехала.'
        : mode === 'edit' ? 'Торговая точка сохранена.' : 'Торговая точка добавлена.');
      const created = mode === 'add';
      closeForm();
      if (created) onLocationCreated?.();
    } catch {
      setError('Не удалось сохранить торговую точку.');
    } finally {
      setSubmitting(false);
    }
  }

  function requestGeo(locationId: string) {
    setError('');
    setStatus('');
    if (!navigator.geolocation) {
      setError('Браузер не поддерживает определение местоположения.');
      return;
    }

    setGeoBusyId(locationId);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const response = await fetch(`/api/seller/locations/${locationId}/geo`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            });
            const data = await response.json() as LocationResponse;
            if (!response.ok || !data.location) {
              setError(data.error?.message ?? 'Не удалось сохранить местоположение.');
              return;
            }
            onSellerChange({
              ...seller!,
              locations: locations.map((location) => location.id === locationId ? data.location! : location),
            });
            setStatus('Местоположение сохранено.');
          } catch {
            setError('Не удалось сохранить местоположение.');
          } finally {
            setGeoBusyId(null);
          }
        })();
      },
      (geoError) => {
        setGeoBusyId(null);
        setError(browserGeoErrorMessage(geoError));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <section className={styles.card} aria-labelledby="seller-trading-points-heading">
      <p className={styles.eyebrow}>Рабочий кабинет</p>
      <h2 id="seller-trading-points-heading">Торговые точки</h2>
      <p className={styles.muted}>Выберите карточку, чтобы изменить данные точки. Контакты покупателей общие для всех точек.</p>

      {locations.length === 0 && mode === 'closed' && (
        <p className={styles.emptyState}>Пока нет торговых точек. Добавьте первую, чтобы привязывать к ней товары.</p>
      )}

      <div className={styles.tradingPointGrid}>
        {locations.map((location) => (
          <article key={location.id} className={styles.tradingPointCard} data-testid={`trading-point-${location.id}`}>
            <button type="button" className={styles.tradingPointMain} onClick={() => beginEdit(location)} aria-label={`Изменить торговую точку ${location.name}`}>
              <span className={styles.tradingPointTitle}>{location.name}</span>
              <span>{typeLabels[location.type]}</span>
              <span>{location.addressText}</span>
              <span className={styles.geoBadge}>{location.geo ? 'Местоположение сохранено' : 'Местоположение не задано'}</span>
            </button>
            <div className={styles.tradingPointActions}>
              <button type="button" className={styles.secondaryButton} disabled={geoBusyId === location.id} onClick={() => requestGeo(location.id)}>
                {geoBusyId === location.id ? 'Определяем…' : location.geo ? 'Обновить местоположение' : 'Использовать моё местоположение'}
              </button>
            </div>
          </article>
        ))}
        <button type="button" className={styles.addTradingPointCard} onClick={beginAdd} aria-label="Добавить торговую точку">
          <span aria-hidden="true">+</span>
          <strong>Добавить точку</strong>
        </button>
      </div>

      {mode !== 'closed' && (
        <form className={styles.locationEditor} onSubmit={submit} noValidate aria-labelledby="location-editor-heading">
          <h3 id="location-editor-heading">{mode === 'edit' ? 'Изменить торговую точку' : 'Новая торговая точка'}</h3>
          <div className={styles.formGrid}>
            {!seller && (
              <div className={styles.field}>
                <label htmlFor="seller-display-name">Имя</label>
                <ClearableInput id="seller-display-name" value={sellerDisplayName} onValueChange={setSellerDisplayName} clearLabel="Имя" maxLength={120} disabled={submitting} autoComplete="name" />
                <span className={styles.fieldHelp}>Как к вам будут обращаться покупатели. Можно оставить пустым.</span>
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor="trading-location-name">Название торговой точки <span aria-hidden="true">*</span></label>
              <ClearableInput id="trading-location-name" value={name} onValueChange={setName} clearLabel="Название торговой точки" maxLength={120} disabled={submitting} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="trading-location-type">Тип торговой точки <span aria-hidden="true">*</span></label>
              <select id="trading-location-type" value={type} onChange={(event) => setType(event.target.value as LocationType)} disabled={submitting} required>
                <option value="market">Рынок</option>
                <option value="shop">Магазин</option>
                <option value="pavilion">Павильон</option>
                <option value="home">Домашняя точка</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="trading-location-address">Адрес <span aria-hidden="true">*</span></label>
              <ClearableInput id="trading-location-address" value={addressText} onValueChange={setAddressText} clearLabel="Адрес" maxLength={500} disabled={submitting} autoComplete="street-address" required />
            </div>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={submitting}>{submitting ? 'Сохраняем…' : 'Сохранить точку'}</button>
            <button type="button" className={styles.secondaryButton} onClick={closeForm} disabled={submitting}>Отмена</button>
          </div>
        </form>
      )}

      {mode === 'closed' && error && <p className={styles.error} role="alert">{error}</p>}
      {status && <p className={styles.status} role="status">{status}</p>}
    </section>
  );
}
