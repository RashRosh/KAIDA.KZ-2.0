'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { nearbyResponseSchema, type NearbyResponse } from '@/modules/discovery/contracts/discovery.contract';
import { buyerLocationSchema, type BuyerLocation } from '@/modules/search/contracts/buyer-location.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatAmount } from '../../_components/format-amount';
import { priceBasisText } from '../../../modules/offers/price-unit/price-basis';
import { BuyerScreen, NEARBY_NAV_INTENT_KEY, formatDistance, markBuyerOfferOpened } from '../_ui/buyer-ui';
import { ConfirmationBadge } from '../_ui/SearchResultCard';
import { KaidaMark } from '../_ui/offer-details';
import { SearchIcon } from '../_ui/SearchIcon';
import { useFavourites } from '../_ui/use-favourites';
import styles from './nearby.module.css';

// D5 · B07 «Рядом»: the grid of nearby offers. Launch behaviour, privacy and the discovery API stay as closed by
// UX1C / nearby-result-first / S11; only the presentation follows the source (docs/slices/design-nearby).

type NearbyState =
  | { kind: 'initial' | 'locating' | 'loading' | 'geo_error' | 'request_error' }
  | { kind: 'success'; result: NearbyResponse };

// B07.ST01: pin illustration (гео-прицел).
function PinAimIllustration() {
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true">
      <circle cx="120" cy="90" r="64" fill="#f8e5ff" />
      <circle cx="120" cy="90" r="42" fill="#efc7ff" />
      <circle cx="120" cy="90" r="20" fill="#9900cc" />
      <circle cx="120" cy="90" r="7" fill="#fdfbff" />
      <rect x="116" y="14" width="8" height="22" rx="4" fill="#5b406a" />
      <rect x="116" y="144" width="8" height="22" rx="4" fill="#5b406a" />
      <rect x="44" y="86" width="22" height="8" rx="4" fill="#5b406a" />
      <rect x="174" y="86" width="22" height="8" rx="4" fill="#5b406a" />
    </svg>
  );
}

// B07.ST04: denial illustration (перечёркнутые круги).
function DeniedIllustration() {
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true">
      <circle cx="120" cy="90" r="64" fill="#f4e9fb" />
      <circle cx="120" cy="90" r="42" fill="#e9d9f2" />
      <circle cx="120" cy="90" r="20" fill="#d8c3e4" />
      <rect x="48" y="84" width="144" height="12" rx="6" transform="rotate(-35 120 90)" fill="#5b406a" />
    </svg>
  );
}

// B07.ST05: empty result illustration (пин над землёй).
function EmptyIllustration() {
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true">
      <path d="M120 150s-44-38-44-72a44 44 0 0 1 88 0c0 34-44 72-44 72z" fill="#e29dff" />
      <circle cx="120" cy="78" r="22" fill="#fdfbff" />
      <rect x="60" y="152" width="120" height="10" rx="5" fill="#d8c3e4" />
    </svg>
  );
}

const skeletonTiles = [
  [85, 55, 70],
  [75, 50, 65],
  [80, 60, 70],
  [90, 45, 60],
] as const;

function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className={styles.grid} aria-hidden="true">
      {skeletonTiles.slice(0, count).map((widths, index) => (
        <li key={index} className={styles.tile} data-testid="nearby-skeleton">
          <div className={styles.thumb} />
          <span className={styles.sk} style={{ height: 16, width: `${widths[0]}%` }} />
          <span className={styles.sk} style={{ height: 20, width: `${widths[1]}%` }} />
          <span className={styles.sk} style={{ height: 14, width: `${widths[2]}%` }} />
        </li>
      ))}
    </ul>
  );
}

