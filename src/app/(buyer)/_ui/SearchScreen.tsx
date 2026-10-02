'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { offerCount, offersCount, showOffersLabel } from '../../../i18n/format';
import { buyerLocationSchema, type BuyerLocation } from '../../../modules/search/contracts/buyer-location.contract';
import { searchQuerySchema, searchResponseSchema, type SearchResponse } from '../../../modules/search/contracts/search.contract';
import { filterOffersByRadius } from '../../../modules/search/radius-filter';
import type { SearchSortMode } from '../../../modules/search/config/search-ranking-policy.config';
import { Ic } from '../../seller/_kaida/ui';
import { BuyerScreen, ResultCard, ResultSkeletons } from './buyer-ui';
import { Sheet } from '../../seller/_kaida/ui';
import { useSellerEntry } from './seller-entry';

// buyer-screens-mockup · search start (no frame, mockup classes) and results (B01). The search behavior is the one of
// S0 / S7 / S9: explicit submit, optional transient buyer location, popular queries, the query kept in the address.
// stage #5 (B07): «Фильтры» — sorting «Сначала ближе»/«Сначала актуальнее» and the distance radius; the standalone
// pin toggle is gone — selecting «Сначала ближе» or a finite radius is itself the explicit geolocation intent.

type SearchState =
  | { kind: 'initial' | 'loading' | 'validation' | 'error' }
  | { kind: 'success'; result: SearchResponse };

type BuyerLocationState =
  | { kind: 'not_enabled' | 'requesting' | 'error' }
  | { kind: 'enabled'; point: BuyerLocation };

const RADIUS_OPTIONS = [
  { meters: 1000, labelKey: 'search.radius1' },
  { meters: 3000, labelKey: 'search.radius3' },
  { meters: 5000, labelKey: 'search.radius5' },
] as const;

