'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SellerChangeSetItemView, SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../../../page.module.css';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

type ApiResponse = { changeSet?: SellerChangeSetView; error?: { code?: string; message?: string } };

function actionCopy(item: SellerChangeSetItemView, status: SellerChangeSetView['status'], t: (key: MessageKey) => string) {
  if (item.action === 'create_offer') {
    return {
      statusText: status === 'proposed' ? t('review.createPending') : t('review.createDone'),
      button: t('review.confirmCreate'), result: t('review.created'),
    };
  }
  if (item.action === 'update_offer') {
    return {
      statusText: status === 'proposed' ? t('review.updatePending') : t('review.updateDone'),
      button: t('review.confirmUpdate'), result: t('review.updated'),
    };
  }
  if (item.action === 'deactivate_offer') {
    return {
      statusText: status === 'proposed' ? t('review.deactivatePending') : t('review.deactivateDone'),
      button: t('review.confirmDeactivate'), result: t('review.deactivated'),
    };
  }
  return {
    statusText: status === 'proposed' ? t('review.refreshPending') : t('review.refreshDone'),
    button: t('review.confirmRefresh'), result: t('review.active'),
  };
}

export function SellerChangeSetReview({ changeSetId }: { changeSetId: string }) {
  const { locale, t } = useI18n();
  const [changeSet, setChangeSet] = useState<SellerChangeSetView | null>(null);
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/change-sets/${changeSetId}?locale=${locale}`, { cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) {
          setState('anonymous');
          return;
        }
        const data = await response.json() as ApiResponse;
        if (!active) return;
        if (!response.ok || !data.changeSet) {
          setError(t('review.loadError'));
          setState('ready');
          return;
        }
        setError('');
        setChangeSet(data.changeSet);
        setState('ready');
      } catch {
        if (!active) return;
        setError(t('review.loadError'));
        setState('ready');
      }
    })();
    return () => { active = false; };
  }, [changeSetId, locale, t]);

  async function confirm() {
    setError('');
    setConfirming(true);
    try {
      const response = await fetch(`/api/seller/change-sets/${changeSetId}/confirm`, { method: 'POST' });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.changeSet) {
        setError(t('review.confirmError'));
        return;
      }
      setChangeSet(data.changeSet);
    } catch {
      setError(t('review.confirmError'));
    } finally {
      setConfirming(false);
    }
  }

  if (state === 'loading') return <section className={styles.card}><p>{t('seller.loading')}</p></section>;
  if (state === 'anonymous') {
    return <section className={styles.card}><h2>{t('seller.loginRequired')}</h2><p>{t('review.loginHelp')}</p><Link className={styles.primaryLink} href="/login">{t('auth.signIn')}</Link></section>;
  }
  if (!changeSet) return <section className={styles.card}>{error && <p className={styles.error} role="alert">{error}</p>}<Link className={styles.secondaryLink} href="/seller">{t('review.back')}</Link></section>;

  const firstItem = changeSet.items[0];
  const copy = firstItem ? actionCopy(firstItem, changeSet.status, t) : null;
  const isBatch = changeSet.items.length > 1;
  const batchStatus = changeSet.status === 'proposed'
    ? t('review.batchPending', { count: changeSet.items.length })
    : t('review.batchDone', { count: changeSet.items.length });

  return (
    <section className={styles.card} aria-labelledby="change-set-heading">
      <p className={styles.eyebrow}>{changeSet.status === 'proposed' ? t('review.awaiting') : t('review.confirmed')}</p>
      <h2 id="change-set-heading">{changeSet.seller.displayName}</h2>
      {isBatch ? <p className={styles.status}>{batchStatus}</p> : copy && <p className={styles.status}>{copy.statusText}</p>}

      <div className={styles.stack}>
        {changeSet.items.map((item) => {
          const itemCopy = actionCopy(item, changeSet.status, t);
          return (
            <article key={item.id} className={styles.itemCard}>
              <h3>{item.product.name}</h3>
              {isBatch && <p className={styles.muted}>{itemCopy.statusText}</p>}
              <dl className={styles.summaryGrid}>
                <dt>{t('review.point')}</dt><dd>{item.location.name}</dd>
                <dt>{t('review.address')}</dt><dd>{item.location.addressText}</dd>
                <dt>{t('review.price')}</dt><dd>{item.price ? `${item.price.amount} ${item.price.currency}${item.price.unit ? ` / ${item.price.unit}` : ''}` : t('review.noPrice')}</dd>
                <dt>{t('review.comment')}</dt><dd>{item.sellerComment ?? t('review.notSpecified')}</dd>
              </dl>
              {item.resultOffer && (
                <div className={styles.result}>
                  <strong>{itemCopy.result}</strong>
                  <span>ID: {item.resultOffer.id}</span>
                  <span>{t('review.status', { status: item.resultOffer.status })}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        {changeSet.status === 'proposed' && copy && <button type="button" onClick={confirm} disabled={confirming}>{confirming ? t('review.confirming') : isBatch ? t('review.confirmBatch') : copy.button}</button>}
        <Link className={styles.secondaryLink} href="/seller">{t('review.back')}</Link>
      </div>
    </section>
  );
}
