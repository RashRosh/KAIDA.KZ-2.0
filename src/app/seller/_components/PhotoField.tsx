'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';

export const PHOTO_LIMIT = 5;
const LONG_PRESS_MS = 300;
const LIFT_MS = 150;
const SETTLE_MS = 200;
const MOVE_TOLERANCE_PX = 8;
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const LIFT_SCALE = 1.08;

export type PhotoTile = {
  key: string;
  id: string | null;
  previewUrl: string;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  error?: MessageKey;
  file?: File;
};

type PhotoDrag = {
  key: string;
  li: HTMLElement;
  tile: HTMLElement;
  grabX: number;
  grabY: number;
  pointerX: number;
  pointerY: number;
  reduceMotion: boolean;
};

const uploadErrorKey: Record<string, MessageKey> = {
  PHOTO_UNSUPPORTED_TYPE: 'photos.errorType',
  PHOTO_TOO_LARGE: 'photos.errorLarge',
  PHOTO_TOO_SMALL: 'photos.errorSmall',
  PHOTO_UNATTACHED_LIMIT: 'photos.errorLimit',
};

export function readyTiles(photoIds: string[]): PhotoTile[] {
  return photoIds.map((id) => ({ key: id, id, previewUrl: photoUrl(id, 'thumb'), status: 'ready', progress: 1 }));
}

