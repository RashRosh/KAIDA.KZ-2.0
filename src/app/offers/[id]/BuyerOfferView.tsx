'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { photoUrl } from '@/modules/media/contracts/photo.contract';
import type { BuyerOfferPage } from '@/modules/search/application/get-buyer-offer';
import { useI18n } from '@/i18n/I18nProvider';
import { OfferCard } from '../../_components/OfferCard';
import styles from './offer-page.module.css';

function BackLink() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Link
      href="/"
      className={styles.back}
      onClick={(event) => {
        // Back to the same results (the query is kept in the search address); a direct visit goes to search.
        if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {t('offer.back')}
    </Link>
  );
}

function GalleryPhoto({ photoId, alt }: { photoId: string; alt: string }) {
  const { t } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={styles.photoFailed}>
        <span>{t('offer.photoFailed')}</span>
        <button type="button" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t('offer.photoRetry')}</button>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- public, immutable photo route
    <img key={attempt} src={`${photoUrl(photoId, 'display')}${attempt ? `?r=${attempt}` : ''}`} alt={alt} onError={() => setFailed(true)} />
  );
}

function Gallery({ offer }: { offer: BuyerOfferPage }) {
  const { t } = useI18n();
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const count = offer.photos.length;

  if (count === 0) {
    return <div className={styles.fallback} role="img" aria-label={t('offer.noPhoto')} />;
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
      <ul
        ref={track}
        className={styles.track}
        onScroll={(event) => {
          const element = event.currentTarget;
          setIndex(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)));
        }}
      >
        {offer.photos.map((photo, position) => (
          <li key={photo.id} className={styles.slide} aria-hidden={position !== index || undefined}>
            <GalleryPhoto photoId={photo.id} alt={t('offer.photoAlt', { name: offer.product.name, position: position + 1, count })} />
          </li>
        ))}
      </ul>
      {count > 1 && (
        <>
          <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('offer.prevPhoto')}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => go(index + 1)} disabled={index === count - 1} aria-label={t('offer.nextPhoto')}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <p className={styles.counter} aria-live="polite">{t('offer.photoCounter', { position: index + 1, count })}</p>
        </>
      )}
    </section>
  );
}

export function BuyerOfferView({ offer }: { offer: BuyerOfferPage }) {
  return (
    <article className={styles.page}>
      <BackLink />
      <Gallery offer={offer} />
      <OfferCard offer={offer} linked={false} />
    </article>
  );
}

export function OfferUnavailable({ failed }: { failed: boolean }) {
  const { t } = useI18n();
  return (
    <section className={styles.unavailable} aria-labelledby="offer-unavailable">
      <h1 id="offer-unavailable">{failed ? t('offer.loadFailedTitle') : t('offer.unavailableTitle')}</h1>
      <p>{failed ? t('offer.loadFailedText') : t('offer.unavailableText')}</p>
      <Link href="/" className={styles.toSearch}>{t('offer.toSearch')}</Link>
    </section>
  );
}
