'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  interestResponseSchema,
  interestsResponseSchema,
} from '@/modules/interests/contracts/interests.contract';
import {
  buyerLocationSchema,
  type BuyerLocation,
} from '@/modules/search/contracts/buyer-location.contract';
import { searchQuerySchema, searchResponseSchema, type SearchResponse } from '@/modules/search/contracts/search.contract';
import { AuthModal } from './AuthModal';
import { OfferCard } from './OfferCard';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';
import { offerCount } from '@/i18n/format';

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

const popularSearches = ['Баранина', 'Говядина', 'Мёд', 'Картофель', 'Кумыс', 'Яблоки'] as const;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

function LocationPinIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" className={active ? styles.locationPinActiveDot : undefined} />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m4 16 6-6 4 4 6-7" />
      <path d="M15 7h5v5" />
    </svg>
  );
}

export function SearchForm({ initialQuery = '' }: SearchFormProps) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState>({ kind: 'initial' });
  const [locationState, setLocationState] = useState<BuyerLocationState>({ kind: 'not_enabled' });
  const [interestsState, setInterestsState] = useState<InterestsState>({ kind: 'loading' });
  const [pendingInterestIds, setPendingInterestIds] = useState<Set<string>>(() => new Set());
  const [interestError, setInterestError] = useState(false);
  const [interestAuthProductId, setInterestAuthProductId] = useState<string | null>(null);
  const interestTriggerRef = useRef<HTMLElement | null>(null);
  const pending = useRef(false);
  const localeRef = useRef(locale);
  const previousLocaleRef = useRef(locale);
  const input = useRef<HTMLInputElement>(null);
  const loading = state.kind === 'loading';

  useEffect(() => { localeRef.current = locale; }, [locale]);

  useEffect(() => {
    if (previousLocaleRef.current === locale) return;
    previousLocaleRef.current = locale;
    if (state.kind !== 'success' || state.result.offers.length === 0) return;

    let active = true;
    const current = state.result;
    void fetch(`/api/search?${new URLSearchParams({ q: current.query, locale })}`, { cache: 'no-store' })
      .then(async (response) => response.ok ? searchResponseSchema.parse(await response.json()) : null)
      .then((localized) => {
        if (!active || !localized) return;
        const names = new Map(localized.offers.map((offer) => [offer.product.id, offer.product]));
        const comments = new Map(localized.offers.map((offer) => [offer.id, offer.sellerCommentTranslation]));
        setState({
          kind: 'success',
          result: {
            ...current,
            offers: current.offers.map((offer) => ({
              ...offer,
              product: names.get(offer.product.id) ?? offer.product,
              // The comment variant is per interface locale; an Offer missing from the refetch keeps no stale translation.
              sellerCommentTranslation: comments.get(offer.id),
            })),
          },
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [locale, state]);

  const loadInterests = useCallback(async (): Promise<InterestsState> => {
    try {
      const response = await fetch(`/api/interests?locale=${locale}`, { cache: 'no-store' });
      if (response.status === 401) return { kind: 'anonymous' };
      if (!response.ok) return { kind: 'error' };
      const parsed = interestsResponseSchema.parse(await response.json());
      return { kind: 'ready', productIds: new Set(parsed.interests.map((interest) => interest.product.id)) };
    } catch {
      return { kind: 'error' };
    }
  }, [locale]);

  useEffect(() => {
    let active = true;
    void loadInterests().then((nextState) => { if (active) setInterestsState(nextState); });
    return () => { active = false; };
  }, [loadInterests]);

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
        ? await fetch(`/api/search?locale=${localeRef.current}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: parsed.data, buyerLocation }),
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })
        : await fetch(`/api/search?${new URLSearchParams({ q: parsed.data, locale: localeRef.current })}`, {
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
    const timer = window.setTimeout(() => {
      void executeSearch(initialQuery);
    }, 0);
    return () => window.clearTimeout(timer);
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

  function requestInterestAuth(productId: string, event?: ReactMouseEvent<HTMLElement>) {
    interestTriggerRef.current = event?.currentTarget ?? null;
    setInterestAuthProductId(productId);
  }

  function cancelInterestAuth() {
    setInterestAuthProductId(null);
    requestAnimationFrame(() => interestTriggerRef.current?.focus());
  }

  async function completeInterestAuth() {
    const productId = interestAuthProductId;
    setInterestAuthProductId(null);
    if (!productId) return;
    setInterestError(false);
    setPendingInterestIds((current) => new Set(current).add(productId));
    try {
      const response = await fetch(`/api/interests/${productId}`, { method: 'PUT', cache: 'no-store' });
      if (!response.ok) throw new Error('Interest unavailable');
      interestResponseSchema.parse(await response.json());
    } catch {
      setInterestError(true);
    }
    const refreshed = await loadInterests();
    setInterestsState(refreshed);
    setPendingInterestIds((current) => {
      const next = new Set(current);
      next.delete(productId);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const buyerLocation = locationState.kind === 'enabled' ? locationState.point : undefined;
    await executeSearch(query, buyerLocation);
  }

  function quickSearch(term: string) {
    if (loading) return;
    setQuery(term);
    const buyerLocation = locationState.kind === 'enabled' ? locationState.point : undefined;
    void executeSearch(term, buyerLocation);
  }

  const feedback = loading
    ? t('search.loadingOffers')
    : state.kind === 'success'
      ? state.result.offers.length === 0
        ? t('search.empty')
        : offerCount(locale, state.result.offers.length)
      : '';

  const locationStatus = locationState.kind === 'enabled'
    ? t('search.locationEnabled')
    : locationState.kind === 'error'
      ? t('search.locationError')
      : '';

  const locationActionLabel = locationState.kind === 'enabled'
    ? t('search.locationDisable')
    : locationState.kind === 'requesting'
      ? t('search.locationLoading')
      : locationState.kind === 'error'
        ? t('search.tryAgain')
        : t('search.locationEnable');

  const locationEnabled = locationState.kind === 'enabled';
  const hasResults = state.kind === 'success' && state.result.offers.length > 0;

  return (
    <section className={styles.searchArea} aria-label={t('search.area')}>
      <form onSubmit={submit} noValidate className={styles.searchForm}>
        <label htmlFor="product-query" className={styles.srOnly}>{t('search.question')}</label>
        <div className={styles.searchControls}>
          <div className={styles.queryField}>
            <span className={styles.queryIcon}><SearchIcon /></span>
            <input
              ref={input}
              id="product-query"
              name="q"
              type="search"
              placeholder={t('search.placeholder')}
              value={query}
              readOnly={loading}
              onChange={(event) => setQuery(event.target.value)}
              aria-invalid={state.kind === 'validation'}
              aria-describedby={state.kind === 'validation' ? 'search-validation' : undefined}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          <button type="submit" className={styles.searchSubmit} disabled={loading}>
            <SearchIcon />
            <span>{loading ? t('search.loading') : t('search.submit')}</span>
          </button>
          <button
            type="button"
            className={styles.locationToggle}
            disabled={locationState.kind === 'requesting'}
            aria-label={locationActionLabel}
            aria-pressed={locationEnabled}
            title={locationActionLabel}
            onClick={() => {
              if (locationEnabled) setLocationState({ kind: 'not_enabled' });
              else requestBuyerLocation();
            }}
          >
            <LocationPinIcon active={locationEnabled} />
          </button>
        </div>

        {state.kind === 'validation' && <p id="search-validation" className={styles.error} role="alert">{t('search.validation')}</p>}

        <div className={styles.popularSearches} aria-label={t('search.popularQueries')}>
          <span className={styles.popularLabel}>
            <TrendingIcon />
            {t('search.popular')}
          </span>
          {popularSearches.map((term) => (
            <button
              key={term}
              type="button"
              className={styles.popularChip}
              disabled={loading}
              onClick={() => quickSearch(term)}
            >
              {term}
            </button>
          ))}
        </div>

        {locationStatus && (
          <p className={styles.locationStatus} role={locationState.kind === 'error' ? 'alert' : 'status'}>
            {locationStatus}
          </p>
        )}
      </form>

      <div className={styles.results} aria-busy={loading}>
        <p
          className={`${styles.feedback} ${hasResults ? styles.feedbackVisuallyHidden : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {feedback}
        </p>
        {state.kind === 'error' && <p className={styles.error} role="alert">{t('search.error')}</p>}
        {interestError && <p className={styles.error} role="alert">{t('search.interestError')}</p>}
        {hasResults && (
          <>
            <div className={styles.resultsHeader}>
              <h2>{t('search.results')}</h2>
              <span className={styles.resultsCount}>({state.result.offers.length})</span>
            </div>
            <ul className={styles.offerList} aria-label={t('search.offers')}>
              {state.result.offers.map((offer) => {
                const interest = interestsState.kind === 'ready'
                  ? {
                    active: interestsState.productIds.has(offer.product.id),
                    pending: pendingInterestIds.has(offer.product.id),
                    onToggle: () => toggleInterest(offer.product.id),
                  }
                  : interestsState.kind === 'anonymous'
                    ? {
                      active: false,
                      pending: pendingInterestIds.has(offer.product.id),
                      onToggle: (event?: ReactMouseEvent<HTMLElement>) => requestInterestAuth(offer.product.id, event),
                    }
                    : undefined;
                return <li key={offer.id}><OfferCard offer={offer} interest={interest} /></li>;
              })}
            </ul>
          </>
        )}
      </div>
      {interestAuthProductId && (
        <AuthModal
          open
          description={t('auth.interestDescription')}
          onClose={cancelInterestAuth}
          onAuthenticated={() => { void completeInterestAuth(); }}
        />
      )}
    </section>
  );
}
