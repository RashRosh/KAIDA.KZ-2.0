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
  const hasActions = Boolean(interest) || contactActions.length > 0;

  return (
    <article className={styles.offer} aria-labelledby={`offer-${offer.id}`}>
      <div className={styles.offerHeading}>
        <h2 id={`offer-${offer.id}`}>{offer.product.name}</h2>
        <p className={styles.price}>
          {offer.price
            ? <>{formatAmount(offer.price.amount)} {offer.price.currency === 'KZT' ? '₸' : offer.price.currency}{offer.price.unit && <span className={styles.priceUnit}> / {offer.price.unit}</span>}</>
            : <span className={styles.noPrice}>Цена не указана</span>}
        </p>
      </div>

      <dl className={styles.offerDetails}>
        <div className={styles.locationDetail}>
          <dt>Где купить</dt>
          <dd>
            <span className={styles.locationLine}>
              <span className={styles.locationName}>{offer.location.name}</span>
              {distanceMeters !== undefined && <span className={styles.distance}>{distanceMeters} м</span>}
            </span>
            <span className={styles.address}>{offer.location.addressText}</span>
          </dd>
        </div>
        <div className={styles.sellerDetail}>
          <dt>Продавец</dt>
          <dd>{offer.seller.displayName}</dd>
        </div>
      </dl>

      {offer.sellerComment && <p className={styles.comment}>{offer.sellerComment}</p>}

      {hasActions && (
        <div className={styles.offerActions}>
          {interest && (
            <button
              type="button"
              className={styles.interestAction}
              aria-pressed={interest.active}
              disabled={interest.pending}
              onClick={interest.onToggle}
            >
              {interest.pending ? 'Сохраняем…' : interest.active ? 'В интересах' : 'Добавить в интересы'}
            </button>
          )}
          {contactActions.length > 0 && (
            <div className={styles.contactActions} aria-label="Связаться с продавцом">
              {contactActions.map((action) => {
                const external = action.href.startsWith('https://');
                return (
                  <a
                    className={styles.contactAction}
                    href={action.href}
                    key={action.label}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                  >
                    {action.label}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
