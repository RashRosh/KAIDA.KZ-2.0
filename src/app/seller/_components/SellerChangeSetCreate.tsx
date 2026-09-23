'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../page.module.css';
import { useI18n } from '../../../i18n/I18nProvider';
import { CommentTranslationAssist } from './CommentTranslationAssist';

type ApiError = { error?: { code?: string; message?: string } };
type CreateResponse = { changeSet?: SellerChangeSetView } & ApiError;

export type ProductDraft = {
  productName: string;
  priceAmount: string;
  priceUnit: string;
  sellerComment: string;
};

type SellerChangeSetCreateProps = {
  seller: SellerView | null;
  draft: ProductDraft;
  onDraftChange: (draft: ProductDraft) => void;
  onPrerequisiteRequired: () => void;
  resumedAfterSetup?: boolean;
  commentTranslationEnabled?: boolean;
};

export function automaticLocationId(seller: SellerView | null): string {
  return seller?.locations.length === 1 ? seller.locations[0]!.id : '';
}

export function SellerChangeSetCreate({
  seller,
  draft,
  onDraftChange,
  onPrerequisiteRequired,
  resumedAfterSetup = false,
  commentTranslationEnabled = false,
}: SellerChangeSetCreateProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [locationId, setLocationId] = useState(() => automaticLocationId(seller));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const locations = seller?.locations ?? [];
  const location = locations.find((candidate) => candidate.id === locationId) ?? null;
  const previousLocationCount = useRef(locations.length);

  useEffect(() => {
    const previousCount = previousLocationCount.current;
    previousLocationCount.current = seller?.locations.length ?? 0;
    setLocationId((current) => {
      if (seller?.locations.length === 1) return seller.locations[0]!.id;
      if (!seller || seller.locations.length === 0) return '';
      if (previousCount <= 1) return '';
      return seller.locations.some((candidate) => candidate.id === current) ? current : '';
    });
  }, [seller]);

  function updateDraft(field: keyof ProductDraft, value: string) {
    onDraftChange({ ...draft, [field]: value });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (draft.productName.trim() === '') {
      setError(t('offerCreate.productRequired'));
      return;
    }
    const normalizedAmount = draft.priceAmount.trim();
    if (normalizedAmount === '') {
      setError(t('offerCreate.priceRequired'));
      return;
    }
    if (!seller || locations.length === 0) {
      onPrerequisiteRequired();
      return;
    }
    if (!location) {
      setError(t('offerCreate.locationRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/seller/change-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: draft.productName,
          locationId: location.id,
          price: { amount: normalizedAmount, unit: draft.priceUnit },
          sellerComment: draft.sellerComment,
        }),
      });
      const data = await response.json() as CreateResponse;
      if (!response.ok || !data.changeSet) {
        setError(t('offerCreate.error'));
        return;
      }
      router.push(`/seller/change-sets/${data.changeSet.id}`);
    } catch {
      setError(t('offerCreate.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="seller-change-set-create-heading">
      <h2 id="seller-change-set-create-heading">{t('offerCreate.title')}</h2>
      <p className={styles.muted}>{t('offerCreate.description')}</p>
      {resumedAfterSetup && <p className={styles.status} role="status">{t('offerCreate.resumed')}</p>}
      <form className={styles.form} onSubmit={submit} noValidate>
        {locations.length === 1 && location && <p className={styles.muted}>{t('offerCreate.point', { name: location.name })} · {location.addressText}</p>}
        {locations.length > 1 && (
          <>
            <label htmlFor="seller-offer-location">{t('seller.tradingPoint')}</label>
            <select id="seller-offer-location" value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={submitting} required>
              <option value="">{t('offerCreate.chooseLocation')}</option>
              {locations.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.addressText}</option>)}
            </select>
          </>
        )}
        <label htmlFor="seller-product-name">{t('offerCreate.product')}</label>
        <input id="seller-product-name" value={draft.productName} onChange={(event) => updateDraft('productName', event.target.value)} disabled={submitting} autoComplete="off" />

        <label htmlFor="seller-price-amount">{t('offerCreate.price')}</label>
        <input id="seller-price-amount" value={draft.priceAmount} onChange={(event) => updateDraft('priceAmount', event.target.value)} disabled={submitting} inputMode="decimal" placeholder={t('offerCreate.required')} aria-required="true" />

        <label htmlFor="seller-price-unit">{t('offerCreate.unit')}</label>
        <input id="seller-price-unit" value={draft.priceUnit} onChange={(event) => updateDraft('priceUnit', event.target.value)} maxLength={32} disabled={submitting || draft.priceAmount.trim() === ''} placeholder={t('offerCreate.unitExample')} />

        <label htmlFor="seller-comment">{t('offerCreate.comment')}</label>
        <textarea id="seller-comment" value={draft.sellerComment} onChange={(event) => updateDraft('sellerComment', event.target.value)} maxLength={500} rows={3} disabled={submitting} placeholder={t('offerCreate.optional')} />
        <CommentTranslationAssist enabled={commentTranslationEnabled} comment={draft.sellerComment} />

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? t('offerCreate.creating') : locations.length > 0 ? t('offerCreate.create') : t('offerCreate.continue')}</button>
      </form>
    </section>
  );
}
