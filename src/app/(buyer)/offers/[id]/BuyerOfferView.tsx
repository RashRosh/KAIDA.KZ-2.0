'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { photoUrl } from '@/modules/media/contracts/photo.contract';
import type { BuyerOfferPage } from '@/modules/search/application/get-buyer-offer';
import { useI18n } from '@/i18n/I18nProvider';
import { OpeningHoursLine } from '../../../_components/OpeningHoursLine';
import { Ic } from '../../../seller/_kaida/ui';
import { BuyerScreen, cameFromList, ContactIcons, FreshPlaque, PriceLine, RouteButton } from '../../_ui/buyer-ui';
import { useInterest } from '../../_ui/use-interest';

// buyer-screens-mockup · B02 offer detail: gallery (or neutral fallback, or a photo error that keeps the data), the
// actuality plaque, name, pack, price, the seller comment, the point block with route and contacts, the seller and
// the interest action. Same eligibility as Search (offer-photos §2).

function BackButton() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Link
      href="/"
      className="ib"
      aria-label={t('offer.back')}
      style={{ background: '#ffffffe6', position: 'absolute', top: 8, left: 8, zIndex: 2 }}
      onClick={(event) => {
        // Back to the same results (the query is kept in the search address); a direct visit goes to search.
        if (window.history.length > 1 && (cameFromList() || document.referrer.startsWith(window.location.origin))) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <Ic name="left" />
    </Link>
  );
}

function GalleryPhoto({ photoId, alt }: { photoId: string; alt: string }) {
  const { t } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) {
    // B02 · Media error: the photo area says so; data and route below stay.
    return (
      <div role="alert" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Ic name="image" className="lg c2" />
        <span className="c">{t('offer.photoFailed')}</span>
        <button type="button" className="btn btn-o sm" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>
          <Ic name="refresh" className="sm" />{t('offer.photoRetry')}
        </button>
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
  const plaque = <FreshPlaque offer={offer} style={{ top: 64, left: 16 }} />;

  if (count === 0) {
    return (
      <div className="gal img fb" role="img" aria-label={t('offer.noPhoto')}>
        <BackButton />
        <Ic name="logo" />
        {plaque}
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
    <section className="gal" aria-label={t('offer.gallery')} aria-roledescription="carousel">
      <BackButton />
      <ul
        ref={track}
        className="gal-track"
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
      {plaque}
      {count > 1 && (
        <>
          <button type="button" className="ib gal-prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('offer.prevPhoto')}><Ic name="left" /></button>
          <button type="button" className="ib gal-next" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label={t('offer.nextPhoto')}><Ic name="right" /></button>
          <div className="gal-dots" aria-hidden="true">
            {offer.photos.map((photo, position) => <i key={photo.id} className={position === index ? 'on' : undefined} />)}
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
  if (translation?.status === 'translated') {
    return (
      <div data-testid="offer-comment" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p className="t c2" lang={showOriginal ? translation.originalLocale : translation.locale}>{showOriginal ? comment : translation.text}</p>
        <p className="c">
          {showOriginal ? t('offer.originalText') : t('offer.autoTranslated')}{' · '}
          <button type="button" className="btn btn-g sm" style={{ padding: 0, height: 'auto', display: 'inline' }} onClick={() => setShowOriginal(!showOriginal)}>
            {showOriginal ? t('offer.showTranslation') : t('offer.showOriginal')}
          </button>
        </p>
      </div>
    );
  }
  return (
    <div data-testid="offer-comment" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p className="t c2">{comment}</p>
      {translation?.status === 'unavailable' && <p className="c">{t('offer.translationUnavailable')}</p>}
    </div>
  );
}

export function BuyerOfferView({ offer }: { offer: BuyerOfferPage }) {
  const { t } = useI18n();
  const interest = useInterest(offer.product.id);
  return (
    <BuyerScreen section="search" overlay={interest.modal}>
      <main className="body np" style={{ gap: 0 }}>
        <Gallery offer={offer} />
        <article style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }} aria-labelledby="offer-title">
          <h1 className="h1" id="offer-title" lang={offer.product.nameLocale}>{offer.product.name}</h1>
          {offer.pack && <p className="ts c2">{offer.pack}</p>}
          <PriceLine offer={offer} large />
          <SellerComment
            key={`${offer.sellerCommentTranslation?.status ?? 'original'}:${offer.sellerCommentTranslation?.status === 'translated' ? offer.sellerCommentTranslation.locale : ''}`}
            offer={offer}
          />
          <div className="card p16" style={{ gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Ic name="pin" className="pt" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="ts">{offer.location.name}</div>
                <p className="c">{offer.location.addressText}</p>
                <OpeningHoursLine hours={offer.location.openingHours} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <RouteButton offer={offer} />
              <span className="sp" />
              <ContactIcons offer={offer} />
            </div>
          </div>
          <p className="c" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ic name="store" className="sm c2" />{offer.seller.displayName}</p>
          {interest.available && (
            <button type="button" className="btn btn-o w" aria-pressed={interest.active} disabled={interest.pending} onClick={(event) => void interest.toggle(event)}>
              <Ic name={interest.active ? 'starf' : 'star'} className="sm" />
              {interest.pending ? t('offer.saving') : interest.active ? t('offer.inInterests') : t('offer.addInterest')}
            </button>
          )}
          {interest.error && <div className="fld"><p className="emsg" role="alert"><Ic name="alert" />{t('search.interestError')}</p></div>}
        </article>
      </main>
    </BuyerScreen>
  );
}

export function OfferUnavailable({ failed }: { failed: boolean }) {
  const { t } = useI18n();
  return (
    <BuyerScreen section="search">
      <main className="body" style={{ justifyContent: 'center', gap: 16, padding: '24px 20px', textAlign: 'center' }} aria-labelledby="offer-unavailable">
        <h1 className="h2" id="offer-unavailable">{failed ? t('offer.loadFailedTitle') : t('offer.unavailableTitle')}</h1>
        <p className="t c2">{failed ? t('offer.loadFailedText') : t('offer.unavailableText')}</p>
        <Link href="/" className="btn btn-p lg w">{t('offer.toSearch')}</Link>
      </main>
    </BuyerScreen>
  );
}
