'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerContactSettings } from './SellerContactSettings';
import { SellerTradingPoints } from './SellerTradingPoints';
import { CabinetLoadError, CabinetLoginRequired, CabinetSkeleton } from './CabinetStates';
import styles from '../cabinet.module.css';
import { useI18n } from '../../../i18n/I18nProvider';

type SellerState = { kind: 'loading' } | { kind: 'anonymous' } | { kind: 'error' } | { kind: 'ready'; seller: SellerView | null };

function useOwnedSeller() {
  const { locale } = useI18n();
  const [state, setState] = useState<SellerState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
        if (!alive) return;
        if (response.status === 401) {
          setState({ kind: 'anonymous' });
          return;
        }
        if (!response.ok) throw new Error('seller');
        const data = await response.json() as { seller: SellerView | null };
        if (alive) setState({ kind: 'ready', seller: data.seller });
      } catch {
        if (alive) setState({ kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [locale, attempt]);
  return {
    state,
    setSeller: (seller: SellerView) => setState({ kind: 'ready', seller }),
    retry: () => { setState({ kind: 'loading' }); setAttempt((value) => value + 1); },
  };
}

// Trading points (#36) inside the cabinet frame; behavior unchanged until seller-points-contacts.
export function SellerPointsSection() {
  const { t } = useI18n();
  const { state, setSeller, retry } = useOwnedSeller();
  if (state.kind === 'loading') return <CabinetSkeleton rows={2} />;
  if (state.kind === 'anonymous') return <CabinetLoginRequired />;
  if (state.kind === 'error') return <CabinetLoadError title={t('seller.loadError')} onRetry={retry} />;
  return (
    <>
      <div className={styles.pageHead}><h1>{t('cabinet.points')}</h1></div>
      <SellerTradingPoints seller={state.seller} onSellerChange={setSeller} autoOpenAdd={state.seller === null} />
    </>
  );
}

// Seller contacts (S10) inside the cabinet frame; behavior unchanged until seller-points-contacts.
export function SellerContactsSection() {
  const { t } = useI18n();
  const { state, retry } = useOwnedSeller();
  if (state.kind === 'loading') return <CabinetSkeleton rows={2} />;
  if (state.kind === 'anonymous') return <CabinetLoginRequired />;
  if (state.kind === 'error') return <CabinetLoadError title={t('seller.loadError')} onRetry={retry} />;
  return (
    <>
      <div className={styles.pageHead}><h1>{t('cabinet.contacts')}</h1></div>
      {state.seller ? <SellerContactSettings /> : (
        <section className={styles.panel}>
          <p className={styles.lead}>{t('batch.setupFirst')}</p>
          <Link className={styles.secondary} href="/seller/points">{t('batch.setupSeller')}</Link>
        </section>
      )}
    </>
  );
}
