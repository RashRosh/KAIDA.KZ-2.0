import type { SearchOffer } from '@/modules/search/contracts/search.contract';
import styles from '../page.module.css';

// Keep the decimal as a string throughout formatting, including large amounts.
export function formatAmount(amount: string): string {
  const [whole, fraction] = amount.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (decimals ? `,${decimals}` : '');
}

export function OfferCard({ offer }: { offer: SearchOffer }) {
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
        <div><dt>Продавец</dt><dd>{offer.seller.displayName}</dd></div>
        <div><dt>Где купить</dt><dd>{offer.location.name}<span className={styles.address}>{offer.location.addressText}</span></dd></div>
      </dl>
      {offer.sellerComment && <p className={styles.comment}>{offer.sellerComment}</p>}
    </article>
  );
}
