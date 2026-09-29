import type { useI18n } from '../../i18n/I18nProvider';
import { pluralForm } from '../../i18n/format';
import type { MessageKey } from '../../i18n/messages';

// offer-actuality: «Сегодня», «Вчера», «2 дня» … «6 дней» since the Seller last confirmed the offer. There is no
// «7 дней»: such an offer is no longer shown.
export function actualityText(days: number, t: ReturnType<typeof useI18n>['t']): string {
  if (days <= 0) return t('actuality.today');
  if (days === 1) return t('actuality.yesterday');
  return t(`actuality.days.${pluralForm(days)}` as MessageKey, { count: days });
}
