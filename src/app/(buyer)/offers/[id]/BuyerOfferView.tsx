'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BuyerReportFlow } from './BuyerReportFlow';
import { useRouter, useSearchParams } from 'next/navigation';
import { safePreviewReturn } from '@/modules/offers/preview/preview-link';
import type { BuyerOfferPage } from '@/modules/search/application/get-buyer-offer';
import { useI18n } from '@/i18n/I18nProvider';
import { Ic } from '../../../seller/_kaida/ui';
import { BuyerScreen, cameFromList } from '../../_ui/buyer-ui';
import { OfferDetails, OfferRoute } from '../../_ui/offer-details';
import { SearchIcon } from '../../_ui/SearchIcon';
import styles from '../../_ui/offer.module.css';
import { useFavourites } from '../../_ui/use-favourites';
import { favouritesReturn } from '@/modules/favourites/safe-return';
import { useInterest } from '../../_ui/use-interest';

// buyer-screens-mockup · B02 offer detail: gallery (or neutral fallback, or a photo error that keeps the data), the
// actuality plaque, name, pack, price, the seller comment, the point block with route and contacts, the seller and
// the interest action. Same eligibility as Search (offer-photos §2).

// post-publication-buyer-preview: the Seller's preview of an own published Offer — `preview=1` with a safe `return` path inside
// the Seller cabinet. It only adds a note, a way back and hides the interest action; the page and its data are the buyer's.
function usePreviewReturn(): string | null {
  const params = useSearchParams();
  return params.get('preview') === '1' ? safePreviewReturn(params.get('return')) : null;
}

function PreviewNote({ returnTo }: { returnTo: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div role="note" style={{ display: 'flex', flexDirection: 'column', padding: '8px 16px', background: 'var(--sunken)', borderBottom: '1px solid var(--line)' }}>
      <p className="c c2" style={{ margin: 0 }}>{t('preview.strip')}</p>
      <Link
        href={returnTo}
        className="t"
        style={{ margin: '-6px 0', padding: '12px 0', display: 'block', textDecoration: 'underline', overflowWrap: 'anywhere' }}
        onClick={(event) => {
          if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
            event.preventDefault();
            router.back();
          }
        }}
      >{t('preview.back')}</Link>
    </div>
  );
}

