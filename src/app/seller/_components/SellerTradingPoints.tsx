'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import type { LocationType, LocationView } from '@/modules/locations/contracts/location.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import type { PointDetailsView } from '@/modules/locations/details/point-details.contract';
import { openingHoursSchema, templateOpeningHours, type OpeningHours } from '@/modules/locations/hours/opening-hours';
import { OpeningHoursFields, PointContactStatus, PointContactsFields, type ContactsDraft } from './PointDetailsFields';
import { Bar, Ic, Nav, Phone, Toast } from '../_kaida/ui';
import { pluralKey } from './card-model';
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
  const ids = useId();
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
  const [details, setDetails] = useState<Map<string, PointDetailsView>>(new Map());
  const [contacts, setContacts] = useState<ContactsDraft>({ phone: '', whatsapp: '' });
  const [hours, setHours] = useState<OpeningHours>(templateOpeningHours);
  const [hoursNeedsReview, setHoursNeedsReview] = useState(true);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    try {
      const response = await fetch('/api/seller/points/details', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { points: PointDetailsView[] };
      setDetails(new Map(data.points.map((point) => [point.locationId, point])));
    } catch {
      // The cards still work without contacts and hours; the form falls back to the template.
    }
  }, []);
  // AI-S12 · Points · List: how many cards each point shows («· 8 карточек»).
  const [cardCounts, setCardCounts] = useState<Map<string, number>>(new Map());
  const loadCardCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/seller/offers', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { offers: { location: { id: string } }[] };
      const counts = new Map<string, number>();
      for (const offer of data.offers) counts.set(offer.location.id, (counts.get(offer.location.id) ?? 0) + 1);
      setCardCounts(counts);
    } catch {
      // The list works without the counts.
    }
  }, []);
  const locationCount = locations.length;
  useEffect(() => {
    if (!seller) return;
    const timer = window.setTimeout(() => { void loadDetails(); void loadCardCounts(); }, 0);
    return () => window.clearTimeout(timer);
  }, [seller, locationCount, loadDetails, loadCardCounts]);

  function fillDetails(source: PointDetailsView | undefined) {
    setContacts({ phone: source?.contacts.phone?.e164 ?? '', whatsapp: source?.contacts.whatsapp?.e164 ?? '' });
    setHours(source?.openingHours ?? templateOpeningHours());
    setHoursNeedsReview(source ? source.openingHoursNeedsReview : true);
  }

  function resetForm() {
    setName('');
    setType('shop');
    setAddressText('');
    setEditingId(null);
    setError('');
  }

  function beginAdd() {
    resetForm();
    // point-contacts-hours §2: a new point starts with the latest point's contacts and hours.
    const latest = locations.at(-1);
    fillDetails(latest ? details.get(latest.id) : undefined);
    setCopiedFrom(latest && details.has(latest.id) ? latest.name : null);
    setStatus('');
    setMode('add');
  }

  function beginEdit(location: LocationView) {
    setName(location.name);
    setType(location.type);
    setAddressText(location.addressText);
    setEditingId(location.id);
    fillDetails(details.get(location.id));
    setCopiedFrom(null);
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
    if (!openingHoursSchema.safeParse(hours).success) {
      setError(t('pointDetails.hoursInvalid'));
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
      const detailsResponse = await fetch(`/api/seller/locations/${savedLocation.id}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contacts.phone.trim() || null, whatsapp: contacts.whatsapp.trim() || null, openingHours: hours }),
      });
      if (!detailsResponse.ok) {
        const detailsError = await detailsResponse.json().catch(() => ({})) as { error?: { code?: string } };
        onSellerChange(nextSeller);
        if (mode === 'add') { setMode('edit'); setEditingId(savedLocation.id); }
        setError(detailsError.error?.code === 'INVALID_PHONE' ? t('error.INVALID_PHONE') : t('points.saveError'));
        return;
      }
      const savedDetails = (await detailsResponse.json() as { point: PointDetailsView }).point;
      setDetails((current) => new Map(current).set(savedLocation.id, savedDetails));
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

  const statusToast = status && <Toast>{status}</Toast>;
  const errorBanner = error && (
    <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12, flexDirection: 'row', gap: 10 }}>
      <Ic name="alert" className="dn" /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{error}</p>
    </div>
  );

  // AI-S12A · Point: one screen for a new or an existing point — name, place, contacts, opening hours.
  if (mode !== 'closed') {
    const editing = mode === 'edit' ? locations.find((location) => location.id === editingId) : undefined;
    const saved = editing ? details.get(editing.id)?.contacts : undefined;
    return (
      <Phone>
        <Bar title={editing?.name ?? t('points.new')} onBack={closeForm} backDisabled={submitting} />
        <form id={`${ids}-form`} className="body" style={{ gap: 18, overflowY: 'auto' }} onSubmit={submit} noValidate aria-label={mode === 'edit' ? t('points.edit') : t('points.new')}>
          {errorBanner}
          {!seller && (
            <div className="fld">
              <label htmlFor="seller-display-name">{t('points.sellerName')}</label>
              <input id="seller-display-name" className="inp" value={sellerDisplayName} onChange={(event) => setSellerDisplayName(event.target.value)} maxLength={120} disabled={submitting} autoComplete="name" />
              <span className="hint">{t('points.sellerNameHelp')}</span>
            </div>
          )}
          <div className="fld">
            <label htmlFor="trading-location-name">{t('points.name')}</label>
            <input id="trading-location-name" className="inp" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} disabled={submitting} required />
            <span className="hint">{t('points.nameHint')}</span>
          </div>
          <div className="fld">
            <label htmlFor="trading-location-type">{t('points.type')}</label>
            <select id="trading-location-type" className="inp" value={type} onChange={(event) => setType(event.target.value as LocationType)} disabled={submitting} required>
              <option value="market">{t('points.type.market')}</option>
              <option value="shop">{t('points.type.shop')}</option>
              <option value="pavilion">{t('points.type.pavilion')}</option>
              <option value="home">{t('points.type.home')}</option>
              <option value="other">{t('points.type.other')}</option>
            </select>
          </div>
          <div className="fld">
            <div className="fl">{t('points.where')}</div>
            <label htmlFor="trading-location-address" className="vh">{t('points.address')}</label>
            <input id="trading-location-address" className="inp" placeholder={t('points.addressPlaceholder')} value={addressText} onChange={(event) => setAddressText(event.target.value)} maxLength={500} disabled={submitting} autoComplete="street-address" required />
            {editing && (
              <div className="card" style={{ gap: 0, padding: '0 12px', marginTop: 6 }}>
                <button type="button" className="li" disabled={geoBusyId === editing.id || submitting} onClick={() => requestGeo(editing.id)}>
                  <div className="lic p">{geoBusyId === editing.id ? <span className="spin" /> : <Ic name="locate" />}</div>
                  <div className="mid">
                    <div className="ts">{geoBusyId === editing.id ? t('points.locating') : editing.geo ? t('points.geoUpdate') : t('points.geoUseMine')}</div>
                    <p className="c">{editing.geo ? t('points.geoSet') : t('points.geoOnce')}</p>
                  </div>
                  <Ic name="right" className="c2" />
                </button>
              </div>
            )}
          </div>
          <PointContactsFields value={contacts} onChange={setContacts} disabled={submitting} sourceName={mode === 'add' ? copiedFrom : null} saved={saved} />
          {editing && (['phone', 'whatsapp'] as const).map((channel) => {
            const contact = details.get(editing.id)?.contacts[channel];
            return contact && !contact.verified ? (
              <PointContactStatus key={channel} label={channel === 'phone' ? t('pointDetails.phone') : 'WhatsApp'} contact={contact}
                onVerified={() => { setStatus(t('pointDetails.verifiedStatus')); void loadDetails(); }} />
            ) : null;
          })}
          <OpeningHoursFields value={hours} onChange={setHours} disabled={submitting} needsReview={hoursNeedsReview} />
        </form>
        <div className="foot">
          <button type="submit" form={`${ids}-form`} className="btn btn-p lg w" disabled={submitting} aria-busy={submitting}>
            {submitting && <span className="spin" />}{submitting ? t('points.saving') : t('points.save')}
          </button>
          <button type="button" className="btn btn-g w" onClick={closeForm} disabled={submitting}>{t('offerManage.cancel')}</button>
        </div>
        {status && <Toast bottom={140}>{status}</Toast>}
      </Phone>
    );
  }

  // AI-S12 · Points: empty state or the list of points with their contacts.
  return (
    <Phone>
      <Bar title={t('points.title')} lang />
      {locations.length === 0 ? (
        <main className="body" style={{ justifyContent: 'center', gap: 16, padding: 24 }}>
          <div className="ill" aria-hidden="true">
            <i style={{ left: 70, top: 10, width: 60, height: 60, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: '#9900cc' }} />
            <i style={{ left: 88, top: 28, width: 24, height: 24, borderRadius: '50%', background: '#ffffff' }} />
            <i style={{ left: 20, top: 104, width: 160, height: 28, borderRadius: 14, background: '#efc7ff' }} />
            <i style={{ left: 50, top: 96, width: 20, height: 20, borderRadius: '50%', background: '#fec92f' }} />
            <i style={{ left: 130, top: 98, width: 16, height: 16, borderRadius: '50%', background: '#d7d2da' }} />
          </div>
          <h2 className="h2" style={{ textAlign: 'center' }}>{t('points.emptyTitle')}</h2>
          <p className="t c2" style={{ textAlign: 'center' }}>{t('points.empty')}</p>
          {errorBanner}
          <button type="button" className="btn btn-p lg w" onClick={beginAdd}><Ic name="plus" className="sm" />{t('points.add')}</button>
        </main>
      ) : (
        <main className="body" style={{ gap: 10 }}>
          {errorBanner}
          {locations.map((location) => {
            const point = details.get(location.id);
            const channels = (['phone', 'whatsapp'] as const).filter((channel) => point?.contacts[channel]);
            const waiting = channels.some((channel) => point?.contacts[channel]?.verified === false);
            return (
              <button key={location.id} type="button" className="card" style={{ flexDirection: 'row', gap: 12 }} onClick={() => beginEdit(location)}
                aria-label={t('points.editNamed', { name: location.name })} data-testid={`trading-point-${location.id}`}>
                <div className="lic p"><Ic name="pin" /></div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="ts">{location.name}</div>
                  <p className="c">{t(typeLabelKeys[location.type])} · {location.addressText}{cardCounts.has(location.id) ? ` · ${t(pluralKey('points.cards', cardCounts.get(location.id)!), { count: cardCounts.get(location.id)! })}` : ''}</p>
                  {channels.length > 0 ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {channels.includes('phone') && <Ic name="phone" className="xs c2" />}
                      {/* eslint-disable-next-line @next/next/no-img-element -- mockup brand mark */}
                      {channels.includes('whatsapp') && <img src="/kaida/icons/127a626f246aa48c4b8bc196e32e93a2.svg" alt="" style={{ width: 16, height: 16 }} />}
                      <span className="c">{channels.map((channel) => channel === 'phone' ? t('pointDetails.phone') : 'WhatsApp').join(', ')}</span>
                      {waiting && <span className="bd bd-info" style={{ height: 20 }}><Ic name="clock" />{t('pointDetails.waiting').toLowerCase()}</span>}
                    </div>
                  ) : (
                    <p className="c">{t('pointDetails.none')}</p>
                  )}
                  {!location.geo && <p className="c">{t('points.geoNotSet')}</p>}
                  {point?.openingHoursNeedsReview && <span className="bd bd-warn"><Ic name="clock" />{t('pointDetails.hoursReviewBadge')}</span>}
                </div>
                <Ic name="right" className="c2" />
              </button>
            );
          })}
          <button type="button" className="btn btn-o w" onClick={beginAdd}><Ic name="plus" className="sm" />{t('points.add')}</button>
        </main>
      )}
      {statusToast}
      <Nav active="points" />
    </Phone>
  );
}
