'use client';

import { useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';

type Preview = { locale: 'ru' | 'kk'; text: string }[];
type PreviewResponse = { preview?: { translations?: Preview } };

// Hidden, not disabled, while the translator is off. The preview is read-only and never touches the draft.
export function CommentTranslationAssist({ enabled, comment }: { enabled: boolean; comment: string }) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<{ source: string; translations: Preview } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const text = comment.trim();
  if (!enabled || text === '') return null;

  async function check() {
    setLoading(true);
    setFailedFor(null);
    try {
      const response = await fetch('/api/seller/comment-translation/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json() as PreviewResponse;
      const translations = data.preview?.translations;
      if (!response.ok || !translations || translations.length === 0) {
        setPreview(null);
        setFailedFor(text);
        return;
      }
      setPreview({ source: text, translations });
    } catch {
      setPreview(null);
      setFailedFor(text);
    } finally {
      setLoading(false);
    }
  }

  const currentPreview = preview?.source === text ? preview.translations : null;
  return (
    <div className="banner gray" style={{ padding: 12, borderRadius: 14, gap: 8 }}>
      <p className="c c2">{t('offerCreate.translationHint')}</p>
      <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} onClick={() => void check()} disabled={loading} aria-busy={loading}>
        {loading && <span className="spin" style={{ width: 14, height: 14, borderWidth: 2 }} />}
        {loading ? t('offerCreate.checkingTranslation') : t('offerCreate.checkTranslation')}
      </button>
      {currentPreview && (
        <div role="status" aria-label={t('offerCreate.translationPreview')} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="ov">{t('offerCreate.translationPreview')}</div>
          {currentPreview.map((entry) => (
            <p key={entry.locale} className="t">
              <span className="c2">{t(entry.locale === 'ru' ? 'language.ru' : 'language.kk')}: </span>
              <span lang={entry.locale}>{entry.text}</span>
            </p>
          ))}
        </div>
      )}
      {failedFor === text && <p className="c c2" role="status">{t('offerCreate.translationPreviewError')}</p>}
    </div>
  );
}
