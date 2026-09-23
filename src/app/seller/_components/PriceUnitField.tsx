'use client';

import {
  PRICE_UNIT_CODES,
  PRICE_UNIT_CUSTOM_MAX_LENGTH,
  PRICE_UNIT_LABELS,
  type PriceUnit,
  type PriceUnitCode,
} from '../../../modules/offers/price-unit/price-unit';
import { useI18n } from '../../../i18n/I18nProvider';
import styles from '../page.module.css';

// offer-price-unit: one controlled choice (none + five codes); «другое» reveals the Seller's own value.
export type PriceUnitDraft = { code: PriceUnitCode | ''; custom: string };

export const emptyPriceUnitDraft: PriceUnitDraft = { code: '', custom: '' };

export function priceUnitDraftFrom(unit: PriceUnit | null | undefined): PriceUnitDraft {
  if (!unit) return emptyPriceUnitDraft;
  return unit.code === 'other' ? { code: 'other', custom: unit.value } : { code: unit.code, custom: '' };
}

// null result means the draft is incomplete: «другое» chosen without a value.
export function priceUnitFromDraft(draft: PriceUnitDraft): { unit: PriceUnit | null } | null {
  if (draft.code === '') return { unit: null };
  if (draft.code !== 'other') return { unit: { code: draft.code } };
  const value = draft.custom.trim();
  return value === '' ? null : { unit: { code: 'other', value } };
}

export function PriceUnitField({
  id,
  draft,
  onChange,
  disabled = false,
  showError = false,
}: {
  id: string;
  draft: PriceUnitDraft;
  onChange: (draft: PriceUnitDraft) => void;
  disabled?: boolean;
  showError?: boolean;
}) {
  const { locale, t } = useI18n();
  const customId = `${id}-custom`;
  const errorId = `${id}-error`;
  const invalid = showError && priceUnitFromDraft(draft) === null;

  return (
    <>
      <label htmlFor={id}>{t('offerCreate.unit')}</label>
      <select
        id={id}
        value={draft.code}
        disabled={disabled}
        onChange={(event) => {
          const code = event.target.value as PriceUnitDraft['code'];
          // The custom draft survives until another choice is explicitly made.
          onChange({ code, custom: code === 'other' ? draft.custom : '' });
        }}
      >
        <option value="">{t('unit.none')}</option>
        {PRICE_UNIT_CODES.map((code) => <option key={code} value={code}>{PRICE_UNIT_LABELS[locale][code]}</option>)}
      </select>
      {draft.code === 'other' && (
        <>
          <label htmlFor={customId}>{t('unit.customLabel')}</label>
          <input
            id={customId}
            value={draft.custom}
            onChange={(event) => onChange({ code: 'other', custom: event.target.value })}
            maxLength={PRICE_UNIT_CUSTOM_MAX_LENGTH}
            disabled={disabled}
            placeholder={t('unit.customExample')}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${errorId} ${customId}-hint` : `${customId}-hint`}
            aria-required="true"
          />
          <p id={`${customId}-hint`} className={styles.muted}>{t('unit.customHint')}</p>
          {invalid && <p id={errorId} className={styles.error}>{t('unit.customRequired')}</p>}
        </>
      )}
    </>
  );
}
