import type { SearchOffer } from '@/modules/search/contracts/search.contract';
import { buildContactActions } from '../../modules/sellers/contact/build-contact-actions';
import styles from '../page.module.css';

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

export function OfferCard({
  offer,
  distanceMeters,
  interest,
}: {
  offer: SearchOffer;
  distanceMeters?: number;
  interest?: InterestControl;
}) {
  const contactActions = offer.seller.contacts ? buildContactActions(offer.seller.contacts) : [];

  return (
    <article className={styles.offer} aria-labelledby={`offer-${offer.id}`}>
      <div className={styles.offerTop}>
        <div className={styles.offerTitleBlock}>
          <h2 id={`offer-${offer.id}`}>{offer.product.name}</h2>
          <p className={styles.price}>
            {offer.price
              ? <>{formatAmount(offer.price.amount)} {offer.price.currency === 'KZT' ? '₸' : offer.price.currency}{offer.price.unit && <span className={styles.priceUnit}> / {offer.price.unit}</span>}</>
              : <span className={styles.noPrice}>Цена не указана</span>}
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
            <span>{interest.pending ? 'Сохраняем…' : interest.active ? 'В интересах' : 'Добавить в интересы'}</span>
          </button>
        )}
      </div>

      <div className={styles.locationBlock}>
        <span className={styles.offerMetaIcon}><PinIcon /></span>
        <div className={styles.locationCopy}>
          <div className={styles.locationLine}>
            <strong>{offer.location.name}</strong>
            {distanceMeters !== undefined && <span className={styles.distance}>{distanceMeters} м</span>}
          </div>
          <span className={styles.address}>{offer.location.addressText}</span>
        </div>
      </div>

      {offer.sellerComment && <p className={styles.comment}>{offer.sellerComment}</p>}

      <div className={styles.sellerLine}>
        <span className={styles.offerMetaIcon}><SellerIcon /></span>
        <span>{offer.seller.displayName}</span>
      </div>

      {contactActions.length > 0 && (
        <div className={styles.contactActions} aria-label="Связаться с продавцом">
          {contactActions.map((action) => {
            const external = action.href.startsWith('https://');
            const primary = action.label === 'Позвонить';
            return (
              <a
                className={`${styles.contactAction} ${primary ? styles.contactActionPrimary : styles.contactActionSecondary}`}
                href={action.href}
                key={action.label}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
              >
                {primary && <PhoneIcon />}
                <span>{action.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </article>
  );
}
