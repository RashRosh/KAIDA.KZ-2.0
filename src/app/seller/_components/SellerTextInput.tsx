'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { SellerTextInputResponse } from '../../../modules/seller-text-input/contracts/seller-text-input.contract';
import { Bar, Phone } from '../_kaida/ui';

const REVIEW_STORAGE_PREFIX = 'kaida:text-input-review:';

export function storeTextInputReview(result: SellerTextInputResponse) {
  sessionStorage.setItem(`${REVIEW_STORAGE_PREFIX}${result.inputId}`, JSON.stringify({
    skipped: result.skipped,
    uncertain: result.uncertain,
    rawText: result.rawText,
  }));
}

export function SellerTextInputScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (busy || text.trim() === '') return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/seller/text-input', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error('failed');
      const result = await response.json() as SellerTextInputResponse;
      storeTextInputReview(result);
      router.push(`/seller/text-input/review?input=${result.inputId}`);
    } catch {
      setError(true);
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
            onChange={(event) => setText(event.target.value)}
            disabled={busy}
            placeholder={t('textInput.placeholder')}
          />
        </label>
        {error && (
          <div className="banner soft" role="alert">
            <p className="c">{t('textInput.error')}</p>
            <button type="button" className="btn btn-o sm" onClick={() => void submit()} disabled={busy}>
              {t('textInput.retry')}
            </button>
          </div>
        )}
        <button type="button" className="btn btn-p lg w" onClick={() => void submit()} disabled={busy || text.trim() === ''}>
          {busy ? t('textInput.sending') : t('textInput.submit')}
        </button>
      </main>
    </Phone>
  );
}
