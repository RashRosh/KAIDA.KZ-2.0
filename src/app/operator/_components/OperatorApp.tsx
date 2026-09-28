'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatAmount } from '../../_components/OfferCard';
import { Bar, Ic, LoadError, Phone, Radio, SkeletonRows, Thumb, Toast, TOAST_MS } from '../../seller/_kaida/ui';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import {
  REMOVAL_REASONS,
  type OperatorCardView,
  type OperatorFeedPage,
  type OperatorFeedRow,
  type OperatorRemovalView,
  type RemovalReason,
} from '../../../modules/moderation/contracts/moderation.contract';

// operator-post-check · AI-M06: the post-check feed, the operator card screen (no frame in the mockup, built from its
// classes) and the removal reason. Russian only (contract §3).

const REASON_LABELS: Record<RemovalReason, string> = {
  prohibited_item: 'Товар нельзя размещать',
  photo_mismatch: 'Фото не соответствует товару',
  contacts_or_ads: 'Контакты или реклама',
  other: 'Другое',
};

const KIND_LABELS: Record<OperatorFeedRow['kind'], string> = { new: 'новая', changed: 'изменена', republished: 'снова после снятия' };

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return new Intl.DateTimeFormat('ru-KZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function priceText(price: { amount: string; unit: string } | null) {
  return price ? `${formatAmount(price.amount)} ₸${price.unit ? ` / ${price.unit}` : ''}` : '';
}

async function send(url: string, init: RequestInit): Promise<OperatorCardView> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
  const result = await response.json().catch(() => null) as { card?: OperatorCardView } | null;
  if (!response.ok || !result?.card) throw new Error('operator action');
  return result.card;
}

type View = { kind: 'feed' } | { kind: 'card'; cardId: string } | { kind: 'remove'; cardId: string; title: string; coverPhotoId: string | null };

