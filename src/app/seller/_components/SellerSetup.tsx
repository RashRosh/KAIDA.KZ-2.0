'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerChangeSetCreate, type ProductDraft } from './SellerChangeSetCreate';
import { SellerContactSettings, type OwnerContacts } from './SellerContactSettings';
import { SellerOfferManagement } from './SellerOfferManagement';
import { SellerTradingPoints } from './SellerTradingPoints';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';

type ApiError = { error?: { code?: string; message?: string } };
type SellerResponse = { seller: SellerView | null };
type ContactsResponse = { contacts: OwnerContacts };

const emptyProductDraft: ProductDraft = {
  productName: '',
  priceAmount: '',
  priceUnit: '',
  sellerComment: '',
};

function StorePointIcon() {
  return (
    <span className={styles.storePointIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10v9h16v-9" />
        <path d="M3 10 5.2 5h13.6L21 10" />
        <path d="M3 10c0 1.3 1 2.3 2.3 2.3S7.7 11.3 7.7 10c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3c0 1.3 1 2.3 2.3 2.3s2.4-1 2.4-2.3c0 1.3 1 2.3 2.3 2.3S21 11.3 21 10" />
        <path d="M9 19v-4h6v4" />
      </svg>
    </span>
  );
}

function ProductIcon() {
  return (
    <span className={styles.storePointIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
        <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9" />
      </svg>
    </span>
  );
}

export function SellerSetup({ commentTranslationEnabled = false }: { commentTranslationEnabled?: boolean }) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [savedContacts, setSavedContacts] = useState<OwnerContacts | null>(null);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsLoadError, setContactsLoadError] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState<'landing' | 'setup' | 'product'>('landing');
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const [resumeProductAfterSetup, setResumeProductAfterSetup] = useState(false);
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
        const data = await response.json() as SellerResponse & ApiError;
        if (!response.ok) {
          setError(t('seller.loadError'));
          setState('ready');
          return;
        }

        setSeller(data.seller);

        if (data.seller) {
          try {
            const contactsResponse = await fetch(`/api/seller/contacts?locale=${locale}`, { cache: 'no-store' });
            const contactsData = await contactsResponse.json() as ContactsResponse & ApiError;
            if (!active) return;
            if (!contactsResponse.ok) {
              setContactsLoadError(t('seller.contactsLoadError'));
            } else {
              setSavedContacts(contactsData.contacts);
            }
          } catch {
            if (active) setContactsLoadError(t('seller.contactsLoadError'));
          } finally {
            if (active) setContactsLoaded(true);
          }
        }
        setState('ready');
      } catch {
        if (!active) return;
        setError(t('seller.loadError'));
        setState('ready');
      }
    })();
    return () => { active = false; };
  }, [locale, t]);

  const firstLocation = seller?.locations[0] ?? null;
  const phoneReady = savedContacts?.phoneE164 !== null && savedContacts?.phoneE164 !== undefined;
  const geoReady = Boolean(firstLocation?.geo);
  const onboardingComplete = Boolean(seller && firstLocation && contactsLoaded && phoneReady && geoReady);

  function requireTradingPointSetup() {
    setResumeProductAfterSetup(true);
    setProductResumed(false);
    setWorkspaceMode(seller ? 'landing' : 'setup');
  }

  function resumeProductFlow() {
    setWorkspaceMode('product');
    setResumeProductAfterSetup(false);
    setProductResumed(true);
  }

  if (state === 'loading') return <section className={styles.card}><p>{t('seller.loading')}</p></section>;

  if (state === 'anonymous') {
    return (
      <>
        <div className={styles.intro}>
          <h1>{t('seller.cabinet')}</h1>
          <p>{t('seller.managePointProducts')}</p>
        </div>
        <section className={styles.card}>
          <h2>{t('seller.loginRequired')}</h2>
          <p className={styles.muted}>{t('seller.loginHelp')}</p>
          <Link className={styles.primaryLink} href="/login">{t('auth.signIn')}</Link>
        </section>
      </>
    );
  }

  if (!seller && workspaceMode === 'landing') {
    return (
      <>
        <div className={styles.intro}>
          <h1>{t('seller.cabinet')}</h1>
          <p>{t('seller.firstChoice')}</p>
        </div>
        <section className={styles.firstRun} aria-labelledby="seller-first-run-heading">
          <h2 id="seller-first-run-heading">{t('seller.startTask')}</h2>
          <div className={styles.firstRunActions}>
            <button type="button" className={styles.firstRunAction} aria-label={t('seller.tradingPoint')} onClick={() => setWorkspaceMode('setup')}>
              <StorePointIcon />
              <span><strong>{t('seller.tradingPoint')}</strong><small>{t('seller.createFirstPoint')}</small></span>
            </button>
            <button type="button" className={styles.firstRunAction} aria-label={t('seller.addProduct')} onClick={() => setWorkspaceMode('product')}>
              <ProductIcon />
              <span><strong>{t('seller.addProduct')}</strong><small>{t('seller.addProductHint')}</small></span>
            </button>
          </div>
        </section>
      </>
    );
  }

  if (workspaceMode === 'product') {
    return (
      <>
        <div className={styles.intro}>
          <h1>{t('seller.newProduct')}</h1>
          <p>{t('seller.offerAfterConfirm')}</p>
        </div>
        <div className={styles.workspaceBackRow}>
          <button type="button" className={styles.secondaryLinkButton} onClick={() => setWorkspaceMode('landing')}>{t('seller.backCabinet')}</button>
        </div>
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

  if (seller) {
    return (
      <>
        <div className={styles.intro}>
          <h1>{t('seller.cabinet')}</h1>
          <p>{t('seller.managePointOffers')}</p>
        </div>
        <div className={styles.stack}>
        <section className={styles.card} aria-labelledby="seller-summary-heading">
          <p className={styles.eyebrow}>{onboardingComplete ? t('seller.setupComplete') : t('seller.profile')}</p>
          <div className={styles.completedHeader}>
            <div>
              <h2 id="seller-summary-heading">{seller.displayName}</h2>
              <p className={styles.muted}>{onboardingComplete ? t('seller.readyHint') : t('seller.incompleteHint')}</p>
            </div>
            <Link className={styles.secondaryLinkButton} href="/seller/batch">{t('seller.batchLink')}</Link>
          </div>
        </section>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {contactsLoadError && <p className={styles.error} role="alert">{contactsLoadError}</p>}
        <SellerTradingPoints
          seller={seller}
          onSellerChange={setSeller}
          autoOpenAdd={resumeProductAfterSetup && seller.locations.length === 0}
          onLocationCreated={resumeProductAfterSetup ? resumeProductFlow : undefined}
        />
        <SellerContactSettings onSaved={setSavedContacts} />
        <SellerChangeSetCreate
          seller={seller}
          draft={productDraft}
          onDraftChange={setProductDraft}
          onPrerequisiteRequired={requireTradingPointSetup}
          commentTranslationEnabled={commentTranslationEnabled}
        />
        <SellerOfferManagement commentTranslationEnabled={commentTranslationEnabled} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.intro}>
        <h1>{t('seller.cabinet')}</h1>
        <p>{t('seller.createPointIntro')}</p>
      </div>
      {!resumeProductAfterSetup && (
        <div className={styles.workspaceBackRow}>
          <button type="button" className={styles.secondaryLinkButton} onClick={() => setWorkspaceMode('landing')}>{t('seller.backChoice')}</button>
        </div>
      )}
      {resumeProductAfterSetup && <p className={styles.draftNotice} role="status">{t('seller.draftKept')}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <SellerTradingPoints
        seller={null}
        onSellerChange={(createdSeller) => {
          setSeller(createdSeller);
          setContactsLoaded(true);
          if (resumeProductAfterSetup) resumeProductFlow();
          else setWorkspaceMode('landing');
        }}
        autoOpenAdd
      />
    </>
  );
}
