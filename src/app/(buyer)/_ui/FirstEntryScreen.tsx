'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { Locale } from '../../../i18n/config';
import { searchQuerySchema } from '../../../modules/search/contracts/search.contract';
import { Ic } from '../../seller/_kaida/ui';
import { BuyerScreen } from './buyer-ui';
import { writeIntroMarker } from './intro-marker';
import { useSellerEntry } from './seller-entry';

// First Entry correction (stage 6B): `/welcome` is the onboarding start page (first-entry-mobile layout, demo, example
// fixture) with the language switch of the mockup header; it is not a mode of the ordinary Search `/`.
const DEMO_SEEN_KEY = 'kaida_fe_demo_seen';

// The names are always written in their own language, so they are not part of the string catalog.
const LANGUAGES: { locale: Locale; short: string; name: string }[] = [
  { locale: 'ru', short: 'РУС', name: 'Русский' },
  { locale: 'kk', short: 'ҚАЗ', name: 'Қазақша' },
];

export function FirstEntryScreen() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const seller = useSellerEntry();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // The demo plays once on the first visit; later visits, reduced motion and a missing storage show the final frame;
  // a touch of the field or an example stops it and hides the example.
  const [demo, setDemo] = useState<'play' | 'final' | 'off'>('play');

  // First Entry is shown: the intro marker is set (separate from the demo flag below).
  useEffect(() => { writeIntroMarker(); }, []);

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

  // The language applies at once: the demo is not replayed, the typed text and the route stay.
  function chooseLanguage(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    router.refresh();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (leaving) return;
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    setLeaving(true);
    router.push(`/?${new URLSearchParams({ q: parsed.data })}`);
  }

  const playing = demo === 'play';
  const demoQuery = t('start.demoQuery');
  const focusField = () => { stopDemo(); input.current?.focus(); };

  return (
    <BuyerScreen
      section="search"
      overlay={seller.modal}
      top={(
        <header className="fe-hdr">
          <div className="fe-logo"><Ic name="logo" />KAIDA</div>
          <div className="lang" role="group" aria-label={t('more.language')}>
            {LANGUAGES.map((language) => (
              <button
                key={language.locale}
                type="button"
                lang={language.locale}
                aria-label={language.name}
                aria-pressed={locale === language.locale}
                onClick={() => chooseLanguage(language.locale)}
              >
                {language.short}
              </button>
            ))}
          </div>
        </header>
      )}
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
              readOnly={leaving}
              onChange={(event) => { setQuery(event.target.value); setInvalid(false); }}
              onPointerDown={stopDemo}
              onFocus={stopDemo}
              onKeyDown={stopDemo}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'search-validation' : undefined}
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
            <button type="submit" className="go" aria-label={t('search.submit')} disabled={leaving}><Ic name="right" /></button>
          )}
          <span className="fe-wave" aria-hidden="true" />
        </form>
        <div className="fe-note"><Ic name="check" />{t('start.note')}</div>
        {invalid && <div className="fld"><p id="search-validation" className="emsg" role="alert"><Ic name="alert" />{t('search.validation')}</p></div>}
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
