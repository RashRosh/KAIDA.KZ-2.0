'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { offerCount } from '../../../i18n/format';
import { buyerLocationSchema, type BuyerLocation } from '../../../modules/search/contracts/buyer-location.contract';
import { searchQuerySchema, searchResponseSchema, type SearchResponse } from '../../../modules/search/contracts/search.contract';
import { Ic } from '../../seller/_kaida/ui';
import { BuyerScreen, ResultCard, ResultSkeletons } from './buyer-ui';
import { useSellerEntry } from './seller-entry';

// buyer-screens-mockup · search start (no frame, mockup classes) and results (B01). The search behavior is the one of
// S0 / S7 / S9: explicit submit, optional transient buyer location, popular queries, the query kept in the address.

type SearchState =
  | { kind: 'initial' | 'loading' | 'validation' | 'error' }
  | { kind: 'success'; result: SearchResponse };

type BuyerLocationState =
  | { kind: 'not_enabled' }
  | { kind: 'requesting' }
  | { kind: 'enabled'; point: BuyerLocation }
  | { kind: 'error' };

const popularSearches = ['Баранина', 'Говядина', 'Мёд', 'Картофель', 'Кумыс', 'Яблоки'] as const;

export function SearchScreen() {
  const { locale, t } = useI18n();
  // The query kept in the address (replaceState below is synced into the router), so Back from an offer page
  // reopens the same results even when the router restores this page from its cache.
  const addressQuery = useSearchParams().get('q') ?? '';
  const [query, setQuery] = useState(addressQuery);
  const [state, setState] = useState<SearchState>(addressQuery ? { kind: 'loading' } : { kind: 'initial' });
  // The results view is kept from the first sent search on, so a validation message never swaps the form under focus.
  const [started, setStarted] = useState(Boolean(addressQuery));
  const [shown, setShown] = useState<SearchResponse | null>(null);
  const writtenQuery = useRef<string | null>(null);
  const [locationState, setLocationState] = useState<BuyerLocationState>({ kind: 'not_enabled' });
  const pending = useRef(false);
  const lastSearch = useRef<{ query: string; location?: BuyerLocation } | null>(null);
  const localeRef = useRef(locale);
  const previousLocaleRef = useRef(locale);
  const input = useRef<HTMLInputElement>(null);
  const seller = useSellerEntry();
  const loading = state.kind === 'loading';

  useEffect(() => { localeRef.current = locale; }, [locale]);

  // A language change re-reads the shown results: pack and unit labels and comment translations follow the locale.
  useEffect(() => {
    if (previousLocaleRef.current === locale) return;
    previousLocaleRef.current = locale;
    if (!shown || shown.offers.length === 0) return;
    let active = true;
    const current = shown;
    void fetch(`/api/search?${new URLSearchParams({ q: current.query, locale })}`, { cache: 'no-store' })
      .then(async (response) => response.ok ? searchResponseSchema.parse(await response.json()) : null)
      .then((localized) => {
        if (!active || !localized) return;
        const byId = new Map(localized.offers.map((offer) => [offer.id, offer]));
        setShown({
          ...current,
          offers: current.offers.map((offer) => {
            const fresh = byId.get(offer.id);
            return { ...offer, pack: fresh ? fresh.pack : offer.pack, price: fresh?.price ?? offer.price, sellerCommentTranslation: fresh?.sellerCommentTranslation };
          }),
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [locale, shown]);

  const executeSearch = useCallback(async (rawQuery: string, buyerLocation?: BuyerLocation) => {
    if (pending.current) return;
    const parsed = searchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      setState({ kind: 'validation' });
      input.current?.focus();
      return;
    }
    pending.current = true;
    lastSearch.current = { query: parsed.data, location: buyerLocation };
    setStarted(true);
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
      setShown(result);
      // Keep the query in the address so Back from an Offer page returns to the same results.
      // An address that already holds the query is left alone: a replaceState there would race a navigation that
      // started meanwhile (for example a tap on «Ещё» right after Back).
      writtenQuery.current = parsed.data;
      if (window.location.pathname === '/' && new URLSearchParams(window.location.search).get('q') !== parsed.data) {
        window.history.replaceState(null, '', `/?${new URLSearchParams({ q: parsed.data })}`);
      }
    } catch {
      // Cards of the previous query would read as results of this one: the error replaces them (as in S0).
      setState({ kind: 'error' });
      setShown(null);
    } finally {
      pending.current = false;
    }
  }, []);

  // An address this screen did not write (first open, Back, «Поиск» in the navigation) decides what is shown.
  useEffect(() => {
    if (addressQuery === writtenQuery.current) return;
    const timer = window.setTimeout(() => {
      writtenQuery.current = addressQuery;
      setQuery(addressQuery);
      if (addressQuery) {
        void executeSearch(addressQuery);
      } else {
        setShown(null);
        setStarted(false);
        setState({ kind: 'initial' });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [executeSearch, addressQuery]);

  function requestBuyerLocation() {
    if (locationState.kind === 'requesting') return;
    if (!navigator.geolocation) {
      setLocationState({ kind: 'error' });
      return;
    }
    setLocationState({ kind: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const parsed = buyerLocationSchema.safeParse({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationState(parsed.success ? { kind: 'enabled', point: parsed.data } : { kind: 'error' });
      },
      () => setLocationState({ kind: 'error' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const buyerLocation = locationState.kind === 'enabled' ? locationState.point : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeSearch(query, buyerLocation);
  }

  function quickSearch(term: string) {
    if (loading) return;
    setQuery(term);
    void executeSearch(term, buyerLocation);
  }

  const locationEnabled = locationState.kind === 'enabled';
  const locationLabel = locationEnabled
    ? t('search.locationDisable')
    : locationState.kind === 'requesting'
      ? t('search.locationLoading')
      : locationState.kind === 'error' ? t('search.tryAgain') : t('search.locationEnable');
  const locationStatus = locationEnabled ? t('search.locationEnabled') : locationState.kind === 'error' ? t('search.locationError') : '';
  const feedback = loading
    ? t('search.loadingOffers')
    : state.kind === 'success'
      ? state.result.offers.length === 0 ? t('search.empty') : offerCount(locale, state.result.offers.length)
      : '';

  const form = (compact: boolean) => (
    <form role="search" aria-label={t('search.area')} onSubmit={submit} noValidate
      style={{ display: 'flex', alignItems: 'center', gap: 8, flex: compact ? 1 : 'none', minWidth: 0 }}>
      <label htmlFor="product-query" className="vh">{t('search.question')}</label>
      <div className="inp" style={compact
        ? { flex: 1, minWidth: 0, height: 44, borderRadius: 999, background: 'var(--sunken)', borderColor: 'transparent' }
        : { flex: 1, minWidth: 0 }}>
        <Ic name="search" className="c2" />
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
      <button type="submit" className={compact ? 'ib' : 'btn btn-p'} disabled={loading}
        aria-label={compact ? (loading ? t('search.loading') : t('search.submit')) : undefined}>
        {compact ? <Ic name="search" /> : (loading ? t('search.loading') : t('search.submit'))}
      </button>
      <button
        type="button"
        className="ib"
        disabled={locationState.kind === 'requesting'}
        aria-label={locationLabel}
        aria-pressed={locationEnabled}
        title={locationLabel}
        style={locationEnabled ? { color: 'var(--primary-text)', background: 'var(--primary-soft)' } : undefined}
        onClick={() => { if (locationEnabled) setLocationState({ kind: 'not_enabled' }); else requestBuyerLocation(); }}
      >
        <Ic name="pin" />
      </button>
    </form>
  );

  const validation = state.kind === 'validation' && <div className="fld"><p id="search-validation" className="emsg" role="alert"><Ic name="alert" />{t('search.validation')}</p></div>;
  const location = locationStatus && <p className="c" role={locationState.kind === 'error' ? 'alert' : 'status'}>{locationStatus}</p>;

  if (!started) {
    return (
      <BuyerScreen section="search" overlay={seller.modal}>
        <main className="body" style={{ gap: 16, padding: '24px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 className="h1">{t('home.title.before')} <span style={{ color: 'var(--primary-text)' }}>{t('home.title.accent')}</span></h1>
            <p className="t c2">{t('home.description')}</p>
          </div>
          {form(false)}
          {validation}
          {location}
          <div className="chips" aria-label={t('search.popularQueries')} role="group">
            {popularSearches.map((term) => (
              <button key={term} type="button" className="chip" disabled={loading} onClick={() => quickSearch(term)}>{term}</button>
            ))}
          </div>
          <a href="/seller" className="c" onClick={(event) => void seller.enter(event)} style={{ marginTop: 'auto' }}>
            {t('buyer.sellerLine')} <Ic name="right" className="xs" />
          </a>
          <p className="c" style={{ color: 'var(--ink3)' }}>{t('common.disclaimer')}</p>
        </main>
      </BuyerScreen>
    );
  }

  const offers = shown?.offers ?? [];
  return (
    <BuyerScreen
      section="search"
      overlay={seller.modal}
      top={<header className="bar" style={{ padding: '0 12px', gap: 8 }}>{form(true)}</header>}
    >
      <main className="body" style={{ gap: 12, padding: 12 }} aria-busy={loading || undefined}>
        {validation}
        {location}
        <p className="c">{buyerLocation ? t('buyer.captionNear') : t('buyer.captionFresh')}</p>
        <p className={offers.length > 0 && !loading ? 'vh' : 'c'} role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
        {state.kind === 'error' && (
          <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14, gap: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}><Ic name="alert" className="dn" /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{t('search.error')}</p></div>
            {lastSearch.current && (
              <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }}
                onClick={() => lastSearch.current && void executeSearch(lastSearch.current.query, lastSearch.current.location)}>
                <Ic name="refresh" className="sm" />{t('cabinet.retry')}
              </button>
            )}
          </div>
        )}
        {loading && offers.length === 0 && <ResultSkeletons />}
        {offers.length > 0 && (
          <ul aria-label={t('search.offers')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {offers.map((offer) => <li key={offer.id}><ResultCard offer={offer} /></li>)}
          </ul>
        )}
      </main>
    </BuyerScreen>
  );
}
