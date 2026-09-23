'use client';

import { FormEvent, useState } from 'react';
import type { LocationType, LocationView } from '@/modules/locations/contracts/location.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { ClearableInput } from './ClearableInput';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

type ApiError = { error?: { message?: string } };
type LocationResponse = { location?: LocationView } & ApiError;
type SellerResponse = { seller?: SellerView } & ApiError;

const typeLabelKeys: Record<LocationType, MessageKey> = {
  market: 'points.type.market', shop: 'points.type.shop', pavilion: 'points.type.pavilion', home: 'points.type.home', other: 'points.type.other',
};

function browserGeoErrorKey(error: GeolocationPositionError): MessageKey {
  if (error.code === 1) return 'points.geoDenied';
  if (error.code === 2) return 'points.geoUnavailable';
  if (error.code === 3) return 'points.geoTimeout';
  return 'points.geoGeneric';
}

type Props = {
  seller: SellerView | null;
  onSellerChange: (seller: SellerView) => void;
  autoOpenAdd?: boolean;
  onLocationCreated?: () => void;
};

export function SellerTradingPoints({ seller, onSellerChange, autoOpenAdd = false, onLocationCreated }: Props) {
  const { t } = useI18n();
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
      setError(t('points.nameRequired'));
      return;
    }
    if (!normalizedAddress) {
      setError(t('points.addressRequired'));
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
        setError(t('points.saveError'));
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
        ? t('points.addressGeoWarning')
        : mode === 'edit' ? t('points.saved') : t('points.added'));
      const created = mode === 'add';
      closeForm();
      if (created) onLocationCreated?.();
    } catch {
      setError(t('points.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  function requestGeo(locationId: string) {
    setError('');
    setStatus('');
    if (!navigator.geolocation) {
      setError(t('points.unsupported'));
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
              setError(t('points.geoSaveError'));
              return;
            }
            onSellerChange({
              ...seller!,
              locations: locations.map((location) => location.id === locationId ? data.location! : location),
            });
            setStatus(t('points.geoSaved'));
          } catch {
            setError(t('points.geoSaveError'));
          } finally {
            setGeoBusyId(null);
          }
        })();
      },
      (geoError) => {
        setGeoBusyId(null);
        setError(t(browserGeoErrorKey(geoError)));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <section className={styles.card} aria-labelledby="seller-trading-points-heading">
      <p className={styles.eyebrow}>{t('points.eyebrow')}</p>
      <h2 id="seller-trading-points-heading">{t('points.title')}</h2>
      <p className={styles.muted}>{t('points.description')}</p>

      {locations.length === 0 && mode === 'closed' && (
        <p className={styles.emptyState}>{t('points.empty')}</p>
      )}

      <div className={styles.tradingPointGrid}>
        {locations.map((location) => (
          <article key={location.id} className={styles.tradingPointCard} data-testid={`trading-point-${location.id}`}>
            <button type="button" className={styles.tradingPointMain} onClick={() => beginEdit(location)} aria-label={t('points.editNamed', { name: location.name })}>
              <span className={styles.tradingPointTitle}>{location.name}</span>
              <span>{t(typeLabelKeys[location.type])}</span>
              <span>{location.addressText}</span>
              <span className={styles.geoBadge}>{location.geo ? t('points.geoSaved') : t('points.geoNotSet')}</span>
            </button>
            <div className={styles.tradingPointActions}>
              <button type="button" className={styles.secondaryButton} disabled={geoBusyId === location.id} onClick={() => requestGeo(location.id)}>
                {geoBusyId === location.id ? t('points.locating') : location.geo ? t('points.geoUpdate') : t('points.geoUseMine')}
              </button>
            </div>
          </article>
        ))}
        <button type="button" className={styles.addTradingPointCard} onClick={beginAdd} aria-label={t('points.add')}>
          <span aria-hidden="true">+</span>
          <strong>{t('points.addShort')}</strong>
        </button>
      </div>

      {mode !== 'closed' && (
        <form className={styles.locationEditor} onSubmit={submit} noValidate aria-labelledby="location-editor-heading">
          <h3 id="location-editor-heading">{mode === 'edit' ? t('points.edit') : t('points.new')}</h3>
          <div className={styles.formGrid}>
            {!seller && (
              <div className={styles.field}>
                <label htmlFor="seller-display-name">{t('points.sellerName')}</label>
                <ClearableInput id="seller-display-name" value={sellerDisplayName} onValueChange={setSellerDisplayName} clearLabel={t('points.sellerName')} maxLength={120} disabled={submitting} autoComplete="name" />
                <span className={styles.fieldHelp}>{t('points.sellerNameHelp')}</span>
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor="trading-location-name">{t('points.name')} <span aria-hidden="true">*</span></label>
              <ClearableInput id="trading-location-name" value={name} onValueChange={setName} clearLabel={t('points.name')} maxLength={120} disabled={submitting} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="trading-location-type">{t('points.type')} <span aria-hidden="true">*</span></label>
              <select id="trading-location-type" value={type} onChange={(event) => setType(event.target.value as LocationType)} disabled={submitting} required>
                <option value="market">{t('points.type.market')}</option>
                <option value="shop">{t('points.type.shop')}</option>
                <option value="pavilion">{t('points.type.pavilion')}</option>
                <option value="home">{t('points.type.home')}</option>
                <option value="other">{t('points.type.other')}</option>
              </select>
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="trading-location-address">{t('points.address')} <span aria-hidden="true">*</span></label>
              <ClearableInput id="trading-location-address" value={addressText} onValueChange={setAddressText} clearLabel={t('points.address')} maxLength={500} disabled={submitting} autoComplete="street-address" required />
            </div>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={submitting}>{submitting ? t('points.saving') : t('points.save')}</button>
            <button type="button" className={styles.secondaryButton} onClick={closeForm} disabled={submitting}>{t('offerManage.cancel')}</button>
          </div>
        </form>
      )}

      {mode === 'closed' && error && <p className={styles.error} role="alert">{error}</p>}
      {status && <p className={styles.status} role="status">{status}</p>}
    </section>
  );
}
