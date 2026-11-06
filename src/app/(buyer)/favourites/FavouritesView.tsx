'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { pluralForm } from '../../../i18n/format';
import type { MessageKey } from '../../../i18n/messages';
import type { Favourite } from '../../../modules/favourites/contracts/favourites.contract';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { priceBasisText } from '../../../modules/offers/price-unit/price-basis';
import { formatAmount } from '../../_components/format-amount';
import { BuyerScreen, markBuyerOfferOpened } from '../_ui/buyer-ui';
import { KaidaMark } from '../_ui/offer-details';
import { ConfirmationBadge } from '../_ui/SearchResultCard';
import { SearchIcon } from '../_ui/SearchIcon';
import design from '../_ui/search-results.module.css';
import { useFavourites } from '../_ui/use-favourites';
import styles from './favourites.module.css';

// D4 · B09/B10: the buyer's private list. Data, order, removal, privacy and the return from an Offer are unchanged
// (offer-favourites); only the presentation follows the source. No price history, unavailability reasons or distance:
// the product has none of them (docs/slices/design-favourites).

const SCROLL_KEY = 'kaida-favourites-scroll';

function Thumb({ photoId, unavailable = false }: { photoId?: string; unavailable?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.thumb} data-unavailable={unavailable || undefined}>
      <KaidaMark className={styles.logo} />
      {/* eslint-disable-next-line @next/next/no-img-element -- existing ordinary media authorization */}
      {photoId && !failed && <img src={photoUrl(photoId, 'thumb')} alt="" loading="lazy" onError={() => setFailed(true)} />}
    </div>
  );
}

function RemoveLink({ entry, fav, failed, onRemove }: { entry: Favourite; fav: ReturnType<typeof useFavourites>; failed: boolean; onRemove: () => void }) {
  const { t } = useI18n();
  const pending = fav.pendingId === entry.id;
  return (
    <button type="button" className={styles.link} disabled={fav.pendingId !== null} aria-busy={pending} onClick={onRemove}>
      {pending ? t('fav.removing') : failed ? t('fav.removeAgain') : t('fav.remove')}
    </button>
  );
}

function RemoveError() {
  const { t } = useI18n();
  return <p className={styles.errmsg} role="alert"><SearchIcon name="alert" />{t('fav.removeError')}</p>;
}

function AvailableCard({ entry, onOpen, remove, failed }: { entry: Extract<Favourite, { state: 'available' }>; onOpen: () => void; remove: React.ReactNode; failed: boolean }) {
  const offer = entry.offer;
  const basis = priceBasisText(offer.price.unit, offer.pack);
  return (
    <article className={`linkcard ${styles.card}`} aria-labelledby={`saved-${entry.id}`}>
      <div className={styles.row}>
        <Thumb photoId={offer.coverPhotoId} />
        <div className={styles.info}>
          <h3 className={styles.title} id={`saved-${entry.id}`} lang={offer.product.nameLocale}>
            <Link href={`/offers/${entry.offerId}?return=%2Ffavourites`} className="stretch" onClick={() => { markBuyerOfferOpened(); onOpen(); }}>{offer.product.name}</Link>
          </h3>
          <div className={styles.price}><b>{formatAmount(offer.price.amount)} ₸</b>{basis && <> <span>{basis}</span></>}</div>
          <p className={styles.label} data-testid="card-point">{offer.location.name}</p>
          <p className={styles.caption} data-testid="card-seller">{offer.seller.displayName}</p>
        </div>
      </div>
      {failed && <RemoveError />}
      <div className={styles.footer}>
        <ConfirmationBadge offer={offer} className={styles.fresh} />
        {remove}
      </div>
    </article>
  );
}

function UnavailableCard({ entry, remove, failed }: { entry: Extract<Favourite, { state: 'unavailable' }>; remove: React.ReactNode; failed: boolean }) {
  const { t } = useI18n();
  return (
    <article className={styles.card} data-unavailable="true" aria-labelledby={`saved-${entry.id}`}>
      <div className={styles.row}>
        <Thumb key={entry.coverPhotoId ?? ''} photoId={entry.coverPhotoId} unavailable />
        <div className={styles.info}>
          <span className={styles.state} data-testid="unavailable-line"><SearchIcon name="blocked" /><span>{t('fav.unavailable')}</span></span>
          <h3 className={styles.title} id={`saved-${entry.id}`}>{entry.title}</h3>
          <p className={styles.caption} data-testid="unavailable-line">{entry.sellerName} · {entry.pointName}</p>
        </div>
      </div>
      {failed && <RemoveError />}
      <div className={styles.footer} data-end="true">{remove}</div>
    </article>
  );
}

