'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nearbyResponseSchema, type NearbyResponse } from '@/modules/discovery/contracts/discovery.contract';
import { buyerLocationSchema, type BuyerLocation } from '@/modules/search/contracts/buyer-location.contract';
import { Ic } from '../../seller/_kaida/ui';
import { BuyerScreen, NEARBY_NAV_INTENT_KEY, ResultCard, ResultSkeletons } from '../_ui/buyer-ui';
import { useI18n } from '@/i18n/I18nProvider';

type NearbyState =
  | { kind: 'initial' | 'locating' | 'loading' | 'geo_error' | 'request_error' }
  | { kind: 'success'; result: NearbyResponse };


export function NearbyFeed() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<NearbyState>({ kind: 'initial' });
  const pending = useRef(false);
  const localeRef = useRef(locale);

  useEffect(() => { localeRef.current = locale; }, [locale]);

  const loadNearby = useCallback(async (buyerLocation: BuyerLocation) => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch(`/api/discovery/nearby?locale=${localeRef.current}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerLocation }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Nearby unavailable');
      const result = nearbyResponseSchema.parse(await response.json());
      setState({ kind: 'success', result });
    } catch {
      setState({ kind: 'request_error' });
    } finally {
      pending.current = false;
    }
  }, []);

  const requestNearby = useCallback(() => {
    if (pending.current) return;
    pending.current = true;

    if (!navigator.geolocation) {
      pending.current = false;
      setState({ kind: 'geo_error' });
      return;
    }

    setState({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const parsed = buyerLocationSchema.safeParse({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (!parsed.success) {
          pending.current = false;
          setState({ kind: 'geo_error' });
          return;
        }
        void loadNearby(parsed.data);
      },
      () => {
        pending.current = false;
        setState({ kind: 'geo_error' });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [loadNearby]);

  useEffect(() => {
    let autoStart = false;
    try {
      autoStart = window.sessionStorage.getItem(NEARBY_NAV_INTENT_KEY) === '1';
      if (autoStart) window.sessionStorage.removeItem(NEARBY_NAV_INTENT_KEY);
    } catch {
      autoStart = false;
    }

    if (autoStart) queueMicrotask(requestNearby);
  }, [requestNearby]);

  const busy = state.kind === 'locating' || state.kind === 'loading';
  const buttonLabel = state.kind === 'locating'
    ? t('nearby.locating')
    : state.kind === 'loading'
      ? t('nearby.loading')
      : state.kind === 'initial'
        ? t('nearby.show')
        : t('nearby.refresh');

  const feedback = state.kind === 'success'
    ? state.result.offers.length === 0
      ? t('nearby.empty')
      : t('nearby.found', { count: state.result.offers.length })
    : '';
  const hasResults = state.kind === 'success' && state.result.offers.length > 0;

  // buyer-screens-mockup: «Рядом» (no frame) from the mockup's classes; the same cards as the search results (B01).
  return (
    <BuyerScreen
      section="nearby"
      top={hasResults ? (
        <header className="bar">
          <h1 className="bar-t" style={{ margin: 0 }}>{t('nearby.offersTitle')} <span className="c2">({state.result.offers.length})</span></h1>
          <button type="button" className="ib" disabled={busy} onClick={requestNearby} aria-label={buttonLabel} title={buttonLabel}>
            <Ic name="refresh" />
          </button>
        </header>
      ) : undefined}
    >
      <main className="body" style={{ gap: 12, padding: hasResults ? 12 : '24px 16px' }} aria-label={t('nearby.area')} aria-busy={busy || undefined}>
        {!hasResults && (
          <button type="button" className="btn btn-p lg w" disabled={busy} onClick={requestNearby}>
            <Ic name="pin" className="sm" />{buttonLabel}
          </button>
        )}
        {state.kind === 'geo_error' && (
          <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14 }}>
            <p className="c" style={{ color: 'var(--ink)' }}>{t('nearby.geoError')}</p>
          </div>
        )}
        {state.kind === 'request_error' && (
          <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14 }}>
            <p className="c" style={{ color: 'var(--ink)' }}>{t('nearby.requestError')}</p>
          </div>
        )}
        <p className={hasResults ? 'vh' : 'c'} role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
        {state.kind === 'loading' && <ResultSkeletons />}
        {hasResults && (
          <>
            <p className="c">{t('buyer.captionNear')}</p>
            <ul aria-label={t('nearby.offersTitle')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {state.result.offers.map((offer) => (
                <li key={offer.id}><ResultCard offer={offer} distanceMeters={offer.distanceMeters} /></li>
              ))}
            </ul>
          </>
        )}
      </main>
    </BuyerScreen>
  );
}
