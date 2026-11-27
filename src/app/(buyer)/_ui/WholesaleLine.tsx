import { useI18n } from '../../../i18n/I18nProvider';
import type { SearchOffer } from '../../../modules/search/contracts/search.contract';
import { priceBasisText } from '../../../modules/offers/price-unit/price-basis';
import { formatAmount } from '../../_components/format-amount';
import styles from './wholesale-line.module.css';

// wholesale-price §3.2 / wholesale-only §2.2: under the retail price when price !== null, or as the primary prominent
// price with explicit «ОПТ» label and minimum batch when price === null.
export function WholesaleLine({ offer, size = 'sm' }: { offer: Pick<SearchOffer, 'wholesale' | 'price' | 'pack'>; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useI18n();
  if (!offer.wholesale) return null;
  const primary = offer.price === null;
  const unit = offer.price ? offer.price.unit : (offer.wholesale.unit ?? null);
  const basis = priceBasisText(unit, offer.pack);
  return <p className={`${styles.line} ${styles[size]}${primary ? ` ${styles.primary}` : ''}`} data-testid="wholesale-line" data-wholesale-only={primary || undefined}>
    <b>{formatAmount(offer.wholesale.amount)}&nbsp;₸</b>{basis && <> <span>{basis}</span></>}{' '}<span className={styles.tag}>{t('offer.wholesaleTag')}</span>{' '}
    <span className={styles.batch}>{offer.wholesale.batch}</span>
  </p>;
}
