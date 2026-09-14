'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerBatchChangeSetCreate } from '../_components/SellerBatchChangeSetCreate';
import styles from '../page.module.css';

type ApiError = { error?: { message?: string } };
type SellerResponse = { seller: SellerView | null } & ApiError;

export default function SellerBatchPage() {
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/seller/me', { cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) {
          setState('anonymous');
          return;
        }
        const data = await response.json() as SellerResponse;
        if (!response.ok) {
          setError(data.error?.message ?? 'Не удалось загрузить продавца.');
          setState('ready');
          return;
        }
        setSeller(data.seller);
        setState('ready');
      } catch {
        if (active) {
          setError('Не удалось загрузить продавца.');
          setState('ready');
        }
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">KAIDA.KZ</Link>
        <Link href="/seller" className={styles.secondaryLink}>Продавец</Link>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Seller Input · Batch</p>
          <h1>Пакетное изменение ассортимента</h1>
          <p>Соберите несколько изменений, проверьте их вместе и подтвердите одним действием.</p>
        </div>

        {state === 'loading' && <section className={styles.card}><p>Загружаем…</p></section>}
        {state === 'anonymous' && <section className={styles.card}><h2>Нужно войти</h2><Link className={styles.primaryLink} href="/login">Войти</Link></section>}
        {state === 'ready' && error && <section className={styles.card}><p className={styles.error} role="alert">{error}</p></section>}
        {state === 'ready' && !error && !seller && <section className={styles.card}><p>Сначала создайте продавца и точку.</p><Link className={styles.secondaryLink} href="/seller">Настроить продавца</Link></section>}
        {state === 'ready' && seller && <SellerBatchChangeSetCreate seller={seller} />}
      </main>
    </div>
  );
}