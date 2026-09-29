'use client';

import { useEffect, useState } from 'react';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { SellerTradingPoints } from './SellerTradingPoints';
import { Bar, LoadError, LoginRequired, Nav, Phone } from '../_kaida/ui';
import { useI18n } from '../../../i18n/I18nProvider';

type SellerState = { kind: 'loading' } | { kind: 'anonymous' } | { kind: 'error' } | { kind: 'ready'; seller: SellerView | null };

function useOwnedSeller() {
  const { locale } = useI18n();
  const [state, setState] = useState<SellerState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
        if (!alive) return;
        if (response.status === 401) {
          setState({ kind: 'anonymous' });
          return;
        }
        if (!response.ok) throw new Error('seller');
        const data = await response.json() as { seller: SellerView | null };
        if (alive) setState({ kind: 'ready', seller: data.seller });
      } catch {
        if (alive) setState({ kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [locale, attempt]);
  return {
    state,
    setSeller: (seller: SellerView) => setState({ kind: 'ready', seller }),
    retry: () => { setState({ kind: 'loading' }); setAttempt((value) => value + 1); },
  };
}

// AI-S12 «Мои точки»: loading, sign-in and error states around the list and the point screen.
export function SellerPointsSection() {
  const { t } = useI18n();
  const { state, setSeller, retry } = useOwnedSeller();
  if (state.kind === 'ready') return <SellerTradingPoints seller={state.seller} onSellerChange={setSeller} autoOpenAdd={state.seller === null} />;
  return (
    <Phone>
      <Bar title={t('points.title')} />
      {state.kind === 'anonymous' ? <LoginRequired /> : (
        <main className="body" style={{ gap: 10 }} aria-busy={state.kind === 'loading' || undefined}>
          {state.kind === 'error' ? <LoadError title={t('seller.loadError')} onRetry={retry} /> : (
            <>
              <span className="vh" role="status">{t('cabinet.loading')}</span>
              {[0, 1].map((index) => (
                <div key={index} className="card" style={{ flexDirection: 'row', gap: 12 }} aria-hidden="true">
                  <div className="sk" style={{ width: 40, height: 40, borderRadius: 12 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="sk" style={{ height: 14, width: '70%' }} /><div className="sk" style={{ height: 14, width: '45%' }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </main>
      )}
      <Nav active="points" />
    </Phone>
  );
}
