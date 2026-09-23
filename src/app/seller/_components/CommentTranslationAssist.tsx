'use client';

import { useState } from 'react';
import styles from '../page.module.css';
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
    <div className={styles.translationAssist}>
      <p className={styles.muted}>{t('offerCreate.translationHint')}</p>
      <button type="button" className={styles.secondaryButton} onClick={() => void check()} disabled={loading}>
        {loading ? t('offerCreate.checkingTranslation') : t('offerCreate.checkTranslation')}
      </button>
      {currentPreview && (
        <div className={styles.translationPreview} role="status" aria-label={t('offerCreate.translationPreview')}>
          <p className={styles.eyebrow}>{t('offerCreate.translationPreview')}</p>
          {currentPreview.map((entry) => (
            <p key={entry.locale}>
              <span className={styles.muted}>{t(entry.locale === 'ru' ? 'language.ru' : 'language.kk')}: </span>
              <span lang={entry.locale}>{entry.text}</span>
            </p>
          ))}
        </div>
      )}
      {failedFor === text && <p className={styles.muted} role="status">{t('offerCreate.translationPreviewError')}</p>}
    </div>
  );
}
