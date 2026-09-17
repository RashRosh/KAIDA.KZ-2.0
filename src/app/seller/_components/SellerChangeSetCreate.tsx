'use client';

import { FormEvent, useState } from 'react';
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
  prerequisiteComplete: boolean;
  draft: ProductDraft;
  onDraftChange: (draft: ProductDraft) => void;
  onPrerequisiteRequired: () => void;
  resumedAfterSetup?: boolean;
};

export function SellerChangeSetCreate({
  seller,
  prerequisiteComplete,
  draft,
  onDraftChange,
  onPrerequisiteRequired,
  resumedAfterSetup = false,
}: SellerChangeSetCreateProps) {
  const router = useRouter();
  const location = seller?.locations[0] ?? null;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (!prerequisiteComplete || !seller || !location) {
      onPrerequisiteRequired();
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
      <p className={styles.muted}>Заполните товар и цену. Если торговая точка ещё не готова, настроим её перед созданием изменения.</p>
      {resumedAfterSetup && <p className={styles.status} role="status">Торговая точка готова. Введённые данные товара сохранены — проверьте их и продолжите.</p>}
      {location && <p className={styles.muted}>Точка: <strong>{location.name}</strong></p>}
      <form className={styles.form} onSubmit={submit} noValidate>
        <label htmlFor="seller-product-name">Товар</label>
        <input id="seller-product-name" value={draft.productName} onChange={(event) => updateDraft('productName', event.target.value)} disabled={submitting} autoComplete="off" />

        <label htmlFor="seller-price-amount">Цена, ₸</label>
        <input id="seller-price-amount" value={draft.priceAmount} onChange={(event) => updateDraft('priceAmount', event.target.value)} disabled={submitting} inputMode="decimal" placeholder="Обязательно" aria-required="true" />

        <label htmlFor="seller-price-unit">Единица</label>
        <input id="seller-price-unit" value={draft.priceUnit} onChange={(event) => updateDraft('priceUnit', event.target.value)} maxLength={32} disabled={submitting || draft.priceAmount.trim() === ''} placeholder="Например, кг" />

        <label htmlFor="seller-comment">Комментарий продавца</label>
        <textarea id="seller-comment" value={draft.sellerComment} onChange={(event) => updateDraft('sellerComment', event.target.value)} maxLength={500} rows={3} disabled={submitting} placeholder="Необязательно" />

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? 'Создаём…' : prerequisiteComplete ? 'Создать изменение' : 'Продолжить'}</button>
      </form>
    </section>
  );
}
