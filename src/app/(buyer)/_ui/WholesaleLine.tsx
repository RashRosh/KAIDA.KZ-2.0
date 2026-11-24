import { useI18n } from '../../../i18n/I18nProvider';
import type { SearchOffer } from '../../../modules/search/contracts/search.contract';
import { priceBasisText } from '../../../modules/offers/price-unit/price-basis';
import { formatAmount } from '../../_components/format-amount';
import styles from './wholesale-line.module.css';

// wholesale-price §3.2: the card's wholesale line under the retail price — «650 ₸ / кг ОПТ», then the minimum batch
// «от 1 ящика (≈ 10 кг)». The basis is the retail price's; nothing is shown when the card has no wholesale price.
export function WholesaleLine({ offer, size = 'sm' }: { offer: Pick<SearchOffer, 'wholesale' | 'price' | 'pack'>; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useI18n();
  if (!offer.wholesale) return null;
  const basis = priceBasisText(offer.price.unit, offer.pack);
  return <p className={`${styles.line} ${styles[size]}`} data-testid="wholesale-line">
    <b>{formatAmount(offer.wholesale.amount)}&nbsp;₸</b>{basis && <> <span>{basis}</span></>}{' '}<span className={styles.tag}>{t('offer.wholesaleTag')}</span>{' '}
    <span className={styles.batch}>{offer.wholesale.batch}</span>
  </p>;
}
