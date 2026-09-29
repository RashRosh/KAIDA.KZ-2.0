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
  const pending = useRef(false);
  const lastSearch = useRef<{ query: string; location?: BuyerLocation } | null>(null);
  const localeRef = useRef(locale);
  const previousLocaleRef = useRef(locale);
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
        {query && !loading && (
          <button type="button" className="ib" aria-label={t('search.clear')} style={{ width: 44, height: 44, margin: '0 -12px 0 0' }}
            onClick={() => { setQuery(''); input.current?.focus(); }}><Ic name="close" className="c2" /></button>
        )}
      </div>
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

  const chips = (
    <div className="chips" aria-label={t('search.popularQueries')} role="group">
      {popularSearches.map((term) => (
        <button key={term} type="button" className="chip" disabled={loading} onClick={() => quickSearch(term)}>{term}</button>
      ))}
    </div>
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
        {/* Nothing to show (empty result, error, empty query): keep the popular queries as the way forward. */}
        {!loading && offers.length === 0 && chips}
        {offers.length > 0 && (
          <ul aria-label={t('search.offers')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {offers.map((offer) => <li key={offer.id}><ResultCard offer={offer} /></li>)}
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
