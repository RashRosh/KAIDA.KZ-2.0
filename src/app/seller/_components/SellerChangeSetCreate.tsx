'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../page.module.css';

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
}: SellerChangeSetCreateProps) {
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
      setError('Укажите товар.');
      return;
    }
    const normalizedAmount = draft.priceAmount.trim();
    if (normalizedAmount === '') {
      setError('Укажите цену предложения.');
      return;
    }
    if (!seller || locations.length === 0) {
      onPrerequisiteRequired();
      return;
    }
    if (!location) {
      setError('Выберите торговую точку.');
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
        setError(data.error?.message ?? 'Не удалось создать изменение.');
        return;
      }
      router.push(`/seller/change-sets/${data.changeSet.id}`);
    } catch {
      setError('Не удалось создать изменение.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="seller-change-set-create-heading">
      <h2 id="seller-change-set-create-heading">Добавить товар</h2>
      <p className={styles.muted}>Заполните товар и цену. Если торговой точки ещё нет, добавим её перед созданием изменения.</p>
      {resumedAfterSetup && <p className={styles.status} role="status">Торговая точка готова. Введённые данные товара сохранены — проверьте их и продолжите.</p>}
      <form className={styles.form} onSubmit={submit} noValidate>
        {locations.length === 1 && location && <p className={styles.muted}>Точка: <strong>{location.name}</strong> · {location.addressText}</p>}
        {locations.length > 1 && (
          <>
            <label htmlFor="seller-offer-location">Торговая точка</label>
            <select id="seller-offer-location" value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={submitting} required>
              <option value="">Выберите торговую точку</option>
              {locations.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.addressText}</option>)}
            </select>
          </>
        )}
        <label htmlFor="seller-product-name">Товар</label>
        <input id="seller-product-name" value={draft.productName} onChange={(event) => updateDraft('productName', event.target.value)} disabled={submitting} autoComplete="off" />

        <label htmlFor="seller-price-amount">Цена, ₸</label>
        <input id="seller-price-amount" value={draft.priceAmount} onChange={(event) => updateDraft('priceAmount', event.target.value)} disabled={submitting} inputMode="decimal" placeholder="Обязательно" aria-required="true" />

        <label htmlFor="seller-price-unit">Единица</label>
        <input id="seller-price-unit" value={draft.priceUnit} onChange={(event) => updateDraft('priceUnit', event.target.value)} maxLength={32} disabled={submitting || draft.priceAmount.trim() === ''} placeholder="Например, кг" />

        <label htmlFor="seller-comment">Комментарий продавца</label>
        <textarea id="seller-comment" value={draft.sellerComment} onChange={(event) => updateDraft('sellerComment', event.target.value)} maxLength={500} rows={3} disabled={submitting} placeholder="Необязательно" />

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? 'Создаём…' : locations.length > 0 ? 'Создать изменение' : 'Продолжить'}</button>
      </form>
    </section>
  );
}