function Illustration({ guest }: { guest: boolean }) {
  return guest ? (
    <svg viewBox="0 0 240 180" aria-hidden="true"><path d="M120 150s-62-38-62-84a30 30 0 0 1 62-10 30 30 0 0 1 62 10c0 46-62 84-62 84z" fill="#efc7ff" /><circle cx="120" cy="86" r="18" fill="#9900cc" /><rect x="112" y="84" width="16" height="14" rx="3" fill="#fdfbff" /><path d="M114 84v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#fdfbff" strokeWidth="3" /></svg>
  ) : (
    <svg viewBox="0 0 240 180" aria-hidden="true"><path d="M120 150s-62-38-62-84a30 30 0 0 1 62-10 30 30 0 0 1 62 10c0 46-62 84-62 84z" fill="#f8e5ff" /><circle cx="96" cy="76" r="8" fill="#e29dff" /><circle cx="144" cy="76" r="8" fill="#e29dff" /><rect x="82" y="104" width="76" height="10" rx="5" fill="#cd6bfd" /></svg>
  );
}

function Skeletons() {
  return <>{[[90, 45, 70], [80, 40, 65], [85, 50, 60]].map((widths, index) => (
    <div key={index} className={styles.card} aria-hidden="true" data-testid="favourite-skeleton">
      <div className={styles.row}>
        <div className={styles.thumb} />
        <div className={styles.info} style={{ gap: 8 }}>{widths.map((width, i) => <span key={i} className={`sk ${styles.skeleton}`} style={{ width: `${width}%`, height: [16, 20, 14][i] }} />)}</div>
      </div>
      <span className={`sk ${styles.skeleton}`} style={{ width: '50%', height: 22, borderRadius: 999 }} />
    </div>
  ))}</>;
}

export function FavouritesView() {
  const { t } = useI18n();
  const fav = useFavourites();
  const list = useRef<HTMLElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  useEffect(() => {
    if (fav.state.kind !== 'ready') return;
    // Scroll-only state; never persist private content or identity in the browser.
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
      if (Number.isFinite(y)) requestAnimationFrame(() => list.current?.scrollTo(0, y));
    } catch { /* Scroll restoration is optional. */ }
  }, [fav.state.kind]);
  const rememberScroll = () => { try { sessionStorage.setItem(SCROLL_KEY, String(list.current?.scrollTop ?? 0)); } catch { /* Scroll persistence is optional. */ } };
  const count = fav.state.kind === 'ready' ? fav.state.favourites.length : 0;
  const top = (
    <header className={styles.top}>
      <h1>{t('fav.title')}</h1>
      {count > 0 && <span className={styles.count}>{t(`fav.count.${pluralForm(count)}` as MessageKey, { count })}</span>}
    </header>
  );
  return (
    <BuyerScreen section="favourites" className={design.screen} top={top} overlay={fav.modal}>
      <main ref={list} className={`body ${styles.body}`} aria-busy={fav.state.kind === 'loading' || undefined}>
        {fav.state.kind === 'loading' && <Skeletons />}
        {fav.state.kind === 'anonymous' && <>
          <div className={styles.empty}><Illustration guest /><h2>{t('fav.signInTitle')}</h2><p>{t('fav.guestText')}</p></div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={fav.signIn}>{t('auth.signIn')}</button>
            <Link href="/" className={styles.link}>{t('fav.find')}</Link>
          </div>
        </>}
        {fav.state.kind === 'error' && (
          <div className={styles.notice} role="alert">
            <div><SearchIcon name="alert" /><p><strong>{t('fav.listErrorTitle')}</strong> {t('fav.listErrorText')}</p></div>
            <button type="button" className={styles.secondary} onClick={() => void fav.reload()}><SearchIcon name="refresh" />{t('cabinet.retry')}</button>
          </div>
        )}
        {fav.state.kind === 'ready' && count === 0 && <>
          <div className={styles.empty}><Illustration guest={false} /><h2>{t('fav.emptyTitle')}</h2><p>{t('fav.emptyText')}</p></div>
          <div className={styles.actions}><Link href="/" className={styles.primary}>{t('fav.find')}</Link></div>
        </>}
        {fav.state.kind === 'ready' && fav.state.favourites.map((entry) => {
          const failed = fav.error && removing === entry.id;
          const remove = <RemoveLink entry={entry} fav={fav} failed={failed} onRemove={() => { setRemoving(entry.id); void fav.remove(entry.id); }} />;
          return (
            <div key={entry.id} data-testid="favourite-entry">
              {entry.state === 'available'
                ? <AvailableCard entry={entry} onOpen={rememberScroll} remove={remove} failed={failed} />
                : <UnavailableCard key={`${entry.id}:${entry.coverPhotoId ?? ''}`} entry={entry} remove={remove} failed={failed} />}
            </div>
          );
        })}
        {fav.error && removing === null && <p className={styles.errmsg} role="alert"><SearchIcon name="alert" />{t('fav.writeError')}</p>}
      </main>
    </BuyerScreen>
  );
}
