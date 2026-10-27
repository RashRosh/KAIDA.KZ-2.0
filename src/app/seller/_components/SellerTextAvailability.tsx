'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type {
  AvailabilityCandidate,
  AvailabilityStatementView,
} from '../../../modules/seller-input/contracts/availability.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { formatAmount } from '../../_components/format-amount';
import { Check, Ic, Thumb } from '../_kaida/ui';

const STATUS: Record<AvailabilityCandidate['status'], { className: string; icon: string; key: MessageKey }> = {
  live: { className: 'bd bd-ok', icon: 'check', key: 'showcase.statusLive' },
  pending: { className: 'bd bd-warn', icon: 'clock', key: 'availability.statusPending' },
  off_here: { className: 'bd bd-n', icon: 'power', key: 'availability.statusOffHere' },
  off_before: { className: 'bd bd-n', icon: 'power', key: 'availability.statusOffBefore' },
};

// text-availability §4.1 item 3: one clear match — the only card found, and on sale — is pre-ticked; several matches
// (even when the others are already switched off), an uncertain pack or a changed statement wait for the Seller.
function defaultTicks(views: AvailabilityStatementView[], changed: Set<number>): Map<number, Set<string>> {
  const ticks = new Map<number, Set<string>>();
  for (const view of views) {
    const selectable = view.candidates.filter((candidate) => candidate.selectable);
    const clear = view.candidates.length === 1 && selectable.length === 1 && view.variant.state !== 'uncertain' && !changed.has(view.index);
    ticks.set(view.index, new Set(clear ? [selectable[0]!.offerId] : []));
  }
  return ticks;
}

export function availabilitySummary(views: AvailabilityStatementView[]) {
  return {
    off: views.flatMap((view) => view.candidates).filter((candidate) => candidate.status === 'off_here').length,
    pending: views.flatMap((view) => view.candidates).filter((candidate) => candidate.status === 'pending').length,
    open: views.filter((view) => view.candidates.some((candidate) => candidate.selectable)).length,
  };
}