export function NearbyFeed() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<NearbyState>({ kind: 'initial' });
  const pending = useRef(false);
  const localeRef = useRef(locale);
  const lastLocation = useRef<BuyerLocation | null>(null);
  const favourites = useFavourites(null);
  const [favouriteTargetId, setFavouriteTargetId] = useState<string | null>(null);

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
      lastLocation.current = buyerLocation;
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

    // B07.ST06 copy assumes the location may already be known: an explicit retry after a request error repeats the
    // query for the same transient coordinates without a new geolocation call (UX1C/S9 semantics unchanged).
    if (lastLocation.current) {
      void loadNearby(lastLocation.current);
      return;
    }

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
  const hasResults = state.kind === 'success' && state.result.offers.length > 0;

  const top = (
    <header className={styles.top}>
      <h1>{t('nearby.title')}</h1>
      {/* nearby-result-first: the explicit refresh stays; B07.ST03 draws the bar without it, so it is a quiet icon. */}
      {hasResults && (
        <button type="button" className={styles.refresh} disabled={busy} onClick={requestNearby} aria-label={t('nearby.refresh')} title={t('nearby.refresh')}>
          <SearchIcon name="refresh" />
        </button>
      )}
    </header>
  );

  return (
    <BuyerScreen
      section="nearby"
      className={styles.screen}
      top={top}
      overlay={favourites.modal}
    >
      <main
        className={`body ${styles.body} ${state.kind === 'initial' || state.kind === 'geo_error' ? styles.bodyStart : ''}`}
        aria-busy={busy || undefined}
        aria-label={t('nearby.area')}
      >
        {/* B07.ST01 · Геолокация ещё не включена: явное действие вместо автозапроса */}
        {state.kind === 'initial' && (
          <>
            <div className={styles.empty}>
              <PinAimIllustration />
              <h2>{t('nearby.introTitle')}</h2>
              <p>{t('nearby.introText')}</p>
            </div>
            <div className={styles.choices}>
              <button type="button" className={"btn btn-p lg w"} onClick={requestNearby}>
                <SearchIcon name="aim" />{t('nearby.startLocation')}
              </button>
              <Link href="/" className={`${styles.link} ${styles.choicesLink}`}>{t('nearby.searchByName')}</Link>
            </div>
          </>
        )}

        {/* B07.ST02/ST08 · Определяем местоположение / загрузка: уведомление и скелетон сетки */}
        {(state.kind === 'locating' || state.kind === 'loading') && (
          <>
            <div className={styles.notice} role="status">
              <span className={styles.spin} aria-hidden="true" />
              <span>{state.kind === 'locating' ? t('nearby.locating') : t('nearby.loading')}</span>
            </div>
            <GridSkeleton />
          </>
        )}

        {/* B07.ST04/ST08 · Отказ, таймаут или браузер без геолокации */}
        {state.kind === 'geo_error' && (
          <>
            <div className={styles.empty}>
              <DeniedIllustration />
              <h2>{t('nearby.geoTitle')}</h2>
              <p>{t('nearby.geoText')}</p>
            </div>
            <div className={styles.choices}>
              <button type="button" className={"btn btn-p lg w"} onClick={requestNearby}>
                {t('nearby.tryAgain')}
              </button>
              <Link href="/" className={`${styles.link} ${styles.choicesLink}`}>{t('nearby.searchByName')}</Link>
            </div>
          </>
        )}

        {/* B07.ST06/ST08 · Ошибка загрузки и повтор */}
        {state.kind === 'request_error' && (
          <>
            <div className={styles.errNotice} role="alert">
              <div>
                <SearchIcon name="alert" />
                <p><b>{t('nearby.requestErrorTitle')}</b> {t('nearby.requestErrorText')}</p>
              </div>
              <button type="button" className={`btn btn-o ${styles.errButton}`} onClick={requestNearby}>
                <SearchIcon name="refresh" />{t('cabinet.retry')}
              </button>
            </div>
            <div className={styles.dimmed}>
              <GridSkeleton count={2} />
            </div>
          </>
        )}

        {/* B07.ST05/ST08 · Местоположение известно, предложений рядом нет */}
        {state.kind === 'success' && state.result.offers.length === 0 && (
          <>
            <div className={styles.empty}>
              <EmptyIllustration />
              <h2>{t('nearby.emptyTitle')}</h2>
              <p>{t('nearby.emptyText')}</p>
            </div>
            <div style={{ marginTop: 8 }}>
              <Link href="/" className={"btn btn-p lg w"}>{t('nearby.searchByName')}</Link>
            </div>
          </>
        )}

        {/* B07.ST03/ST07/ST09/ST10 · Сетка по две карточки */}
        {hasResults && (
          <>
            <p className="vh" role="status" aria-live="polite" aria-atomic="true">
              {t('nearby.found', { count: state.result.offers.length })}
            </p>
            <ul className={styles.grid} aria-label={t('nearby.offersTitle')}>
              {state.result.offers.map((offer) => {
                const basis = priceBasisText(offer.price.unit, offer.pack);
                const active = favourites.state.kind === 'ready'
                  && favourites.state.favourites.some(f => f.offerId === offer.id && f.locationId === offer.location.id);
                return (
                  <li key={offer.id}>
                    <article className={`linkcard ${styles.tile}`} data-testid="nearby-tile" aria-labelledby={`nearby-${offer.id}`}>
                      <div className={styles.thumb}>
                        <KaidaMark />
                        {offer.coverPhotoId && (
                          // eslint-disable-next-line @next/next/no-img-element -- existing immutable public photo route
                          <img src={`/media/photos/${offer.coverPhotoId}/thumb`} alt="" loading="lazy" />
                        )}
                      </div>
                      <div className={styles.nm}>
                        <h3 className={styles.tt} id={`nearby-${offer.id}`} lang={offer.product.nameLocale}>
                          <Link href={`/offers/${offer.id}`} className="stretch" onClick={markBuyerOfferOpened}>{offer.product.name}</Link>
                        </h3>
                        <button
                          type="button"
                          className={styles.heart}
                          data-testid="favourite-heart"
                          aria-label={active ? t('fav.remove') : t('fav.save')}
                          aria-pressed={active}
                          aria-busy={favourites.pendingId === offer.id || undefined}
                          data-error={favourites.error && favouriteTargetId === offer.id || undefined}
                          disabled={!favourites.available || favourites.pendingId !== null}
                          onClick={event => {
                            setFavouriteTargetId(offer.id);
                            favourites.toggleOffer(event, { offerId: offer.id, locationId: offer.location.id });
                          }}
                        >
                          <SearchIcon name="heart" filled={active} />
                        </button>
                      </div>
                      <p className={styles.price}>
                        {formatAmount(offer.price.amount)}&nbsp;₸{basis && <>{' '}<small>{basis}</small></>}
                      </p>
                      <ConfirmationBadge offer={offer} className={styles.fresh} />
                      <span className={styles.cap2}>{formatDistance(offer.distanceMeters, t)}</span>
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </BuyerScreen>
  );
}
