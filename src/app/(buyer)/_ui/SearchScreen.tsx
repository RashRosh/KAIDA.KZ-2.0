'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { offerCount } from '../../../i18n/format';
import { buyerLocationSchema, type BuyerLocation } from '../../../modules/search/contracts/buyer-location.contract';
import {
  NATURAL_SORT_DIRECTION,
  searchQuerySchema,
  searchResponseSchema,
  type SearchResponse,
  type SearchSortDirection,
  type SearchSortMode,
} from '../../../modules/search/contracts/search.contract';
import { normalizeGeoDependentState, readLastSearchState, writeLastSearchState } from '../../../modules/search/last-search-state';
import { Ic } from '../../seller/_kaida/ui';
import { BuyerScreen, ResultCard, ResultSkeletons } from './buyer-ui';
import { SortPopover } from './SortPopover';

// buyer-screens-mockup · the ordinary Search `/` (interim start: field + popular queries) and results (B01). The search behavior is the one of
// S0 / S7 / S9: explicit submit, optional transient buyer location, popular queries, the query kept in the address.
// Stage 6 Rev 3: an explicit sort control (a popover of three criteria — Расстояние, Цена, Актуальность — each with a
// direction); the selected criterion is the real primary ordering and is applied by a new request (ranking stays a server
// authority). Choosing «Расстояние» is itself the explicit geolocation intent.

type SearchState =
  | { kind: 'initial' | 'loading' | 'validation' | 'error' }
  | { kind: 'success'; result: SearchResponse };

type BuyerLocationState =
  | { kind: 'not_enabled' | 'requesting' | 'error' }
  | { kind: 'enabled'; point: BuyerLocation };

