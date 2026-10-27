'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import type { SellerTextInputResponse } from '../../../modules/seller-text-input/contracts/seller-text-input.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { Bar, Ic, LoginRequired, Phone } from '../_kaida/ui';
import { clientRequestId } from '../../_components/client-request-id';

const REVIEW_STORAGE_PREFIX = 'kaida:text-input-review:';
// The text being written survives errors, point creation and a reload of this tab; it never leaves the browser.
const TEXT_STORAGE_KEY = 'kaida:text-input-text';
// seller-ai-text-real-parser §6.2: the client waits longer than the largest server-side parser timeout (180 s).
const CLIENT_WAIT_MS = 200_000;
// §16: a fixed field of about six lines (16 px text, 22 px lines, 12 px padding, 1.5 px border); longer text scrolls.
export const TEXT_FIELD_HEIGHT = 6 * 22 + 2 * 12 + 2 * 1.5;

type SubmitError = 'timeout' | 'busy' | 'failed' | 'conflict' | 'network' | 'pointNotFound';
type SellerState = { kind: 'loading' } | { kind: 'anonymous' } | { kind: 'error' } | { kind: 'ready'; seller: SellerView | null };

export function storeTextInputReview(result: SellerTextInputResponse) {
  try {
    sessionStorage.setItem(`${REVIEW_STORAGE_PREFIX}${result.inputId}`, JSON.stringify({ rawText: result.rawText }));
  } catch {
    // The review also works from the server record; only the original text is missing then.
  }
}

function errorOf(code: string): SubmitError | 'pointRequired' {
  if (code === 'TEXT_INPUT_TIMEOUT') return 'timeout';
  if (code === 'TEXT_INPUT_BUSY') return 'busy';
  if (code === 'TEXT_INPUT_REQUEST_CONFLICT') return 'conflict';
  if (code === 'TEXT_INPUT_POINT_REQUIRED' || code === 'SELLER_REQUIRED') return 'pointRequired';
  if (code === 'TEXT_INPUT_POINT_NOT_FOUND') return 'pointNotFound';
  return 'failed';
}

const ERROR_KEYS: Record<SubmitError, MessageKey> = {
  timeout: 'textInput.errorTimeout',
  busy: 'textInput.errorBusy',
  failed: 'textInput.errorFailed',
  conflict: 'textInput.errorConflict',
  network: 'textInput.error',
  pointNotFound: 'textInput.pointNotFound',
};

