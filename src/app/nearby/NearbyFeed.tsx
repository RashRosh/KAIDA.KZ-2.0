'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { nearbyResponseSchema, type NearbyResponse } from '@/modules/discovery/contracts/discovery.contract';
import { buyerLocationSchema, type BuyerLocation } from '@/modules/search/contracts/buyer-location.contract';
import { OfferCard } from '../_components/OfferCard';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';

type NearbyState =
  | { kind: 'initial' | 'locating' | 'loading' | 'geo_error' | 'request_error' }
  | { kind: 'success'; result: NearbyResponse };

const NEARBY_NAV_INTENT_KEY = 'kaida:nearby-nav-intent';

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  return (
    <section className={styles.searchArea} aria-label={t('nearby.area')}>
      {!hasResults && (
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{t('nearby.eyebrow')}</p>
          <h1>{t('nearby.title')}</h1>
          <p className={styles.description}>{t('nearby.description')}</p>
          <Link href="/" className={styles.secondaryLink}>{t('nearby.searchSpecific')}</Link>
        </div>
      )}

      {!hasResults && (
        <>
          <button
            type="button"
            className={styles.nearbyButton}
            disabled={busy}
            onClick={requestNearby}
          >
            {buttonLabel}
          </button>
          <p className={styles.help}>{t('nearby.privacy')}</p>
        </>
      )}

      {state.kind === 'geo_error' && (
        <p className={styles.error} role="alert">
          {t('nearby.geoError')}
        </p>
      )}
      {state.kind === 'request_error' && (
        <p className={styles.error} role="alert">{t('nearby.requestError')}</p>
      )}

      <div className={styles.results} aria-busy={busy}>
        <p
          className={`${styles.feedback} ${hasResults ? styles.feedbackVisuallyHidden : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {feedback}
        </p>
        {hasResults && (
          <>
            <div className={styles.resultsHeader}>
              <h1>{t('nearby.offersTitle')}</h1>
              <span className={styles.resultsCount}>({state.result.offers.length})</span>
              <button
                type="button"
                className={styles.refreshButton}
                disabled={busy}
                onClick={requestNearby}
                aria-label={buttonLabel}
                title={buttonLabel}
              >
                <RefreshIcon />
              </button>
            </div>
            <ul className={styles.offerList} aria-label={t('nearby.offersTitle')}>
              {state.result.offers.map((offer) => (
                <li key={offer.id}>
                  <OfferCard offer={offer} distanceMeters={offer.distanceMeters} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
