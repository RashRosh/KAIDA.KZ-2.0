'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerBatchChangeSetCreate } from '../_components/SellerBatchChangeSetCreate';
import { Bar, Ic, LoginRequired, Phone } from '../_kaida/ui';
import { useI18n } from '@/i18n/I18nProvider';

type ApiError = { error?: { message?: string } };
type SellerResponse = { seller: SellerView | null } & ApiError;

export default function SellerBatchPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) {
          setState('anonymous');
          return;
        }
        const data = await response.json() as SellerResponse;
        if (!response.ok) {
          setError(t('batch.loadSellerError'));
          setState('ready');
          return;
        }
        setSeller(data.seller);
        setState('ready');
      } catch {
        if (active) {
          setError(t('batch.loadSellerError'));
          setState('ready');
        }
      }
    })();
    return () => { active = false; };
  }, [locale, t]);

  // «Добавить списком» (no frame in the mockup): the mockup shell around the batch form.
  return (
    <Phone>
      <Bar title={t('cabinet.batch')} onBack={() => router.push('/seller/more')} />
      {state === 'anonymous' ? <LoginRequired /> : (
        <main className="body" style={{ gap: 14 }}>
          <p className="t c2">{t('batch.pageDescription')}</p>
          {state === 'loading' && <div className="sk" style={{ height: 160, borderRadius: 14 }} aria-label={t('seller.loading')} />}
          {state === 'ready' && error && (
            <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12, flexDirection: 'row', gap: 10 }}>
              <Ic name="alert" className="dn" /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{error}</p>
            </div>
          )}
          {state === 'ready' && !error && !seller && (
            <div className="card p16" style={{ gap: 10 }}>
              <p className="t">{t('batch.setupFirst')}</p>
              <Link className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} href="/seller/points">{t('batch.setupSeller')}</Link>
            </div>
          )}
          {state === 'ready' && seller && <SellerBatchChangeSetCreate seller={seller} />}
        </main>
      )}
    </Phone>
  );
}