function BackLink({ returnTo }: { returnTo: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Link
      href={returnTo ?? '/'}
      className={styles.iconButton}
      aria-label={t('offer.back')}
      onClick={(event) => {
        // Back to the same results (the query is kept in the search address); a direct visit goes to search.
        if (window.history.length > 1 && ((returnTo === null && cameFromList()) || (returnTo !== '/favourites' && document.referrer.startsWith(window.location.origin)))) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <SearchIcon name="left" />
    </Link>
  );
}

// D3 · B08 top bar: back 48 + «Предложение»; no share, no bottom navigation.
function OfferTop({ returnTo }: { returnTo: string | null }) {
  const { t } = useI18n();
  return (
    <header className={`${styles.tokens} ${styles.top}`}>
      <BackLink returnTo={returnTo} />
      <h1>{t('offer.title')}</h1>
    </header>
  );
}

export function BuyerOfferView({ offer, reporting = false }: { offer: BuyerOfferPage; reporting?: boolean }) {
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useI18n();
  const previewReturn = usePreviewReturn();
  const params = useSearchParams();
  const returnTo = previewReturn ?? (params.get('preview') === '1' ? null : favouritesReturn(params.get('return')));
  // in the Seller's preview there is no interest action and no request for it
  const preview = params.get('preview') === '1';
  const interest = useInterest(previewReturn === null ? offer.product.id : null);
  const fav = useFavourites({ offerId: offer.id, locationId: offer.location.id }, !preview);
  if (fav.unavailable) return <OfferUnavailable failed={false} />;
  if (reportOpen) return <BuyerReportFlow offerId={offer.id} onClose={() => { setReportOpen(false); requestAnimationFrame(() => document.getElementById('report-entry')?.focus()); }} />;
  const showReport = reporting && previewReturn === null;
  return (
    <BuyerScreen section="search" className={styles.screen} nav={false} top={<OfferTop returnTo={returnTo} />} overlay={<>{interest.modal}{fav.modal}</>}>
      <main className={`body np ${styles.body}`}>
        {previewReturn !== null && <PreviewNote returnTo={previewReturn} />}
        <OfferDetails
          offer={offer}
          titleAction={!preview && <button data-testid="favourite-heart" type="button" className={styles.heart} data-error={fav.error || undefined} aria-label={fav.active ? t('fav.saved') : t('fav.save')} aria-pressed={fav.active} aria-busy={fav.pendingId !== null} disabled={!fav.available || fav.pendingId !== null} onClick={fav.toggle}><SearchIcon name="heart" filled={fav.active} /></button>}
          afterTitle={!preview && fav.active && <p className={styles.savedNote}>{t('offer.savedNote')}</p>}
          footer={(
            <>
              {(showReport || interest.available) && <div className={styles.links} data-testid="offer-links">
                {showReport && <button id="report-entry" type="button" className={styles.link} onClick={() => setReportOpen(true)}>{t('offer.reportCard')}</button>}
                {interest.available && (
                  <button type="button" className={styles.link} aria-pressed={interest.active} aria-busy={interest.pending} disabled={interest.pending} onClick={(event) => void interest.toggle(event)}>
                    <Ic name={interest.active ? 'starf' : 'star'} className="sm" />
                    <span>{t('offer.trackProduct')}</span>
                  </button>
                )}
              </div>}
              {fav.error && <p className={styles.alert} role="alert">{t('fav.writeError')}</p>}
              {!preview && fav.state.kind === 'error' && <div role="alert" className={styles.section}><p className={styles.alert}>{t('fav.loadError')}</p><button type="button" className={styles.secondary} onClick={() => void fav.reload()}>{t('cabinet.retry')}</button></div>}
              {interest.error && <p className={styles.alert} role="alert">{t('search.interestError')}</p>}
            </>
          )}
        />
      </main>
      {!preview && offer.routeAvailable && <div className={`${styles.tokens} ${styles.sticky}`}><OfferRoute offer={offer} /></div>}
    </BuyerScreen>
  );
}

function UnavailableArt() {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true">
      <rect x="28" y="22" width="104" height="80" rx="14" fill="#f4e9fb" stroke="#e9d9f2" strokeWidth="2" />
      <rect x="44" y="40" width="44" height="8" rx="4" fill="#e9d9f2" />
      <rect x="44" y="56" width="72" height="6" rx="3" fill="#e9d9f2" />
      <rect x="44" y="70" width="56" height="6" rx="3" fill="#e9d9f2" />
      <circle cx="118" cy="88" r="16" fill="#fdfbff" stroke="#9073a0" strokeWidth="2" />
      <path d="M111 88h14" stroke="#9073a0" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// D3 · B08.ST08: the unavailable Offer (illustration, title, text, back) and the load error (notice with Retry over skeletons).
export function OfferUnavailable({ failed }: { failed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  // in the Seller's preview the way back is the card, not the search
  const previewReturn = usePreviewReturn();
  const params = useSearchParams();
  const returnTo = previewReturn ?? (params.get('preview') === '1' ? null : favouritesReturn(params.get('return')));
  const backLabel = returnTo === '/favourites' ? t('fav.back') : returnTo !== null ? t('preview.back') : t('offer.backToResults');
  return (
    <BuyerScreen section="search" className={styles.screen} nav={false} top={<OfferTop returnTo={returnTo} />}>
      <main className={`body np ${styles.body}`}>
        {failed ? (
          <div className={`${styles.tokens} ${styles.state}`}>
            <div className={styles.errorNotice} role="alert">
              <div>
                <SearchIcon name="alert" />
                <p><strong>{t('offer.loadFailedTitle')}</strong> {t('offer.loadFailedText')}</p>
              </div>
              <button type="button" className={styles.secondary} onClick={() => router.refresh()}><SearchIcon name="refresh" />{t('cabinet.retry')}</button>
            </div>
            <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className={styles.skeleton} style={{ aspectRatio: '1 / 1', borderRadius: 20 }} />
              <span className={styles.skeleton} style={{ height: 28, width: '70%' }} />
              <span className={styles.skeleton} style={{ height: 36, width: '45%' }} />
              <span className={styles.skeleton} style={{ height: 96 }} />
            </div>
          </div>
        ) : (
          <div className={`${styles.tokens} ${styles.state}`} aria-labelledby="offer-unavailable">
            <div className={styles.empty}>
              <UnavailableArt />
              <h2 id="offer-unavailable">{t('offer.unavailableTitle')}</h2>
              <p>{t('offer.unavailableText')}</p>
            </div>
            <Link href={returnTo ?? '/'} className={styles.primary}>{backLabel}</Link>
          </div>
        )}
      </main>
    </BuyerScreen>
  );
}
