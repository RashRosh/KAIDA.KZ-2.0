'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import type { SellerTextSubmissionView } from '../../../modules/seller-text-input/contracts/seller-text-input.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatAmount } from '../../_components/format-amount';
import { Bar, Ic, LoadError, LoginRequired, Phone, Thumb } from '../_kaida/ui';
import { missingDraftFields } from './card-model';

const REVIEW_STORAGE_PREFIX = 'kaida:text-input-review:';

type Review =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | { kind: 'ready'; submission: SellerTextSubmissionView; pointName: string | null };

// The original text is never stored on the server (§6.5); this tab may still hold it from the submission.
function readRawText(inputId: string | null): string | null {
  if (!inputId) return null;
  try {
    const raw = sessionStorage.getItem(`${REVIEW_STORAGE_PREFIX}${inputId}`);
    return raw ? (JSON.parse(raw) as { rawText?: string }).rawText ?? null : null;
  } catch {
    return null;
  }
}

function unitShort(unit: OfferDraftView['payload']['unit']): string {
  if (!unit) return '';
  if (unit.code === 'other') return unit.value;
  return ({ kg: 'кг', liter: 'л', piece: 'шт.', package: 'упак.' } as const)[unit.code] ?? '';
}

// seller-ai-text-real-parser §16: the review of one submission, recovered from the Seller's own server record (24 h)
// after a reload, navigation away or in a new tab.
export function SellerTextInputReviewScreen() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const inputId = useSearchParams().get('input');
  const [review, setReview] = useState<Review>({ kind: 'loading' });
  const [rawText, setRawText] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (!inputId) { setReview({ kind: 'unavailable' }); return; }
        const response = await fetch(`/api/seller/text-input/${encodeURIComponent(inputId)}`, { cache: 'no-store' });
        if (!alive) return;
        if (response.status === 401) { setReview({ kind: 'anonymous' }); return; }
        if (response.status === 404) { setReview({ kind: 'unavailable' }); return; }
        if (!response.ok) throw new Error('review');
        const { submission } = await response.json() as { submission: SellerTextSubmissionView };
        let pointName: string | null = null;
        if (submission.locationId) {
          const me = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
          if (me.ok) {
            const { seller } = await me.json() as { seller: SellerView | null };
            pointName = seller?.locations.find((location) => location.id === submission.locationId)?.name ?? null;
          }
        }
        if (!alive) return;
        setRawText(readRawText(submission.inputId));
        setReview({ kind: 'ready', submission, pointName });
      } catch {
        if (alive) setReview({ kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [inputId, locale, attempt]);

  const back = <Bar title={t('textInput.reviewTitle')} onBack={() => router.push('/seller')} />;
  if (review.kind === 'anonymous') return <Phone>{back}<LoginRequired /></Phone>;
  if (review.kind === 'loading') {
    return <Phone>{back}<main className="body" aria-busy="true"><p className="c c2">{t('textInput.loading')}</p></main></Phone>;
  }
  if (review.kind === 'error') {
    return <Phone>{back}<main className="body"><LoadError title={t('textInput.reviewLoadError')} onRetry={() => { setReview({ kind: 'loading' }); setAttempt((value) => value + 1); }} /></main></Phone>;
  }
  if (review.kind === 'unavailable') {
    return (
      <Phone>
        {back}
        <main className="body" style={{ gap: 12 }} data-testid="text-review-unavailable">
          <h2 className="h3">{t('textInput.reviewUnavailableTitle')}</h2>
          <p className="t c2">{t('textInput.reviewUnavailableText')}</p>
          <Link className="btn btn-g w" href="/seller?tab=drafts">{t('textInput.toShowcase')}</Link>
        </main>
      </Phone>
    );
  }

  const { submission, pointName } = review;
  const uncertainByDraft = new Map(submission.uncertain.map((item) => [item.draftId, item]));
  if (submission.status !== 'succeeded') {
    return (
      <Phone>
        {back}
        <main className="body" style={{ gap: 12 }} data-testid="text-review-not-ready">
          <p className="t">{t(submission.status === 'processing' ? 'textInput.reviewProcessing' : 'textInput.reviewFailed')}</p>
          <Link className="btn btn-g w" href="/seller/text-input">{t('textInput.title')}</Link>
        </main>
      </Phone>
    );
  }
  const nothingAtAll = submission.drafts.length === 0 && submission.skipped.length === 0 && submission.notices.length === 0
    && submission.unavailableDrafts === 0;

  return (
    <Phone>
      {back}
      <main className="body" style={{ gap: 12 }} data-testid="text-input-review">
        {rawText ? (
          <>
            <p className="c c2" style={{ whiteSpace: 'pre-wrap' }} data-testid="text-review-raw">{rawText}</p>
            {submission.parser === 'real' && (
              <p className="c" role="note" data-testid="text-input-reminder">{t('textInput.reminder')}</p>
            )}
          </>
        ) : (
          <p className="c" role="note" data-testid="text-review-raw-unavailable">{t('textInput.rawTextUnavailable')}</p>
        )}
        {pointName && <p className="c c2" data-testid="text-review-point">{t('textInput.reviewFor', { name: pointName })}</p>}
        {submission.publishedDrafts > 0 && (
          <p className="c" role="status" data-testid="text-review-published">{t('textInput.publishedDrafts', { count: submission.publishedDrafts })}</p>
        )}
        {submission.deletedDrafts > 0 && (
          <p className="c" role="status" data-testid="text-review-deleted">{t('textInput.deletedDrafts', { count: submission.deletedDrafts })}</p>
        )}
        {nothingAtAll && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
            <Ic name="box" className="lg c2" />
            <h2 className="h3">{t('textInput.emptyTitle')}</h2>
            <p className="c c2">{t('textInput.emptyText')}</p>
            <Link className="btn btn-o w" href="/seller?new=1">{t('source.manual')}</Link>
          </div>
        )}
        {submission.drafts.map((draft) => {
          const missing = missingDraftFields(draft.payload);
          const uncertain = uncertainByDraft.get(draft.id);
          const price = draft.payload.price.trim();
          return (
            <article key={draft.id} className="card p16" style={{ gap: 8 }} data-testid={`text-draft-${draft.id}`}>
              <button type="button" className="rowbtn" onClick={() => router.push(`/seller?draft=${draft.id}`)}>
                <Thumb photoUrl={null} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="ts">{draft.payload.title.trim() || t('showcase.draftUntitled')}</div>
                  {price && <p className="c c2"><b className="num">{formatAmount(price)} ₸</b>{draft.payload.unit ? ` / ${unitShort(draft.payload.unit)}` : ''}</p>}
                  {missing.length > 0 && <p className="c">{t('showcase.missing', { fields: missing.map((key) => t(key)).join(', ') })}</p>}
                </div>
                <Ic name="right" className="c2" />
              </button>
              {uncertain && <p className="c" role="status" data-testid="text-uncertain-notice">{uncertain.message}</p>}
            </article>
          );
        })}
        {submission.skipped.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="text-skipped-block">
            <div className="ov">{t('textInput.skippedTitle')}</div>
            {submission.skipped.map((item, index) => (
              <div key={`${item.label}-${index}`} className="card p16" style={{ gap: 4 }}>
                <div className="ts">{item.label}</div>
                <p className="c c2">{item.reason}</p>
                {item.sourceQuote && <p className="c c2" style={{ fontStyle: 'italic' }}>{item.sourceQuote}</p>}
              </div>
            ))}
          </section>
        )}
        {submission.notices.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="text-notices-block">
            <div className="ov">{t('textInput.noticesTitle')}</div>
            {submission.notices.map((notice, index) => <p key={`${notice}-${index}`} className="c c2">{notice}</p>)}
          </section>
        )}
        <Link className="btn btn-g w" href="/seller?tab=drafts">{t('textInput.toShowcase')}</Link>
      </main>
    </Phone>
  );
}