function readStoredText(): string {
  try {
    return sessionStorage.getItem(TEXT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeText(value: string) {
  try {
    if (value) sessionStorage.setItem(TEXT_STORAGE_KEY, value);
    else sessionStorage.removeItem(TEXT_STORAGE_KEY);
  } catch {
    // Without storage the text still stays on this screen.
  }
}

export function SellerTextInputScreen() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const requestedPoint = useSearchParams().get('point');
  const [text, setText] = useState('');
  const [seller, setSeller] = useState<SellerState>({ kind: 'loading' });
  const [pointId, setPointId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  const [pointRequired, setPointRequired] = useState(false);
  // One id per submitted text and point: a retry reuses it, so the server never creates the same drafts twice.
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStoredText();
      if (stored) setText((current) => current || stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
        if (!alive) return;
        if (response.status === 401) { setSeller({ kind: 'anonymous' }); return; }
        if (!response.ok) throw new Error('seller');
        const data = await response.json() as { seller: SellerView | null };
        if (!alive) return;
        const locations = data.seller?.locations ?? [];
        setSeller({ kind: 'ready', seller: data.seller });
        // The point the Seller came from is the target; never another one silently. One point is the target itself.
        if (requestedPoint) {
          if (locations.some((location) => location.id === requestedPoint)) setPointId(requestedPoint);
          else setError('pointNotFound');
        } else if (locations.length === 1) setPointId(locations[0]!.id);
      } catch {
        if (alive) setSeller({ kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [locale, requestedPoint]);

  const locations = seller.kind === 'ready' ? seller.seller?.locations ?? [] : [];
  const noPoint = seller.kind === 'ready' && locations.length === 0;
  const target = locations.find((location) => location.id === pointId) ?? null;

  function edit(value: string) {
    setText(value);
    storeText(value);
    requestId.current = null;
  }

  function choosePoint(id: string) {
    setPointId(id || null);
    requestId.current = null;
    if (error === 'pointNotFound') setError(null);
  }

  async function submit() {
    if (busy || text.trim() === '' || !target) return;
    if (error === 'conflict') requestId.current = null;
    requestId.current ??= clientRequestId();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/seller/text-input', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, requestId: requestId.current, locationId: target.id }),
        signal: AbortSignal.timeout(CLIENT_WAIT_MS),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
        const kind = errorOf(body?.error?.code ?? 'TEXT_INPUT_FAILED');
        if (kind === 'pointRequired') setPointRequired(true);
        else setError(kind);
        return;
      }
      const result = await response.json() as SellerTextInputResponse;
      storeTextInputReview(result);
      storeText('');
      router.push(`/seller/text-input/review?input=${result.inputId}`);
    } catch {
      setError('network');
    } finally {
      setBusy(false);
    }
  }

  if (seller.kind === 'anonymous') {
    return <Phone><Bar title={t('textInput.title')} onBack={() => router.push('/seller')} /><LoginRequired /></Phone>;
  }

  const missingPoint = noPoint || pointRequired;
  return (
    <Phone>
      <Bar title={t('textInput.title')} onBack={() => router.push('/seller')} />
      <main className="body" style={{ gap: 12 }}>
        <p className="c c2">{t('textInput.hint')}</p>
        {missingPoint ? (
          <div className="banner soft" role="status" data-testid="text-input-point-required" style={{ gap: 8 }}>
            <p className="ts">{t('textInput.pointRequiredTitle')}</p>
            <p className="c">{t('textInput.pointRequiredText')}</p>
            <Link className="btn btn-p sm" href="/seller/points?return=text-input" data-testid="text-input-create-point">
              <Ic name="plus" className="sm" />{t('textInput.createPoint')}
            </Link>
          </div>
        ) : seller.kind === 'ready' && (
          <div className="card p16" style={{ gap: 6 }} data-testid="text-input-target">
            {locations.length > 1 ? (
              <div className="fld">
                <label htmlFor="seller-text-input-point">{t('textInput.target')}</label>
                <select id="seller-text-input-point" className="inp" value={pointId ?? ''} onChange={(event) => choosePoint(event.target.value)} disabled={busy}>
                  <option value="">{t('textInput.choosePoint')}</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </div>
            ) : <div className="ov">{t('textInput.target')}</div>}
            {target && (
              <p className="t" data-testid="text-input-target-name"><b>{target.name}</b> · {target.addressText}</p>
            )}
          </div>
        )}
        <div className="fld">
          <label htmlFor="seller-text-input">{t('textInput.label')}</label>
          <textarea
            id="seller-text-input"
            className="inp"
            rows={6}
            value={text}
            onChange={(event) => edit(event.target.value)}
            disabled={busy}
            placeholder={t('textInput.placeholder')}
            style={{ height: TEXT_FIELD_HEIGHT, minHeight: TEXT_FIELD_HEIGHT, maxHeight: TEXT_FIELD_HEIGHT, padding: 12, lineHeight: '22px', overflowY: 'auto', resize: 'none' }}
          />
        </div>
        {error && (
          <div className="banner soft" role="alert" data-testid="text-input-error">
            <p className="c">{t(ERROR_KEYS[error])}</p>
            {error !== 'pointNotFound' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-o sm" onClick={() => void submit()} disabled={busy}>
                  {t('textInput.retry')}
                </button>
                <Link className="btn btn-g sm" href={target ? `/seller?new=1&at=${target.id}` : '/seller?new=1'}>{t('source.manual')}</Link>
              </div>
            )}
          </div>
        )}
        <button type="button" className="btn btn-p lg w" onClick={() => void submit()} disabled={busy || text.trim() === '' || !target || missingPoint}>
          {busy ? t('textInput.sending') : t('textInput.submit')}
        </button>
      </main>
    </Phone>
  );
}
