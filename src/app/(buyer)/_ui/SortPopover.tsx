'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { NATURAL_SORT_DIRECTION, type SearchSortDirection, type SearchSortMode } from '../../../modules/search/contracts/search.contract';
import styles from './sort-popover.module.css';

// D2 visual baseline: B04.ST01–ST04 and the new KAIDA motion specification.
// Search semantics remain owned by search-sort-control-refresh: trigger = current direction;
// active explicit item = opposite direction; default has no direction; one choice closes the list.
type ExplicitSort = Exclude<SearchSortMode, 'relevance'>;
const CRITERIA: ExplicitSort[] = ['price', 'distance', 'actuality'];
const arrowOf = (direction: SearchSortDirection) => (direction === 'asc' ? '↑' : '↓');
const opposite = (direction: SearchSortDirection): SearchSortDirection => (direction === 'asc' ? 'desc' : 'asc');

// Exact paths from the new B04 canvas; no shared legacy icon changes.
function SortIcon({ chevron = false }: { chevron?: boolean }) {
  return (
    <svg className={chevron ? styles.chevron : styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={chevron ? 'M6 9l6 6 6-6' : 'M4 5h16l-6 8v5l-4 2v-7z'} />
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
  // A criterion chosen in the list: a different one starts in its natural direction, the active one reverses its direction.
  onChoose: (criterion: SearchSortMode) => void;
  // «По умолчанию» chosen in the list while an explicit sort is active: back to relevance without a direction.
  onReset: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [motion, setMotion] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const explicit = sort !== 'relevance';

  const close = useCallback((animate = true) => {
    setMotion(animate);
    setOpen(false);
    if (!animate) setMounted(false);
    trigger.current?.focus();
  }, []);

  // Keep the exiting layer inert; reopening cancels the old removal timer.
  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 120);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  // Focus goes in once when the list opens (to the active item) and returns to the trigger when it closes.
  useEffect(() => {
    if (!open) return;
    (popover.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? popover.current?.querySelector<HTMLElement>('button'))?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const phrase = (criterion: ExplicitSort, order: SearchSortDirection) => t(`search.order.${criterion}.${order}` as 'search.order.price.asc');
  const criterionName = (criterion: ExplicitSort) => t(`search.criterion.${criterion}` as 'search.criterion.price');
  // The row shows the state; its accessible name says the current state, not an action.
  const current = explicit ? `${criterionName(sort)}, ${phrase(sort, direction)}` : t('search.criterion.default');

  function select(criterion: ExplicitSort | null, animate: boolean) {
    if (disabled) return;
    close(animate);
    // The default value is a regular item: it does nothing while it is the active one.
    if (criterion === null) { if (explicit) onReset(); return; }
    onChoose(criterion);
  }

  return (
    <div ref={root} className={styles.root} data-motion={motion}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={t('search.sortCurrent', { value: current })}
        aria-haspopup="true"
        aria-expanded={open}
        aria-busy={sort === 'distance' && busy ? true : undefined}
        onClick={(event) => {
          const animate = event.detail > 0;
          if (open) { close(animate); return; }
          setMotion(animate);
          setMounted(true);
          setOpen(true);
        }}
      >
        <SortIcon />
        <span className={styles.label}>
          {explicit ? criterionName(sort) : t('search.criterion.default')}
        </span>
        {explicit && <b aria-hidden="true" className={styles.arrow}>{arrowOf(direction)}</b>}
        <SortIcon chevron />
      </button>
      {mounted && (
        <div
          ref={popover}
          role="group"
          aria-label={t('search.sortOrder')}
          aria-hidden={!open || undefined}
          inert={!open}
          data-state={open ? 'open' : 'closed'}
          className={styles.menu}
        >
          {([null, ...CRITERIA] as Array<ExplicitSort | null>).map((criterion) => {
            const active = criterion === null ? !explicit : criterion === sort;
            // What a click applies: the active explicit item reverses its direction, an inactive one starts in its natural direction.
            const applies = criterion === null ? null : active ? opposite(direction) : NATURAL_SORT_DIRECTION[criterion];
            const name = criterion === null ? t('search.criterion.default') : criterionName(criterion);
            return (
              <button
                key={criterion ?? 'default'}
                type="button"
                aria-pressed={active}
                aria-label={criterion === null || applies === null ? name : `${name}, ${t('search.sortApply', { order: phrase(criterion, applies) })}`}
                aria-busy={criterion === 'distance' && busy ? true : undefined}
                aria-disabled={disabled || undefined}
                onClick={(event) => select(criterion, event.detail > 0)}
                className={styles.item}
              >
                <span>{name}</span>
                {applies !== null && <span aria-hidden="true" style={{ fontWeight: 700 }}>{arrowOf(applies)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
