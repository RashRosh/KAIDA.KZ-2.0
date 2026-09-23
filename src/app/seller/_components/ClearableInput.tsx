'use client';

import type { InputHTMLAttributes } from 'react';
import styles from './ClearableInput.module.css';
import { useI18n } from '@/i18n/I18nProvider';

type ClearableInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  clearLabel: string;
};

export function ClearableInput({ value, onValueChange, clearLabel, disabled, ...props }: ClearableInputProps) {
  const { t } = useI18n();
  return (
    <div className={styles.control}>
      <input
        {...props}
        aria-label={props['aria-label'] ?? clearLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value.length > 0 && (
        <button
          className={styles.clearButton}
          type="button"
          aria-label={t('clear.field', { field: clearLabel })}
          title={t('clear.action')}
          disabled={disabled}
          onClick={() => onValueChange('')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
