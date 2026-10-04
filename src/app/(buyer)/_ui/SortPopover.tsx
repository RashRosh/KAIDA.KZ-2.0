'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { SearchSortDirection, SearchSortMode } from '../../../modules/search/contracts/search.contract';
import { Ic } from '../../seller/_kaida/ui';

// Stage 6 Rev 3 (slice contract §3.1): the explicit sort control — a compact popover anchored to its button, with exactly
// three criteria. A choice applies at once; tapping the active criterion reverses its direction. The popover stays open
// after a choice and closes by a tap outside, `Esc` or the button; focus moves in once on open and returns to the button
// (PROJECT_RULES.md §18.4 «Overlay»), and it is never taken back while the popover is open.
const CRITERIA: SearchSortMode[] = ['distance', 'price', 'actuality'];

export function SortPopover({ sort, direction, busy, disabled, onChoose }: {
  sort: SearchSortMode;
  direction: SearchSortDirection;
  // True while the browser geolocation requested by an explicit «Расстояние» is pending.
  busy: boolean;
  // True while a search is in flight: a choice made then would be lost, so the criteria wait (as the field does) — they stay
  // focusable (aria-disabled) so a keyboard user keeps their place.
  disabled: boolean;
  onChoose: (criterion: SearchSortMode) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  // Focus goes in once when the popover opens (to the active criterion) and returns to the button when it closes.
  useEffect(() => {
    if (!open) return;
    popover.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const order = (criterion: SearchSortMode) => t(`search.order.${criterion}.${criterion === sort ? direction : 'asc'}` as 'search.order.price.asc');

  return (
    <div ref={root} style={{ position: 'relative', flex: 'none' }}>
      <button
        ref={trigger}
        type="button"
        className="ib"
        aria-label={t('search.sorting')}
        aria-haspopup="true"
        aria-expanded={open}
        title={t('search.sorting')}
        style={{ width: 44 }}
        onClick={() => setOpen((current) => !current)}
      >
        <Ic name="filter" />
      </button>
      {open && (
        <div
          ref={popover}
          role="group"
          aria-label={t('search.sorting')}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 4, width: 248, padding: 6,
            background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: 'var(--shadow-md)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {CRITERIA.map((criterion) => {
            const active = criterion === sort;
            const name = t(`search.criterion.${criterion}` as 'search.criterion.price');
            return (
              <button
                key={criterion}
                type="button"
                className="li"
                aria-pressed={active}
                aria-label={active ? `${name}, ${order(criterion)}` : name}
                aria-busy={criterion === 'distance' && busy ? true : undefined}
                aria-disabled={disabled || undefined}
                onClick={() => onChoose(criterion)}
                style={{
                  minHeight: 48, padding: '4px 10px', border: 0, borderRadius: 10, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
                  background: active ? 'var(--primary-soft)' : 'transparent', color: active ? 'var(--primary-text)' : 'var(--ink)',
                }}
              >
                <div className="mid">
                  <div className="ts" style={{ fontWeight: active ? 700 : 500 }}>{name}</div>
                  {active && <p className="c" style={{ color: 'inherit' }}>{order(criterion)}</p>}
                </div>
                {active && <span aria-hidden="true" style={{ fontSize: 18, fontWeight: 700 }}>{direction === 'asc' ? '↑' : '↓'}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
