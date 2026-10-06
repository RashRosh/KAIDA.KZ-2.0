'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { SearchSortDirection, SearchSortMode } from '../../../modules/search/contracts/search.contract';
import { Ic } from '../../seller/_kaida/ui';

// Search sorting control UX refresh (docs/slices/search-sort-control-refresh): one compact inline row below the chips, no
// captions, no pill. Default (relevance): sliders icon / «По умолчанию» / list trigger. Explicit sort: sliders icon / the current
// criterion + ↑ or ↓ / list trigger / ×. The value of the row is the current criterion: a tap on it reverses the direction (the
// arrow is an indicator, not a separate action); the default value and the icon are not interactive. The list is the anchored
// popover of Rev 3 with four items; a choice applies at once and the list stays open after it (closes by a tap outside, `Esc` or the
// trigger); focus moves in once on open and returns to the trigger (PROJECT_RULES.md §18.4 «Overlay»). Touch targets are 44×44
// through invisible padding; the visible row stays about 28 px high.
type ExplicitSort = Exclude<SearchSortMode, 'relevance'>;
const CRITERIA: ExplicitSort[] = ['price', 'distance', 'actuality'];

const hit: React.CSSProperties = {
  // No `all: unset`: the global `:focus-visible` outline (PROJECT_RULES.md §18.4) must keep working.
  boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, margin: '-8px 0', padding: '0 6px', border: 0, background: 'none',
  font: 'inherit', fontSize: 14, lineHeight: '20px', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
};

// The sliders icon (PO-approved for this slice): drawn in the style of the mockup icon set — 24 px grid, 1.75 stroke, round caps.
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

export function SortControl({ sort, direction, busy, disabled, onChoose, onReset }: {
  sort: SearchSortMode;
  direction: SearchSortDirection;
  // True while the browser geolocation requested by an explicit «По расстоянию» is pending.
  busy: boolean;
  // True while a search is in flight: a choice made then would be lost, so the controls wait (as the field does) — they stay
  // focusable (aria-disabled) so a keyboard user keeps their place.
  disabled: boolean;
  // A criterion chosen in the list, or the active one tapped (in the row or in the list): the active one reverses its direction.
  onChoose: (criterion: SearchSortMode) => void;
  // «По умолчанию» chosen in the list while an explicit sort is active, or ×: back to relevance without a direction.
  onReset: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const explicit = sort !== 'relevance';

  // Focus goes in once when the list opens (to the active item) and returns to the trigger when it closes.
  useEffect(() => {
    if (!open) return;
    (popover.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? popover.current?.querySelector<HTMLElement>('button'))?.focus();
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
  const arrow = direction === 'asc' ? '↑' : '↓';
  const activeName = explicit ? t(`search.criterion.${sort}` as 'search.criterion.price') : '';

  return (
    <div ref={root} style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 28, minWidth: 0 }}>
      <span style={{ ...hit, cursor: 'default', marginLeft: -6, padding: '0 6px', flex: 'none' }}>
        <SlidersIcon />
        {!explicit && <span>{t('search.criterion.default')}</span>}
      </span>
      {explicit && (
        <button
          type="button"
          style={{ ...hit, padding: '0 4px', minWidth: 0 }}
          aria-label={`${activeName}, ${order(sort)}`}
          aria-busy={sort === 'distance' && busy ? true : undefined}
          aria-disabled={disabled || undefined}
          onClick={() => onChoose(sort)}
        >
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeName}</span>
          <b aria-hidden="true" style={{ color: 'var(--primary-text)', fontWeight: 700 }}>{arrow}</b>
        </button>
      )}
      <button
        ref={trigger}
        type="button"
        // 44×44 target; after the inert default value its padding overlaps only that inert text, so the row stays compact.
        style={{ ...hit, minWidth: 44, justifyContent: 'center', padding: 0, flex: 'none', marginLeft: explicit ? 0 : -8 }}
        aria-label={t('search.sortOrder')}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Ic name="down" className="sm c2" />
      </button>
      {explicit && (
        <button
          type="button"
          style={{ ...hit, minWidth: 44, justifyContent: 'center', padding: 0, flex: 'none' }}
          aria-label={t('search.sortReset')}
          aria-disabled={disabled || undefined}
          onClick={onReset}
        >
          <Ic name="close" className="sm c2" />
        </button>
      )}
      {open && (
        <div
          ref={popover}
          role="group"
          aria-label={t('search.sortOrder')}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 4, width: 'max-content', minWidth: 176, maxWidth: 'calc(100vw - 24px)', padding: 4,
            background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow-md)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {([null, ...CRITERIA] as Array<ExplicitSort | null>).map((criterion) => {
            const active = criterion === null ? !explicit : criterion === sort;
            const name = criterion === null ? t('search.criterion.default') : t(`search.criterion.${criterion}` as 'search.criterion.price');
            return (
              <button
                key={criterion ?? 'default'}
                type="button"
                aria-pressed={active}
                aria-label={active && criterion !== null ? `${name}, ${order(criterion)}` : name}
                aria-busy={criterion === 'distance' && busy ? true : undefined}
                aria-disabled={disabled || undefined}
                onClick={() => {
                  // The default value is a regular item: it does nothing while it is the active one.
                  if (criterion === null) { if (explicit) onReset(); return; }
                  onChoose(criterion);
                }}
                style={{
                  boxSizing: 'border-box', minHeight: 44, padding: '0 12px', border: 0, font: 'inherit', textAlign: 'left', borderRadius: 8, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 20, fontSize: 15, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
                  fontWeight: active ? 700 : 500, background: active ? 'var(--primary-soft)' : 'transparent', color: active ? 'var(--primary-text)' : 'var(--ink)',
                }}
              >
                <span>{name}</span>
                {active && criterion !== null && <span aria-hidden="true" style={{ fontWeight: 700 }}>{arrow}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
