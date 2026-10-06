'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { SearchSortDirection, SearchSortMode } from '../../../modules/search/contracts/search.contract';
import { Ic } from '../../seller/_kaida/ui';

// Search sorting control UX refresh (docs/slices/search-sort-control-refresh): one compact row under the search field, no
// captions. Default (relevance): «Сортировка» + a list indicator. Explicit sort: the criterion with its direction arrow (a tap
// reverses the direction), a separate list trigger and × (reset to relevance). The list is the anchored popover of Rev 3 with
// three criteria; a choice applies at once, tapping the active one reverses its direction, and the list stays open after a choice
// and closes by a tap outside or `Esc`; focus moves in once on open and returns to the trigger (PROJECT_RULES.md §18.4 «Overlay»).
const CRITERIA: Array<Exclude<SearchSortMode, 'relevance'>> = ['actuality', 'price', 'distance'];

const pill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px', borderRadius: 999,
  border: '1px solid var(--line)', background: 'var(--raised)', color: 'var(--ink)', font: 'inherit', fontWeight: 600, cursor: 'pointer',
  minWidth: 0,
};

export function SortControl({ sort, direction, busy, disabled, onChoose, onReset }: {
  sort: SearchSortMode;
  direction: SearchSortDirection;
  // True while the browser geolocation requested by an explicit «По расстоянию» is pending.
  busy: boolean;
  // True while a search is in flight: a choice made then would be lost, so the controls wait (as the field does) — they stay
  // focusable (aria-disabled) so a keyboard user keeps their place.
  disabled: boolean;
  // A criterion chosen in the list or the active one tapped in the row (the active one reverses its direction).
  onChoose: (criterion: SearchSortMode) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const explicit = sort !== 'relevance';

  // Focus goes in once when the list opens (to the active criterion, else the first) and returns to the trigger when it closes.
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
    <div ref={root} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      {explicit ? (
        <>
          <button
            type="button"
            style={{ ...pill, flex: '0 1 auto', overflow: 'hidden' }}
            aria-label={`${activeName}, ${order(sort)}`}
            aria-busy={sort === 'distance' && busy ? true : undefined}
            aria-disabled={disabled || undefined}
            onClick={() => onChoose(sort)}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeName}</span>
            <span aria-hidden="true" style={{ fontWeight: 700 }}>{arrow}</span>
          </button>
          <button
            ref={trigger}
            type="button"
            className="ib"
            aria-label={t('search.sorting')}
            aria-haspopup="true"
            aria-expanded={open}
            title={t('search.sorting')}
            style={{ width: 44, flex: 'none' }}
            onClick={() => setOpen((current) => !current)}
          >
            <Ic name="down" />
          </button>
          <button
            type="button"
            className="ib"
            aria-label={t('search.sortReset')}
            aria-disabled={disabled || undefined}
            title={t('search.sortReset')}
            style={{ width: 44, flex: 'none' }}
            onClick={onReset}
          >
            <Ic name="close" />
          </button>
        </>
      ) : (
        <button
          ref={trigger}
          type="button"
          style={pill}
          aria-label={t('search.sorting')}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{t('search.sorting')}</span>
          <Ic name="down" />
        </button>
      )}
      {open && (
        <div
          ref={popover}
          role="group"
          aria-label={t('search.sorting')}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 4, width: 248, maxWidth: '100%', padding: 6,
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
                {active && <span aria-hidden="true" style={{ fontSize: 18, fontWeight: 700 }}>{arrow}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