export function readyPhotoIds(tiles: PhotoTile[]): string[] {
  return tiles.flatMap((tile) => (tile.status === 'ready' && tile.id ? [tile.id] : []));
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Offer photos (offer-photos contract §2, seller-photo-tiles contract): each file uploads on its own with progress and
// retry; the first tile is the cover. Every ready tile carries ☆ (make cover) and × (delete); a tap opens the ← → micro-
// menu under the tile; a long press lifts the tile and it follows the finger, so dragging is never the only way.
export function PhotoField({ tiles, setTiles, disabled, blockedMessage }: {
  tiles: PhotoTile[];
  setTiles: Dispatch<SetStateAction<PhotoTile[]>>;
  disabled: boolean;
  blockedMessage?: MessageKey;
}) {
  const { t } = useI18n();
  const ids = useId();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [rowSize, setRowSize] = useState(4);
  const gridRef = useRef<HTMLUListElement>(null);
  const press = useRef<{ key: string; x: number; y: number; timer: number } | null>(null);
  const drag = useRef<PhotoDrag | null>(null);
  const draggingRef = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const layout = useRef(new Map<string, { left: number; top: number }>());
  const arrowFocus = useRef<'left' | 'right' | null>(null);

  useEffect(() => { draggingRef.current = draggingKey; }, [draggingKey]);

  // While a photo is lifted, a finger move drags it instead of scrolling the page.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const onTouchMove = (event: TouchEvent) => { if (draggingRef.current) event.preventDefault(); };
    grid.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => grid.removeEventListener('touchmove', onTouchMove);
  }, []);

  useEffect(() => {
    const pending = requests.current;
    return () => { for (const request of pending.values()) request.abort(); };
  }, []);

  // How many tiles fit in a row: the micro-menu goes under the row of the selected tile.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const first = grid.querySelector<HTMLElement>('[data-photo-key], [data-photo-add]');
      if (!first || first.offsetWidth === 0) return;
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 8;
      setRowSize(Math.max(1, Math.floor((grid.clientWidth + gap) / (first.offsetWidth + gap))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  // A tap outside the row (and its menu) closes the micro-menu.
  useEffect(() => {
    if (!selectedKey) return;
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || gridRef.current?.contains(event.target)) return;
      setSelectedKey(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [selectedKey]);

  // Tiles change places with a 200 ms spring (FLIP) — the lifted tile is moved by the finger instead.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const next = new Map<string, { left: number; top: number }>();
    const skip = reducedMotion();
    for (const li of grid.querySelectorAll<HTMLElement>('[data-photo-key]')) {
      const key = li.dataset.photoKey!;
      const now = { left: li.offsetLeft, top: li.offsetTop };
      next.set(key, now);
      const before = layout.current.get(key);
      if (skip || !before || key === draggingRef.current) continue;
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (dx !== 0 || dy !== 0) li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: SETTLE_MS, easing: SPRING });
    }
    layout.current = next;
    const held = drag.current;
    if (held) positionDraggedTile(held, held.pointerX, held.pointerY);
  });

  function patch(key: string, change: Partial<PhotoTile>) {
    setTiles((current) => current.map((tile) => (tile.key === key ? { ...tile, ...change } : tile)));
  }

  function upload(key: string, file: File) {
    const request = new XMLHttpRequest();
    requests.current.set(key, request);
    request.open('POST', '/api/seller/photos');
    request.responseType = 'json';
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) patch(key, { progress: event.loaded / event.total });
    };
    request.onload = () => {
      requests.current.delete(key);
      const body = request.response as { photo?: { id: string }; error?: { code?: string } } | null;
      if (request.status === 201 && body?.photo) {
        patch(key, { id: body.photo.id, status: 'ready', progress: 1, error: undefined, file: undefined });
      } else {
        patch(key, { status: 'error', error: uploadErrorKey[body?.error?.code ?? ''] ?? 'photos.errorUpload' });
      }
    };
    request.onerror = () => {
      requests.current.delete(key);
      patch(key, { status: 'error', error: 'photos.errorUpload' });
    };
    const form = new FormData();
    form.append('file', file);
    request.send(form);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = PHOTO_LIMIT - tiles.length;
    const added = [...files].slice(0, Math.max(0, room)).map((file): PhotoTile => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      id: null,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
      progress: 0,
      file,
    }));
    if (added.length === 0) return;
    setTiles((current) => [...current, ...added]);
    for (const tile of added) upload(tile.key, tile.file!);
  }

  function retry(tile: PhotoTile) {
    if (!tile.file) return;
    patch(tile.key, { status: 'uploading', progress: 0, error: undefined });
    upload(tile.key, tile.file);
  }

  function remove(key: string) {
    const removed = tiles.find((tile) => tile.key === key);
    if (removed?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl);
    requests.current.get(key)?.abort();
    requests.current.delete(key);
    setTiles((current) => current.filter((tile) => tile.key !== key));
    setSelectedKey(null);
    setAnnouncement(t('photos.removed'));
  }

  function reorder(key: string, to: number) {
    const from = tiles.findIndex((tile) => tile.key === key);
    if (from < 0 || to < 0 || to >= tiles.length || from === to) return;
    setTiles((current) => move(current, from, to));
    setAnnouncement(to === 0 ? t('photos.nowCover') : t('photos.movedTo', { position: to + 1 }));
  }

  function makeCover(key: string) {
    reorder(key, 0);
    setSelectedKey(null);
  }

  function onPointerDown(event: ReactPointerEvent, tile: PhotoTile) {
    if (disabled || event.button !== 0 || tile.status !== 'ready') return;
    // Captured, so the drag keeps receiving moves and the release even outside the grid.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const timer = window.setTimeout(() => lift(tile.key), LONG_PRESS_MS);
    press.current = { key: tile.key, x: event.clientX, y: event.clientY, timer };
  }

  // Hold done: the tile rises (scale 1.08 and a shadow, 150 ms), then follows the finger 1:1.
  function lift(key: string) {
    const current = press.current;
    const li = gridRef.current?.querySelector<HTMLElement>(`[data-photo-key="${CSS.escape(key)}"]`);
    const tile = li?.querySelector<HTMLElement>('.mt');
    if (!current || !li || !tile) return;
    const rect = tile.getBoundingClientRect();
    const reduceMotion = reducedMotion();
    drag.current = {
      key,
      li,
      tile,
      grabX: current.x - rect.left,
      grabY: current.y - rect.top,
      pointerX: current.x,
      pointerY: current.y,
      reduceMotion,
    };
    if (reduceMotion) {
      tile.style.transition = 'none';
      tile.style.transform = '';
    } else {
      tile.style.transition = `transform ${LIFT_MS}ms ease-out`;
      tile.style.transform = `scale(${LIFT_SCALE})`;
      window.setTimeout(() => { tile.style.transition = 'none'; }, LIFT_MS);
    }
    setDraggingKey(key);
    setSelectedKey(null);
    navigator.vibrate?.(10);
  }

  function positionDraggedTile(held: PhotoDrag, clientX: number, clientY: number) {
    held.pointerX = clientX;
    held.pointerY = clientY;
    if (held.reduceMotion) {
      held.tile.style.transform = '';
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;
    const box = grid.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top;
    held.tile.style.transform = `translate(${x - held.grabX - held.li.offsetLeft}px, ${y - held.grabY - held.li.offsetTop}px) scale(${LIFT_SCALE})`;
  }

  function onPointerMove(event: ReactPointerEvent) {
    const current = press.current;
    if (!current) return;
    const grid = gridRef.current;
    const held = drag.current;
    if (!held || !grid) {
      // Moving before the long press completes is a scroll, not a drag.
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_TOLERANCE_PX) {
        window.clearTimeout(current.timer);
        press.current = null;
      }
      return;
    }
    const box = grid.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    positionDraggedTile(held, event.clientX, event.clientY);
    // The slot under the finger (by layout, so slots that are still settling do not flip back and forth).
    for (const li of grid.querySelectorAll<HTMLElement>('[data-photo-key]')) {
      const key = li.dataset.photoKey!;
      if (key === held.key) continue;
      if (x >= li.offsetLeft && x <= li.offsetLeft + li.offsetWidth && y >= li.offsetTop && y <= li.offsetTop + li.offsetHeight) {
        reorder(held.key, tiles.findIndex((tile) => tile.key === key));
        break;
      }
    }
  }

  // Released: the tile settles into its slot in 200 ms; released outside the row it returns along the same path.
  function endPress() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    const held = drag.current;
    drag.current = null;
    if (held) {
      // The release after a drag must not also toggle the selection through the button's click.
      suppressClick.current = true;
      const from = held.tile.style.transform;
      held.tile.style.transition = '';
      held.tile.style.transform = '';
      if (!held.reduceMotion && from) held.tile.animate([{ transform: from }, { transform: 'none' }], { duration: SETTLE_MS, easing: 'ease-out' });
    }
    setDraggingKey(null);
  }

  function onTap(tile: PhotoTile) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    arrowFocus.current = null;
    if (tile.status === 'error') { if (tile.file && tile.error === 'photos.errorUpload') retry(tile); return; }
    if (tile.status !== 'ready') return;
    setSelectedKey((current) => (current === tile.key ? null : tile.key));
  }

  const selectedIndex = tiles.findIndex((tile) => tile.key === selectedKey);
  const selected = selectedIndex >= 0 && !draggingKey ? tiles[selectedIndex] : undefined;
  const full = tiles.length >= PHOTO_LIMIT;
  const failed = tiles.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile.status === 'error');
  // The micro-menu sits under the row that holds the selected tile.
  const menuAfter = selected ? Math.min(tiles.length - 1, (Math.floor(selectedIndex / rowSize) + 1) * rowSize - 1) : -1;
  const tileLabel = (index: number) => (index === 0 ? t('photos.tileCover', { position: index + 1 }) : t('photos.tile', { position: index + 1 }));

  // The menu moves with its photo, and the arrow the finger used keeps the focus after the photo changed place.
  useEffect(() => {
    if (!arrowFocus.current || !gridRef.current) return;
    const wanted = gridRef.current.querySelector<HTMLButtonElement>(`[data-arrow="${arrowFocus.current}"]`);
    const other = gridRef.current.querySelector<HTMLButtonElement>(`[data-arrow="${arrowFocus.current === 'left' ? 'right' : 'left'}"]`);
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [selectedIndex]);

  // AI-S09 · Editor · Media: 72 px tiles, the cover marked with a star, ☆ and × on the tile, progress and error on it too.
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-labelledby={`${ids}-title`}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="lbl" id={`${ids}-title`}>{t('photos.title')}</span>
        <span className="c num">{full ? `${tiles.length} из ${PHOTO_LIMIT} — максимум` : t('photos.counter', { count: tiles.length, limit: PHOTO_LIMIT })}</span>
      </div>

      <ul ref={gridRef} className="mrow" style={{ margin: 0, padding: 0, listStyle: 'none', position: 'relative' }} onPointerMove={onPointerMove} onPointerUp={endPress} onPointerCancel={endPress}
        onKeyDown={(event) => { if (event.key === 'Escape' && selectedKey) { event.stopPropagation(); setSelectedKey(null); } }}>
        {tiles.flatMap((tile, index) => {
          const ready = tile.status === 'ready';
          const label = tileLabel(index);
          const items = [(
            <li key={tile.key} data-photo-key={tile.key}>
              <div className={`mt img${tile.status === 'uploading' ? ' up' : ''}${tile.status === 'error' ? ' er' : ''}${tile.key === selectedKey && !draggingKey ? ' sel' : ''}${tile.key === draggingKey ? ' lift' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs and owner-only photo routes */}
                <img src={tile.previewUrl} alt="" draggable={false} />
                <button
                  type="button"
                  className="tap"
                  onPointerDown={(event) => onPointerDown(event, tile)}
                  onClick={() => onTap(tile)}
                  onContextMenu={(event) => event.preventDefault()}
                  aria-pressed={ready ? tile.key === selectedKey : undefined}
                  aria-label={label}
                  disabled={disabled}
                />
                {index === 0 && <span className="cv star" role="img" aria-label={t('photos.cover')} title={t('photos.cover')}><span className="ic i-starf" /></span>}
                {ready && index > 0 && (
                  <button type="button" className="cvb" aria-label={`${t('photos.makeCover')}: ${label}`} onClick={() => makeCover(tile.key)} disabled={disabled}>
                    <span className="ic i-star" />
                  </button>
                )}
                {ready && (
                  <button type="button" className="del" aria-label={`${t('photos.remove')}: ${label}`} onClick={() => remove(tile.key)} disabled={disabled}>
                    <span className="ic i-close" />
                  </button>
                )}
                {tile.status === 'uploading' && (
                  <div className="pb" role="progressbar" aria-label={t('photos.uploading')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tile.progress * 100)}>
                    <i style={{ width: `${Math.round(tile.progress * 100)}%` }} />
                  </div>
                )}
                {tile.status === 'error' && (
                  <div className="erl"><span className="ic i-refresh sm" />{tile.file && tile.error === 'photos.errorUpload' ? t('photos.retry') : t('photos.remove')}</div>
                )}
              </div>
            </li>
          )];
          if (index === menuAfter && selected) {
            const column = selectedIndex % rowSize;
            items.push(
              <li key="photo-menu" className="mpop-wrap" role="toolbar" aria-label={t('photos.orderToolbar', { position: selectedIndex + 1, count: tiles.length })}>
                <div className="mpop" style={{ left: `calc(${column} * (72px + 8px) + 36px)`, transform: 'translateX(-50%)' }}>
                  <button type="button" data-arrow="left" aria-label={t('photos.moveLeft')} disabled={disabled || selectedIndex === 0}
                    onClick={() => { arrowFocus.current = 'left'; reorder(selected.key, selectedIndex - 1); }}><span className="ic i-left sm" /></button>
                  <span className="sep" />
                  <button type="button" data-arrow="right" aria-label={t('photos.moveRight')} disabled={disabled || selectedIndex === tiles.length - 1}
                    onClick={() => { arrowFocus.current = 'right'; reorder(selected.key, selectedIndex + 1); }}><span className="ic i-right sm" /></button>
                </div>
              </li>,
            );
          }
          return items;
        })}
        <li data-photo-add>
          {full ? (
            <div className="mt add" style={{ color: 'var(--ink3)', borderColor: 'var(--line)' }} aria-disabled="true"><span className="ic i-plus" />Лимит</div>
          ) : (
            <label className="mt add" style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
              <input
                type="file"
                accept="image/*"
                multiple
                className="vh"
                aria-label={t('photos.add')}
                disabled={disabled}
                onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
              />
              <span className="ic i-camera" />Фото
            </label>
          )}
        </li>
      </ul>

      {failed.map(({ tile, index }) => (
        <div key={tile.key} className="fld">
          <div className="emsg">
            <span className="ic i-alert" />
            <span style={{ flex: 1 }}>{t(tile.error ?? 'photos.errorUpload')}</span>
            {!(tile.file && tile.error === 'photos.errorUpload') && (
              <button type="button" className="btn btn-g sm" style={{ height: 20, padding: 0 }} onClick={() => remove(tile.key)} disabled={disabled} aria-label={`${t('photos.remove')}: ${t('photos.tile', { position: index + 1 })}`}>{t('photos.remove')}</button>
            )}
          </div>
        </div>
      ))}

      <p className="c">{tiles.length === 0 ? t('photos.emptyHint') : 'Удерживайте фото, чтобы изменить порядок.'}</p>
      {blockedMessage && <div className="fld" role="alert"><div className="emsg"><span className="ic i-alert" />{t(blockedMessage)}</div></div>}
      <p className="vh" aria-live="polite">{announcement}</p>
    </section>
  );
}
