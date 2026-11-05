'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { photoUrl } from '@/modules/media/contracts/photo.contract';
import type { BuyerOfferPage } from '@/modules/search/application/get-buyer-offer';
import { buildContactActions } from '@/modules/sellers/contact/build-contact-actions';
import { priceBasisText } from '@/modules/offers/price-unit/price-basis';
import { useI18n } from '@/i18n/I18nProvider';
import { OpeningSchedule, OpeningStatusLine } from '../../_components/OpeningHoursLine';
import { formatAmount } from '../../_components/format-amount';
import { ConfirmationBadge } from './SearchResultCard';
import { SearchIcon } from './SearchIcon';
import styles from './offer.module.css';

// D3 · B08 offer detail (new baseline), as ONE component: square gallery (or «no photo», or a photo error that keeps the
// data), name, price and the heart slot, the confirmation pill, the point card (place, seller, hours), contacts, the seller
// comment. The buyer's Offer page and the Seller's private pre-publication preview (pre-publication-buyer-preview §3.3)
// both draw it, so the preview cannot drift from the real page. `inert` draws contacts and the route as they look but
// without any action (a preview); on the buyer page the route is the page's bottom bar instead.

export function KaidaMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18.23 27.17" aria-hidden="true">
      <path d="M5.69 11.09c0.71,1.24 0.29,2.81 -0.95,3.53 -1.24,0.71 -2.82,0.29 -3.53,-0.94 -0.81,-1.41 -1.22,-2.98 -1.22,-4.56 0,-2.33 0.89,-4.67 2.67,-6.44 1.78,-1.78 4.11,-2.67 6.45,-2.67 2.33,0 4.67,0.89 6.44,2.67 1.78,1.78 2.67,4.11 2.67,6.45 0,2.33 -0.89,4.67 -2.67,6.44 -2.15,2.15 -4.3,4.3 -6.45,6.45l-1.83 -1.83c-1.01,-1.01 -1.01,-2.64 0,-3.65l4.62 -4.62c0.77,-0.77 1.16,-1.78 1.16,-2.79 0,-1.01 -0.39,-2.02 -1.16,-2.79 -0.77,-0.77 -1.78,-1.16 -2.79,-1.16 -1.01,0 -2.02,0.39 -2.79,1.16 -0.77,0.77 -1.16,1.78 -1.16,2.79 0,0.68 0.18,1.37 0.53,1.97zm3.42 16.08c1.43,0 2.58,-1.16 2.58,-2.58 0,-1.43 -1.16,-2.58 -2.58,-2.58 -1.43,0 -2.58,1.16 -2.58,2.58 0,1.43 1.16,2.58 2.58,2.58z" />
    </svg>
  );
}

function GalleryPhoto({ photoId, alt }: { photoId: string; alt: string }) {
  const { t } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  // A server-rendered photo can fail before hydration, when React's onError is not attached yet.
  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) setFailed(true);
  }, [attempt]);
  if (failed) {
    // B08.ST05 · the photo area says so; data and actions below stay.
    return (
      <div role="alert" style={{ display: 'contents' }}>
        <KaidaMark className={styles.logo} />
        <p className={styles.frameLabel}>{t('offer.photoFailed')}</p>
        <button type="button" className={styles.secondary} onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>
          <SearchIcon name="refresh" />{t('offer.photoRetry')}
        </button>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- public, immutable photo route
    <img ref={image} key={attempt} src={`${photoUrl(photoId, 'display')}${attempt ? `?r=${attempt}` : ''}`} alt={alt} onError={() => setFailed(true)} />
  );
}

