'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../../../page.module.css';

type ApiResponse = { changeSet?: SellerChangeSetView; error?: { code?: string; message?: string } };

export function SellerChangeSetReview({ changeSetId }: { changeSetId: string }) {
  const [changeSet, setChangeSet] = useState<SellerChangeSetView | null>(null);
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/seller/change-sets/${changeSetId}`, { cache: 'no-store' });
      if (response.status === 401) {
        setState('anonymous');
        return;
      }
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.changeSet) {
        setError(data.error?.message ?? 'Не удалось загрузить изменение.');
        setState('ready');
        return;
      }
      setChangeSet(data.changeSet);
      setState('ready');
    } catch {
      setError('Не удалось загрузить изменение.');
      setState('ready');
    }
  }, [changeSetId]);

  useEffect(() => { void load(); }, [load]);

  async function confirm() {
    setError('');
    setConfirming(true);
    try {
      const response = await fetch(`/api/seller/change-sets/${changeSetId}/confirm`, { method: 'POST' });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.changeSet) {
        setError(data.error?.message ?? 'Не удалось подтвердить изменение.');
        return;
      }
      setChangeSet(data.changeSet);
    } catch {
      setError('Не удалось подтвердить изменение.');
    } finally {
      setConfirming(false);
    }
  }

  if (state === 'loading') return <section className={styles.card}><p>Загружаем…</p></section>;
  if (state === 'anonymous') {
    return <section className={styles.card}><h2>Нужно войти</h2><p>Чтобы открыть изменение продавца, войдите по телефону.</p><Link className={styles.primaryLink} href="/login">Войти</Link></section>;
  }
  if (!changeSet) return <section className={styles.card}>{error && <p className={styles.error} role="alert">{error}</p>}<Link className={styles.secondaryLink} href="/seller">Вернуться к продавцу</Link></section>;

  return (
    <section className={styles.card} aria-labelledby="change-set-heading">
      <p className={styles.eyebrow}>{changeSet.status === 'proposed' ? 'Ожидает подтверждения' : 'Подтверждено'}</p>
      <h2 id="change-set-heading">{changeSet.seller.displayName}</h2>
      <p className={styles.status}>
        {changeSet.status === 'proposed' ? 'Предложение ещё не применено. Offer пока не создан.' : 'Предложение подтверждено. Offer создан.'}
      </p>

      <div className={styles.stack}>
        {changeSet.items.map((item) => (
          <article key={item.id} className={styles.itemCard}>
            <h3>{item.product.name}</h3>
            <dl className={styles.summaryGrid}>
              <dt>Точка</dt><dd>{item.location.name}</dd>
              <dt>Адрес</dt><dd>{item.location.addressText}</dd>
              <dt>Цена</dt><dd>{item.price ? `${item.price.amount} ${item.price.currency}${item.price.unit ? ` / ${item.price.unit}` : ''}` : 'Цена не указана'}</dd>
              <dt>Комментарий</dt><dd>{item.sellerComment ?? 'Не указан'}</dd>
            </dl>
            {item.resultOffer && (
              <div className={styles.result}>
                <strong>Offer создан</strong>
                <span>ID: {item.resultOffer.id}</span>
                <span>Статус: {item.resultOffer.status}</span>
              </div>
            )}
          </article>
        ))}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        {changeSet.status === 'proposed' && <button type="button" onClick={confirm} disabled={confirming}>{confirming ? 'Подтверждаем…' : 'Подтвердить и создать Offer'}</button>}
        <Link className={styles.secondaryLink} href="/seller">Вернуться к продавцу</Link>
      </div>
    </section>
  );
}
