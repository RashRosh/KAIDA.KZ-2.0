'use client';

import styles from './AppHeader.module.css';
import { useI18n } from '@/i18n/I18nProvider';

export function HeaderSearch() {
  const { t } = useI18n();
  return (
    <form
      className={styles.headerSearch}
      action="/"
      method="get"
      role="search"
      aria-label={t('header.searchLabel')}
    >
      <label htmlFor="header-product-query" className={styles.visuallyHidden}>{t('header.searchProduct')}</label>
      <div className={styles.headerSearchField}>
        <svg className={styles.headerSearchIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.25 4.25" />
        </svg>
        <input
          id="header-product-query"
          name="q"
          type="search"
          placeholder={t('header.searchPlaceholder')}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <button type="submit" aria-label={t('search.submit')}>
        <svg className={styles.headerButtonIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m14 7 5 5-5 5" />
        </svg>
      </button>
    </form>
  );
}
