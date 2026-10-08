'use client';

import { useState } from 'react';
import { OfferDetails } from '../../(buyer)/_ui/offer-details';
import { PriceLine } from '../../(buyer)/_ui/buyer-ui';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import type { CardPreviewPage } from '../../../modules/seller-input/application/card-preview';
import { Bar, Ic, Phone } from '../_kaida/ui';

// pre-publication-buyer-preview (docs/slices/pre-publication-buyer-preview, contract rev 1): the Seller's PRIVATE preview of a card
// that is not published. A screen of the editor (the form stays mounted underneath, so nothing typed is lost). The page is the
// buyer's own presentation (`OfferDetails`); a permanent note says buyers do not see it yet; route and contacts are inactive and
// there is no interest action. One point opens at once; several points open a list with the price in each.

export type PreviewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; pages: CardPreviewPage[]; change: boolean; missing: MessageKey[] };

export function CardPreviewScreen({ state, onClose, onRetry }: { state: PreviewState; onClose: () => void; onRetry: () => void }) {
  const { t } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  if (state.status !== 'ready') {
    return (
      <Phone>
        <Bar title={t('preview.future')} onBack={onClose} backLabel={t('preview.backEdit')} />
        <main className="body" style={{ gap: 12 }} aria-busy={state.status === 'loading' || undefined}>
          {state.status === 'loading'
            ? <div className="sk" style={{ height: 160, borderRadius: 16 }} aria-hidden="true" />
            : (
              <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14, gap: 8 }}>
                <p className="c" style={{ color: 'var(--ink)' }}>{t('preview.loadError')}</p>
                <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} onClick={onRetry}><Ic name="refresh" className="sm" />{t('cabinet.retry')}</button>
              </div>
            )}
        </main>
      </Phone>
    );
  }
  const { pages, change, missing } = state;
  const current = pages.length === 1 ? 0 : index;
  const note = (
    <div role="note" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 16px', background: 'var(--warning-soft)', borderBottom: '1px solid var(--line)' }}>
      <p className="c" style={{ margin: 0, color: 'var(--ink)', fontWeight: 600 }}>{change ? t('preview.noteChange') : t('preview.noteNew')}</p>
      {missing.length > 0 && <p className="c c2" style={{ margin: 0 }}>{missing.map((key) => t(key)).join(' · ')}</p>}
      <button type="button" className="act" style={{ margin: '0 0 -8px', minHeight: 44 }} onClick={onClose}><span>{t('preview.backEdit')}</span></button>
    </div>
  );
  if (current === null) {
    return (
      <Phone>
        <Bar title={t('preview.future')} onBack={onClose} backLabel={t('preview.backEdit')} />
        {note}
        <main className="body" style={{ gap: 12 }}>
          <h2 className="ov">{t('cardScreen.inPoints', { count: pages.length })}</h2>
          <p className="c c2" style={{ margin: 0 }}>{t('preview.choosePoint')}</p>
          {pages.map((page, position) => (
            <button key={page.offer.id} type="button" className="li card" style={{ padding: '8px 12px', flexDirection: 'row', textAlign: 'left' }} onClick={() => setIndex(position)} data-testid="preview-point">
              <div className="mid" style={{ minWidth: 0 }}>
                <div className="ts" style={{ overflowWrap: 'anywhere' }}>{page.offer.location.name}</div>
                <div className="c"><PriceLine offer={page.offer} /></div>
              </div>
              <Ic name="right" className="pt" />
            </button>
          ))}
        </main>
      </Phone>
    );
  }
  const page = pages[current]!;
  return (
    <Phone>
      <Bar
        title={t('preview.future')}
        onBack={pages.length === 1 ? onClose : () => setIndex(null)}
        backLabel={pages.length === 1 ? t('preview.backEdit') : t('preview.backList')}
      />
      {note}
      <main className="body np" style={{ gap: 0 }} data-testid="card-preview">
        <OfferDetails offer={page.offer} back={null} inert />
      </main>
    </Phone>
  );
}
