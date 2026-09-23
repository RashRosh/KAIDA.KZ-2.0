'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { AppHeader } from '../../_components/AppHeader';
import { SellerBatchChangeSetCreate } from '../_components/SellerBatchChangeSetCreate';
import { SellerCabinetFrame } from '../_components/SellerCabinetFrame';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';

type ApiError = { error?: { message?: string } };
type SellerResponse = { seller: SellerView | null } & ApiError;

export default function SellerBatchPage() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) {
          setState('anonymous');
          return;
        }
        const data = await response.json() as SellerResponse;
        if (!response.ok) {
          setError(t('batch.loadSellerError'));
          setState('ready');
          return;
        }
        setSeller(data.seller);
        setState('ready');
      } catch {
        if (active) {
          setError(t('batch.loadSellerError'));
          setState('ready');
        }
      }
    })();
    return () => { active = false; };
  }, [locale, t]);

  return (
    <>
      <AppHeader showAuth={false} contextLabel={t('context.seller')} />
      <SellerCabinetFrame active="offers">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>{t('batch.eyebrow')}</p>
            <h1>{t('batch.pageTitle')}</h1>
            <p>{t('batch.pageDescription')}</p>
          </div>

          {state === 'loading' && <section className={styles.card}><p>{t('seller.loading')}</p></section>}
          {state === 'anonymous' && <section className={styles.card}><h2>{t('seller.loginRequired')}</h2><Link className={styles.primaryLink} href="/login">{t('auth.signIn')}</Link></section>}
          {state === 'ready' && error && <section className={styles.card}><p className={styles.error} role="alert">{error}</p></section>}
          {state === 'ready' && !error && !seller && <section className={styles.card}><p>{t('batch.setupFirst')}</p><Link className={styles.secondaryLink} href="/seller">{t('batch.setupSeller')}</Link></section>}
          {state === 'ready' && seller && <SellerBatchChangeSetCreate seller={seller} />}
      </SellerCabinetFrame>
    </>
  );
}
