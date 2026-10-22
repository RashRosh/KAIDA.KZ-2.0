'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import type { OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import { Bar, Ic, LoadError, LoginRequired, Nav, Phone, SkeletonRows } from '../_kaida/ui';
import { groupCards } from './card-model';
import { CardRow, DraftRow } from './SellerShowcase';
import { AddProductsSheet } from './SellerTradingPoints';

type Point = { id: string; name: string; addressText: string };
type State =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; point: Point; offers: SellerOfferView[]; drafts: OfferDraftView[]; total: number };

// seller-ai-text-real-parser §21: «Товары точки» — the cards and drafts of ONE point, published and drafts told apart
// exactly as on «Моя витрина», with «Добавить товары» for this point. Back leads to the point workspace; a card or draft
// opened from here comes back here.
export function SellerPointProducts({ pointId, textInputEnabled }: { pointId: string; textInputEnabled: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const back = encodeURIComponent(`/seller/points/${pointId}/products`);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/points/${pointId}/products?locale=${locale}`, { cache: 'no-store' });
        if (!alive) return;
        if (response.status === 401) { setState({ kind: 'anonymous' }); return; }
        if (response.status === 404 || response.status === 409) { setState({ kind: 'missing' }); return; }
        if (!response.ok) throw new Error('products');
        const data = await response.json() as { point: Point; offers: SellerOfferView[]; drafts: OfferDraftView[]; total: number };
        if (alive) setState({ kind: 'ready', ...data });
      } catch {
        if (alive) setState({ kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [pointId, locale, attempt]);

  const title = state.kind === 'ready' ? state.point.name : t('pointProducts.titleShort');
  const bar = <Bar title={title} onBack={() => router.push('/seller/points')} backLabel={t('pointProducts.back')} />;
  if (state.kind === 'anonymous') return <Phone>{bar}<LoginRequired /><Nav active="points" /></Phone>;
  if (state.kind !== 'ready') {
    return (
      <Phone>
        {bar}
        <main className="body" style={{ gap: 12 }} aria-busy={state.kind === 'loading' || undefined}>
          {state.kind === 'loading' && <SkeletonRows />}
          {state.kind === 'error' && <LoadError title={t('pointProducts.loadError')} onRetry={() => { setState({ kind: 'loading' }); setAttempt((n) => n + 1); }} />}
          {state.kind === 'missing' && <p className="t c2" data-testid="point-products-missing">{t('pointProducts.missing')}</p>}
        </main>
        <Nav active="points" />
      </Phone>
    );
  }

  const cards = groupCards(state.offers);
  return (
    <Phone>
      {bar}
      <main className="body" style={{ gap: 12 }} data-testid="point-products">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p className="ov" style={{ margin: 0 }}>{t('pointProducts.heading', { count: state.total })}</p>
          <p className="c c2" style={{ margin: 0 }}>{state.point.addressText}</p>
        </div>
        <button type="button" className="btn btn-p w" onClick={() => setAdding(true)} data-testid="point-products-add">
          <Ic name="plus" className="sm" />{t('pointProducts.add')}
        </button>
        {state.total === 0 && <p className="t c2" data-testid="point-products-empty">{t('pointProducts.empty')}</p>}
        {cards.map((card) => (
          <CardRow key={card.cardId} card={card}
            onOpen={() => router.push(`/seller?card=${card.cardId}&back=${back}`)}
            onAddPhoto={() => router.push(`/seller?edit=${card.cardId}&focus=photos&back=${back}`)} />
        ))}
        {state.drafts.map((draft) => (
          <DraftRow key={draft.id} draft={draft} onOpen={() => router.push(`/seller?draft=${draft.id}&back=${back}`)} />
        ))}
      </main>
      {adding && (
        <AddProductsSheet
          location={state.point}
          textInputEnabled={textInputEnabled}
          onManual={() => router.push(`/seller?new=1&at=${state.point.id}&back=${back}`)}
          onText={() => router.push(`/seller/text-input?point=${state.point.id}`)}
          onClose={() => setAdding(false)}
        />
      )}
      <Nav active="points" />
    </Phone>
  );
}