// text-availability §4.1 item 4: the «Нет в наличии» section of a text review and its single switch-off action.
export function SellerTextAvailability({ inputId, locationId, availability, pendingChangeSetIds }: {
  inputId: string;
  locationId: string | null;
  availability: AvailabilityStatementView[];
  pendingChangeSetIds: string[];
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [views, setViews] = useState(availability);
  const [changed, setChanged] = useState<Set<number>>(new Set());
  const [ticks, setTicks] = useState(() => defaultTicks(availability, new Set()));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const count = useMemo(() => [...ticks.values()].reduce((sum, set) => sum + set.size, 0), [ticks]);
  const reviewUrl = `/seller/text-input/review?input=${inputId}`;
  const confirmHref = (id: string) => `/seller/change-sets/${id}?back=${encodeURIComponent(reviewUrl)}`;

  function toggle(index: number, offerId: string, on: boolean) {
    setTicks((current) => {
      const next = new Map(current);
      const set = new Set(next.get(index) ?? []);
      if (on) set.add(offerId); else set.delete(offerId);
      next.set(index, set);
      return next;
    });
  }

  async function propose() {
    setBusy(true);
    setFailed(false);
    const statements = views.flatMap((view) => {
      const selected = [...(ticks.get(view.index) ?? [])];
      return selected.length === 0 ? [] : [{
        index: view.index,
        shown: view.candidates.map((candidate) => ({ offerId: candidate.offerId, revision: candidate.revision })),
        selected,
      }];
    });
    try {
      const response = await fetch(`/api/seller/text-input/${encodeURIComponent(inputId)}/availability?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements }),
      });
      const data = await response.json() as { changeSetId?: string; availability?: AvailabilityStatementView[]; changed?: number[] };
      if (response.status === 201 && data.changeSetId) {
        router.push(confirmHref(data.changeSetId));
        return;
      }
      if (response.status === 409 && data.availability) {
        // The cards changed since they were shown: fresh candidates, no ticks on the changed statements, new choice.
        const nextChanged = new Set(data.changed ?? []);
        setViews(data.availability);
        setChanged(nextChanged);
        setTicks(defaultTicks(data.availability, nextChanged));
        setBusy(false);
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  const warn = (text: string) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--warning)' }} role="status">
      <Ic name="alert" className="xs" /><p className="c" style={{ flex: 1, color: 'var(--warning)' }}>{text}</p>
    </div>
  );
  const hasRows = views.some((view) => view.candidates.length > 0);

  return (
    <>
      {pendingChangeSetIds.length > 0 && (
        <div className="banner warn" role="status" style={{ padding: '12px 14px', borderRadius: 14, gap: 8 }} data-testid="availability-pending">
          <p className="c" style={{ color: 'var(--ink)' }}><b>{t('availability.pending', { count: pendingChangeSetIds.length })}</b></p>
          <Link className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} href={confirmHref(pendingChangeSetIds[0]!)}>{t('availability.openConfirm')}</Link>
        </div>
      )}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="availability-block">
        <div className="ov">{t('availability.title', { count: views.length })}</div>
        {views.map((view) => {
          const selectable = view.candidates.filter((candidate) => candidate.selectable);
          const notes = changed.has(view.index)
            ? warn(t('availability.changed'))
            : view.variant.state === 'uncertain'
              ? warn(view.variant.words ? t('availability.uncertain', { words: view.variant.words }) : t('availability.uncertainGeneric'))
              : view.candidates.length === 0
                ? <p className="c c2">{t(view.others.length > 0 ? 'availability.packNotFound' : 'availability.notFound')}</p>
                : selectable.length > 1 ? <p className="c c2">{t('availability.choose')}</p> : null;
          return (
            <article key={view.index} className="card p16" style={{ gap: 10 }} data-testid={`availability-${view.index}`}>
              <div className="ts">«{view.sourceQuote ?? view.label}»</div>
              {notes}
              {view.candidates.map((candidate) => {
                const status = STATUS[candidate.status];
                const name = candidate.packLabel ? `${candidate.title} · ${candidate.packLabel}` : candidate.title;
                const checked = ticks.get(view.index)?.has(candidate.offerId) ?? false;
                return (
                  <div key={candidate.offerId} style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 56 }} data-testid={`availability-row-${candidate.offerId}`}>
                    {candidate.selectable
                      ? <Check checked={checked} onChange={(on) => toggle(view.index, candidate.offerId, on)} label={name} disabled={busy} />
                      : <span style={{ width: 24, flex: 'none' }} />}
                    <Thumb photoUrl={null} size={48} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="ts">{name}</div>
                      {candidate.price && <p className="c c2 num">{formatAmount(candidate.price.amount)} ₸{candidate.price.unit ? ` / ${candidate.price.unit}` : ''}</p>}
                      <span className={status.className}><Ic name={status.icon} />{t(status.key)}</span>
                    </div>
                  </div>
                );
              })}
              {view.others.map((other) => (
                <div key={other.offerId} style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 36 }}>
                  <Ic name="info" className="xs c2" />
                  <p className="c c2" style={{ flex: 1 }}>{t('availability.otherPack', { title: other.packLabel ? `${other.title} · ${other.packLabel}` : other.title })}</p>
                </div>
              ))}
              {view.candidates.length === 0 && locationId && (
                <Link className="btn btn-g" style={{ alignSelf: 'flex-start', padding: 0 }} href={`/seller/points/${locationId}/products`}>{t('pointProducts.titleShort')}</Link>
              )}
            </article>
          );
        })}
      </section>
      {hasRows && (
        // Preview screens 1–8: the rule once, above the one action, kept at the bottom of the scrolling review.
        <div className="foot" style={{ position: 'sticky', bottom: -16, margin: '0 -16px -16px', zIndex: 1 }} data-testid="availability-action">
          <p className="c c2">{t('availability.rule')}</p>
          {failed && <p className="c" role="alert" style={{ color: 'var(--danger)' }}>{t('availability.error')}</p>}
          <button type="button" className={`btn btn-p lg w${count === 0 ? ' dis' : ''}`} disabled={count === 0 || busy} aria-busy={busy || undefined}
            onClick={() => void propose()} data-testid="availability-submit">
            {busy ? <span className="spin" /> : <Ic name="power" className="sm" />}{t('availability.submit', { count })}
          </button>
        </div>
      )}
    </>
  );
}
