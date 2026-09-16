'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../page.module.css';

type ApiError = { error?: { code?: string; message?: string } };
type CreateResponse = { changeSet?: SellerChangeSetView } & ApiError;

export function SellerChangeSetCreate({ seller }: { seller: SellerView }) {
  const router = useRouter();
  const location = seller.locations[0];
  const [productName, setProductName] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceUnit, setPriceUnit] = useState('');
  const [sellerComment, setSellerComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) return;
    setError('');
    const normalizedAmount = priceAmount.trim();
    if (normalizedAmount === '') {
      setError('Укажите цену предложения.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/seller/change-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          locationId: location.id,
          price: { amount: normalizedAmount, unit: priceUnit },
          sellerComment,
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

  if (!location) {
    return <section className={styles.card}><p className={styles.error}>Для добавления товара нужна точка продавца.</p></section>;
  }

  return (
    <section className={styles.card} aria-labelledby="seller-change-set-create-heading">
      <p className={styles.eyebrow}>Seller Input</p>
      <h2 id="seller-change-set-create-heading">Добавить товар</h2>
      <p className={styles.muted}>Сначала создадим изменение. Offer появится только после отдельного подтверждения.</p>
      <p className={styles.muted}>Точка: <strong>{location.name}</strong></p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label htmlFor="seller-product-name">Товар</label>
        <input id="seller-product-name" value={productName} onChange={(event) => setProductName(event.target.value)} disabled={submitting} autoComplete="off" />

        <label htmlFor="seller-price-amount">Цена, ₸</label>
        <input id="seller-price-amount" value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} disabled={submitting} inputMode="decimal" placeholder="Обязательно" aria-required="true" />

        <label htmlFor="seller-price-unit">Единица</label>
        <input id="seller-price-unit" value={priceUnit} onChange={(event) => setPriceUnit(event.target.value)} maxLength={32} disabled={submitting || priceAmount.trim() === ''} placeholder="Например, кг" />

        <label htmlFor="seller-comment">Комментарий продавца</label>
        <textarea id="seller-comment" value={sellerComment} onChange={(event) => setSellerComment(event.target.value)} maxLength={500} rows={3} disabled={submitting} placeholder="Необязательно" />

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? 'Создаём…' : 'Создать изменение'}</button>
      </form>
    </section>
  );
}
