'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  interestResponseSchema,
  interestsResponseSchema,
} from '@/modules/interests/contracts/interests.contract';
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

type InterestsState =
  | { kind: 'loading' | 'anonymous' | 'error' }
  | { kind: 'ready'; productIds: Set<string> };

type SearchFormProps = {
  initialQuery?: string;
};

export function SearchForm({ initialQuery = '' }: SearchFormProps) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState>({ kind: 'initial' });
  const [locationState, setLocationState] = useState<BuyerLocationState>({ kind: 'not_enabled' });
  const [interestsState, setInterestsState] = useState<InterestsState>({ kind: 'loading' });
  const [pendingInterestIds, setPendingInterestIds] = useState<Set<string>>(() => new Set());
  const [interestError, setInterestError] = useState(false);
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const loading = state.kind === 'loading';

  useEffect(() => {
    let active = true;
    fetch('/api/interests', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) return { kind: 'anonymous' } as const;
        if (!response.ok) return { kind: 'error' } as const;
        const parsed = interestsResponseSchema.parse(await response.json());
        return { kind: 'ready', productIds: new Set(parsed.interests.map((interest) => interest.product.id)) } as const;
      })
      .then((nextState) => { if (active) setInterestsState(nextState); })
      .catch(() => { if (active) setInterestsState({ kind: 'error' }); });
    return () => { active = false; };
  }, []);

  const executeSearch = useCallback(async (rawQuery: string, buyerLocation?: BuyerLocation) => {
    if (pending.current) return;
    const parsed = searchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      setState({ kind: 'validation' });
      input.current?.focus();
      return;
    }

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
  }, []);

  useEffect(() => {
    if (!initialQuery) return;
    void executeSearch(initialQuery);
  }, [executeSearch, initialQuery]);

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

  async function toggleInterest(productId: string) {
    if (interestsState.kind !== 'ready' || pendingInterestIds.has(productId)) return;
    const active = interestsState.productIds.has(productId);
    setInterestError(false);
    setPendingInterestIds((current) => new Set(current).add(productId));

    try {
      const response = await fetch(`/api/interests/${productId}`, {
        method: active ? 'DELETE' : 'PUT',
        cache: 'no-store',
      });
      if (response.status === 401) {
        setInterestsState({ kind: 'anonymous' });
        return;
      }
      if (!response.ok) throw new Error('Interest unavailable');
      if (!active) {
        const saved = interestResponseSchema.parse(await response.json());
        if (saved.interest.product.id !== productId) throw new Error('Unexpected interest');
      }
      setInterestsState((current) => {
        if (current.kind !== 'ready') return current;
        const next = new Set(current.productIds);
        if (active) next.delete(productId);
        else next.add(productId);
        return { kind: 'ready', productIds: next };
      });
    } catch {
      setInterestError(true);
    } finally {
      setPendingInterestIds((current) => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const buyerLocation = locationState.kind === 'enabled' ? locationState.point : undefined;
    await executeSearch(query, buyerLocation);
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
        {interestError && <p className={styles.error} role="alert">Не удалось изменить интерес. Попробуйте ещё раз.</p>}
        {state.kind === 'success' && state.result.offers.length > 0 && (
          <ul className={styles.offerList} aria-label="Предложения">
            {state.result.offers.map((offer) => {
              const interest = interestsState.kind === 'ready'
                ? {
                  active: interestsState.productIds.has(offer.product.id),
                  pending: pendingInterestIds.has(offer.product.id),
                  onToggle: () => toggleInterest(offer.product.id),
                }
                : undefined;
              return <li key={offer.id}><OfferCard offer={offer} interest={interest} /></li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
