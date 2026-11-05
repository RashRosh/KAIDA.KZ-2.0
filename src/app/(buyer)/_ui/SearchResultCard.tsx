'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { SearchOffer } from '../../../modules/search/contracts/search.contract';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { buildContactActions } from '../../../modules/sellers/contact/build-contact-actions';
import { actualityText } from '../../_components/actuality-text';
import { pluralForm } from '../../../i18n/format';
import type { MessageKey } from '../../../i18n/messages';
import { formatDistance, markBuyerOfferOpened } from './buyer-ui';
import { formatAmount } from '../../_components/format-amount';
import { priceBasisText } from '../../../modules/offers/price-unit/price-basis';
import { SearchIcon } from './SearchIcon';
import styles from './search-results.module.css';

function ConfirmationBadge({ offer }: { offer: SearchOffer }) {
  const { locale, t } = useI18n();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  if (!offer.actuality) return null;
  const minutes = offer.lastConfirmedAt && now !== null ? Math.max(1, Math.floor((now - Date.parse(offer.lastConfirmedAt)) / 60_000)) : null;
  const hours = minutes === null ? null : Math.floor(minutes / 60);
  const days = hours === null ? offer.actuality.days : Math.floor(hours / 24);
  const label = minutes === null ? actualityText(days, t) : minutes < 60 ? `${minutes} мин` : hours! < 24 ? `${hours} ${locale === 'ru' ? 'ч' : 'сағ'}` : t(`actuality.days.${pluralForm(days)}` as MessageKey, { count: days });
  const tier = hours !== null && hours < 3 ? 1 : days === 0 ? 2 : days < 3 ? 3 : days < 7 ? 4 : 5;
  return <span className={styles.confirmation} data-tier={tier} role="img" aria-label={t('actuality.label', { when: label })}><SearchIcon name="leaf" />{label}</span>;
}

export function SearchResultCard({ offer, heart }: { offer: SearchOffer; heart: React.ReactNode }) {
  const { t } = useI18n();
  const contacts = offer.location.contacts ? buildContactActions(offer.location.contacts) : [];
  const basis = priceBasisText(offer.price.unit, offer.pack);
  return <article className={`linkcard ${styles.resultCard}`} aria-labelledby={`offer-${offer.id}`}>
    <div className={styles.cardMain}>
      <div className={styles.photo}>
        <span className="ic i-logo" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element -- existing immutable public photo route */}
        {offer.coverPhotoId && <img src={photoUrl(offer.coverPhotoId, 'thumb')} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
        <ConfirmationBadge offer={offer} />
        {heart}
      </div>
      <div className={styles.cardText}>
        <h3 id={`offer-${offer.id}`} lang={offer.product.nameLocale}><Link href={`/offers/${offer.id}`} className="stretch" onClick={markBuyerOfferOpened}>{offer.product.name}</Link></h3>
        <div className={styles.price}><b className="pr">{formatAmount(offer.price.amount)} ₸</b>{basis && <> <span>{basis}</span></>}</div>
        <p className={styles.point} data-testid="card-point">{offer.location.name}</p>
        <p className={styles.address} data-testid="card-place" title={[offer.location.addressText, offer.seller.displayName].filter(Boolean).join(' · ')}>{offer.location.addressText}<span>{offer.location.addressText && offer.seller.displayName ? ' · ' : ''}{offer.seller.displayName}</span></p>
      </div>
    </div>
    <div className={styles.cardFooter}>
      {contacts.map(action => <a key={action.label} className={styles.contact} href={action.href}
        aria-label={action.label === 'Позвонить' ? t('offer.callSeller') : action.label === 'WhatsApp' ? t('offer.writeWhatsApp') : t('offer.writeTelegram')}
        {...(action.label === 'Позвонить' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
        <SearchIcon name={action.label === 'Позвонить' ? 'phone' : action.label === 'WhatsApp' ? 'whatsapp' : 'telegram'} />
      </a>)}
      {offer.routeAvailable && <a className={styles.route} href={`/api/offers/${offer.id}/route`} target="_blank" rel="noopener noreferrer" aria-label={t('offer.routeTo', { place: offer.location.name })}>
        <SearchIcon name="route" />{offer.distanceMeters === undefined ? t('offer.route') : formatDistance(offer.distanceMeters, t)}
      </a>}
    </div>
  </article>;
}

export function SearchResultSkeletons() {
  return <>{[[90,45,75,60],[85,40,70,55],[92,50,65,58],[80,42,72,50]].map((widths,index)=><div key={index} className={styles.resultCard} data-testid="search-skeleton" aria-hidden="true">
    <div className={styles.cardMain}>
      <div className={styles.photo} />
      <div className={styles.skeletonText}>
        {widths.map((width,i)=><span key={i} className="sk" style={{width:`${width}%`,height:[16,22,13,13][i]}} />)}
      </div>
    </div>
    <div className={styles.cardFooter} style={{minHeight:53}}>
      {index<3 && <span className="sk" style={{width:36,height:36,borderRadius:'50%',marginLeft:4}} />}
      {index===0 && <span className="sk" style={{width:36,height:36,borderRadius:'50%',marginLeft:8}} />}
      <span className="sk" style={{width:92,height:36,borderRadius:999,marginLeft:'auto'}} />
    </div>
  </div>)}</>;
}
