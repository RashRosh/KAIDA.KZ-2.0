'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { Toast, TOAST_MS, UNDO_TOAST_MS } from '../_kaida/ui';
import { pluralKey } from './card-model';

// actuality-words: the one-tap «Всё актуально». The server confirms card by card and answers with the cards it confirmed
// and the cards it could not (`POST /api/seller/actuality/confirm`); an undo of exactly those confirmations is offered for 8 s
// (the server accepts it for 12 s). A partial result has no undo (R1).

export type BulkToastState =
  | { kind: 'done'; count: number; changeSetIds: string[] }
  | { kind: 'partial'; ok: number; failed: number }
  | { kind: 'undone' };

type ConfirmResponse = { confirmed?: { cardId: string; changeSetId: string }[]; failed?: { cardId: string }[] };

export function useBulkConfirm({ onChanged }: { onChanged: () => void }) {
  const [toast, setToast] = useState<BulkToastState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // One request at a time, also across fast double taps (state updates are not synchronous).
  const inFlight = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.kind === 'done' ? UNDO_TOAST_MS : TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Resolves true when at least one card was confirmed (the caller may leave the list screen).
  const confirmAll = useCallback(async (cardIds: string[]): Promise<boolean> => {
    if (inFlight.current || cardIds.length === 0) return false;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/seller/actuality/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds }),
      });
      if (!response.ok) throw new Error('confirm');
      const result = await response.json() as ConfirmResponse;
      const confirmed = result.confirmed ?? [];
      const failed = result.failed ?? [];
      if (confirmed.length === 0) throw new Error('confirm');
      setToast(failed.length === 0
        ? { kind: 'done', count: confirmed.length, changeSetIds: confirmed.map((item) => item.changeSetId) }
        : { kind: 'partial', ok: confirmed.length, failed: failed.length });
      onChanged();
      return true;
    } catch {
      setError(true);
      onChanged();
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [onChanged]);

  const undo = useCallback(async () => {
    if (inFlight.current || toast?.kind !== 'done') return;
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/seller/actuality/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeSetIds: toast.changeSetIds }),
      });
      // Refused cards keep their confirmation; the list on screen shows what is true after the reload.
      setToast(response.ok ? { kind: 'undone' } : null);
    } catch {
      setToast(null);
    } finally {
      inFlight.current = false;
      setBusy(false);
      onChanged();
    }
  }, [onChanged, toast]);

  const dismiss = useCallback(() => setToast(null), []);
  return { toast, busy, error, confirmAll, undo, dismiss };
}

export function BulkToast({ toast, onUndo, onView }: { toast: BulkToastState; onUndo: () => void; onView: () => void }) {
  const { t } = useI18n();
  if (toast.kind === 'done') {
    return <Toast action={{ label: t('actuality.undo'), onClick: onUndo }}>{t(pluralKey('actuality.bulkDone', toast.count), { count: toast.count })}</Toast>;
  }
  if (toast.kind === 'partial') {
    return <Toast tone="warn" action={{ label: t('actuality.viewList'), onClick: onView }}>{t('actuality.bulkPartial', { ok: toast.ok, failed: toast.failed })}</Toast>;
  }
  return <Toast>{t('actuality.undone')}</Toast>;
}