function Gallery({ offer }: { offer: BuyerOfferPage }) {
  const { t } = useI18n();
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const count = offer.photos.length;

  if (count === 0) {
    return (
      <div className={styles.frame} role="img" aria-label={t('offer.noPhotoSeller')} data-testid="offer-no-photo">
        <KaidaMark className={styles.logo} />
        <p className={styles.frameLabel} aria-hidden="true">{t('offer.noPhotoSeller')}</p>
      </div>
    );
  }

  function go(to: number) {
    const element = track.current;
    if (!element) return;
    const next = Math.max(0, Math.min(count - 1, to));
    element.scrollTo({ left: next * element.clientWidth, behavior: 'smooth' });
    setIndex(next);
  }

  return (
    <section className={styles.gallery} aria-label={t('offer.gallery')} aria-roledescription="carousel">
      <div className={styles.frame}>
        <ul
          ref={track}
          className={styles.track}
          onScroll={(event) => {
            const element = event.currentTarget;
            setIndex(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)));
          }}
        >
          {offer.photos.map((photo, position) => (
            <li key={photo.id} aria-hidden={position !== index || undefined}>
              <GalleryPhoto photoId={photo.id} alt={t('offer.photoAlt', { name: offer.product.name, position: position + 1, count })} />
            </li>
          ))}
        </ul>
        {count > 1 && (
          <>
            <button type="button" className={`${styles.photoNav} ${styles.prev}`} onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('offer.prevPhoto')}><SearchIcon name="left" /></button>
            <button type="button" className={`${styles.photoNav} ${styles.next}`} onClick={() => go(index + 1)} disabled={index === count - 1} aria-label={t('offer.nextPhoto')}><SearchIcon name="right" /></button>
            <span className={styles.counter} aria-hidden="true">{index + 1} / {count}</span>
          </>
        )}
      </div>
      {count > 1 && (
        <>
          <div className={styles.dots} aria-hidden="true">
            {offer.photos.map((photo, position) => <i key={photo.id} data-on={position === index || undefined} />)}
          </div>
          <p className="vh" aria-live="polite">{t('offer.photoCounter', { position: index + 1, count })}</p>
        </>
      )}
    </section>
  );
}

function SellerComment({ offer }: { offer: BuyerOfferPage }) {
  const { t } = useI18n();
  const [showOriginal, setShowOriginal] = useState(false);
  const comment = offer.sellerComment;
  const translation = offer.sellerCommentTranslation;
  if (!comment) return null;
  return (
    <div className={styles.section} data-gap="4" data-testid="offer-comment">
      <span className={styles.overline}>{t('offer.fromSeller')}</span>
      {translation?.status === 'translated' ? (
        <>
          <p className={styles.comment} lang={showOriginal ? translation.originalLocale : translation.locale}>{showOriginal ? comment : translation.text}</p>
          <p className={styles.caption}>
            {showOriginal ? t('offer.originalText') : t('offer.autoTranslated')}{' · '}
            <button type="button" className={styles.inlineLink} onClick={() => setShowOriginal(!showOriginal)}>
              {showOriginal ? t('offer.showTranslation') : t('offer.showOriginal')}
            </button>
          </p>
        </>
      ) : (
        <>
          <p className={styles.comment}>{comment}</p>
          {translation?.status === 'unavailable' && <p className={styles.caption}>{t('offer.translationUnavailable')}</p>}
        </>
      )}
    </div>
  );
}

function contactName(label: 'Позвонить' | 'WhatsApp' | 'Telegram', t: ReturnType<typeof useI18n>['t']) {
  if (label === 'Telegram') return t('offer.writeTelegram');
  return label === 'Позвонить' ? t('offer.callSeller') : t('offer.writeWhatsApp');
}