export function OperatorApp() {
  const [tab, setTab] = useState<'new' | 'all'>('new');
  const [page, setPage] = useState<OperatorFeedPage | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ kind: 'feed' });
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const newest = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      try {
        const response = await fetch(`/api/operator/feed?tab=${tab}&offset=0`, { cache: 'no-store' });
        if (!response.ok) throw new Error('feed');
        const data = await response.json() as OperatorFeedPage;
        if (cancelled) return;
        setPage(data);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [tab, attempt]);

  useEffect(() => {
    const first = page?.rows[0]?.at ?? null;
    if (first && (!newest.current || first > newest.current)) newest.current = first;
  }, [page]);

  // Leaving the feed marks what was shown as seen.
  useEffect(() => {
    function onHide() {
      if (newest.current) navigator.sendBeacon('/api/operator/feed/seen', JSON.stringify({ until: newest.current }));
    }
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadMore = useCallback(async () => {
    if (!page) return;
    setBusy('more');
    try {
      const response = await fetch(`/api/operator/feed?tab=${tab}&offset=${page.rows.length}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('feed');
      const data = await response.json() as OperatorFeedPage;
      setPage({ ...data, rows: [...page.rows, ...data.rows] });
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  }, [page, tab]);

  async function markAllSeen() {
    const until = newest.current ?? new Date().toISOString();
    setBusy('seen');
    try {
      const response = await fetch('/api/operator/feed/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ until }) });
      if (!response.ok) throw new Error('seen');
      setAttempt((value) => value + 1);
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  }

  function applyCard(card: OperatorCardView) {
    setPage((current) => current && ({
      ...current,
      rows: current.rows.map((row) => row.cardId === card.cardId ? { ...row, removal: card.removal } : row),
    }));
  }

  async function restore(cardId: string) {
    setBusy(cardId);
    setActionError(false);
    try {
      applyCard(await send(`/api/operator/cards/${cardId}/removal`, { method: 'DELETE' }));
      setToast('Карточка снова на витрине');
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  }

  async function remove(cardId: string, reason: RemovalReason, comment: string) {
    setBusy(cardId);
    setActionError(false);
    try {
      applyCard(await send(`/api/operator/cards/${cardId}/removal`, { method: 'POST', body: JSON.stringify({ reason, comment }) }));
      setView({ kind: 'feed' });
      setToast('Карточка снята с витрины');
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  }

  if (view.kind === 'card') {
    return (
      <OperatorCard
        cardId={view.cardId}
        busy={busy === view.cardId}
        actionError={actionError}
        onBack={() => { setActionError(false); setView({ kind: 'feed' }); }}
        onRemove={(card) => setView({ kind: 'remove', cardId: card.cardId, title: card.title, coverPhotoId: card.photoIds[0] ?? null })}
        onRestore={async (cardId) => { await restore(cardId); }}
      />
    );
  }

  if (view.kind === 'remove') {
    return (
      <RemoveScreen
        title={view.title}
        coverPhotoId={view.coverPhotoId}
        busy={busy === view.cardId}
        actionError={actionError}
        onCancel={() => { setActionError(false); setView({ kind: 'feed' }); }}
        onConfirm={(reason, comment) => void remove(view.cardId, reason, comment)}
      />
    );
  }

  return (
    <Phone>
      <Bar title="Опубликовано недавно" />
      <main className="body" style={{ gap: 12 }}>
        <div className="chips" role="group" aria-label="Какие карточки показать">
          <button type="button" className={`chip${tab === 'new' ? ' on' : ''}`} aria-pressed={tab === 'new'} onClick={() => setTab('new')}>
            Новые с моего последнего просмотра{page ? ` · ${page.newCount}` : ''}
          </button>
          <button type="button" className={`chip${tab === 'all' ? ' on' : ''}`} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Все</button>
        </div>
        {actionError && (
          <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12 }}><p className="c" style={{ color: 'var(--ink)' }}>Не удалось выполнить действие. Повторите.</p></div>
        )}
        {state === 'loading' && <SkeletonRows />}
        {state === 'error' && <LoadError title="Не удалось загрузить ленту" onRetry={() => setAttempt((value) => value + 1)} />}
        {state === 'ready' && page && page.rows.length === 0 && (
          <p className="t c2" style={{ textAlign: 'center', marginTop: 24 }}>Новых карточек нет</p>
        )}
        {state === 'ready' && page?.rows.map((row) => (
          <FeedRow
            key={row.eventId}
            row={row}
            busy={busy === row.cardId}
            onOpen={() => { setActionError(false); setView({ kind: 'card', cardId: row.cardId }); }}
            onRemove={() => { setActionError(false); setView({ kind: 'remove', cardId: row.cardId, title: row.title, coverPhotoId: row.coverPhotoId }); }}
            onRestore={() => void restore(row.cardId)}
          />
        ))}
        {state === 'ready' && page?.hasMore && (
          <button type="button" className="btn btn-o w" onClick={() => void loadMore()} disabled={busy === 'more'}>Показать ещё</button>
        )}
        {state === 'ready' && tab === 'new' && page && page.rows.length > 0 && (
          <button type="button" className="btn btn-g w" onClick={() => void markAllSeen()} disabled={busy === 'seen'}>Отметить всё просмотренным</button>
        )}
      </main>
      {toast && <Toast>{toast}</Toast>}
    </Phone>
  );
}

function RemovedLine({ removal }: { removal: OperatorRemovalView }) {
  return (
    <>
      {/* A long reason wraps inside the card instead of running past its edge (the mockup badge never wraps). */}
      <span className="bd bd-err" style={{ alignSelf: 'flex-start', whiteSpace: 'normal', height: 'auto', minHeight: 24, padding: '4px 8px', maxWidth: '100%' }}>
        <Ic name="eyeoff" /><span>Снята · {REASON_LABELS[removal.reason]}</span>
      </span>
      <p className="c">Снял оператор · {ago(removal.removedAt)}</p>
    </>
  );
}

function FeedRow({ row, busy, onOpen, onRemove, onRestore }: {
  row: OperatorFeedRow; busy: boolean; onOpen: () => void; onRemove: () => void; onRestore: () => void;
}) {
  const title = `${row.title}${row.packLabel ? ` · ${row.packLabel}` : ''}`;
  return (
    <article className="card" aria-labelledby={`op-${row.eventId}`} data-testid={`operator-row-${row.cardId}`}
      style={row.removal ? { border: '1.5px solid var(--danger)' } : undefined}>
      <button type="button" className="rowbtn" onClick={onOpen} aria-labelledby={`op-${row.eventId}`}>
        <Thumb photoUrl={row.coverPhotoId ? photoUrl(row.coverPhotoId, 'thumb') : null} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="ts" id={`op-${row.eventId}`}>{title}</div>
          <p className="c c2 num">{priceText(row.price)} · {row.pointName}{row.morePoints > 0 ? ` + ${row.morePoints} точ.` : ''}</p>
          <p className="c">Продавец {row.sellerPhone} · {ago(row.at)} · {KIND_LABELS[row.kind]}</p>
          {row.removal && <RemovedLine removal={row.removal} />}
        </div>
      </button>
      <div style={{ paddingLeft: 68 }}>
        {row.removal
          ? <button type="button" className="btn btn-o sm" onClick={onRestore} disabled={busy}>Вернуть на витрину</button>
          : <button type="button" className="btn btn-o sm" onClick={onRemove} disabled={busy} style={{ color: 'var(--danger)' }}><Ic name="eyeoff" className="sm" />Снять с витрины</button>}
      </div>
    </article>
  );
}

function OperatorCard({ cardId, busy, actionError, onBack, onRemove, onRestore }: {
  cardId: string; busy: boolean; actionError: boolean; onBack: () => void;
  onRemove: (card: OperatorCardView) => void; onRestore: (cardId: string) => Promise<void>;
}) {
  const [card, setCard] = useState<OperatorCardView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      try {
        const response = await fetch(`/api/operator/cards/${cardId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('card');
        const data = await response.json() as { card: OperatorCardView };
        if (!cancelled) { setCard(data.card); setState('ready'); }
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [cardId, attempt]);

  return (
    <Phone>
      <Bar title={card?.title ?? 'Карточка'} onBack={onBack} />
      <main className="body" style={{ gap: 12 }}>
        {state === 'loading' && <SkeletonRows rows={2} />}
        {state === 'error' && <LoadError title="Не удалось открыть карточку" onRetry={() => setAttempt((value) => value + 1)} />}
        {state === 'ready' && card && (
          <>
            {card.photoIds.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {card.photoIds.map((id) => (
                  <div key={id} className="img" style={{ height: 150, borderRadius: 14 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- operator-only photo route */}
                    <img src={photoUrl(id, 'display')} alt="" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="img fb" style={{ height: 120, borderRadius: 16 }}><Ic name="logo" /></div>
            )}
            <h2 className="h3">{card.title}{card.packLabel ? ` · ${card.packLabel}` : ''}</h2>
            {card.removal && <RemovedLine removal={card.removal} />}
            {card.removal?.comment && <p className="c">Комментарий продавцу: {card.removal.comment}</p>}
            {card.sellerComment && <p className="t c2">{card.sellerComment}</p>}
            <p className="c">Продавец {card.sellerPhone}</p>
            <h3 className="ov">Точки · {card.points.length}</h3>
            {card.points.map((point) => (
              <div key={point.offerId} className="card" style={{ gap: 2 }}>
                <div className="ts">{point.name}</div>
                <p className="c">{point.addressText}</p>
                <p className="c num">{priceText(point.price)}{point.active ? '' : ' · выключено продавцом'}</p>
              </div>
            ))}
            {actionError && (
              <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12 }}><p className="c" style={{ color: 'var(--ink)' }}>Не удалось выполнить действие. Повторите.</p></div>
            )}
          </>
        )}
      </main>
      {state === 'ready' && card && (
        <div className="foot">
          {card.removal
            ? <button type="button" className="btn btn-p lg w" disabled={busy} onClick={async () => { await onRestore(card.cardId); setAttempt((value) => value + 1); }}>Вернуть на витрину</button>
            : <button type="button" className="btn btn-p lg w" disabled={busy} onClick={() => onRemove(card)}>Снять с витрины</button>}
        </div>
      )}
    </Phone>
  );
}

function RemoveScreen({ title, coverPhotoId, busy, actionError, onCancel, onConfirm }: {
  title: string; coverPhotoId: string | null; busy: boolean; actionError: boolean;
  onCancel: () => void; onConfirm: (reason: RemovalReason, comment: string) => void;
}) {
  const [reason, setReason] = useState<RemovalReason>('prohibited_item');
  const [comment, setComment] = useState('');
  return (
    <Phone>
      <Bar title="Снять с витрины" onBack={onCancel} />
      <main className="body" style={{ gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Thumb photoUrl={coverPhotoId ? photoUrl(coverPhotoId, 'thumb') : null} size={48} />
          <div className="ts" style={{ flex: 1 }}>{title}</div>
        </div>
        <fieldset className="fld" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="fl">Причина</legend>
          {REMOVAL_REASONS.map((code) => (
            <label key={code} className="li" style={{ minHeight: 48, cursor: 'pointer', position: 'relative' }}>
              <input className="cbx" type="radio" name="reason" value={code} checked={reason === code} onChange={() => setReason(code)} />
              <Radio on={reason === code} />
              <div className="mid"><div className="ts">{REASON_LABELS[code]}</div></div>
            </label>
          ))}
        </fieldset>
        <div className="fld">
          <label className="fl" htmlFor="removal-comment">Комментарий продавцу <span className="req">· необязательно</span></label>
          <textarea id="removal-comment" className="inp ta" rows={3} maxLength={300} value={comment} onChange={(event) => setComment(event.target.value)} />
        </div>
        <div className="banner gray" style={{ padding: 12, borderRadius: 14 }}>
          <p className="c c2">Продавец увидит «Снято оператором» и причину обычными словами. Карточка пропадёт у покупателей во всех точках сразу.</p>
        </div>
        {actionError && (
          <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12 }}><p className="c" style={{ color: 'var(--ink)' }}>Не удалось снять карточку. Повторите.</p></div>
        )}
      </main>
      <div className="foot" style={{ flexDirection: 'row' }}>
        <button type="button" className="btn btn-o lg" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>Отмена</button>
        <button type="button" className="btn btn-p lg" style={{ flex: 1 }} onClick={() => onConfirm(reason, comment)} disabled={busy}>Снять с витрины</button>
      </div>
    </Phone>
  );
}
