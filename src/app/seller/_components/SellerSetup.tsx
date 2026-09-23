'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import { SellerChangeSetCreate, type ProductDraft } from './SellerChangeSetCreate';
import { SellerTradingPoints } from './SellerTradingPoints';
import { CabinetLoginRequired } from './CabinetStates';
import { emptyPriceUnitDraft, priceUnitDraftFrom } from './PriceUnitField';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';

type SellerResponse = { seller: SellerView | null };

const emptyProductDraft: ProductDraft = {
  productName: '',
  priceAmount: '',
  priceUnit: emptyPriceUnitDraft,
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
  const returnedFrom = useSearchParams().get('from');
  const [prefill, setPrefill] = useState<{ pending: boolean; locationId?: string }>(() => ({ pending: returnedFrom !== null }));

  // «Вернуться к правке» from the review: refill the form from that proposed create, including its unit choice.
  useEffect(() => {
    if (returnedFrom === null) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/change-sets/${encodeURIComponent(returnedFrom)}`, { cache: 'no-store' });
        const data = response.ok ? await response.json() as { changeSet?: SellerChangeSetView } : {};
        const item = data.changeSet?.status === 'proposed' && data.changeSet.items.length === 1 ? data.changeSet.items[0] : undefined;
        if (!active) return;
        if (item?.action === 'create_offer' && item.price) {
          setProductDraft({
            productName: item.product.name,
            priceAmount: item.price.amount,
            priceUnit: priceUnitDraftFrom(item.price.unitChoice),
            sellerComment: item.sellerComment ?? '',
          });
          setPrefill({ pending: false, locationId: item.location.id });
          return;
        }
      } catch {
        // An unreadable proposal just opens the empty form.
      }
      if (active) setPrefill({ pending: false });
    })();
    return () => { active = false; };
  }, [returnedFrom]);

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

  if (state === 'loading' || prefill.pending) return <section className={styles.card}><p>{t('seller.loading')}</p></section>;
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
          initialLocationId={prefill.locationId}
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