// Stage 6C: at most five curated queries — the first five of the existing set; no popularity data is involved.
const popularSearches = ['Баранина', 'Говядина', 'Мёд', 'Картофель', 'Кумыс'] as const;
export function SearchScreen() {
  const { locale, t } = useI18n();
  // The query kept in the address (replaceState below is synced into the router), so Back from an offer page
  // reopens the same results even when the router restores this page from its cache.
  const addressQuery = useSearchParams().get('q') ?? '';
  const [query, setQuery] = useState(addressQuery);
  const [state, setState] = useState<SearchState>(addressQuery ? { kind: 'loading' } : { kind: 'initial' });
  // Stage 6C: the Search Home (field + chips, no feed) shows until a deliberate search starts; `ready` is false only
  // while a plain `/` still decides between the Home and the last Search of this tab (storage is read after mount).
  const [started, setStarted] = useState(Boolean(addressQuery));
  const [ready, setReady] = useState(Boolean(addressQuery));
  const [searchedQuery, setSearchedQuery] = useState('');
  const [shown, setShown] = useState<SearchResponse | null>(null);
  const writtenQuery = useRef<string | null>(null);
  const [locationState, setLocationState] = useState<BuyerLocationState>({ kind: 'not_enabled' });
  // Stage 6 Rev 3: the applied sort criterion and its direction (default: actuality, fresher first).
  const [sort, setSort] = useState<SearchSortMode>('actuality');
  const [direction, setDirection] = useState<SearchSortDirection>(NATURAL_SORT_DIRECTION.actuality);
  // Shown after a geolocation denial for «Расстояние»: the order fell back to the actuality.
  const [distanceNotice, setDistanceNotice] = useState(false);
  const pending = useRef(false);
  const lastSearch = useRef<{ query: string; location?: BuyerLocation; sort: SearchSortMode; direction: SearchSortDirection } | null>(null);
  const localeRef = useRef(locale);
  const previousLocaleRef = useRef(locale);
  const preferencesRef = useRef({ sort, direction });
  const locationRef = useRef<BuyerLocation | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const loading = state.kind === 'loading';
  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => { preferencesRef.current = { sort, direction }; }, [sort, direction]);

  // A language change re-reads the shown results with the same request (query, location, sort, direction): pack and unit
  // labels and comment translations follow the locale; the applied sorting and the results are kept.
  useEffect(() => {
    if (previousLocaleRef.current === locale) return;
    previousLocaleRef.current = locale;
    const last = lastSearch.current;
    if (!shown || shown.offers.length === 0 || !last) return;
    let active = true;
    const request = last.location
      ? fetch(`/api/search?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: last.query, buyerLocation: last.location, sort: last.sort, direction: last.direction }),
        cache: 'no-store',
      })
      : fetch(`/api/search?${new URLSearchParams({ q: last.query, locale, sort: last.sort, direction: last.direction })}`, { cache: 'no-store' });
    void request
      .then(async (response) => response.ok ? searchResponseSchema.parse(await response.json()) : null)
      .then((localized) => {
        if (!active || !localized) return;
        const byId = new Map(localized.offers.map((offer) => [offer.id, offer]));
        setShown((current) => current && ({
          ...current,
          offers: current.offers.map((offer) => {
            const fresh = byId.get(offer.id);
            return { ...offer, pack: fresh ? fresh.pack : offer.pack, price: fresh?.price ?? offer.price, sellerCommentTranslation: fresh?.sellerCommentTranslation };
          }),
        }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [locale, shown]);

  const executeSearch = useCallback(async (
    rawQuery: string,
    buyerLocation: BuyerLocation | undefined,
    requestedSort: SearchSortMode,
    requestedDirection: SearchSortDirection,
  ) => {
    if (pending.current) return;
    // «Расстояние» needs coordinates: without them the request is never sent as `distance` (the API rejects it) — the
    // order falls back to the actuality and the UI says so (it is the same state, not a hidden one).
    const fellBack = requestedSort === 'distance' && !buyerLocation;
    const mode = fellBack ? 'actuality' : requestedSort;
    const order = fellBack ? NATURAL_SORT_DIRECTION.actuality : requestedDirection;
    if (fellBack) {
      setSort(mode);
      setDirection(order);
    }
    const parsed = searchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      setState({ kind: 'validation' });
      input.current?.focus();
      return;
    }
    pending.current = true;
    lastSearch.current = { query: parsed.data, location: buyerLocation, sort: mode, direction: order };
    setStarted(true);
    setSearchedQuery(parsed.data);
    setState({ kind: 'loading' });
    try {
      const response = buyerLocation
        ? await fetch(`/api/search?locale=${localeRef.current}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: parsed.data, buyerLocation, sort: mode, direction: order }),
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })
        : await fetch(`/api/search?${new URLSearchParams({ q: parsed.data, locale: localeRef.current, sort: mode, direction: order })}`, {
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
  // Stage 6C: a plain `/` reopens the last Search of this tab, fetched afresh; with none it is the Search Home. Without
  // buyer coordinates every geo-dependent preference is normalized (UI and the tab state are rewritten alike) and the
  // geolocation is never requested here.
  useEffect(() => {
    if (addressQuery === writtenQuery.current) return;
    const timer = window.setTimeout(() => {
      writtenQuery.current = addressQuery;
      const stored = readLastSearchState();
      const hasCoordinates = locationRef.current !== undefined;
      if (addressQuery) {
        setQuery(addressQuery);
        const preferences = stored && stored.query === addressQuery ? normalizeGeoDependentState(stored, hasCoordinates) : null;
        if (preferences) {
          setSort(preferences.sort);
          setDirection(preferences.direction);
          preferencesRef.current = { sort: preferences.sort, direction: preferences.direction };
        }
        const next = preferences ?? preferencesRef.current;
        void executeSearch(addressQuery, locationRef.current, next.sort, next.direction);
      } else if (stored) {
        const preferences = normalizeGeoDependentState(stored, hasCoordinates);
        setQuery(preferences.query);
        setSort(preferences.sort);
        setDirection(preferences.direction);
        preferencesRef.current = { sort: preferences.sort, direction: preferences.direction };
        void executeSearch(preferences.query, locationRef.current, preferences.sort, preferences.direction);
      } else {
        setQuery('');
        setShown(null);
        setStarted(false);
        setSearchedQuery('');
        setState({ kind: 'initial' });
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [executeSearch, addressQuery]);

  // Stage 6C + Rev 3: the last Search of this tab — query, sort and direction only; never results or coordinates.
  useEffect(() => {
    if (!searchedQuery) return;
    writeLastSearchState({ query: searchedQuery, sort, direction });
  }, [searchedQuery, sort, direction]);

  // Requesting the browser geolocation happens only through an explicit geo intent of the buyer — choosing «Расстояние».
  // On denial or unavailability the ordinary Search keeps working: the order falls back to the actuality.
  function requestBuyerLocation(): Promise<BuyerLocation | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationState({ kind: 'error' });
        resolve(null);
        return;
      }
      setLocationState({ kind: 'requesting' });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const parsed = buyerLocationSchema.safeParse({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setLocationState(parsed.success ? { kind: 'enabled', point: parsed.data } : { kind: 'error' });
          resolve(parsed.success ? parsed.data : null);
        },
        () => {
          setLocationState({ kind: 'error' });
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }

  const buyerLocation = locationState.kind === 'enabled' ? locationState.point : undefined;
  useEffect(() => { locationRef.current = buyerLocation; }, [buyerLocation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeSearch(query, buyerLocation, sort, direction);
  }

  function quickSearch(term: string) {
    if (loading) return;
    setQuery(term);
    void executeSearch(term, buyerLocation, sort, direction);
  }

  function applyOrder(nextSort: SearchSortMode, nextDirection: SearchSortDirection, location: BuyerLocation | undefined) {
    setSort(nextSort);
    setDirection(nextDirection);
    if (lastSearch.current) void executeSearch(lastSearch.current.query, location, nextSort, nextDirection);
  }

  // A choice applies at once. A new criterion starts with its natural direction; the active one reverses its direction.
  async function chooseCriterion(criterion: SearchSortMode) {
    if (loading || locationState.kind === 'requesting') return;
    setDistanceNotice(false);
    const nextDirection = criterion === sort ? (direction === 'asc' ? 'desc' : 'asc') : NATURAL_SORT_DIRECTION[criterion];
    if (criterion === 'distance' && !buyerLocation) {
      const point = await requestBuyerLocation();
      if (point) {
        applyOrder('distance', nextDirection, point);
      } else {
        setDistanceNotice(true);
        if (sort !== 'actuality' || direction !== NATURAL_SORT_DIRECTION.actuality) {
          applyOrder('actuality', NATURAL_SORT_DIRECTION.actuality, undefined);
        }
      }
      return;
    }
    applyOrder(criterion, nextDirection, buyerLocation);
  }

  const form = (compact: boolean, withFilters = true) => (
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
        {query && !loading && (
          <button type="button" className="ib" aria-label={t('search.clear')} style={{ width: 44, height: 44, margin: '0 -12px 0 0' }}
            onClick={() => { setQuery(''); input.current?.focus(); }}><Ic name="close" className="c2" /></button>
        )}
      </div>
      {withFilters && <SortPopover sort={sort} direction={direction} busy={locationState.kind === 'requesting'} disabled={loading || locationState.kind === 'requesting'} onChoose={(criterion) => void chooseCriterion(criterion)} />}
    </form>
  );

  const validation = state.kind === 'validation' && <div className="fld"><p id="search-validation" className="emsg" role="alert"><Ic name="alert" />{t('search.validation')}</p></div>;

  const chips = (
    <div className="chips" aria-label={t('search.popularQueries')} role="group">
      {popularSearches.map((term) => (
        <button key={term} type="button" className="chip" disabled={loading} onClick={() => quickSearch(term)}>{term}</button>
      ))}
    </div>
  );

  // Stage 6C: while a plain `/` decides, nothing flashes; then either the Search Home or the results view follows.
  if (!ready) {
    return <BuyerScreen section="search"><main className="body" aria-busy="true" /></BuyerScreen>;
  }

  // Stage 6C Search Home: the field centered with the curated chips; no feed, no caption, no First Entry.
  if (!started) {
    return (
      <BuyerScreen section="search">
        <main className="body" style={{ justifyContent: 'center', gap: 16, padding: '0 16px 48px' }}>
          {form(false, false)}
          {validation}
          {chips}
        </main>
      </BuyerScreen>
    );
  }

  const visibleOffers = shown?.offers ?? [];
  const orderPhrase = t(`search.order.${sort}.${direction}` as 'search.order.price.asc');
  const feedback = loading
    ? t('search.loadingOffers')
    : state.kind === 'success'
      ? visibleOffers.length === 0 ? t('search.empty') : offerCount(locale, visibleOffers.length)
      : '';

  return (
    <BuyerScreen
      section="search"
      top={<header className="bar" style={{ padding: '0 12px', gap: 8 }}>{form(true)}</header>}
    >
      <div className="chips-row" style={{ padding: '8px 12px 0', flex: 'none', background: 'var(--bg)' }}>{chips}</div>
      <main className="body" style={{ gap: 12, padding: 12 }} aria-busy={loading || undefined}>
        {validation}
        <p className="c">{t('search.orderCaption', { order: orderPhrase })}</p>
        {distanceNotice && (
          <div className="banner gray" role="alert" style={{ gap: 8, padding: 12, borderRadius: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}><Ic name="locate" className="c2" /><p className="c c2" style={{ flex: 1 }}>{t('search.distanceNeedsLocation')}</p></div>
          </div>
        )}
        <p className={visibleOffers.length > 0 && !loading ? 'vh' : 'c'} role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
        {state.kind === 'error' && (
          <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14, gap: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}><Ic name="alert" className="dn" /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{t('search.error')}</p></div>
            {lastSearch.current && (
              <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }}
                onClick={() => lastSearch.current && void executeSearch(lastSearch.current.query, buyerLocation, lastSearch.current.sort, lastSearch.current.direction)}>
                <Ic name="refresh" className="sm" />{t('cabinet.retry')}
              </button>
            )}
          </div>
        )}
        {loading && visibleOffers.length === 0 && <ResultSkeletons />}
        {visibleOffers.length > 0 && (
          <ul aria-label={t('search.offers')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibleOffers.map((offer) => <li key={offer.id}><ResultCard offer={offer} distanceMeters={offer.distanceMeters} /></li>)}
          </ul>
        )}
      </main>
    </BuyerScreen>
  );
}