const popularSearches = ['Баранина', 'Говядина', 'Мёд', 'Картофель', 'Кумыс', 'Яблоки'] as const;
const DEMO_SEEN_KEY = 'kaida_fe_demo_seen';

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
  // stage #5: applied filter values; the sheet edits drafts and «Показать N предложений» commits them.
  const [sortMode, setSortMode] = useState<SearchSortMode>('actuality');
  const [radiusMeters, setRadiusMeters] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftSort, setDraftSort] = useState<SearchSortMode>('actuality');
  const [draftRadius, setDraftRadius] = useState<number | null>(null);
  const pending = useRef(false);
  const lastSearch = useRef<{ query: string; location?: BuyerLocation; sortMode: SearchSortMode } | null>(null);
  const localeRef = useRef(locale);
  const previousLocaleRef = useRef(locale);
  const sortModeRef = useRef(sortMode);
  const locationRef = useRef<BuyerLocation | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const seller = useSellerEntry();
  const loading = state.kind === 'loading';
  // First Entry: the demo plays once on the first visit; later visits, reduced motion and a missing storage show the
  // final frame; a touch of the field or an example stops it and hides the example.
  const [demo, setDemo] = useState<'play' | 'final' | 'off'>('play');

  const demoDecided = useRef(false);
  useEffect(() => {
    // Decided once per page load (a development re-run of the effect would otherwise find the flag it just set).
    if (demoDecided.current) return;
    demoDecided.current = true;
    let seen = true;
    try {
      seen = window.localStorage.getItem(DEMO_SEEN_KEY) === '1';
      if (!seen) window.localStorage.setItem(DEMO_SEEN_KEY, '1');
    } catch {
      // No storage: no demo.
    }
    if (seen) setDemo('final');
  }, []);

  // The tab went to the background during the demo: the final frame at once.
  useEffect(() => {
    const onHidden = () => { if (document.hidden) setDemo((current) => (current === 'play' ? 'final' : current)); };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, []);

  function stopDemo() {
    setDemo('off');
  }

  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => { sortModeRef.current = sortMode; }, [sortMode]);

  // A language change re-reads the shown results with the same request (query, location, sort mode): pack and unit
  // labels and comment translations follow the locale; the applied filters and the results are kept.
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
        body: JSON.stringify({ q: last.query, buyerLocation: last.location, sort: last.sortMode }),
        cache: 'no-store',
      })
      : fetch(`/api/search?${new URLSearchParams({ q: last.query, locale, sort: last.sortMode })}`, { cache: 'no-store' });
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

  const executeSearch = useCallback(async (rawQuery: string, buyerLocation: BuyerLocation | undefined, mode: SearchSortMode) => {
    if (pending.current) return;
    const parsed = searchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      setState({ kind: 'validation' });
      input.current?.focus();
      return;
    }
    pending.current = true;
    lastSearch.current = { query: parsed.data, location: buyerLocation, sortMode: mode };
    setStarted(true);
    setState({ kind: 'loading' });
    try {
      const response = buyerLocation
        ? await fetch(`/api/search?locale=${localeRef.current}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: parsed.data, buyerLocation, sort: mode }),
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })
        : await fetch(`/api/search?${new URLSearchParams({ q: parsed.data, locale: localeRef.current, sort: mode })}`, {
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
        void executeSearch(addressQuery, locationRef.current, sortModeRef.current);
      } else {
        setShown(null);
        setStarted(false);
        setState({ kind: 'initial' });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [executeSearch, addressQuery]);

  // stage #5: requesting the browser geolocation happens only through an explicit geo intent of the buyer —
  // selecting «Сначала ближе» or a finite distance in the sheet (or the banner's retry button). On denial or
  // unavailability the ordinary Search keeps working: «Сначала актуальнее» stays, a finite radius resets to «Любое»,
  // and the sheet banner carries the concise feedback and the retry (contract §4 «Geolocation intent»).
  function revertGeoDependentSettings() {
    setSortMode('actuality');
    setRadiusMeters(null);
    setDraftSort('actuality');
    setDraftRadius(null);
  }

  function requestBuyerLocation() {
    if (locationState.kind === 'requesting') return;
    if (!navigator.geolocation) {
      setLocationState({ kind: 'error' });
      revertGeoDependentSettings();
      return;
    }
    setLocationState({ kind: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const parsed = buyerLocationSchema.safeParse({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationState(parsed.success ? { kind: 'enabled', point: parsed.data } : { kind: 'error' });
        if (!parsed.success) revertGeoDependentSettings();
      },
      () => {
        setLocationState({ kind: 'error' });
        revertGeoDependentSettings();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const buyerLocation = locationState.kind === 'enabled' ? locationState.point : undefined;
  useEffect(() => { locationRef.current = buyerLocation; }, [buyerLocation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeSearch(query, buyerLocation, sortMode);
  }

  function quickSearch(term: string) {
    if (loading) return;
    setQuery(term);
    void executeSearch(term, buyerLocation, sortMode);
  }

  const locationEnabled = locationState.kind === 'enabled';

  function radiusLabel(meters: number): string {
    return t(RADIUS_OPTIONS.find((option) => option.meters === meters)?.labelKey ?? 'search.radiusAny');
  }

  function openSheet() {
    setDraftSort(sortMode);
    setDraftRadius(radiusMeters);
    setSheetOpen(true);
  }

  function selectSort(mode: SearchSortMode) {
    setDraftSort(mode);
    if (mode === 'distance' && !locationEnabled) requestBuyerLocation();
  }

  function selectRadius(meters: number | null) {
    setDraftRadius(meters);
    if (meters !== null && !locationEnabled) requestBuyerLocation();
  }

  // «Показать N предложений» (B07): commit the drafts. The radius is a client-side presentation filter, so it applies
  // without a request; a sort-mode change re-runs the search (ranking stays a server authority). A geo-dependent
  // setting commits only with the granted location.
  function applyFilters() {
    const nextSort = draftSort === 'distance' && !locationEnabled ? sortMode : draftSort;
    const nextRadius = locationEnabled ? draftRadius : null;
    setRadiusMeters(nextRadius);
    if (nextSort !== sortMode) {
      setSortMode(nextSort);
      if (lastSearch.current) void executeSearch(lastSearch.current.query, buyerLocation, nextSort);
    }
    setSheetOpen(false);
  }

  // «Сбросить» (B07): back to the defaults «Сначала актуальнее» / «Любое».
  function resetFilters() {
    setDraftSort('actuality');
    setDraftRadius(null);
    setRadiusMeters(null);
    if (sortMode !== 'actuality') {
      setSortMode('actuality');
      if (lastSearch.current) void executeSearch(lastSearch.current.query, buyerLocation, 'actuality');
    }
    setSheetOpen(false);
  }

  const activeFilters = (sortMode !== 'actuality' ? 1 : 0) + (radiusMeters !== null ? 1 : 0);

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
        {query && !loading && (
          <button type="button" className="ib" aria-label={t('search.clear')} style={{ width: 44, height: 44, margin: '0 -12px 0 0' }}
            onClick={() => { setQuery(''); input.current?.focus(); }}><Ic name="close" className="c2" /></button>
        )}
      </div>
      <button
        type="button"
        className="ib"
        aria-label={activeFilters > 0 ? t('search.filtersActive', { count: activeFilters }) : t('search.filters')}
        aria-haspopup="dialog"
        title={t('search.filters')}
        style={{ width: 44, position: 'relative', ...(activeFilters > 0 ? { color: 'var(--primary-text)', background: 'var(--primary-soft)' } : {}) }}
        onClick={openSheet}
      >
        <Ic name="filter" />
        {activeFilters > 0 && <span className="dot" aria-hidden="true" style={{ top: 4, marginLeft: 26 }}>{activeFilters}</span>}
      </button>
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

  const appliedChips: { key: string; label: string; remove: () => void }[] = [];
  if (sortMode === 'distance') {
    appliedChips.push({
      key: 'sort',
      label: t('search.sortDistance'),
      remove: () => {
        setSortMode('actuality');
        if (lastSearch.current) void executeSearch(lastSearch.current.query, buyerLocation, 'actuality');
      },
    });
  }
  if (radiusMeters !== null) {
    appliedChips.push({ key: 'radius', label: radiusLabel(radiusMeters), remove: () => setRadiusMeters(null) });
  }

  const appliedChipsRow = appliedChips.length > 0 && (
    <div style={{ display: 'flex', gap: 6, overflow: 'hidden', padding: '8px 12px 0', flex: 'none', background: 'var(--bg)' }} aria-label={t('search.activeFilters')}>
      {appliedChips.map((chip) => (
        <button key={chip.key} type="button" className="chip on" style={{ height: 32, padding: '0 8px 0 12px', fontSize: 13 }}
          aria-label={t('search.removeFilter', { label: chip.label })}
          onClick={chip.remove}>
          {chip.label}<Ic name="close" style={{ width: 16, height: 16 }} />
        </button>
      ))}
    </div>
  );

  const geoNeeded = draftSort === 'distance' || draftRadius !== null;
  // After a denial the geo-dependent drafts are reverted, but the concise feedback and the retry (B07) stay
  // visible while the sheet is open.
  const showLocationBanner = sheetOpen && (geoNeeded || locationState.kind === 'error');

  const filtersSheet = sheetOpen && (
    <Sheet title={t('search.filtersTitle')} onClose={() => setSheetOpen(false)} closeLabel={t('search.close')}>
      {showLocationBanner && (
        <div className="banner gray" role={locationState.kind === 'error' ? 'alert' : 'status'} style={{ gap: 8, padding: 12, borderRadius: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Ic name="locate" className="c2" />
            <p className="c c2" style={{ flex: 1 }}>
              {locationState.kind === 'error' ? t('search.locationError') : t('search.locationNeeded')}
            </p>
          </div>
          <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }}
            disabled={locationState.kind === 'requesting'} onClick={requestBuyerLocation}>
            <Ic name="locate" className="sm" />{t('search.allowLocation')}
          </button>
        </div>
      )}
      <div className="ov">{t('search.sorting')}</div>
      <div role="radiogroup" aria-label={t('search.sorting')} style={{ display: 'flex', flexDirection: 'column' }}>
        {(['distance', 'actuality'] as const).map((mode) => (
          <label key={mode} className="li" style={{ minHeight: 40, padding: '2px 0', position: 'relative' }}>
            <input type="radio" name="search-sort" className="cbx" checked={draftSort === mode} onChange={() => selectSort(mode)} />
            <span className={`rd${draftSort === mode ? ' on' : ''}`} aria-hidden="true" />
            <div className="mid"><div className="t">{mode === 'distance' ? t('search.sortDistance') : t('search.sortActuality')}</div></div>
          </label>
        ))}
      </div>
      <div className="ov" style={{ marginTop: 2 }}>{t('search.distanceLabel')}</div>
      <div className="chips" role="radiogroup" aria-label={t('search.distanceLabel')} style={{ gap: 6, flexWrap: 'nowrap' }}>
        {RADIUS_OPTIONS.map(({ meters, labelKey }) => (
          <button key={meters} type="button" role="radio" aria-checked={draftRadius === meters}
            className={`chip${draftRadius === meters ? ' on' : ''}`} style={{ padding: '0 10px', height: 34 }}
            onClick={() => selectRadius(meters)}>
            {t(labelKey)}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={draftRadius === null}
          className={`chip${draftRadius === null ? ' on' : ''}`} style={{ padding: '0 10px', height: 34 }}
          onClick={() => selectRadius(null)}>
          {t('search.radiusAny')}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
        <button type="button" className="btn btn-p lg w" onClick={applyFilters}>
          {showOffersLabel(locale, filterOffersByRadius(shown?.offers ?? [], draftRadius).length)}
        </button>
        <button type="button" className="btn btn-g w" style={{ height: 36 }} onClick={resetFilters}>{t('search.reset')}</button>
      </div>
    </Sheet>
  );

  if (!started) {
    const playing = demo === 'play';
    const demoQuery = t('start.demoQuery');
    const focusField = () => { stopDemo(); input.current?.focus(); };
    return (
      <BuyerScreen
        section="search"
        overlay={seller.modal}
        top={<header className="fe-hdr"><div className="fe-logo"><Ic name="logo" />KAIDA</div></header>}
      >
        <main className={`body fe-body${playing ? ' fe-live' : ''}`}>
          <h1 className="fe-h1">
            <span className="ln"><span>{t('start.title.1')}</span></span>
            <span className="ln"><span>{t('start.title.2')}</span></span>
            <span className="ln"><span>{t('start.title.3')}</span></span>
          </h1>
          <p className="fe-sub">{t('start.sub')}</p>
          <form role="search" aria-label={t('search.area')} className="fe-search" onSubmit={submit} noValidate>
            <Ic name="search" />
            <div className="fe-field">
              <input
                ref={input}
                id="product-query"
                name="q"
                type="search"
                aria-label={t('search.question')}
                placeholder={playing ? '' : t('start.placeholder')}
                value={query}
                readOnly={loading}
                onChange={(event) => setQuery(event.target.value)}
                onPointerDown={stopDemo}
                onFocus={stopDemo}
                onKeyDown={stopDemo}
                aria-invalid={state.kind === 'validation'}
                aria-describedby={state.kind === 'validation' ? 'search-validation' : undefined}
                autoComplete="off"
                enterKeyHint="search"
              />
              {playing && !query && (
                <span className="ph-t" aria-hidden="true">
                  <span className="ph-rest">{t('start.placeholder')}</span>
                  <span className="tp" style={{ '--w': `${demoQuery.length + 0.6}ch`, '--n': demoQuery.length } as React.CSSProperties}>{demoQuery}</span>
                  <span className="fe-caret" />
                </span>
              )}
            </div>
            {query.trim() !== '' && (
              <button type="submit" className="go" aria-label={t('search.submit')} disabled={loading}><Ic name="right" /></button>
            )}
            <span className="fe-wave" aria-hidden="true" />
          </form>
          <div className="fe-note"><Ic name="check" />{t('start.note')}</div>
          {validation}
          {demo !== 'off' && (
            <>
              <div className="ov fe-sell" aria-hidden="true">{t('start.example')}</div>
              <div className="fe-res" aria-hidden="true">
                <ExampleCard n={1} art={<LambArt />} days={0} onOpen={focusField} />
                <ExampleCard n={2} art={<RibsArt />} days={2} onOpen={focusField} />
              </div>
            </>
          )}
        </main>
        <a href="/seller" className={`fe-seller${playing ? ' fe-live' : ''}`} onClick={(event) => void seller.enter(event)}>
          <Ic name="store" />{t('start.sell')}
        </a>
      </BuyerScreen>
    );
  }

  const offers = shown?.offers ?? [];
  // stage #5: the radius is a client-side presentation filter over the complete response (slice contract §2.7).
  const visibleOffers = filterOffersByRadius(offers, radiusMeters);
  const filteredEmpty = radiusMeters !== null && offers.length > 0 && visibleOffers.length === 0;
  const showSummary = !loading && !filteredEmpty && (radiusMeters !== null || sortMode === 'distance');
  const summaryParts = [offersCount(locale, visibleOffers.length)];
  if (radiusMeters !== null) summaryParts.push(radiusLabel(radiusMeters));
  if (sortMode === 'distance') summaryParts.push(t('search.sortDistance'));
  const feedback = loading
    ? t('search.loadingOffers')
    : state.kind === 'success'
      ? visibleOffers.length === 0 ? t('search.empty') : offerCount(locale, visibleOffers.length)
      : '';

  return (
    <BuyerScreen
      section="search"
      overlay={<> {seller.modal} {filtersSheet} </>}
      top={<header className="bar" style={{ padding: '0 12px', gap: 8 }}>{form(true)}</header>}
    >
      {appliedChipsRow}
      <main className="body" style={filteredEmpty
        ? { justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24, textAlign: 'center' }
        : { gap: 12, padding: 12 }} aria-busy={loading || undefined}>
        {validation}
        {showSummary
          ? <p className="c">{summaryParts.join(' · ')}</p>
          : <p className="c">{buyerLocation ? t('buyer.captionNear') : t('buyer.captionFresh')}</p>}
        {!filteredEmpty && <p className={visibleOffers.length > 0 && !loading ? 'vh' : 'c'} role="status" aria-live="polite" aria-atomic="true">{feedback}</p>}
        {state.kind === 'error' && (
          <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14, gap: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}><Ic name="alert" className="dn" /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{t('search.error')}</p></div>
            {lastSearch.current && (
              <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }}
                onClick={() => lastSearch.current && void executeSearch(lastSearch.current.query, buyerLocation, lastSearch.current.sortMode)}>
                <Ic name="refresh" className="sm" />{t('cabinet.retry')}
              </button>
            )}
          </div>
        )}
        {loading && visibleOffers.length === 0 && <ResultSkeletons />}
        {/* Nothing to show (empty result, error, empty query): keep the popular queries as the way forward. */}
        {!loading && visibleOffers.length === 0 && !filteredEmpty && chips}
        {filteredEmpty && (
          <>
            <div className="lic" style={{ width: 64, height: 64, borderRadius: 20 }}><Ic name="filter" className="lg" /></div>
            <h1 className="h2" style={{ margin: 0 }}>{t('search.filteredEmptyTitle')}</h1>
            <p className="t c2" style={{ margin: 0 }}>{t('search.filteredEmptyText', { query, count: offersCount(locale, offers.length) })}</p>
            <button type="button" className="btn btn-p lg w" onClick={resetFilters}>{t('search.resetFilters')}</button>
            <button type="button" className="btn btn-g w" onClick={openSheet}>{t('search.editFilters')}</button>
          </>
        )}
        {visibleOffers.length > 0 && (
          <ul aria-label={t('search.offers')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibleOffers.map((offer) => <li key={offer.id}><ResultCard offer={offer} distanceMeters={offer.distanceMeters} /></li>)}
          </ul>
        )}
      </main>
    </BuyerScreen>
  );
}

// First Entry example: a fixture of two AI-B01 cards in the state «Пример» (the same for everyone, no request); the
// drawings are the mockup's illustrations; nothing on it is active.
function ExampleCard({ n, art, days, onOpen }: { n: 1 | 2; art: React.ReactNode; days: number; onOpen: () => void }) {
  const { t } = useI18n();
  const dist = t(n === 1 ? 'start.ex1.dist' : 'start.ex2.dist');
  const bold = /^\S+ \S+/.exec(dist)?.[0] ?? dist;
  return (
    <article className={`card fe-offer k${n}`} onClick={onOpen}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="fe-photo">{art}<span className={`fresh fr${days}`}>{t(n === 1 ? 'start.ex1.fresh' : 'start.ex2.fresh')}</span></div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
          <h3 className="h3 o-t" style={{ fontSize: 16, lineHeight: '21px', margin: 0 }}>{t(n === 1 ? 'start.ex1.name' : 'start.ex2.name')}</h3>
          <div className="o-p"><span className="pr">{n === 1 ? '4 200' : '3 900'} ₸</span> <span className="c2" style={{ fontSize: 14 }}>/ кг</span></div>
          <p className="c c2 o-l">{t(n === 1 ? 'start.ex1.shop' : 'start.ex2.shop')}</p>
          <div className="fe-dist o-l">
            <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true"><circle cx="3" cy="12" r="2.5" fill="var(--primary)" /><path className="arc" d="M5 11 Q15 -1 25 8" stroke="var(--primary)" strokeWidth="2" fill="none" strokeLinecap="round" /><circle cx="26" cy="9" r="3.2" fill="#fff" stroke="var(--primary)" strokeWidth="2" /></svg>
            <b style={{ fontWeight: 600 }}>{bold}</b> <span className="c2">{dist.slice(bold.length).trim()}</span>
          </div>
        </div>
      </div>
      <div className="fe-cts" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="ct route"><Ic name="route" className="sm" />{t('offer.route')}</span>
        <span className="sp" />
        <div className="cts">
          <span className="ct"><Ic name="phone" /></span>
          {/* eslint-disable-next-line @next/next/no-img-element -- the mockup's official marks */}
          <span className="ct"><img src="/kaida/icons/127a626f246aa48c4b8bc196e32e93a2.svg" alt="" /></span>
          {/* eslint-disable-next-line @next/next/no-img-element -- the mockup's official marks */}
          <span className="ct"><img src="/kaida/icons/24ad95a4b3664ef668a9dad80a7f425a.svg" alt="" /></span>
        </div>
      </div>
    </article>
  );
}

function LambArt() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="#efe4d8" /><ellipse cx="50" cy="66" rx="46" ry="24" fill="#c49a6c" /><ellipse cx="50" cy="63" rx="46" ry="24" fill="#d4ad7f" /><path d="M22 58c-4-14 8-26 26-27 17-1 32 6 34 18 2 11-9 19-27 20-18 1-30-2-33-11z" fill="#f2d7cc" /><path d="M26 57c-3-11 7-21 22-22 15-1 27 5 29 15 1 9-8 15-23 16-15 1-25-1-28-9z" fill="#b8433d" /><path d="M33 49c8-4 18-5 27-2M36 58c9-3 19-3 29 1M45 42c3 6 3 13 0 19" stroke="#e7aa9e" strokeWidth="2" fill="none" strokeLinecap="round" /><circle cx="71" cy="47" r="6" fill="#f6eee2" /><circle cx="71" cy="47" r="2.6" fill="#e0d2bd" /></svg>
  );
}

function RibsArt() {
  const bones = [28, 39, 50, 61, 72];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="#ece2d6" /><ellipse cx="50" cy="68" rx="46" ry="22" fill="#b48d63" /><ellipse cx="50" cy="65" rx="46" ry="22" fill="#cda77a" /><path d="M24 44c10-6 42-6 54 0v26c-12 5-44 5-54 0z" fill="#f2d7cc" />
      {bones.map((x) => (
        <g key={x}><rect x={x} y="36" width="9" height="34" rx="4.5" fill="#b8433d" /><rect x={x + 2.5} y="30" width="4" height="12" rx="2" fill="#f6eee2" /><path d={`M${x + 2} 50h5M${x + 2} 58h5`} stroke="#e7aa9e" strokeWidth="1.6" strokeLinecap="round" /></g>
      ))}
    </svg>
  );
}
