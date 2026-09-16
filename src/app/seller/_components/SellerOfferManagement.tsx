'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../page.module.css';

type ApiError = { error?: { code?: string; message?: string } };
type OffersResponse = { offers?: SellerOfferView[] } & ApiError;
type ChangeResponse = { changeSet?: SellerChangeSetView } & ApiError;

export function SellerOfferManagement() {
  const router = useRouter();
  const [offers, setOffers] = useState<SellerOfferView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [priceAmount, setPriceAmount] = useState('');
  const [priceUnit, setPriceUnit] = useState('');
  const [sellerComment, setSellerComment] = useState('');
  const [submittingOfferId, setSubmittingOfferId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/seller/offers', { cache: 'no-store' });
        const data = await response.json() as OffersResponse;
        if (!active) return;
        if (!response.ok || !data.offers) {
          setError(data.error?.message ?? 'Не удалось загрузить предложения.');
          return;
        }
        setOffers(data.offers);
      } catch {
        if (active) setError('Не удалось загрузить предложения.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function beginEdit(offer: SellerOfferView) {
    setError('');
    setEditingOfferId(offer.id);
    setPriceAmount(offer.price?.amount ?? '');
    setPriceUnit(offer.price?.unit ?? '');
    setSellerComment(offer.sellerComment ?? '');
  }

  async function createProposal(offerId: string, body: unknown) {
    setError('');
    setSubmittingOfferId(offerId);
    try {
      const response = await fetch(`/api/seller/offers/${offerId}/change-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as ChangeResponse;
      if (!response.ok || !data.changeSet) {
        setError(data.error?.message ?? 'Не удалось создать изменение.');
        return;
      }
      router.push(`/seller/change-sets/${data.changeSet.id}`);
    } catch {
      setError('Не удалось создать изменение.');
    } finally {
      setSubmittingOfferId(null);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, offerId: string) {
    event.preventDefault();
    const amount = priceAmount.trim();
    if (amount === '') {
      setError('Укажите цену предложения.');
      return;
    }
    await createProposal(offerId, {
      action: 'update_offer',
      price: { amount, unit: priceUnit },
      sellerComment,
    });
  }

  return (
    <section className={styles.card} aria-labelledby="seller-offers-heading">
      <p className={styles.eyebrow}>Offer management</p>
      <h2 id="seller-offers-heading">Мои предложения</h2>
      <p className={styles.muted}>Изменения применятся только после отдельного подтверждения.</p>

      {loading && <p className={styles.muted}>Загружаем предложения…</p>}
      {!loading && offers.length === 0 && <p className={styles.muted}>Пока нет созданных предложений.</p>}

      <div className={styles.offerList}>
        {offers.map((offer) => {
          const editing = editingOfferId === offer.id;
          const submitting = submittingOfferId === offer.id;
          const needsPrice = offer.price === null;
          return (
            <article key={offer.id} className={styles.offerCard} data-testid={`seller-offer-${offer.id}`}>
              <div className={styles.offerHeader}>
                <div>
                  <h3>{offer.product.name}</h3>
                  <p className={styles.muted}>{offer.location.name} · {offer.location.addressText}</p>
                </div>
                <span className={styles.offerStatus}>{offer.status === 'active' ? 'Активно' : 'Выключено'}</span>
              </div>
              <dl className={styles.summaryGrid}>
                <dt>Цена</dt><dd>{offer.price ? `${offer.price.amount} ${offer.price.currency}${offer.price.unit ? ` / ${offer.price.unit}` : ''}` : 'Требуется цена'}</dd>
                <dt>Комментарий</dt><dd>{offer.sellerComment ?? 'Не указан'}</dd>
              </dl>

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => beginEdit(offer)} disabled={submitting}>Изменить</button>
                {offer.status === 'active' ? (
                  <>
                    <button type="button" className={styles.secondaryButton} onClick={() => void createProposal(offer.id, { action: 'deactivate_offer' })} disabled={submitting}>{submitting ? 'Создаём…' : 'Выключить'}</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => void createProposal(offer.id, { action: 'activate_offer' })} disabled={submitting || needsPrice}>{needsPrice ? 'Сначала укажите цену' : submitting ? 'Создаём…' : 'Подтвердить актуальность'}</button>
                  </>
                ) : (
                  <button type="button" className={styles.secondaryButton} onClick={() => void createProposal(offer.id, { action: 'activate_offer' })} disabled={submitting || needsPrice}>{needsPrice ? 'Сначала укажите цену' : submitting ? 'Создаём…' : 'Включить'}</button>
                )}
              </div>

              {editing && (
                <form className={styles.inlineForm} onSubmit={(event) => void submitUpdate(event, offer.id)} noValidate>
                  <label htmlFor={`offer-price-${offer.id}`}>Цена, ₸</label>
                  <input id={`offer-price-${offer.id}`} value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} inputMode="decimal" disabled={submitting} placeholder="Обязательно" aria-required="true" />
                  <label htmlFor={`offer-unit-${offer.id}`}>Единица</label>
                  <input id={`offer-unit-${offer.id}`} value={priceUnit} onChange={(event) => setPriceUnit(event.target.value)} maxLength={32} disabled={submitting || priceAmount.trim() === ''} placeholder="Например, кг" />
                  <label htmlFor={`offer-comment-${offer.id}`}>Комментарий продавца</label>
                  <textarea id={`offer-comment-${offer.id}`} value={sellerComment} onChange={(event) => setSellerComment(event.target.value)} maxLength={500} rows={3} disabled={submitting} placeholder="Без комментария" />
                  <div className={styles.actions}>
                    <button type="submit" disabled={submitting}>{submitting ? 'Создаём…' : 'Проверить изменение'}</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => setEditingOfferId(null)} disabled={submitting}>Отмена</button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
