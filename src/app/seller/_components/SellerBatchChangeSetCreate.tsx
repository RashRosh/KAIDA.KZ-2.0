'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';
import { PriceUnitField, emptyPriceUnitDraft, priceUnitDraftFrom, priceUnitFromDraft, type PriceUnitDraft } from './PriceUnitField';

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
  priceUnit: PriceUnitDraft;
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
    priceUnit: emptyPriceUnitDraft,
    sellerComment: '',
  };
}

export function SellerBatchChangeSetCreate({ seller }: { seller: SellerView }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const automaticLocationId = seller.locations.length === 1 ? seller.locations[0]!.id : '';
  const [offers, setOffers] = useState<SellerOfferView[]>([]);
  const [items, setItems] = useState<DraftItem[]>(() => [newDraft(automaticLocationId), newDraft(automaticLocationId)]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [unitChecked, setUnitChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/offers?locale=${locale}`, { cache: 'no-store' });
        const data = await response.json() as OffersResponse;
        if (!active) return;
        if (!response.ok || !data.offers) {
          setError(t('batch.loadOffersError'));
          return;
        }
        setOffers(data.offers);
      } catch {
        if (active) setError(t('batch.loadOffersError'));
      } finally {
        if (active) setLoadingOffers(false);
      }
    })();
    return () => { active = false; };
  }, [locale, t]);

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function selectOffer(item: DraftItem, offerId: string) {
    const offer = offers.find((candidate) => candidate.id === offerId);
    updateItem(item.key, {
      offerId,
      priceAmount: offer?.price?.amount ?? '',
      priceUnit: priceUnitDraftFrom(offer?.price?.unitChoice),
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
            price: { amount, unit: priceUnitFromDraft(item.priceUnit)?.unit ?? null },
            sellerComment: item.sellerComment,
          };
        }
        if (item.action === 'update_offer') {
          const amount = item.priceAmount.trim();
          return {
            action: item.action,
            offerId: item.offerId,
            price: { amount, unit: priceUnitFromDraft(item.priceUnit)?.unit ?? null },
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
      setError(t('batch.priceRequired'));
      return;
    }
    const incompleteUnit = items.find((item) =>
      (item.action === 'create_offer' || item.action === 'update_offer') && priceUnitFromDraft(item.priceUnit) === null);
    setUnitChecked(true);
    if (incompleteUnit) {
      document.getElementById(`batch-unit-${incompleteUnit.key}-custom`)?.focus();
      return;
    }
    const missingLocation = items.some((item) => item.action === 'create_offer' && item.locationId === '');
    if (missingLocation) {
      setError(t('batch.locationRequired'));
      return;
    }
    const invalidActivation = items.some((item) => {
      if (item.action !== 'activate_offer') return false;
      const offer = offers.find((candidate) => candidate.id === item.offerId);
      return offer?.price === null;
    });
    if (invalidActivation) {
      setError(t('batch.activationPriceRequired'));
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
        setError(t('batch.createError'));
        return;
      }
      router.push(`/seller/change-sets/${data.changeSet.id}`);
    } catch {
      setError(t('batch.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (seller.locations.length === 0) {
    return (
      <section className={styles.card} aria-labelledby="seller-batch-heading">
        <h2 id="seller-batch-heading">{t('batch.changeSeveral')}</h2>
        <p className={styles.muted}>{t('batch.addPointFirst')}</p>
        <Link className={styles.secondaryLinkButton} href="/seller">{t('batch.openPoints')}</Link>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="seller-batch-heading">
      <p className={styles.eyebrow}>{t('batch.eyebrow')}</p>
      <h2 id="seller-batch-heading">{t('batch.changeSeveral')}</h2>
      <p className={styles.muted}>{t('batch.description')}</p>

      <form className={styles.form} onSubmit={submit} noValidate>
        {items.map((item, index) => (
          <article key={item.key} className={styles.itemCard} data-testid={`batch-item-${index}`}>
            <h3>{t('batch.changeNumber', { number: index + 1 })}</h3>
            <label htmlFor={`batch-action-${item.key}`}>{t('batch.action')}</label>
            <select
              id={`batch-action-${item.key}`}
              value={item.action}
              disabled={submitting}
              onChange={(event) => {
                const action = event.target.value as Action;
                updateItem(item.key, { action, offerId: '', locationId: action === 'create_offer' ? automaticLocationId : '' });
              }}
            >
              <option value="create_offer">{t('batch.createOffer')}</option>
              <option value="update_offer">{t('batch.updateOffer')}</option>
              <option value="deactivate_offer">{t('batch.deactivateOffer')}</option>
              <option value="activate_offer">{t('batch.activateOffer')}</option>
            </select>

            {item.action === 'create_offer' ? (
              <>
                <label htmlFor={`batch-product-${item.key}`}>{t('batch.catalogProduct')}</label>
                <input id={`batch-product-${item.key}`} value={item.productName} onChange={(event) => updateItem(item.key, { productName: event.target.value })} disabled={submitting} />

                <label htmlFor={`batch-location-${item.key}`}>{t('review.point')}</label>
                <select id={`batch-location-${item.key}`} value={item.locationId} onChange={(event) => updateItem(item.key, { locationId: event.target.value })} disabled={submitting} required>
                  {seller.locations.length > 1 && <option value="">{t('offerCreate.chooseLocation')}</option>}
                  {seller.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <label htmlFor={`batch-offer-${item.key}`}>{t('cabinet.offerField')}</label>
                <select id={`batch-offer-${item.key}`} value={item.offerId} onChange={(event) => selectOffer(item, event.target.value)} disabled={submitting || loadingOffers}>
                  <option value="">{t('batch.chooseOffer')}</option>
                  {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.product.name} · {offer.status === 'active' ? t('batch.active') : t('batch.inactive')}</option>)}
                </select>
              </>
            )}

            {(item.action === 'create_offer' || item.action === 'update_offer') && (
              <>
                <label htmlFor={`batch-price-${item.key}`}>{t('offerCreate.price')}</label>
                <input id={`batch-price-${item.key}`} value={item.priceAmount} onChange={(event) => updateItem(item.key, { priceAmount: event.target.value })} inputMode="decimal" disabled={submitting} placeholder={t('offerCreate.required')} aria-required="true" />
                <PriceUnitField id={`batch-unit-${item.key}`} draft={item.priceUnit} onChange={(priceUnit) => updateItem(item.key, { priceUnit })} disabled={submitting} showError={unitChecked} />
                <label htmlFor={`batch-comment-${item.key}`}>{t('offerCreate.comment')}</label>
                <textarea id={`batch-comment-${item.key}`} value={item.sellerComment} onChange={(event) => updateItem(item.key, { sellerComment: event.target.value })} maxLength={500} rows={2} disabled={submitting} placeholder={t('batch.noComment')} />
              </>
            )}

            {items.length > 2 && <button type="button" className={styles.secondaryButton} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} disabled={submitting}>{t('batch.remove')}</button>}
          </article>
        ))}

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setItems((current) => [...current, newDraft(automaticLocationId)])} disabled={submitting}>{t('batch.addChange')}</button>
          <button type="submit" disabled={submitting}>{submitting ? t('batch.creating') : t('batch.review')}</button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>
    </section>
  );
}
