'use client';

import type { InputHTMLAttributes } from 'react';
import styles from './ClearableInput.module.css';

type ClearableInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  clearLabel: string;
};

export function ClearableInput({ value, onValueChange, clearLabel, disabled, ...props }: ClearableInputProps) {
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
          aria-label={`Очистить поле «${clearLabel}»`}
          title="Очистить"
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
