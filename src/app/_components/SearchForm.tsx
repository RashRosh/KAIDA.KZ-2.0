'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  buyerLocationSchema,
  type BuyerLocation,
} from '@/modules/search/contracts/buyer-location.contract';
import { searchQuerySchema, searchResponseSchema, type SearchResponse } from '@/modules/search/contracts/search.contract';
import { OfferCard } from './OfferCard';
import styles from '../page.module.css';

type SearchState =
  | { kind: 'initial' | 'loading' | 'validation' | 'error' }
  | { kind: 'success'; result: SearchResponse };

type BuyerLocationState =
  | { kind: 'not_enabled' }
  | { kind: 'requesting' }
  | { kind: 'enabled'; point: BuyerLocation }
  | { kind: 'error' };

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'initial' });
  const [locationState, setLocationState] = useState<BuyerLocationState>({ kind: 'not_enabled' });
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const loading = state.kind === 'loading';

  function requestBuyerLocation() {
    if (locationState.kind === 'requesting') return;
    if (!navigator.geolocation) {
      setLocationState({ kind: 'error' });
      return;
    }

    setLocationState({ kind: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const parsed = buyerLocationSchema.safeParse({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationState(parsed.success
          ? { kind: 'enabled', point: parsed.data }
          : { kind: 'error' });
      },
      () => setLocationState({ kind: 'error' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) {
      setState({ kind: 'validation' });
      input.current?.focus();
      return;
    }

    const buyerLocation = locationState.kind === 'enabled' ? locationState.point : undefined;
    pending.current = true;
    setState({ kind: 'loading' });
    try {
      const response = buyerLocation
        ? await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: parsed.data, buyerLocation }),
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })
        : await fetch(`/api/search?${new URLSearchParams({ q: parsed.data })}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        });
      if (response.status === 400) {
        setState({ kind: 'validation' });
        return;
      }
      if (!response.ok) throw new Error('Search unavailable');
      const result = searchResponseSchema.parse(await response.json());
      setState({ kind: 'success', result });
    } catch {
      setState({ kind: 'error' });
    } finally {
      pending.current = false;
    }
  }

  const feedback = loading
    ? 'Ищем предложения…'
    : state.kind === 'success'
      ? state.result.offers.length === 0
        ? 'По вашему запросу ничего не найдено.'
        : `Найдено предложений: ${state.result.offers.length}`
      : '';

  const locationStatus = locationState.kind === 'enabled'
    ? 'Местоположение будет учтено при следующем поиске.'
    : locationState.kind === 'error'
      ? 'Не удалось определить местоположение. Поиск работает без учёта расстояния.'
      : '';

  return (
    <section className={styles.searchArea} aria-label="Поиск предложений">
      <form onSubmit={submit} noValidate>
        <label htmlFor="product-query" className={styles.label}>Какой товар ищете?</label>
        <div className={styles.searchControls}>
          <input
            ref={input}
            id="product-query"
            name="q"
            type="search"
            placeholder="Например, баранина"
            value={query}
            readOnly={loading}
            onChange={(event) => setQuery(event.target.value)}
            aria-invalid={state.kind === 'validation'}
            aria-describedby={state.kind === 'validation' ? 'search-help search-validation' : 'search-help'}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" disabled={loading}>{loading ? 'Ищем…' : 'Найти'}</button>
        </div>
        <p id="search-help" className={styles.help}>Введите точное название товара.</p>
        {state.kind === 'validation' && <p id="search-validation" className={styles.error} role="alert">Введите название товара.</p>}

        <div className={styles.locationControls}>
          {locationState.kind === 'enabled' ? (
            <button
              type="button"
              className={styles.locationButton}
              onClick={() => setLocationState({ kind: 'not_enabled' })}
            >
              Не учитывать местоположение
            </button>
          ) : (
            <button
              type="button"
              className={styles.locationButton}
              disabled={locationState.kind === 'requesting'}
              onClick={requestBuyerLocation}
            >
              {locationState.kind === 'requesting'
                ? 'Определяем местоположение…'
                : locationState.kind === 'error'
                  ? 'Попробовать снова'
                  : 'Учитывать моё местоположение'}
            </button>
          )}
          {locationStatus && <p className={styles.locationStatus}>{locationStatus}</p>}
        </div>
      </form>
      <div className={styles.results} aria-busy={loading}>
        <p className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
        {state.kind === 'error' && <p className={styles.error} role="alert">Не удалось выполнить поиск. Попробуйте ещё раз.</p>}
        {state.kind === 'success' && state.result.offers.length > 0 && (
          <ul className={styles.offerList} aria-label="Предложения">
            {state.result.offers.map((offer) => <li key={offer.id}><OfferCard offer={offer} /></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
