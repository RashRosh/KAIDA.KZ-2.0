'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { LocationType, LocationView } from '@/modules/locations/contracts/location.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerChangeSetCreate } from './SellerChangeSetCreate';
import { SellerContactSettings } from './SellerContactSettings';
import { SellerOfferManagement } from './SellerOfferManagement';
import styles from '../page.module.css';

type ApiError = { error?: { code?: string; message?: string } };
type SellerResponse = { seller: SellerView | null };
type LocationGeoResponse = { location: LocationView };
type OwnerContacts = {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};
type ContactsResponse = { contacts: OwnerContacts };

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

function nullableCanonical(value: string, lowercase = false): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

export function SellerSetup() {
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('shop');
  const [addressText, setAddressText] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [whatsappPhoneE164, setWhatsappPhoneE164] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsLoadError, setContactsLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);
  const [geoBusyLocationId, setGeoBusyLocationId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<{ locationId: string; message: string } | null>(null);

  function applyContacts(contacts: OwnerContacts) {
    setPhoneE164(contacts.phoneE164 ?? '');
    setWhatsappPhoneE164(contacts.whatsappPhoneE164 ?? '');
    setTelegramUsername(contacts.telegramUsername ?? '');
    setInstagramUsername(contacts.instagramUsername ?? '');
  }

  function contactPayload(): OwnerContacts {
    return {
      phoneE164: nullableCanonical(phoneE164),
      whatsappPhoneE164: nullableCanonical(whatsappPhoneE164),
      telegramUsername: nullableCanonical(telegramUsername, true),
      instagramUsername: nullableCanonical(instagramUsername, true),
    };
  }

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

        if (data.seller) {
          const contactsResponse = await fetch('/api/seller/contacts', { cache: 'no-store' });
          const contactsData = await contactsResponse.json() as ContactsResponse & ApiError;
          if (!active) return;
          if (!contactsResponse.ok) {
            setContactsLoadError(contactsData.error?.message ?? 'Не удалось загрузить контакты.');
          } else {
            applyContacts(contactsData.contacts);
            setContactsLoaded(true);
          }
        }
        setState('ready');
      } catch {
        if (!active) return;
        setError('Не удалось загрузить данные продавца.');
        setState('ready');
      }
    })();
    return () => { active = false; };
  }, []);

  const firstLocation = seller?.locations[0] ?? null;
  const phoneReady = nullableCanonical(phoneE164) !== null;
  const geoReady = Boolean(firstLocation?.geo);
  const onboardingComplete = Boolean(seller && firstLocation && contactsLoaded && phoneReady && geoReady);

  const progress = useMemo(() => [
    { label: 'Точка продажи', done: Boolean(seller && firstLocation) },
    { label: 'Контакты', done: Boolean(contactsLoaded && phoneReady) },
    { label: 'Местоположение', done: geoReady },
  ], [contactsLoaded, firstLocation, geoReady, phoneReady, seller]);

  async function saveContacts(payload: OwnerContacts): Promise<boolean> {
    const response = await fetch('/api/seller/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as ContactsResponse & ApiError;
    if (!response.ok) {
      setError(data.error?.message ?? 'Не удалось сохранить контакты.');
      return false;
    }
    applyContacts(data.contacts);
    setContactsLoaded(true);
    return true;
  }

  async function submitInitial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const contacts = contactPayload();
    if (!contacts.phoneE164) {
      setError('Укажите телефон для покупателей.');
      return;
    }

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
          setError('Продавец уже создан. Обновите страницу, чтобы продолжить настройку.');
        } else {
          setError(data.error?.message ?? 'Не удалось сохранить данные продавца.');
        }
        return;
      }

      setSeller(data.seller);
      const contactsSaved = await saveContacts(contacts);
      if (!contactsSaved) {
        setContactsLoaded(true);
        setError('Точка сохранена, но контакты не сохранились. Проверьте данные и повторите сохранение контактов.');
        return;
      }
      setSuccess('Точка и контакты сохранены. Осталось указать местоположение.');
    } catch {
      setError('Не удалось сохранить данные продавца.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitContacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const contacts = contactPayload();
    if (!contacts.phoneE164) {
      setError('Укажите телефон для покупателей.');
      return;
    }
    setSavingContacts(true);
    try {
      if (await saveContacts(contacts)) setSuccess('Контакты сохранены.');
    } catch {
      setError('Не удалось сохранить контакты.');
    } finally {
      setSavingContacts(false);
    }
  }

  function requestLocationGeo(locationId: string) {
    setGeoError(null);
    setError('');
    setSuccess('');

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
            setSuccess('Местоположение сохранено. Настройка завершена.');
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
        <p className={styles.muted}>Чтобы создать продавца и первую точку, войдите по телефону.</p>
        <Link className={styles.primaryLink} href="/login">Войти</Link>
      </section>
    );
  }

  if (seller && !contactsLoaded) {
    return (
      <section className={styles.card}>
        <p className={styles.eyebrow}>Настройка продавца</p>
        <h2>{contactsLoadError ? 'Не удалось продолжить настройку' : 'Загружаем контакты…'}</h2>
        {contactsLoadError && <p className={styles.error} role="alert">{contactsLoadError} Обновите страницу и попробуйте снова.</p>}
      </section>
    );
  }

  if (onboardingComplete && firstLocation) {
    return (
      <div className={styles.stack}>
        <section className={styles.card} aria-labelledby="seller-summary-heading">
          <p className={styles.eyebrow}>Настройка завершена</p>
          <div className={styles.completedHeader}>
            <div>
              <h2 id="seller-summary-heading">{seller.displayName}</h2>
              <p className={styles.muted}>Точка готова к buyer-facing предложениям.</p>
            </div>
            <Link className={styles.secondaryLinkButton} href="/seller/batch">Изменить несколько товаров</Link>
          </div>
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
    <section className={styles.onboardingLayout} aria-labelledby="seller-onboarding-heading">
      <aside className={styles.onboardingGuide}>
        <p className={styles.eyebrow}>Первичная настройка</p>
        <h2 id="seller-onboarding-heading">Подготовим точку к публикации</h2>
        <p className={styles.muted}>Один раз укажите данные точки, контакты и её местоположение. После этого можно переходить к товарам.</p>
        <ol className={styles.progressList} aria-label="Шаги настройки продавца">
          {progress.map((item, index) => (
            <li key={item.label} data-done={item.done ? 'true' : 'false'}>
              <span className={styles.progressNumber} aria-hidden="true">{item.done ? '✓' : index + 1}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ol>
      </aside>

      <div className={styles.onboardingPanel}>
        {!seller ? (
          <form className={styles.onboardingForm} onSubmit={submitInitial} noValidate>
            <fieldset className={styles.formSection}>
              <legend>Точка продажи</legend>
              <p className={styles.sectionHint}>Как покупатель увидит продавца и где находится первая точка.</p>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="seller-display-name">Название продавца</label>
                  <input id="seller-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} disabled={submitting} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="location-name">Название точки</label>
                  <input id="location-name" value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={120} disabled={submitting} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="location-type">Тип точки</label>
                  <select id="location-type" value={locationType} onChange={(event) => setLocationType(event.target.value as LocationType)} disabled={submitting}>
                    <option value="market">Рынок</option>
                    <option value="shop">Магазин</option>
                    <option value="pavilion">Павильон</option>
                    <option value="home">Домашняя точка</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="location-address">Адрес</label>
                  <textarea id="location-address" value={addressText} onChange={(event) => setAddressText(event.target.value)} maxLength={500} rows={3} disabled={submitting} />
                </div>
              </div>
            </fieldset>

            <fieldset className={styles.formSection}>
              <legend>Контакты для покупателей</legend>
              <p className={styles.sectionHint}>Телефон обязателен для показа предложений. Мессенджеры можно добавить сейчас или позже.</p>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-phone">Телефон</label>
                  <input id="seller-contact-phone" value={phoneE164} onChange={(event) => setPhoneE164(event.target.value)} maxLength={16} disabled={submitting} autoComplete="tel" placeholder="+77001234567" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-whatsapp">WhatsApp</label>
                  <input id="seller-contact-whatsapp" value={whatsappPhoneE164} onChange={(event) => setWhatsappPhoneE164(event.target.value)} maxLength={16} disabled={submitting} inputMode="tel" placeholder="+77001234567" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-telegram">Telegram</label>
                  <input id="seller-contact-telegram" value={telegramUsername} onChange={(event) => setTelegramUsername(event.target.value)} maxLength={64} disabled={submitting} autoCapitalize="none" placeholder="kaida_shop" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-instagram">Instagram</label>
                  <input id="seller-contact-instagram" value={instagramUsername} onChange={(event) => setInstagramUsername(event.target.value)} maxLength={64} disabled={submitting} autoCapitalize="none" placeholder="kaida.shop" />
                </div>
              </div>
            </fieldset>

            <div className={styles.pendingGeo}>
              <strong>Местоположение</strong>
              <span>После сохранения точки вы сможете определить её геопозицию одним нажатием.</span>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
            {success && <p className={styles.status} role="status">{success}</p>}
            <div className={styles.onboardingActions}>
              <button type="submit" disabled={submitting}>{submitting ? 'Сохраняем…' : 'Сохранить и продолжить'}</button>
            </div>
          </form>
        ) : firstLocation ? (
          <div className={styles.onboardingForm}>
            <section className={styles.formSection} aria-labelledby="saved-location-heading">
              <h3 id="saved-location-heading">Точка продажи</h3>
              <div className={styles.savedSummary}>
                <div><span>Продавец</span><strong>{seller.displayName}</strong></div>
                <div><span>Точка</span><strong>{firstLocation.name}</strong></div>
                <div><span>Тип</span><strong>{typeLabels[firstLocation.type]}</strong></div>
                <div className={styles.savedSummaryWide}><span>Адрес</span><strong>{firstLocation.addressText}</strong></div>
              </div>
            </section>

            <form className={styles.formSection} onSubmit={submitContacts} noValidate aria-labelledby="onboarding-contacts-heading">
              <h3 id="onboarding-contacts-heading">Контакты для покупателей</h3>
              <p className={styles.sectionHint}>Телефон обязателен. Остальные каналы можно оставить пустыми.</p>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-phone">Телефон</label>
                  <input id="seller-contact-phone" value={phoneE164} onChange={(event) => setPhoneE164(event.target.value)} maxLength={16} disabled={savingContacts} autoComplete="tel" placeholder="+77001234567" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-whatsapp">WhatsApp</label>
                  <input id="seller-contact-whatsapp" value={whatsappPhoneE164} onChange={(event) => setWhatsappPhoneE164(event.target.value)} maxLength={16} disabled={savingContacts} inputMode="tel" placeholder="+77001234567" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-telegram">Telegram</label>
                  <input id="seller-contact-telegram" value={telegramUsername} onChange={(event) => setTelegramUsername(event.target.value)} maxLength={64} disabled={savingContacts} autoCapitalize="none" placeholder="kaida_shop" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="seller-contact-instagram">Instagram</label>
                  <input id="seller-contact-instagram" value={instagramUsername} onChange={(event) => setInstagramUsername(event.target.value)} maxLength={64} disabled={savingContacts} autoCapitalize="none" placeholder="kaida.shop" />
                </div>
              </div>
              <div className={styles.onboardingActions}>
                <button type="submit" disabled={savingContacts}>{savingContacts ? 'Сохраняем…' : 'Сохранить контакты'}</button>
              </div>
            </form>

            <section className={styles.formSection} aria-labelledby="onboarding-geo-heading">
              <h3 id="onboarding-geo-heading">Местоположение</h3>
              <p className={styles.sectionHint}>Нажмите кнопку, находясь в точке продажи. Браузер спросит разрешение только после вашего нажатия.</p>
              <p className={styles.geoState}>{firstLocation.geo ? 'Местоположение сохранено' : 'Местоположение не задано'}</p>
              {geoError?.locationId === firstLocation.id && <p className={styles.error} role="alert">{geoError.message}</p>}
              <div className={styles.onboardingActions}>
                <button type="button" disabled={geoBusyLocationId === firstLocation.id} onClick={() => requestLocationGeo(firstLocation.id)}>
                  {geoBusyLocationId === firstLocation.id ? 'Определяем…' : firstLocation.geo ? 'Обновить местоположение' : 'Использовать моё местоположение'}
                </button>
              </div>
            </section>

            {error && <p className={styles.error} role="alert">{error}</p>}
            {success && <p className={styles.status} role="status">{success}</p>}
          </div>
        ) : (
          <p className={styles.error} role="alert">У продавца не найдена первая точка. Обновите страницу.</p>
        )}
      </div>
    </section>
  );
}
