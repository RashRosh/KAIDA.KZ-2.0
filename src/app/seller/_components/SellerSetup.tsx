'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerChangeSetCreate, type ProductDraft } from './SellerChangeSetCreate';
import { SellerTradingPoints } from './SellerTradingPoints';
import { CabinetLoginRequired } from './CabinetStates';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';

type SellerResponse = { seller: SellerView | null };

const emptyProductDraft: ProductDraft = {
  productName: '',
  priceAmount: '',
  priceUnit: '',
  sellerComment: '',
};

// Product-first create flow (#35) behind «Добавить товар». When the Seller or their first trading point is still
// missing, the point step opens in place and the product draft stays in this window until the Seller returns.
export function SellerSetup({ commentTranslationEnabled = false }: { commentTranslationEnabled?: boolean }) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [mode, setMode] = useState<'product' | 'setup' | 'points'>('product');
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const [productResumed, setProductResumed] = useState(false);
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
        if (!response.ok) {
          setError(t('seller.loadError'));
          setState('ready');
          return;
        }
        const data = await response.json() as SellerResponse;
        if (!active) return;
        setSeller(data.seller);
        setState('ready');
      } catch {
        if (!active) return;
        setError(t('seller.loadError'));
        setState('ready');
      }
    })();
    return () => { active = false; };
  }, [locale, t]);

  function requireTradingPointSetup() {
    setProductResumed(false);
    setMode(seller ? 'points' : 'setup');
  }

  function resumeProductFlow() {
    setMode('product');
    setProductResumed(true);
  }

  if (state === 'loading') return <section className={styles.card}><p>{t('seller.loading')}</p></section>;
  if (state === 'anonymous') return <CabinetLoginRequired />;

  if (mode === 'product') {
    return (
      <>
        <div className={styles.intro}>
          <h1>{t('seller.newProduct')}</h1>
          <p>{t('seller.offerAfterConfirm')}</p>
        </div>
        <div className={styles.workspaceBackRow}>
          <Link className={styles.secondaryLinkButton} href="/seller">{t('seller.backCabinet')}</Link>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <SellerChangeSetCreate
          seller={seller}
          draft={productDraft}
          onDraftChange={setProductDraft}
          onPrerequisiteRequired={requireTradingPointSetup}
          commentTranslationEnabled={commentTranslationEnabled}
          resumedAfterSetup={productResumed}
        />
      </>
    );
  }

  return (
    <>
      <div className={styles.intro}>
        <h1>{t('seller.newProduct')}</h1>
        <p>{t('seller.createPointIntro')}</p>
      </div>
      <p className={styles.draftNotice} role="status">{t('seller.draftKept')}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {mode === 'setup' ? (
        <SellerTradingPoints
          seller={null}
          onSellerChange={(createdSeller) => {
            setSeller(createdSeller);
            resumeProductFlow();
          }}
          autoOpenAdd
        />
      ) : (
        <SellerTradingPoints
          seller={seller}
          onSellerChange={setSeller}
          autoOpenAdd
          onLocationCreated={resumeProductFlow}
        />
      )}
    </>
  );
}
