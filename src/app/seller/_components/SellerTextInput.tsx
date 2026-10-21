'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import type { SellerTextInputResponse } from '../../../modules/seller-text-input/contracts/seller-text-input.contract';
import { Bar, Phone } from '../_kaida/ui';

const REVIEW_STORAGE_PREFIX = 'kaida:text-input-review:';
// seller-ai-text-real-parser §6.2: the client waits longer than the largest server-side parser timeout (180 s).
const CLIENT_WAIT_MS = 200_000;

type SubmitError = 'timeout' | 'busy' | 'failed' | 'conflict' | 'network';

export function storeTextInputReview(result: SellerTextInputResponse) {
  sessionStorage.setItem(`${REVIEW_STORAGE_PREFIX}${result.inputId}`, JSON.stringify({
    skipped: result.skipped,
    uncertain: result.uncertain,
    rawText: result.rawText,
    parser: result.parser,
    notices: result.notices,
    unavailableDrafts: result.unavailableDrafts,
  }));
}

function errorOf(code: string): SubmitError {
  if (code === 'TEXT_INPUT_TIMEOUT') return 'timeout';
  if (code === 'TEXT_INPUT_BUSY') return 'busy';
  if (code === 'TEXT_INPUT_REQUEST_CONFLICT') return 'conflict';
  return 'failed';
}

const ERROR_KEYS: Record<SubmitError, MessageKey> = {
  timeout: 'textInput.errorTimeout',
  busy: 'textInput.errorBusy',
  failed: 'textInput.errorFailed',
  conflict: 'textInput.errorConflict',
  network: 'textInput.error',
};

export function SellerTextInputScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  // One id per submitted text: a retry of the same text reuses it, so the server never creates its drafts twice.
  const requestId = useRef<string | null>(null);

  function edit(value: string) {
    setText(value);
    requestId.current = null;
  }

  async function submit() {
    if (busy || text.trim() === '') return;
    if (error === 'conflict') requestId.current = null;
    requestId.current ??= crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/seller/text-input', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, requestId: requestId.current }),
        signal: AbortSignal.timeout(CLIENT_WAIT_MS),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
        setError(errorOf(body?.error?.code ?? 'TEXT_INPUT_FAILED'));
        return;
      }
      const result = await response.json() as SellerTextInputResponse;
      storeTextInputReview(result);
      router.push(`/seller/text-input/review?input=${result.inputId}`);
    } catch {
      setError('network');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Phone>
      <Bar title={t('textInput.title')} onBack={() => router.push('/seller')} />
      <main className="body" style={{ gap: 12 }}>
        <p className="c c2">{t('textInput.hint')}</p>
        <label className="fld" htmlFor="seller-text-input">
          <span>{t('textInput.label')}</span>
          <textarea
            id="seller-text-input"
            className="inp"
            rows={8}
            value={text}
            onChange={(event) => edit(event.target.value)}
            disabled={busy}
            placeholder={t('textInput.placeholder')}
          />
        </label>
        {error && (
          <div className="banner soft" role="alert" data-testid="text-input-error">
            <p className="c">{t(ERROR_KEYS[error])}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-o sm" onClick={() => void submit()} disabled={busy}>
                {t('textInput.retry')}
              </button>
              <Link className="btn btn-g sm" href="/seller?new=1">{t('source.manual')}</Link>
            </div>
          </div>
        )}
        <button type="button" className="btn btn-p lg w" onClick={() => void submit()} disabled={busy || text.trim() === ''}>
          {busy ? t('textInput.sending') : t('textInput.submit')}
        </button>
      </main>
    </Phone>
  );
}
