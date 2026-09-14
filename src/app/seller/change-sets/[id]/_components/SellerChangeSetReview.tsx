'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SellerChangeSetItemView, SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../../../page.module.css';

type ApiResponse = { changeSet?: SellerChangeSetView; error?: { code?: string; message?: string } };

function actionCopy(item: SellerChangeSetItemView, status: SellerChangeSetView['status']) {
  if (item.action === 'create_offer') {
    return {
      statusText: status === 'proposed' ? 'Предложение ещё не применено. Offer пока не создан.' : 'Предложение подтверждено. Offer создан.',
      button: 'Подтвердить и создать Offer',
      result: 'Offer создан',
    };
  }
  if (item.action === 'update_offer') {
    return {
      statusText: status === 'proposed' ? 'Новые цена и комментарий ещё не применены. Покупатели пока видят прежние данные.' : 'Новые цена и комментарий применены.',
      button: 'Подтвердить изменение',
      result: 'Offer обновлён',
    };
  }
  if (item.action === 'deactivate_offer') {
    return {
      statusText: status === 'proposed' ? 'Offer ещё не выключен и остаётся доступен покупателям по обычным правилам поиска.' : 'Offer выключен.',
      button: 'Подтвердить выключение',
      result: 'Offer выключен',
    };
  }
  return {
    statusText: status === 'proposed' ? 'Актуальность Offer ещё не подтверждена повторно.' : 'Актуальность Offer подтверждена.',
    button: 'Подтвердить актуальность',
    result: 'Offer активен',
  };
}

export function SellerChangeSetReview({ changeSetId }: { changeSetId: string }) {
  const [changeSet, setChangeSet] = useState<SellerChangeSetView | null>(null);
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/change-sets/${changeSetId}`, { cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) {
          setState('anonymous');
          return;
        }
        const data = await response.json() as ApiResponse;
        if (!active) return;
        if (!response.ok || !data.changeSet) {
          setError(data.error?.message ?? 'Не удалось загрузить изменение.');
          setState('ready');
          return;
        }
        setError('');
        setChangeSet(data.changeSet);
        setState('ready');
      } catch {
        if (!active) return;
        setError('Не удалось загрузить изменение.');
        setState('ready');
      }
    })();
    return () => { active = false; };
  }, [changeSetId]);

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

  const firstItem = changeSet.items[0];
  const copy = firstItem ? actionCopy(firstItem, changeSet.status) : null;
  const isBatch = changeSet.items.length > 1;
  const batchStatus = changeSet.status === 'proposed'
    ? `Пакет содержит ${changeSet.items.length} изменений. До подтверждения ни одно из них не применяется.`
    : `Пакет из ${changeSet.items.length} изменений применён целиком.`;

  return (
    <section className={styles.card} aria-labelledby="change-set-heading">
      <p className={styles.eyebrow}>{changeSet.status === 'proposed' ? 'Ожидает подтверждения' : 'Подтверждено'}</p>
      <h2 id="change-set-heading">{changeSet.seller.displayName}</h2>
      {isBatch ? <p className={styles.status}>{batchStatus}</p> : copy && <p className={styles.status}>{copy.statusText}</p>}

      <div className={styles.stack}>
        {changeSet.items.map((item) => {
          const itemCopy = actionCopy(item, changeSet.status);
          return (
            <article key={item.id} className={styles.itemCard}>
              <h3>{item.product.name}</h3>
              {isBatch && <p className={styles.muted}>{itemCopy.statusText}</p>}
              <dl className={styles.summaryGrid}>
                <dt>Точка</dt><dd>{item.location.name}</dd>
                <dt>Адрес</dt><dd>{item.location.addressText}</dd>
                <dt>Цена</dt><dd>{item.price ? `${item.price.amount} ${item.price.currency}${item.price.unit ? ` / ${item.price.unit}` : ''}` : 'Цена не указана'}</dd>
                <dt>Комментарий</dt><dd>{item.sellerComment ?? 'Не указан'}</dd>
              </dl>
              {item.resultOffer && (
                <div className={styles.result}>
                  <strong>{itemCopy.result}</strong>
                  <span>ID: {item.resultOffer.id}</span>
                  <span>Статус: {item.resultOffer.status}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        {changeSet.status === 'proposed' && copy && <button type="button" onClick={confirm} disabled={confirming}>{confirming ? 'Подтверждаем…' : isBatch ? 'Подтвердить весь пакет' : copy.button}</button>}
        <Link className={styles.secondaryLink} href="/seller">Вернуться к продавцу</Link>
      </div>
    </section>
  );
}