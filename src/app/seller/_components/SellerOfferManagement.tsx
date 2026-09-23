'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';
import { CommentTranslationAssist } from './CommentTranslationAssist';

type ApiError = { error?: { code?: string; message?: string } };
type OffersResponse = { offers?: SellerOfferView[] } & ApiError;
type ChangeResponse = { changeSet?: SellerChangeSetView } & ApiError;

export function SellerOfferManagement({ commentTranslationEnabled = false }: { commentTranslationEnabled?: boolean }) {
  const { locale, t } = useI18n();
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
        const response = await fetch(`/api/seller/offers?locale=${locale}`, { cache: 'no-store' });
        const data = await response.json() as OffersResponse;
        if (!active) return;
        if (!response.ok || !data.offers) {
          setError(t('offerManage.loadError'));
          return;
        }
        setOffers(data.offers);
      } catch {
        if (active) setError(t('offerManage.loadError'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [locale, t]);

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
        setError(t('offerCreate.error'));
        return;
      }
      router.push(`/seller/change-sets/${data.changeSet.id}`);
    } catch {
      setError(t('offerCreate.error'));
    } finally {
      setSubmittingOfferId(null);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, offerId: string) {
    event.preventDefault();
    const amount = priceAmount.trim();
    if (amount === '') {
      setError(t('offerCreate.priceRequired'));
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
      <p className={styles.eyebrow}>{t('offerManage.eyebrow')}</p>
      <h2 id="seller-offers-heading">{t('offerManage.title')}</h2>
      <p className={styles.muted}>{t('offerManage.description')}</p>

      {loading && <p className={styles.muted}>{t('offerManage.loading')}</p>}
      {!loading && offers.length === 0 && <p className={styles.muted}>{t('offerManage.empty')}</p>}

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
                <span className={styles.offerStatus}>{offer.status === 'active' ? t('offerManage.active') : t('offerManage.inactive')}</span>
              </div>
              <dl className={styles.summaryGrid}>
                <dt>{t('review.price')}</dt><dd>{offer.price ? `${offer.price.amount} ${offer.price.currency}${offer.price.unit ? ` / ${offer.price.unit}` : ''}` : t('offerManage.priceRequired')}</dd>
                <dt>{t('review.comment')}</dt><dd>{offer.sellerComment ?? t('review.notSpecified')}</dd>
              </dl>

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => beginEdit(offer)} disabled={submitting}>{t('offerManage.edit')}</button>
                {offer.status === 'active' ? (
                  <>
                    <button type="button" className={styles.secondaryButton} onClick={() => void createProposal(offer.id, { action: 'deactivate_offer' })} disabled={submitting}>{submitting ? t('offerCreate.creating') : t('offerManage.disable')}</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => void createProposal(offer.id, { action: 'activate_offer' })} disabled={submitting || needsPrice}>{needsPrice ? t('offerManage.priceFirst') : submitting ? t('offerCreate.creating') : t('offerManage.confirmFreshness')}</button>
                  </>
                ) : (
                  <button type="button" className={styles.secondaryButton} onClick={() => void createProposal(offer.id, { action: 'activate_offer' })} disabled={submitting || needsPrice}>{needsPrice ? t('offerManage.priceFirst') : submitting ? t('offerCreate.creating') : t('offerManage.enable')}</button>
                )}
              </div>

              {editing && (
                <form className={styles.inlineForm} onSubmit={(event) => void submitUpdate(event, offer.id)} noValidate>
                  <label htmlFor={`offer-price-${offer.id}`}>{t('offerCreate.price')}</label>
                  <input id={`offer-price-${offer.id}`} value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} inputMode="decimal" disabled={submitting} placeholder={t('offerCreate.required')} aria-required="true" />
                  <label htmlFor={`offer-unit-${offer.id}`}>{t('offerCreate.unit')}</label>
                  <input id={`offer-unit-${offer.id}`} value={priceUnit} onChange={(event) => setPriceUnit(event.target.value)} maxLength={32} disabled={submitting || priceAmount.trim() === ''} placeholder={t('offerCreate.unitExample')} />
                  <label htmlFor={`offer-comment-${offer.id}`}>{t('offerCreate.comment')}</label>
                  <textarea id={`offer-comment-${offer.id}`} value={sellerComment} onChange={(event) => setSellerComment(event.target.value)} maxLength={500} rows={3} disabled={submitting} placeholder={t('batch.noComment')} />
                  <CommentTranslationAssist enabled={commentTranslationEnabled} comment={sellerComment} />
                  <div className={styles.actions}>
                    <button type="submit" disabled={submitting}>{submitting ? t('offerCreate.creating') : t('offerManage.review')}</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => setEditingOfferId(null)} disabled={submitting}>{t('offerManage.cancel')}</button>
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