// Only the point's verified contacts; none at all → no section.
function Contacts({ offer }: { offer: BuyerOfferPage }) {
  const { t } = useI18n();
  const actions = offer.location.contacts ? buildContactActions(offer.location.contacts) : [];
  if (actions.length === 0) return null;
  return (
    <div className={styles.section}>
      <span className={styles.overline}>{t('offer.contactTitle')}</span>
      <div className={styles.contacts} aria-label={t('offer.contacts')}>
        {actions.map((action) => (
          <a
            key={action.label}
            className={styles.lineButton}
            href={action.href}
            aria-label={contactName(action.label, t)}
            {...(action.label !== 'Позвонить' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <SearchIcon name={action.label === 'Позвонить' ? 'phone' : action.label === 'WhatsApp' ? 'whatsapp' : 'telegram'} />
          </a>
        ))}
      </div>
    </div>
  );
}

// stage 5A: the route action is honest — shown only when the route capability is available.
export function OfferRoute({ offer, className }: { offer: BuyerOfferPage; className?: string }) {
  const { t } = useI18n();
  if (!offer.routeAvailable) return null;
  return (
    <a className={`${styles.primary} ${className ?? ''}`} href={`/api/offers/${offer.id}/route`} target="_blank" rel="noopener noreferrer" aria-label={t('offer.routeTo', { place: offer.location.name })}>
      <SearchIcon name="route" />{t('offer.buildRoute')}
    </a>
  );
}

// `scheduleLabel` (seller preview only, seller-ai-text-real-parser §20): the week sits behind an explicit disclosure under
// the status line; the buyer page itself keeps the whole week visible (card-opening-hours §3.3).
export function OfferDetails({ offer, inert = false, titleAction, afterTitle, footer, scheduleLabel }: {
  offer: BuyerOfferPage;
  inert?: boolean;
  titleAction?: ReactNode;
  afterTitle?: ReactNode;
  footer?: ReactNode;
  scheduleLabel?: string;
}) {
  const { t } = useI18n();
  const basis = priceBasisText(offer.price.unit, offer.pack);
  return (
    <article className={`${styles.tokens} ${styles.details}`} aria-labelledby="offer-title">
      <Gallery offer={offer} />
      <div className={styles.heading}>
        <div>
          <h2 id="offer-title" lang={offer.product.nameLocale}>{offer.product.name}</h2>
          <div className={styles.price} data-testid="offer-price"><b>{formatAmount(offer.price.amount)} ₸</b>{basis && <>{' '}<span>{basis}</span></>}</div>
        </div>
        {titleAction}
      </div>
      {afterTitle}
      <ConfirmationBadge offer={offer} className={styles.fresh} />
      <div className={styles.card}>
        <div className={styles.kv}>
          <SearchIcon name="pin" />
          <div>
            <p className={styles.label}>{offer.location.name}</p>
            <p className={styles.caption} data-testid="offer-address">{offer.location.addressText}</p>
          </div>
        </div>
        <div className={styles.kv}>
          <SearchIcon name="user" />
          <div>
            <p className={styles.label} data-testid="offer-seller">{offer.seller.displayName}</p>
            <p className={styles.caption}>{t('offer.sellerRole')}</p>
          </div>
        </div>
        <div>
          <OpeningStatusLine hours={offer.location.openingHours} />
          {scheduleLabel ? (
            <details data-testid="preview-schedule">
              <summary className="act" style={{ minHeight: 44 }}>{scheduleLabel}</summary>
              <OpeningSchedule hours={offer.location.openingHours} />
            </details>
          ) : <OpeningSchedule hours={offer.location.openingHours} />}
        </div>
      </div>
      <div style={{ display: 'contents', ...(inert ? { opacity: 0.55 } : {}) }} inert={inert || undefined} aria-disabled={inert || undefined} data-testid={inert ? 'offer-actions-inert' : undefined}>
        {inert ? (
          <div className={styles.section} style={{ opacity: 0.55 }}>
            <Contacts offer={offer} />
            <OfferRoute offer={offer} className={styles.inertRoute} />
          </div>
        ) : <Contacts offer={offer} />}
      </div>
      <SellerComment
        key={`${offer.sellerCommentTranslation?.status ?? 'original'}:${offer.sellerCommentTranslation?.status === 'translated' ? offer.sellerCommentTranslation.locale : ''}`}
        offer={offer}
      />
      {footer}
    </article>
  );
}
