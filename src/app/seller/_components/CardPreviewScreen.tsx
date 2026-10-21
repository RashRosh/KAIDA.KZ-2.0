'use client';

import { useState } from 'react';
import { OfferDetails } from '../../(buyer)/_ui/offer-details';
import { PriceLine } from '../../(buyer)/_ui/buyer-ui';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import type { CardPreviewPage } from '../../../modules/seller-input/application/card-preview';
import { Bar, Ic, Phone } from '../_kaida/ui';

// pre-publication-buyer-preview (contract rev 1) as revised by seller-ai-text-real-parser §20 (PO 2026-10-21): the
// Seller's PRIVATE preview of a card that is not published, a screen of the editor (the form stays mounted, nothing typed
// is lost). «Предпросмотр карточки» with a compact status, then the buyer's own presentation (`OfferDetails`, contacts and
// route inert, the week behind a disclosure). Actions: «Редактировать» and «Перейти к публикации» — the editor's existing
// «Проверить и опубликовать» into the explicit confirmation; with required fields missing, «Дополнить карточку» and
// what is missing. Nothing is published or saved from here.

export type PreviewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; pages: CardPreviewPage[]; change: boolean; problems: MessageKey[] };

export function CardPreviewScreen({ state, onClose, onRetry, onPublish, onComplete }: {
  state: PreviewState;
  onClose: () => void;
  onRetry: () => void;
  onPublish: () => void;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  const title = t('preview.cardTitle');
  if (state.status !== 'ready') {
    return (
      <Phone>
        <Bar title={title} onBack={onClose} backLabel={t('preview.backEdit')} />
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
  const { pages, change, problems } = state;
  const current = pages.length === 1 ? 0 : index;
  const status = (
    <p role="note" className="c" data-testid="preview-status" style={{ margin: 0, padding: '8px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Ic name="eyeoff" className="sm c2" /><span>{change ? t('preview.statusChange') : t('preview.statusDraft')}</span>
    </p>
  );
  const foot = (
    <div className="foot" data-testid="preview-actions">
      <p className="c c2" style={{ margin: 0 }}>{t('preview.inertNote')}</p>
      {problems.length > 0 ? (
        <>
          <p className="c" role="status" data-testid="preview-problems" style={{ margin: 0 }}>{t('preview.problems', { fields: problems.map((key) => t(key)).join(', ') })}</p>
          <button type="button" className="btn btn-p lg w" onClick={onComplete}>{t('preview.complete')}</button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-p lg w" onClick={onPublish} data-testid="preview-publish">{t('preview.toPublish')}</button>
          <button type="button" className="btn btn-g w" onClick={onClose}>{t('preview.edit')}</button>
        </>
      )}
    </div>
  );
  if (current === null) {
    return (
      <Phone>
        <Bar title={title} onBack={onClose} backLabel={t('preview.backEdit')} />
        {status}
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
        {foot}
      </Phone>
    );
  }
  const page = pages[current]!;
  return (
    <Phone>
      <Bar
        title={title}
        onBack={pages.length === 1 ? onClose : () => setIndex(null)}
        backLabel={pages.length === 1 ? t('preview.backEdit') : t('preview.backList')}
      />
      {status}
      <main className="body np" style={{ gap: 0 }} data-testid="card-preview">
        <OfferDetails offer={page.offer} back={null} inert scheduleLabel={t('preview.showSchedule')} />
      </main>
      {foot}
    </Phone>
  );
}
