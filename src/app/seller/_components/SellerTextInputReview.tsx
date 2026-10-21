'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import type { SkippedTextLine, UncertainDraftNotice } from '../../../modules/seller-text-input/contracts/seller-text-input.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatAmount } from '../../_components/format-amount';
import { Bar, Ic, Phone, Thumb } from '../_kaida/ui';
import { missingDraftFields } from './card-model';

type ReviewMeta = {
  skipped: SkippedTextLine[];
  uncertain: UncertainDraftNotice[];
  rawText: string;
  // seller-ai-text-real-parser: absent in reviews stored by slice 1.
  parser?: 'fake' | 'real';
  notices?: string[];
  unavailableDrafts?: number;
};

const REVIEW_STORAGE_PREFIX = 'kaida:text-input-review:';

function readMeta(inputId: string | null): ReviewMeta | null {
  if (!inputId || typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(`${REVIEW_STORAGE_PREFIX}${inputId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReviewMeta;
  } catch {
    return null;
  }
}

function unitShort(unit: OfferDraftView['payload']['unit']): string {
  if (!unit) return '';
  if (unit.code === 'other') return unit.value;
  return ({ kg: 'кг', liter: 'л', piece: 'шт.', package: 'упак.' } as const)[unit.code] ?? '';
}

export function SellerTextInputReviewScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const inputId = params.get('input');
  const [drafts, setDrafts] = useState<OfferDraftView[]>([]);
  const [meta, setMeta] = useState<ReviewMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch('/api/seller/drafts', { cache: 'no-store' });
        if (!response.ok) throw new Error('drafts');
        const { drafts: all } = await response.json() as { drafts: OfferDraftView[] };
        if (!alive) return;
        const filtered = inputId
          ? all.filter((draft) => draft.payload.aiHints?.inputId === inputId)
          : all;
        setDrafts(filtered);
        setMeta(readMeta(inputId));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [inputId]);

  const uncertainByDraft = new Map((meta?.uncertain ?? []).map((item) => [item.draftId, item]));

  return (
    <Phone>
      <Bar title={t('textInput.reviewTitle')} onBack={() => router.push('/seller/text-input')} />
      <main className="body" style={{ gap: 12 }} data-testid="text-input-review">
        {meta?.rawText && <p className="c c2" style={{ whiteSpace: 'pre-wrap' }}>{meta.rawText}</p>}
        {meta?.parser === 'real' && (
          <p className="c" role="note" data-testid="text-input-reminder">{t('textInput.reminder')}</p>
        )}
        {(meta?.unavailableDrafts ?? 0) > 0 && (
          <p className="c" role="status" data-testid="text-input-unavailable">{t('textInput.unavailableDrafts')}</p>
        )}
        {loading && <p className="c c2">{t('textInput.loading')}</p>}
        {!loading && drafts.length === 0 && meta?.skipped.length === 0 && (meta.notices ?? []).length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
            <Ic name="box" className="lg c2" />
            <h2 className="h3">{t('textInput.emptyTitle')}</h2>
            <p className="c c2">{t('textInput.emptyText')}</p>
            <Link className="btn btn-o w" href="/seller?new=1">{t('source.manual')}</Link>
          </div>
        )}
        {drafts.map((draft) => {
          const missing = missingDraftFields(draft.payload);
          const uncertain = uncertainByDraft.get(draft.id);
          const price = draft.payload.price.trim();
          return (
            <article key={draft.id} className="card p16" style={{ gap: 8 }} data-testid={`text-draft-${draft.id}`}>
              <button
                type="button"
                className="rowbtn"
                onClick={() => router.push(`/seller?draft=${draft.id}`)}
              >
                <Thumb photoUrl={null} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="ts">{draft.payload.title.trim() || t('showcase.draftUntitled')}</div>
                  {price && <p className="c c2"><b className="num">{formatAmount(price)} ₸</b>{draft.payload.unit ? ` / ${unitShort(draft.payload.unit)}` : ''}</p>}
                  {missing.length > 0 && <p className="c">{t('showcase.missing', { fields: missing.map((key) => t(key)).join(', ') })}</p>}
                </div>
                <Ic name="right" className="c2" />
              </button>
              {uncertain && (
                <p className="c" role="status" data-testid="text-uncertain-notice">{uncertain.message}</p>
              )}
            </article>
          );
        })}
        {(meta?.skipped.length ?? 0) > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="text-skipped-block">
            <div className="ov">{t('textInput.skippedTitle')}</div>
            {meta!.skipped.map((item, index) => (
              <div key={`${item.label}-${index}`} className="card p16" style={{ gap: 4 }}>
                <div className="ts">{item.label}</div>
                <p className="c c2">{item.reason}</p>
                {item.sourceQuote && <p className="c c2" style={{ fontStyle: 'italic' }}>{item.sourceQuote}</p>}
              </div>
            ))}
          </section>
        )}
        {(meta?.notices ?? []).length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="text-notices-block">
            <div className="ov">{t('textInput.noticesTitle')}</div>
            {meta!.notices!.map((notice, index) => (
              <p key={`${notice}-${index}`} className="c c2">{notice}</p>
            ))}
          </section>
        )}
        <Link className="btn btn-g w" href="/seller?tab=drafts">{t('textInput.toShowcase')}</Link>
      </main>
    </Phone>
  );
}
