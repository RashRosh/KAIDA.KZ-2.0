'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import styles from '../page.module.css';

type Action = 'create_offer' | 'update_offer' | 'deactivate_offer' | 'activate_offer';
type ApiError = { error?: { code?: string; message?: string } };
type OffersResponse = { offers?: SellerOfferView[] } & ApiError;
type CreateResponse = { changeSet?: SellerChangeSetView } & ApiError;

type DraftItem = {
  key: number;
  action: Action;
  offerId: string;
  productName: string;
  locationId: string;
  priceAmount: string;
  priceUnit: string;
  sellerComment: string;
};

let nextKey = 1;

function newDraft(locationId: string): DraftItem {
  return {
    key: nextKey++,
    action: 'create_offer',
    offerId: '',
    productName: '',
    locationId,
    priceAmount: '',
    priceUnit: '',
    sellerComment: '',
  };
}

export function SellerBatchChangeSetCreate({ seller }: { seller: SellerView }) {
  const router = useRouter();
  const firstLocationId = seller.locations[0]?.id ?? '';
  const [offers, setOffers] = useState<SellerOfferView[]>([]);
  const [items, setItems] = useState<DraftItem[]>(() => [newDraft(firstLocationId), newDraft(firstLocationId)]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/seller/offers', { cache: 'no-store' });
        const data = await response.json() as OffersResponse;
        if (!active) return;
        if (!response.ok || !data.offers) {
          setError(data.error?.message ?? 'Не удалось загрузить предложения для пакета.');
          return;
        }
        setOffers(data.offers);
      } catch {
        if (active) setError('Не удалось загрузить предложения для пакета.');
      } finally {
        if (active) setLoadingOffers(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function selectOffer(item: DraftItem, offerId: string) {
    const offer = offers.find((candidate) => candidate.id === offerId);
    updateItem(item.key, {
      offerId,
      priceAmount: offer?.price?.amount ?? '',
      priceUnit: offer?.price?.unit ?? '',
      sellerComment: offer?.sellerComment ?? '',
    });
  }

  function requestBody() {
    return {
      items: items.map((item) => {
        if (item.action === 'create_offer') {
          const amount = item.priceAmount.trim();
          return {
            action: item.action,
            productName: item.productName,
            locationId: item.locationId,
            price: { amount, unit: item.priceUnit },
            sellerComment: item.sellerComment,
          };
        }
        if (item.action === 'update_offer') {
          const amount = item.priceAmount.trim();
          return {
            action: item.action,
            offerId: item.offerId,
            price: { amount, unit: item.priceUnit },
            sellerComment: item.sellerComment,
          };
        }
        return { action: item.action, offerId: item.offerId };
      }),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const missingPrice = items.some((item) =>
      (item.action === 'create_offer' || item.action === 'update_offer') && item.priceAmount.trim() === '');
    if (missingPrice) {
      setError('Укажите цену для каждого создаваемого или изменяемого Offer.');
      return;
    }
    const invalidActivation = items.some((item) => {
      if (item.action !== 'activate_offer') return false;
      const offer = offers.find((candidate) => candidate.id === item.offerId);
      return offer?.price === null;
    });
    if (invalidActivation) {
      setError('Сначала укажите цену Offer перед включением.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/seller/change-sets/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody()),
      });
      const data = await response.json() as CreateResponse;
      if (!response.ok || !data.changeSet) {
        setError(data.error?.message ?? 'Не удалось создать пакет изменений.');
        return;
      }
      router.push(`/seller/change-sets/${data.changeSet.id}`);
    } catch {
      setError('Не удалось создать пакет изменений.');
    } finally {
      setSubmitting(false);
    }
  }

  if (seller.locations.length === 0) return null;

  return (
    <section className={styles.card} aria-labelledby="seller-batch-heading">
      <p className={styles.eyebrow}>Seller Input · Batch</p>
      <h2 id="seller-batch-heading">Изменить несколько товаров</h2>
      <p className={styles.muted}>Соберите минимум два изменения. Они применятся только вместе после одного подтверждения.</p>

      <form className={styles.form} onSubmit={submit} noValidate>
        {items.map((item, index) => (
          <article key={item.key} className={styles.itemCard} data-testid={`batch-item-${index}`}>
            <h3>Изменение {index + 1}</h3>
            <label htmlFor={`batch-action-${item.key}`}>Действие</label>
            <select
              id={`batch-action-${item.key}`}
              value={item.action}
              disabled={submitting}
              onChange={(event) => updateItem(item.key, { action: event.target.value as Action, offerId: '' })}
            >
              <option value="create_offer">Создать Offer</option>
              <option value="update_offer">Изменить Offer</option>
              <option value="deactivate_offer">Выключить Offer</option>
              <option value="activate_offer">Включить / подтвердить Offer</option>
            </select>

            {item.action === 'create_offer' ? (
              <>
                <label htmlFor={`batch-product-${item.key}`}>Существующий товар каталога</label>
                <input id={`batch-product-${item.key}`} value={item.productName} onChange={(event) => updateItem(item.key, { productName: event.target.value })} disabled={submitting} />

                <label htmlFor={`batch-location-${item.key}`}>Точка</label>
                <select id={`batch-location-${item.key}`} value={item.locationId} onChange={(event) => updateItem(item.key, { locationId: event.target.value })} disabled={submitting}>
                  {seller.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <label htmlFor={`batch-offer-${item.key}`}>Offer</label>
                <select id={`batch-offer-${item.key}`} value={item.offerId} onChange={(event) => selectOffer(item, event.target.value)} disabled={submitting || loadingOffers}>
                  <option value="">Выберите Offer</option>
                  {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.product.name} · {offer.status === 'active' ? 'активно' : 'выключено'}</option>)}
                </select>
              </>
            )}

            {(item.action === 'create_offer' || item.action === 'update_offer') && (
              <>
                <label htmlFor={`batch-price-${item.key}`}>Цена, ₸</label>
                <input id={`batch-price-${item.key}`} value={item.priceAmount} onChange={(event) => updateItem(item.key, { priceAmount: event.target.value })} inputMode="decimal" disabled={submitting} placeholder="Обязательно" aria-required="true" />
                <label htmlFor={`batch-unit-${item.key}`}>Единица</label>
                <input id={`batch-unit-${item.key}`} value={item.priceUnit} onChange={(event) => updateItem(item.key, { priceUnit: event.target.value })} maxLength={32} disabled={submitting || item.priceAmount.trim() === ''} placeholder="Например, кг" />
                <label htmlFor={`batch-comment-${item.key}`}>Комментарий продавца</label>
                <textarea id={`batch-comment-${item.key}`} value={item.sellerComment} onChange={(event) => updateItem(item.key, { sellerComment: event.target.value })} maxLength={500} rows={2} disabled={submitting} placeholder="Без комментария" />
              </>
            )}

            {items.length > 2 && <button type="button" className={styles.secondaryButton} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} disabled={submitting}>Убрать из пакета</button>}
          </article>
        ))}

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setItems((current) => [...current, newDraft(firstLocationId)])} disabled={submitting}>Добавить изменение</button>
          <button type="submit" disabled={submitting}>{submitting ? 'Создаём пакет…' : 'Проверить весь пакет'}</button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>
    </section>
  );
}
