'use client';

import { useEffect, useId, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';

export const PHOTO_LIMIT = 5;
const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE_PX = 8;

export type PhotoTile = {
  key: string;
  id: string | null;
  previewUrl: string;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  error?: MessageKey;
  file?: File;
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

// Offer photos (offer-photos contract §2): each file uploads on its own with progress and retry; the first tile is
// the cover. Order changes by long press and drag, and equally by buttons, so dragging is never the only way.
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
  const gridRef = useRef<HTMLUListElement>(null);
  const press = useRef<{ key: string; x: number; y: number; timer: number } | null>(null);
  const draggingRef = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const requests = useRef(new Map<string, XMLHttpRequest>());

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

  function onPointerDown(event: ReactPointerEvent, key: string) {
    if (disabled || event.button !== 0) return;
    // Captured, so the drag keeps receiving moves and the release even outside the grid.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const timer = window.setTimeout(() => {
      setDraggingKey(key);
      setSelectedKey(key);
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
    press.current = { key, x: event.clientX, y: event.clientY, timer };
  }

  function onPointerMove(event: ReactPointerEvent) {
    const current = press.current;
    if (!current) return;
    if (!draggingRef.current) {
      // Moving before the long press completes is a scroll, not a drag.
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_TOLERANCE_PX) {
        window.clearTimeout(current.timer);
        press.current = null;
      }
      return;
    }
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-photo-key]');
    const overKey = over?.dataset.photoKey;
    if (!overKey || overKey === draggingRef.current) return;
    const to = tiles.findIndex((tile) => tile.key === overKey);
    reorder(draggingRef.current, to);
  }

  function endPress() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    // The release after a drag must not also toggle the selection through the button's click.
    if (draggingRef.current) suppressClick.current = true;
    setDraggingKey(null);
  }

  const selectedIndex = tiles.findIndex((tile) => tile.key === selectedKey);
  const selected = selectedIndex >= 0 ? tiles[selectedIndex] : undefined;
  const full = tiles.length >= PHOTO_LIMIT;
  const failed = tiles.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile.status === 'error');

  // AI-S09 · Editor · Media: 72 px tiles, the cover marked with a star, progress and error on the tile itself.
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-labelledby={`${ids}-title`}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="lbl" id={`${ids}-title`}>{t('photos.title')}</span>
        <span className="c num">{full ? `${tiles.length} из ${PHOTO_LIMIT} — максимум` : t('photos.counter', { count: tiles.length, limit: PHOTO_LIMIT })}</span>
      </div>

      <ul ref={gridRef} className="mrow" style={{ margin: 0, padding: 0, listStyle: 'none' }} onPointerMove={onPointerMove} onPointerUp={endPress} onPointerCancel={endPress}>
        {tiles.map((tile, index) => (
          <li key={tile.key} data-photo-key={tile.key} style={{ opacity: tile.key === draggingKey ? 0.6 : 1 }}>
            <button
              type="button"
              className={`mt img${tile.status === 'uploading' ? ' up' : ''}${tile.status === 'error' ? ' er' : ''}`}
              style={{ padding: 0, border: 0, cursor: 'pointer', outline: tile.key === selectedKey ? '2px solid var(--primary)' : undefined, outlineOffset: tile.key === selectedKey ? 2 : undefined }}
              onClick={() => {
                if (suppressClick.current) { suppressClick.current = false; return; }
                if (tile.status === 'error' && tile.file && tile.error === 'photos.errorUpload') { retry(tile); return; }
                setSelectedKey((current) => (current === tile.key ? null : tile.key));
              }}
              onPointerDown={(event) => onPointerDown(event, tile.key)}
              onContextMenu={(event) => event.preventDefault()}
              aria-pressed={tile.key === selectedKey}
              aria-label={index === 0 ? t('photos.tileCover', { position: index + 1 }) : t('photos.tile', { position: index + 1 })}
              disabled={disabled}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs and owner-only photo routes */}
              <img src={tile.previewUrl} alt="" draggable={false} />
              {index === 0 && <span className="cv star" role="img" aria-label={t('photos.cover')} title={t('photos.cover')}><span className="ic i-starf" /></span>}
              {tile.status === 'uploading' && (
                <div className="pb" role="progressbar" aria-label={t('photos.uploading')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tile.progress * 100)}>
                  <i style={{ width: `${Math.round(tile.progress * 100)}%` }} />
                </div>
              )}
              {tile.status === 'error' && (
                <div className="erl"><span className="ic i-refresh sm" />{tile.file && tile.error === 'photos.errorUpload' ? t('photos.retry') : t('photos.remove')}</div>
              )}
            </button>
          </li>
        ))}
        <li>
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

      {selected && (
        <div className="card p16" style={{ gap: 4, boxShadow: 'var(--shadow-md)' }} role="group" aria-label={t('photos.actionsFor', { position: selectedIndex + 1 })}>
          <div className="ov" style={{ padding: '4px 0 8px' }}>{t('photos.tile', { position: selectedIndex + 1 })}</div>
          {selectedIndex > 0 && (
            <button type="button" className="li" style={{ minHeight: 48, border: 0, background: 'none', padding: '8px 0' }} onClick={() => reorder(selected.key, 0)} disabled={disabled}>
              <span className="ic i-cover c2" /><div className="mid"><div className="ts">{t('photos.makeCover')}</div></div>
            </button>
          )}
          <div className="li" style={{ minHeight: 48 }}>
            <span className="ic i-drag c2" /><div className="mid"><div className="ts">Переместить</div></div>
            <button type="button" className="ib" style={{ width: 40, height: 40 }} onClick={() => reorder(selected.key, selectedIndex - 1)} disabled={disabled || selectedIndex === 0} aria-label={t('photos.moveLeft')}><span className="ic i-left sm" /></button>
            <button type="button" className="ib" style={{ width: 40, height: 40 }} onClick={() => reorder(selected.key, selectedIndex + 1)} disabled={disabled || selectedIndex === tiles.length - 1} aria-label={t('photos.moveRight')}><span className="ic i-right sm" /></button>
          </div>
          <button type="button" className="li" style={{ minHeight: 48, color: 'var(--danger)', border: 0, borderTop: '1px solid var(--line)', background: 'none', padding: '8px 0' }} onClick={() => remove(selected.key)} disabled={disabled}>
            <span className="ic i-trash" /><div className="mid"><div className="ts">{t('photos.remove')}</div></div>
          </button>
        </div>
      )}

      <p className="c">{tiles.length === 0 ? t('photos.emptyHint') : 'Удерживайте фото, чтобы изменить порядок.'}</p>
      {blockedMessage && <div className="fld" role="alert"><div className="emsg"><span className="ic i-alert" />{t(blockedMessage)}</div></div>}
      <p className="vh" aria-live="polite">{announcement}</p>
    </section>
  );
}
