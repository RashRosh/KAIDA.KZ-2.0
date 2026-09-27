'use client';

import Link from 'next/link';
import styles from '../cabinet.module.css';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { CabinetIcon } from './SellerCabinetFrame';

export function CabinetLoginRequired({ help = 'seller.loginHelp' }: { help?: MessageKey }) {
  const { t } = useI18n();
  return (
    <section className={styles.panel} aria-labelledby="cabinet-login-required">
      <p className={styles.eyebrowMuted}>{t('cabinet.title')}</p>
      <h1 id="cabinet-login-required" className={styles.title}>{t('seller.loginRequired')}</h1>
      <p className={styles.lead}>{t(help)}</p>
      <Link className={styles.primary} href="/login">{t('auth.signIn')}</Link>
    </section>
  );
}

// Local block error (DESIGN_SYSTEM.md §7.1): what failed and what to do; nothing technical.
export function CabinetLoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <section className={`${styles.panel} ${styles.errorBlock}`} role="alert">
      <h2>{title}</h2>
      <p>{t('cabinet.unchanged')}</p>
      <button type="button" className={styles.secondary} onClick={onRetry}><CabinetIcon name="retry" />{t('cabinet.retry')}</button>
    </section>
  );
}

export function CabinetSkeleton({ rows }: { rows: number }) {
  const { t } = useI18n();
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className={styles.srOnly} role="status">{t('cabinet.loading')}</span>
      {Array.from({ length: rows }, (_, index) => <div key={index} className={styles.skeletonBlock} />)}
    </div>
  );
}
