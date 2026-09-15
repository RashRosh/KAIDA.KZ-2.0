'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nearbyResponseSchema, type NearbyResponse } from '@/modules/discovery/contracts/discovery.contract';
import { buyerLocationSchema, type BuyerLocation } from '@/modules/search/contracts/buyer-location.contract';
import { OfferCard } from '../_components/OfferCard';
import styles from '../page.module.css';

type NearbyState =
  | { kind: 'initial' | 'locating' | 'loading' | 'geo_error' | 'request_error' }
  | { kind: 'success'; result: NearbyResponse };

const NEARBY_NAV_INTENT_KEY = 'kaida:nearby-nav-intent';

export function NearbyFeed() {
  const [state, setState] = useState<NearbyState>({ kind: 'initial' });
  const pending = useRef(false);

  const loadNearby = useCallback(async (buyerLocation: BuyerLocation) => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch('/api/discovery/nearby', {
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

    if (autoStart) requestNearby();
  }, [requestNearby]);

  const busy = state.kind === 'locating' || state.kind === 'loading';
  const buttonLabel = state.kind === 'locating'
    ? 'Определяем местоположение…'
    : state.kind === 'loading'
      ? 'Ищем товары рядом…'
      : state.kind === 'initial'
        ? 'Показать товары рядом'
        : 'Обновить товары рядом';

  const feedback = state.kind === 'success'
    ? state.result.offers.length === 0
      ? 'Рядом пока нет актуальных предложений.'
      : `Найдено рядом: ${state.result.offers.length}`
    : '';
  const hasResults = state.kind === 'success' && state.result.offers.length > 0;

  return (
    <section className={styles.searchArea} aria-label="Товары рядом">
      <button
        type="button"
        className={styles.nearbyButton}
        disabled={busy}
        onClick={requestNearby}
      >
        {buttonLabel}
      </button>
      <p className={styles.help}>Местоположение используется только для этого запроса и не сохраняется.</p>

      {state.kind === 'geo_error' && (
        <p className={styles.error} role="alert">
          Не удалось определить местоположение. Раздел «Рядом» работает только с разрешённой геолокацией.
        </p>
      )}
      {state.kind === 'request_error' && (
        <p className={styles.error} role="alert">Не удалось загрузить предложения рядом. Попробуйте ещё раз.</p>
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
              <h2>Предложения рядом</h2>
              <span className={styles.resultsCount}>({state.result.offers.length})</span>
            </div>
            <ul className={styles.offerList} aria-label="Предложения рядом">
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
