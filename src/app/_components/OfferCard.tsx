import { useState } from 'react';
import Image from 'next/image';
import type { SearchOffer } from '@/modules/search/contracts/search.contract';
import { buildContactActions, type ContactAction } from '../../modules/sellers/contact/build-contact-actions';
import styles from '../page.module.css';
import { useI18n } from '../../i18n/I18nProvider';

// Keep the decimal as a string throughout formatting, including large amounts.
export function formatAmount(amount: string): string {
  const [whole, fraction] = amount.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (decimals ? `,${decimals}` : '');
}

type InterestControl = {
  active: boolean;
  pending: boolean;
  onToggle: () => void;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"
        className={filled ? styles.interestIconFilled : undefined}
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function SellerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 10h16" />
      <path d="M5 10V7l2-3h10l2 3v3" />
      <path d="M6 10v10h12V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.6a2 2 0 0 1-.5 2.1L9 10.6a16 16 0 0 0 4.4 4.4l1.2-1.2a2 2 0 0 1 2.1-.5c.8.4 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h2a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4" />
    </svg>
  );
}

function SocialIcon({ label }: { label: ContactAction['label'] }) {
  if (label === 'WhatsApp') {
    return (
      <Image
        className={`${styles.serviceIcon} ${styles.whatsappIcon}`}
        src="/brand/whatsapp.svg"
        alt=""
        width={18}
        height={18}
        aria-hidden="true"
      />
    );
  }
  if (label === 'Telegram') {
    return (
      <Image
        className={`${styles.serviceIcon} ${styles.telegramIcon}`}
        src="/brand/telegram.svg"
        alt=""
        width={18}
        height={18}
        aria-hidden="true"
      />
    );
  }
  if (label === 'Instagram') {
    return (
      <Image
        className={`${styles.serviceIcon} ${styles.instagramIcon}`}
        src="/brand/instagram.svg"
        alt=""
        width={18}
        height={18}
        aria-hidden="true"
      />
    );
  }
  return null;
}

function OfferComment({ offer }: { offer: SearchOffer }) {
  const { t } = useI18n();
  const [showOriginal, setShowOriginal] = useState(false);
  const comment = offer.sellerComment;
  const translation = offer.sellerCommentTranslation;
  if (!comment) return null;

  if (translation?.status === 'translated') {
    const original = showOriginal;
    return (
      <div className={styles.commentBlock} data-testid="offer-comment">
        <p className={styles.comment} lang={original ? translation.originalLocale : translation.locale}>
          {original ? comment : translation.text}
        </p>
        <p className={styles.commentMeta}>
          <span>{original ? t('offer.originalText') : t('offer.autoTranslated')}</span>
          <span aria-hidden="true"> · </span>
          <button type="button" className={styles.commentToggle} onClick={() => setShowOriginal(!original)}>
            {original ? t('offer.showTranslation') : t('offer.showOriginal')}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.commentBlock} data-testid="offer-comment">
      <p className={styles.comment}>{comment}</p>
      {translation?.status === 'unavailable' && <p className={styles.commentMeta}>{t('offer.translationUnavailable')}</p>}
    </div>
  );
}

export function OfferCard({
  offer,
  distanceMeters,
  interest,
}: {
  offer: SearchOffer;
  distanceMeters?: number;
  interest?: InterestControl;
}) {
  const { t } = useI18n();
  const contactActions = offer.seller.contacts ? buildContactActions(offer.seller.contacts) : [];
  const phoneAction = contactActions.find((action) => action.label === 'Позвонить');
  const socialActions = contactActions.filter((action) => action.label !== 'Позвонить');

  return (
    <article className={styles.offer} aria-labelledby={`offer-${offer.id}`}>
      <div className={styles.offerTop}>
        <div className={styles.offerTitleBlock}>
          <h2 id={`offer-${offer.id}`} lang={offer.product.nameLocale}>{offer.product.name}</h2>
          <p className={styles.price}>
            {formatAmount(offer.price.amount)} ₸
            {offer.price.unit && <span className={styles.priceUnit}> / {offer.price.unit}</span>}
          </p>
        </div>

        {interest && (
          <button
            type="button"
            className={styles.interestAction}
            aria-pressed={interest.active}
            disabled={interest.pending}
            onClick={interest.onToggle}
          >
            <HeartIcon filled={interest.active} />
            <span>{interest.pending ? t('offer.saving') : interest.active ? t('offer.inInterests') : t('offer.addInterest')}</span>
          </button>
        )}
      </div>

      <div className={styles.locationBlock}>
        <span className={styles.offerMetaIcon}><PinIcon /></span>
        <div className={styles.locationCopy}>
          <div className={styles.locationLine}>
            <strong>{offer.location.name}</strong>
            {distanceMeters !== undefined && <span className={styles.distance}>{t('offer.distanceMeters', { count: distanceMeters })}</span>}
          </div>
          <span className={styles.address}>{offer.location.addressText}</span>
        </div>
      </div>

      <OfferComment
        key={`${offer.sellerCommentTranslation?.status ?? 'original'}:${offer.sellerCommentTranslation?.status === 'translated' ? offer.sellerCommentTranslation.locale : ''}`}
        offer={offer}
      />

      <div className={styles.sellerLine}>
        <span className={styles.offerMetaIcon}><SellerIcon /></span>
        <span>{offer.seller.displayName}</span>
      </div>

      {phoneAction && (
        <div className={styles.offerActions}>
          <div className={styles.primaryActions} aria-label={t('offer.primaryActions')}>
            <a className={`${styles.contactAction} ${styles.contactActionPrimary}`} href={phoneAction.href}>
              <PhoneIcon />
              <span>{t('offer.call')}</span>
            </a>
            <a
              className={`${styles.contactAction} ${styles.routeAction}`}
              href={`/api/offers/${offer.id}/route`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <RouteIcon />
              <span>{t('offer.route')}</span>
            </a>
          </div>

          {socialActions.length > 0 && (
            <div
              className={styles.secondaryActions}
              data-count={socialActions.length}
              aria-label={t('offer.moreContacts')}
            >
              {socialActions.map((action) => (
                <a
                  className={`${styles.contactAction} ${styles.contactActionSecondary}`}
                  href={action.href}
                  key={action.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={action.label}
                >
                  <SocialIcon label={action.label} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
