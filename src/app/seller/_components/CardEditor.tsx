'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { LOCATION_TYPES, type LocationType, type LocationView } from '../../../modules/locations/contracts/location.contract';
import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import type { OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import { PACK_UNIT_LABELS, PACK_UNITS, type PackUnit } from '../../../modules/offers/pack/pack';
import { PRICE_UNIT_LABELS } from '../../../modules/offers/price-unit/price-unit';
import type { SellerChangeSetView } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatAmount } from '../../_components/format-amount';
import { Bar, Check, ErrorLine, Ic, Phone, Radio, shakeErrors, Sheet, Toast, TOAST_MS } from '../_kaida/ui';
import { CommentTranslationAssist } from './CommentTranslationAssist';
import { PhotoField, readyPhotoIds, readyTiles, type PhotoTile } from './PhotoField';
import { pluralKey, type SellerCard } from './card-model';
import {
  createBody,
  draftPayload,
  emptyCardValues,
  FIELD_ORDER,
  keepsLink,
  normalizeAmount,
  packAllowed,
  priceError,
  sameCardValues,
  unitDraftFrom,
  updateBody,
  validateCard,
  valuesFromDraft,
  type CardErrors,
  type CardValues,
  type UnitCode,
  type UnitDraft,
} from './card-editor-state';
import { derivedSellerName } from './offer-editor-state';

export type CardEditorMode =
  | { kind: 'create'; draft: OfferDraftView | null }
  | { kind: 'edit'; card: SellerCard }
  | { kind: 'point'; card: SellerCard; offer: SellerOfferView };

// Values restored from a proposed ChangeSet after «Вернуться к правке».
export type CardEditorInitial = { values: Partial<CardValues>; photoIds?: string[] };

type ApiResult = { changeSet?: SellerChangeSetView; seller?: SellerView; location?: LocationView; draft?: OfferDraftView; error?: { code?: string } };
type Suggestion = { id: string; name: string };
type NewPoint = { name: string; addressText: string; type: LocationType; sellerName: string };

const UNIT_CODES: UnitCode[] = ['kg', 'liter', 'piece', 'package', 'other'];

function price(amount: string | null | undefined) {
  return amount ? `${formatAmount(amount)} ₸` : '';
}

// The saved amount as the Seller sees it in the field: «5 000», not «5000.00».
function formatInput(amount: string | null | undefined) {
  return amount ? formatAmount(amount).replace(/\u00a0/g, ' ') : '';
}

function startValues(mode: CardEditorMode, seller: SellerView | null, initial?: CardEditorInitial): CardValues {
  const base = emptyCardValues();
  const locations = seller?.locations ?? [];
  let values: CardValues;
  if (mode.kind === 'create') {
    values = mode.draft
      ? valuesFromDraft(mode.draft.payload, new Set(locations.map((location) => location.id)))
      : { ...base, points: locations.length === 1 ? { [locations[0]!.id]: { selected: true, ownPrice: null } } : {} };
  } else {
    const lead = mode.card.lead;
    values = {
      ...base,
      title: lead.product.name,
      productId: lead.product.id,
      linkedName: lead.product.id ? lead.product.name : null,
      amount: formatInput(mode.kind === 'point' ? mode.offer.price?.amount : mode.card.commonPrice ?? lead.price?.amount),
      unit: unitDraftFrom(lead.price?.unitChoice),
      packOpen: lead.pack !== null,
      packAmount: lead.pack?.amount ?? '',
      packUnit: lead.pack?.unit ?? 'g',
      comment: lead.sellerComment ?? '',
      applyPrice: Object.fromEntries(mode.card.offers.map((offer) => [offer.id, !offer.priceOwn])),
    };
  }
  return { ...values, ...initial?.values };
}

// AI-S09 in the «ИИ выключен» mode (seller-showcase-editor §2): one editor for a new card, a draft, a change in all
// points and the price of one point. Full screen on phones, a dialog on desktop; overlay rules PROJECT_RULES §18.4.
export function CardEditor({ mode, seller: initialSeller, initial, reopen, commentTranslationEnabled, onClose, onSaved, onReload }: {
  mode: CardEditorMode;
  seller: SellerView | null;
  initial?: CardEditorInitial;
  // Query that reopens this editor from the review page («Вернуться к правке»).
  reopen: string;
  commentTranslationEnabled: boolean;
  onClose: () => void;
  // A draft was saved or deleted: the showcase re-reads and closes the editor.
  onSaved: (kind: 'draftSaved' | 'draftDeleted') => void;
  // «Обновить» after a change from another device: re-read the card and reopen with the Seller's values on top.
  onReload: (values: CardValues, photoIds: string[]) => void;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const ids = useId();
  const [seller, setSeller] = useState<SellerView | null>(initialSeller);
  const locations = seller?.locations ?? [];
  const [start] = useState(() => startValues(mode, initialSeller, initial));
  const [values, setValues] = useState<CardValues>(start);
  const [startPhotoIds] = useState<string[]>(() => initial?.photoIds
    ?? (mode.kind === 'create' ? mode.draft?.payload.photoIds ?? [] : mode.card.lead.photos?.map((photo) => photo.id) ?? []));
  const [photos, setPhotos] = useState<PhotoTile[]>(() => readyTiles(startPhotoIds));
  const [photoBlock, setPhotoBlock] = useState<'photos.waitUpload' | 'photos.fixFailed' | null>(null);
  const [errors, setErrors] = useState<CardErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState<'send' | 'draft' | 'delete' | null>(null);
  const [failure, setFailure] = useState<'send' | 'draft' | 'conflict' | 'noChanges' | null>(null);
  const [overlay, setOverlay] = useState<'discard' | 'deleteDraft' | 'unit' | 'points' | null>(null);
  // Full-screen steps of the editor: the form, the per-point prices (AI-S11), one point's price, a new point.
  const [view, setView] = useState<'form' | 'prices' | 'newPoint' | { pricePoint: string }>('form');
  const [pointAdded, setPointAdded] = useState(false);
  const [newPoint, setNewPoint] = useState<NewPoint>({ name: '', addressText: '', type: 'shop', sellerName: '' });
  const [newPointErrors, setNewPointErrors] = useState<{ name?: boolean; address?: boolean }>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [titleFocused, setTitleFocused] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const requestCloseRef = useRef<() => void>(() => undefined);
  const busyRef = useRef(false);

  const isCreate = mode.kind === 'create';
  const isPoint = mode.kind === 'point';
  const draftId = mode.kind === 'create' ? mode.draft?.id ?? null : null;
  const currentPhotoIds = readyPhotoIds(photos);
  const photosChanged = photos.length !== startPhotoIds.length || currentPhotoIds.some((id, index) => id !== startPhotoIds[index]);
  const dirty = !sameCardValues(values, start) || photosChanged;
  const cardOffers = mode.kind === 'create' ? [] : mode.card.offers;
  const cardLocationIds = new Set(cardOffers.map((offer) => offer.location.id));
  // Options are chosen on mousedown, so choosing never blurs the field first.
  const suggestOpen = titleFocused && !suggestDismissed && suggestions.length > 0;

  function requestClose() {
    if (busyRef.current) return;
    if (overlay) setOverlay(null);
    else if (view !== 'form') setView('form');
    else if (dirty) setOverlay('discard');
    else onClose();
  }
  useEffect(() => { requestCloseRef.current = requestClose; });

  // Escape and the phone's Back close the top layer first, then ask before discarding changes.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); requestCloseRef.current(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Catalog suggestions while the Seller types (from 2 letters); a help, never a requirement.
  const suggestQuery = values.title.trim();
  useEffect(() => {
    if (isPoint || suggestQuery.length < 2 || (values.linkedName && keepsLink(suggestQuery, values.linkedName))) {
      const timer = window.setTimeout(() => setSuggestions([]), 0);
      return () => window.clearTimeout(timer);
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      void fetch(`/api/catalog/suggestions?${new URLSearchParams({ q: suggestQuery, locale })}`, { cache: 'no-store' })
        .then(async (response) => response.ok ? (await response.json() as { suggestions: Suggestion[] }).suggestions : [])
        .then((found) => { if (alive) { setSuggestions(found); setActiveSuggestion(-1); } })
        .catch(() => undefined);
    }, 200);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [suggestQuery, locale, isPoint, values.linkedName]);

  function update(patch: Partial<CardValues>) {
    setValues((current) => {
      const next = { ...current, ...patch };
      if (attempted) setErrors(validateCard(next, mode.kind, locations.length).errors);
      return next;
    });
    setFailure(null);
  }

  function setTitle(title: string) {
    const linked = keepsLink(title, values.linkedName);
    update({ title, ...(linked ? {} : { productId: null, linkedName: null }) });
    setSuggestDismissed(false);
  }

  // Focus moves after React has committed the change: an effect of this render runs after the closing sheet has
  // returned focus to its opener, so the requested field wins on a slow device as well.
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);
  const focusField = (id: string) => setFocusRequest((current) => ({ id, n: (current?.n ?? 0) + 1 }));
  useEffect(() => {
    if (focusRequest) document.getElementById(focusRequest.id)?.focus();
  }, [focusRequest]);

  function chooseSuggestion(suggestion: Suggestion) {
    update({ title: suggestion.name, productId: suggestion.id, linkedName: suggestion.name });
    setSuggestDismissed(true);
    setSuggestions([]);
    focusField(`${ids}-title`);
  }

  function onTitleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion((index) => (index + 1) % suggestions.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1)); }
    else if (event.key === 'Enter' && activeSuggestion >= 0) { event.preventDefault(); chooseSuggestion(suggestions[activeSuggestion]!); }
    else if (event.key === 'Escape') { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); setSuggestDismissed(true); }
  }

  function chooseUnit(code: UnitCode) {
    const unit: UnitDraft = { code, custom: code === 'other' ? values.unit.custom : '' };
    // Changing the unit away from a package or piece clears the pack.
    update({ unit, ...(packAllowed(code) ? { packOpen: code === 'package' ? true : values.packOpen } : { packOpen: false, packAmount: '' }) });
    setOverlay(null);
    focusField(code === 'other' ? `${ids}-custom` : `${ids}-unit`);
  }

  function togglePoint(locationId: string, selected: boolean) {
    const current = values.points[locationId];
    update({ points: { ...values.points, [locationId]: { selected, ownPrice: current?.ownPrice ?? null } } });
  }

  function toggleAllPoints(selected: boolean) {
    const available = locations.filter((location) => !cardLocationIds.has(location.id));
    update({ points: Object.fromEntries(available.map((location) => [location.id, { selected, ownPrice: values.points[location.id]?.ownPrice ?? null }])) });
  }

  function focusFirstError(found: CardErrors) {
    const field = FIELD_ORDER.find((key) => found[key]);
    const target = field === 'unit' && values.unit.code === 'other' ? `${ids}-custom` : field ? `${ids}-${field}` : null;
    if (target) focusField(target);
  }

  async function post(url: string, body: unknown, method = 'POST'): Promise<{ ok: boolean; data: ApiResult }> {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({})) as ApiResult;
    return { ok: response.ok, data };
  }

  function openReview(changeSetId: string) {
    const next = new URLSearchParams({ back: '/seller', reopen });
    router.push(`/seller/change-sets/${changeSetId}?${next.toString()}`);
  }

  function fail(code: string | undefined) {
    if (code === 'OFFER_CHANGED') setFailure('conflict');
    else if (code === 'OFFER_UPDATE_NO_CHANGES') setFailure('noChanges');
    else if (code === 'CARD_POINT_ALREADY_ADDED') setErrors((current) => ({ ...current, points: 'card.pointExists' }));
    else setFailure('send');
    busyRef.current = false;
    setBusy(null);
  }

  async function send(resetPrice = false) {
    if (busyRef.current) return;
    shakeErrors();
    setAttempted(true);
    const { errors: found, payload } = validateCard(values, mode.kind, locations.length);
    const pointPriceProblem = isPoint && !resetPrice ? priceError(values.amount) : null;
    setErrors(isPoint ? (pointPriceProblem ? { price: pointPriceProblem } : {}) : found);
    if (isPoint ? pointPriceProblem : !payload) {
      focusFirstError(found);
      return;
    }
    const pending = photos.some((tile) => tile.status === 'uploading') ? 'photos.waitUpload'
      : photos.some((tile) => tile.status === 'error') ? 'photos.fixFailed' : null;
    setPhotoBlock(pending);
    if (pending) {
      requestAnimationFrame(() => document.getElementById(`${ids}-photos`)?.scrollIntoView({ block: 'center' }));
      return;
    }
    busyRef.current = true;
    setBusy('send');
    setFailure(null);
    try {
      const request = mode.kind === 'create'
        ? post('/api/seller/cards/change-sets', createBody(values, payload!, currentPhotoIds, draftId))
        : mode.kind === 'edit'
          ? post(`/api/seller/cards/${mode.card.cardId}/change-sets`, updateBody(values, payload!, currentPhotoIds, mode.card.offers))
          : post(`/api/seller/offers/${mode.offer.id}/price-change-sets`, {
            revision: mode.offer.revision,
            price: resetPrice ? null : normalizeAmount(values.amount),
          });
      const { ok, data } = await request;
      if (ok && data.changeSet) {
        openReview(data.changeSet.id);
        return;
      }
      fail(data.error?.code);
    } catch {
      fail(undefined);
    }
  }

  async function saveDraft() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy('draft');
    setFailure(null);
    try {
      const body = draftPayload(values, currentPhotoIds);
      const { ok } = await post(draftId ? `/api/seller/drafts/${draftId}` : '/api/seller/drafts', body, draftId ? 'PUT' : 'POST');
      busyRef.current = false;
      setBusy(null);
      if (ok) onSaved('draftSaved');
      else setFailure('draft');
    } catch {
      busyRef.current = false;
      setBusy(null);
      setFailure('draft');
    }
  }

  async function deleteDraft() {
    if (!draftId || busyRef.current) return;
    busyRef.current = true;
    setBusy('delete');
    try {
      const { ok } = await post(`/api/seller/drafts/${draftId}`, undefined, 'DELETE');
      busyRef.current = false;
      setBusy(null);
      if (ok) onSaved('draftDeleted');
      else { setOverlay(null); setFailure('draft'); }
    } catch {
      busyRef.current = false;
      setBusy(null);
      setOverlay(null);
      setFailure('draft');
    }
  }

  // Point creation over the editor (existing S3 flow); the new point comes back selected.
  async function savePoint() {
    const found = { name: newPoint.name.trim() === '', address: newPoint.addressText.trim() === '' };
    setNewPointErrors(found);
    if (found.name || found.address || busyRef.current) return;
    busyRef.current = true;
    setBusy('send');
    try {
      const location = { name: newPoint.name, type: newPoint.type, addressText: newPoint.addressText };
      let created: LocationView | undefined;
      if (!seller) {
        const { ok, data } = await post('/api/seller/setup', { seller: { displayName: derivedSellerName(newPoint.sellerName, newPoint.name) }, location });
        if (ok && data.seller) { setSeller(data.seller); created = data.seller.locations[0]; }
      } else {
        const { ok, data } = await post('/api/seller/locations', location);
        if (ok && data.location) { const made = data.location; setSeller((current) => current ? { ...current, locations: [...current.locations, made] } : current); created = made; }
      }
      busyRef.current = false;
      setBusy(null);
      if (!created) { setFailure('send'); return; }
      update({ points: { ...values.points, [created.id]: { selected: true, ownPrice: null } } });
      setNewPoint({ name: '', addressText: '', type: 'shop', sellerName: '' });
      setView('form');
      setPointAdded(true);
      window.setTimeout(() => setPointAdded(false), TOAST_MS);
    } catch {
      busyRef.current = false;
      setBusy(null);
      setFailure('send');
    }
  }

  const unitLabel = (code: UnitDraft['code'], custom: string) => code === '' ? ''
    : code === 'other' ? custom.trim() || t('card.unitOther') : code === 'piece' ? 'шт.' : PRICE_UNIT_LABELS[locale][code];
  const errorCount = Object.keys(errors).length;
  const selectedPoints = Object.entries(values.points).filter(([, point]) => point.selected);
  const commonAmount = normalizeAmount(values.amount);
  const commonPriceText = price(commonAmount) || '—';
  const packShown = packAllowed(values.unit.code) && values.packOpen;
  const available = locations.filter((location) => !cardLocationIds.has(location.id));
  const willChange = mode.kind === 'edit' ? mode.card.offers.length : 0;
  const willCreate = mode.kind === 'edit' ? selectedPoints.filter(([id]) => !cardLocationIds.has(id)).length : selectedPoints.length;
  const disabled = busy !== null;
  const pointOffer = mode.kind === 'point' ? mode.offer : null;
  const lead = mode.kind === 'create' ? null : mode.card.lead;
  const common = mode.kind === 'point' ? mode.card.commonPrice : null;
  const title = mode.kind === 'point' ? t('card.pointTitle') : mode.kind === 'edit' ? t('card.editTitle') : draftId ? t('card.draftTitle') : t('card.createTitle');
  const err = (field: keyof CardErrors) => errors[field] ? `${ids}-${field}-error` : undefined;
  const hasOwnPrice = selectedPoints.some(([, point]) => point.ownPrice !== null);

  // ---- Full-screen steps ----
  if (view === 'newPoint') {
    return (
      <Phone>
        <Bar title={t('card.newPoint')} onBack={() => setView('form')} backLabel="Назад к карточке" />
        <main className="body" style={{ gap: 14 }}>
          <div className="fld">
            <label htmlFor={`${ids}-point-name`}>Название для покупателей</label>
            <input id={`${ids}-point-name`} className={`inp${newPointErrors.name ? ' er' : ''}`} value={newPoint.name} maxLength={120} autoComplete="off" autoFocus
              placeholder="Например, Зелёный базар, ряд 4" aria-invalid={newPointErrors.name || undefined}
              onChange={(event) => { setNewPoint((current) => ({ ...current, name: event.target.value })); setNewPointErrors((current) => ({ ...current, name: false })); }} disabled={disabled} />
            {newPointErrors.name && <ErrorLine>{t('points.nameRequired')}</ErrorLine>}
          </div>
          <div className="fld">
            <label htmlFor={`${ids}-point-address`}>Где находится точка</label>
            <input id={`${ids}-point-address`} className={`inp${newPointErrors.address ? ' er' : ''}`} value={newPoint.addressText} maxLength={500} autoComplete="off"
              placeholder="Адрес, рынок, павильон" aria-invalid={newPointErrors.address || undefined}
              onChange={(event) => { setNewPoint((current) => ({ ...current, addressText: event.target.value })); setNewPointErrors((current) => ({ ...current, address: false })); }} disabled={disabled} />
            {newPointErrors.address && <ErrorLine>{t('points.addressRequired')}</ErrorLine>}
          </div>
          <div className="fld">
            <label htmlFor={`${ids}-point-type`}>{t('point.type')}</label>
            <select id={`${ids}-point-type`} className="inp" value={newPoint.type} onChange={(event) => setNewPoint((current) => ({ ...current, type: event.target.value as LocationType }))} disabled={disabled}>
              {LOCATION_TYPES.map((type) => <option key={type} value={type}>{t(`points.type.${type}`)}</option>)}
            </select>
          </div>
          {!seller && (
            <div className="fld">
              <label htmlFor={`${ids}-seller-name`}>{t('point.sellerName')} <span className="req">· необязательно</span></label>
              <input id={`${ids}-seller-name`} className="inp" value={newPoint.sellerName} maxLength={120} autoComplete="organization"
                onChange={(event) => setNewPoint((current) => ({ ...current, sellerName: event.target.value }))} disabled={disabled} />
              <span className="hint">{t('point.sellerNameHint')}</span>
              {derivedSellerName(newPoint.sellerName, newPoint.name) && (
                <span className="hint" aria-live="polite">{t('point.sellerNamePreview', { name: derivedSellerName(newPoint.sellerName, newPoint.name) })}</span>
              )}
            </div>
          )}
          <p className="c c2">{t('card.pointLater')}</p>
          {failure === 'send' && <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14 }}><p className="c c2">{t('card.sendErrorText')}</p></div>}
        </main>
        <div className="foot">
          <button type="button" className="btn btn-p lg w" onClick={() => void savePoint()} disabled={disabled}>{busy ? <><span className="spin" />Сохраняем…</> : t('card.savePoint')}</button>
        </div>
      </Phone>
    );
  }

  if (view === 'prices') {
    return (
      <Phone>
        <Bar title="Цены по точкам" onBack={() => setView('form')} backLabel="Назад к карточке" />
        <main className="body" style={{ gap: 12 }}>
          <div className="card p16" style={{ gap: 6, background: 'var(--sunken)', border: 0 }}>
            <div className="ov">Общие для всех точек</div>
            <div className="ts">{values.title.trim() || '—'}</div>
            <div><span className="pr">{commonPriceText}</span> <span className="c2">{unitLabel(values.unit.code, values.unit.custom) ? `/ ${unitLabel(values.unit.code, values.unit.custom)}` : ''}</span></div>
            <p className="c">{[photos.length > 0 ? `${photos.length} фото` : 'без фото', values.comment.trim() ? 'комментарий' : 'без комментария'].join(' · ')}</p>
          </div>
          {selectedPoints.map(([locationId, point]) => {
            const location = locations.find((item) => item.id === locationId);
            if (!location) return null;
            const own = point.ownPrice !== null;
            return (
              <button key={locationId} type="button" className={`card${own ? ' hl' : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onClick={() => setView({ pricePoint: locationId })}>
                <Ic name="pin" className={own ? 'pt' : 'c2'} />
                <div style={{ flex: 1 }}>
                  <div className="ts">{location.name}</div>
                  {own
                    ? <p className="c c2"><span className="bd bd-p" style={{ height: 20, verticalAlign: 1 }}>Своё</span> Цена <b className="num" style={{ color: 'var(--ink)' }}>{price(normalizeAmount(point.ownPrice ?? ''))}</b>{unitLabel(values.unit.code, values.unit.custom) ? ` / ${unitLabel(values.unit.code, values.unit.custom)}` : ''}</p>
                    : <p className="c">Как у всех</p>}
                </div>
                <Ic name="right" className="c2" />
              </button>
            );
          })}
          <p className="c c2"><Ic name="layers" className="xs" style={{ verticalAlign: -3 }} /> {t(pluralKey('card.willCreate', selectedPoints.length), { count: selectedPoints.length })}</p>
        </main>
        <div className="foot"><button type="button" className="btn btn-p lg w" onClick={() => setView('form')}>Готово</button></div>
      </Phone>
    );
  }

  if (typeof view === 'object') {
    const location = locations.find((item) => item.id === view.pricePoint);
    const point = values.points[view.pricePoint];
    const setOwn = (ownPrice: string | null) => update({ points: { ...values.points, [view.pricePoint]: { selected: true, ownPrice } } });
    return (
      <Phone>
        <Bar title={location?.name ?? ''} onBack={() => setView('prices')} />
        <main className="body" style={{ gap: 18 }}>
          <div className="fld"><div className="fl">Название товара</div><div className="inp dis">{values.title.trim() || '—'}</div><span className="hint">Название общее для всех точек. Другой товар — отдельная карточка.</span></div>
          <div className="fld">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><label htmlFor={`${ids}-own`} style={{ flex: 1 }}>Цена</label>{point?.ownPrice !== null && <span className="bd bd-p">Своё значение</span>}</div>
            <div className="inp num"><input id={`${ids}-own`} value={point?.ownPrice ?? values.amount} inputMode="decimal" autoFocus
              onChange={(event) => setOwn(event.target.value)} aria-invalid={errors.ownPrice && point?.ownPrice !== null ? true : undefined} /><span className="c2">₸</span></div>
            {point?.ownPrice !== null && (
              <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setOwn(null)}><Ic name="history" className="sm" />Вернуть общее значение · {commonPriceText}</button>
            )}
          </div>
          <div className="fld"><div style={{ display: 'flex', alignItems: 'center' }}><div className="fl" style={{ flex: 1 }}>Цена за</div><span className="c">Общее</span></div><div className="inp dis">{unitLabel(values.unit.code, values.unit.custom) || '—'}</div></div>
          <div className="fld"><div style={{ display: 'flex', alignItems: 'center' }}><div className="fl" style={{ flex: 1 }}>Фото</div><span className="c">Общее · {photos.length} фото</span></div></div>
          <div className="fld"><div style={{ display: 'flex', alignItems: 'center' }}><div className="fl" style={{ flex: 1 }}>Комментарий</div><span className="c">Общее</span></div><div className="inp ta dis">{values.comment.trim() || '—'}</div></div>
        </main>
        <div className="foot"><button type="button" className="btn btn-p lg w" onClick={() => {
          if (point?.ownPrice !== null && normalizeAmount(point?.ownPrice ?? '') === commonAmount) setOwn(null);
          setView('prices');
        }}>Сохранить</button></div>
      </Phone>
    );
  }

  // ---- The form ----
  const unitText = unitLabel(values.unit.code, values.unit.custom);
  return (
    <Phone>
      <Bar title={title} onBack={requestClose} backDisabled={busy === 'send'} backLabel={busy === 'send' ? 'Назад недоступно во время отправки' : 'Назад'} />
      <main className="body" style={{ gap: pointOffer ? 16 : 20, opacity: busy === 'send' ? 0.55 : 1 }} aria-busy={busy === 'send'}>
        {failure && failure !== 'noChanges' && (
          <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14, gap: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Ic name="alert" className="dn" />
              <div style={{ flex: 1 }}>
                <div className="ts">{failure === 'conflict' ? t('card.changedElsewhere') : failure === 'draft' ? t('card.draftError') : t('card.sendError')}</div>
                {failure === 'send' && <p className="c c2">{t('card.sendErrorText')}</p>}
              </div>
            </div>
            {failure === 'conflict' && (
              <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} onClick={() => onReload(values, currentPhotoIds)}><Ic name="refresh" className="sm" />{t('card.reload')}</button>
            )}
          </div>
        )}
        {failure === 'noChanges' && (
          <div className="banner gray" role="alert" style={{ padding: 12, borderRadius: 14, flexDirection: 'row', gap: 10 }}><Ic name="info" className="c2" /><p className="c c2" style={{ flex: 1 }}>{t('card.noChanges')}</p></div>
        )}
        {attempted && errorCount > 0 && (
          <div className="banner err" role="alert" style={{ padding: 12, borderRadius: 14, flexDirection: 'row', gap: 10 }}>
            <Ic name="alert" className="dn" />
            <div style={{ flex: 1 }}><div className="ts">{t(pluralKey('card.summary', errorCount), { count: errorCount })}</div><p className="c c2">{t('card.summaryHint')}</p></div>
          </div>
        )}

        {pointOffer && lead ? (
          <>
            <div className="banner soft" style={{ padding: '12px 14px', borderRadius: 14, flexDirection: 'row', gap: 10 }}>
              <Ic name="pin" className="pt" />
              <p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{t('card.pointOnly', { name: pointOffer.location.name, count: cardOffers.length - 1 })}</p>
            </div>
            <div className="fld"><div className="fl">Название товара</div><div className="inp dis">{lead.product.name}{lead.packLabel ? ` · ${lead.packLabel}` : ''}</div><span className="hint">Название общее для всех точек</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div className="fld">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><label htmlFor={`${ids}-price`} style={{ flex: 1 }}>{t('card.price')}</label></div>
                <div className={`inp num${errors.price ? ' er' : ''}`}>
                  <input id={`${ids}-price`} value={values.amount} onChange={(event) => update({ amount: event.target.value })} inputMode="decimal" autoComplete="off"
                    aria-invalid={errors.price ? true : undefined} aria-describedby={[err('price'), `${ids}-price-previous`].filter(Boolean).join(' ')} disabled={disabled} />
                  <span className="c2">₸</span>
                </div>
                {pointOffer.priceOwn && <span className="bd bd-p">Своя цена</span>}
                {pointOffer.price && <span className="hint" id={`${ids}-price-previous`}>{t('card.pricePrevious', { price: price(pointOffer.price.amount) })}</span>}
                {errors.price && <ErrorLine id={err('price')}>{t(errors.price)}</ErrorLine>}
              </div>
              <div className="fld"><div className="fl">Цена за</div><div className="inp dis"><span style={{ flex: 1 }}>{lead.price?.unit ?? '—'}</span><Ic name="down" className="c2" /></div></div>
            </div>
            {pointOffer.priceOwn && common && (
              <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => void send(true)} disabled={disabled}>
                <Ic name="history" className="sm" />{t('card.resetPrice', { price: price(common) })}
              </button>
            )}
            <div className="fld"><div className="fl">Комментарий <span className="req">· необязательно</span></div><div className="inp ta dis" style={{ minHeight: 64 }}>{lead.sellerComment ?? t('showcase.noComment')}</div></div>
          </>
        ) : (
          <>
            <div id={`${ids}-photos`}>
              <PhotoField tiles={photos} setTiles={(next) => { setPhotos(next); setPhotoBlock(null); setFailure(null); }} disabled={disabled} blockedMessage={photoBlock ?? undefined} />
            </div>

            <div className="fld" style={{ position: 'relative' }}>
              <label htmlFor={`${ids}-title`}>{t('card.name')}</label>
              <input
                id={`${ids}-title`}
                className={`inp${errors.title ? ' er' : ''}`}
                value={values.title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={onTitleKey}
                onBlur={() => setTitleFocused(false)}
                onFocus={() => setTitleFocused(true)}
                placeholder={t('card.namePlaceholder')}
                maxLength={80}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestOpen}
                aria-controls={`${ids}-suggestions`}
                aria-activedescendant={activeSuggestion >= 0 ? `${ids}-suggestion-${activeSuggestion}` : undefined}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={err('title')}
                disabled={disabled}
              />
              {suggestOpen && (
                <ul id={`${ids}-suggestions`} role="listbox" aria-label={t('card.suggestions')} className="card"
                  style={{ position: 'absolute', top: 78, left: 0, right: 0, zIndex: 2, margin: 0, padding: '4px 0', listStyle: 'none', gap: 0, boxShadow: 'var(--shadow-md)' }}>
                  {suggestions.map((suggestion, index) => (
                    <li key={suggestion.id} id={`${ids}-suggestion-${index}`} role="option" aria-selected={index === activeSuggestion} className="li"
                      style={{ minHeight: 48, padding: '8px 12px', cursor: 'pointer', background: index === activeSuggestion ? 'var(--primary-soft)' : undefined }}
                      onMouseDown={(event) => { event.preventDefault(); chooseSuggestion(suggestion); }}>
                      <Ic name="search" className="c2 sm" /><div className="mid"><div className="ts">{suggestion.name}</div></div>
                    </li>
                  ))}
                </ul>
              )}
              {mode.kind === 'edit' && cardOffers.length > 1 && <span className="hint">{t('card.shared')}</span>}
              {errors.title && <ErrorLine id={err('title')}>{t(errors.title)}</ErrorLine>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, alignItems: 'start' }}>
              <div className="fld">
                <label htmlFor={`${ids}-price`}>{t('card.price')}</label>
                <div className={`inp num${errors.price ? ' er' : ''}`}>
                  <input id={`${ids}-price`} value={values.amount} onChange={(event) => update({ amount: event.target.value })} inputMode="decimal" autoComplete="off"
                    placeholder={t('card.pricePlaceholder')} aria-invalid={errors.price ? true : undefined}
                    aria-describedby={[err('price'), mode.kind === 'edit' ? `${ids}-price-previous` : ''].filter(Boolean).join(' ') || undefined} disabled={disabled} />
                  <span className="c2">₸</span>
                </div>
                {mode.kind === 'edit' && mode.card.commonPrice && <span className="hint" id={`${ids}-price-previous`}>{t('card.pricePrevious', { price: price(mode.card.commonPrice) })}</span>}
                {errors.price && <ErrorLine id={err('price')}>{t(errors.price)}</ErrorLine>}
              </div>
              <div className="fld">
                <label htmlFor={`${ids}-unit`}>{t('card.unit')}</label>
                <button id={`${ids}-unit`} type="button" className={`inp${errors.unit && values.unit.code === '' ? ' er' : ''}${overlay === 'unit' ? ' foc' : ''}`}
                  aria-haspopup="dialog" aria-invalid={errors.unit && values.unit.code === '' ? true : undefined}
                  aria-describedby={errors.unit && values.unit.code === '' ? err('unit') : undefined} onClick={() => setOverlay('unit')} disabled={disabled}>
                  <span style={{ flex: 1, textAlign: 'left' }} className={unitText ? undefined : 'c2'}>{unitText || t('card.unitChoose')}</span><Ic name="down" className="c2" />
                </button>
                {errors.unit && values.unit.code === '' && <ErrorLine id={err('unit')}>{t(errors.unit)}</ErrorLine>}
              </div>
            </div>

            {values.unit.code === 'other' && (
              <div className="fld">
                <label htmlFor={`${ids}-custom`}>{t('card.customUnit')}</label>
                <input id={`${ids}-custom`} className={`inp${errors.unit ? ' er' : ''}`} value={values.unit.custom} maxLength={20} autoComplete="off"
                  placeholder={t('card.customUnitPlaceholder')} onChange={(event) => update({ unit: { code: 'other', custom: event.target.value } })}
                  aria-invalid={errors.unit ? true : undefined} aria-describedby={[err('unit'), `${ids}-custom-hint`].filter(Boolean).join(' ')} disabled={disabled} />
                <span className="hint" id={`${ids}-custom-hint`}>{t('card.customUnitRule')}</span>
                {errors.unit && <ErrorLine id={err('unit')}>{t(errors.unit)}</ErrorLine>}
              </div>
            )}

            {packAllowed(values.unit.code) && (packShown ? (
              <div className="fld">
                <label htmlFor={`${ids}-pack`}>{t('card.pack')} <span className="req">· необязательно</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id={`${ids}-pack`} className={`inp num${errors.pack ? ' er' : ''}`} style={{ flex: 1 }} value={values.packAmount} onChange={(event) => update({ packAmount: event.target.value })}
                    inputMode="decimal" autoComplete="off" aria-label={t('card.packAmount')} aria-invalid={errors.pack ? true : undefined} aria-describedby={err('pack')} disabled={disabled} />
                  <select className="inp" style={{ width: 112 }} aria-label={t('card.packUnit')} value={values.packUnit} onChange={(event) => update({ packUnit: event.target.value as PackUnit })} disabled={disabled}>
                    {PACK_UNITS.map((unit) => <option key={unit} value={unit}>{PACK_UNIT_LABELS[locale][unit]}</option>)}
                  </select>
                </div>
                {values.packAmount.trim() && (
                  <span className="hint">{t('card.packPreview', { name: `${values.title.trim() || '…'} · ${values.packAmount.trim()} ${PACK_UNIT_LABELS[locale][values.packUnit]}`, price: `${commonPriceText} / ${values.unit.code === 'package' ? 'упаковка' : 'шт.'}` })}</span>
                )}
                {errors.pack && <ErrorLine id={err('pack')}>{t(errors.pack)}</ErrorLine>}
              </div>
            ) : (
              <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => update({ packOpen: true })} disabled={disabled}>
                <Ic name="plus" className="sm" />{t('card.packAdd')}
              </button>
            ))}

            <div className="fld">
              <label className="fl" htmlFor={`${ids}-comment`}>{t('card.comment')} <span className="req">· необязательно</span></label>
              <div className="inp ta" style={{ flexDirection: 'column', gap: 8 }}>
                <textarea id={`${ids}-comment`} value={values.comment} onChange={(event) => update({ comment: event.target.value })} maxLength={500} rows={2}
                  placeholder={t('card.commentPlaceholder')} disabled={disabled} style={{ width: '100%', resize: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="btn sm dis" disabled aria-describedby={`${ids}-dictate`}><Ic name="mic" className="sm" />{t('card.dictate')}</button>
                  <span className="c" id={`${ids}-dictate`}>{t('source.unavailable')}</span>
                </div>
              </div>
              <CommentTranslationAssist enabled={commentTranslationEnabled} comment={values.comment} />
            </div>

            {mode.kind === 'create' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} id={`${ids}-points`} tabIndex={-1}>
                <span className="lbl">{t('card.points')}</span>
                {selectedPoints.length === 0 ? (
                  <button type="button" className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, border: errors.points ? '2px solid var(--danger)' : undefined }}
                    onClick={() => (locations.length === 0 ? setView('newPoint') : setOverlay('points'))} disabled={disabled} aria-describedby={err('points')}>
                    <Ic name="plus" className="pt" />
                    <div style={{ flex: 1 }}>
                      <div className="ts pt">{locations.length === 0 ? t('card.pointAdd') : 'Выбрать торговые точки'}</div>
                      <p className="c">{locations.length === 0 ? t('card.pointsNone') : t('card.pointsChoose')}</p>
                    </div>
                  </button>
                ) : (
                  <button type="button" className={`card${pointAdded ? ' hl' : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onClick={() => setOverlay('points')} disabled={disabled}>
                    <Ic name="pin" className="pt" />
                    <div style={{ flex: 1 }}>
                      <div className="ts">{selectedPoints.length === 1
                        ? locations.find((location) => location.id === selectedPoints[0]![0])?.name
                        : `${selectedPoints.length} из ${locations.length} точек`}</div>
                      <p className="c">{selectedPoints.length === 1
                        ? (pointAdded ? 'Новая точка · выбрана' : locations.length === 1 ? 'Выбрана автоматически' : locations.find((location) => location.id === selectedPoints[0]![0])?.addressText)
                        : selectedPoints.map(([id]) => locations.find((location) => location.id === id)?.name).filter(Boolean).join(' · ')}</p>
                    </div>
                    <Ic name="right" className="c2" />
                  </button>
                )}
                {errors.points && <div className="fld"><ErrorLine id={err('points')}>{t(errors.points)}</ErrorLine></div>}
                {selectedPoints.length > 0 && (
                  <p className="c c2"><Ic name="layers" className="xs" style={{ verticalAlign: -3 }} /> {t(pluralKey('card.willCreate', selectedPoints.length), { count: selectedPoints.length })}</p>
                )}
                {selectedPoints.length > 1 && (
                  <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setView('prices')} disabled={disabled}>
                    {hasOwnPrice ? 'Цены по точкам · есть своя цена' : t('card.setPrices')}
                  </button>
                )}
                {errors.ownPrice && <div className="fld"><ErrorLine>{t(errors.ownPrice)}</ErrorLine></div>}
              </section>
            )}

            {mode.kind === 'edit' && (
              <section className="card p16" style={{ gap: 6 }} id={`${ids}-points`} tabIndex={-1}>
                <div className="ts">{cardOffers.length > 1 ? t('card.alsoChange') : t('card.points')}</div>
                {cardOffers.map((offer) => {
                  const checked = values.applyPrice[offer.id] ?? true;
                  const now = offer.price?.amount ?? null;
                  const changing = checked && now && commonAmount && Number(now) !== Number(commonAmount);
                  return (
                    <label key={offer.id} className="li" style={{ minHeight: 48, cursor: cardOffers.length > 1 ? 'pointer' : 'default' }}>
                      <Check checked={checked} onChange={(next) => update({ applyPrice: { ...values.applyPrice, [offer.id]: next } })} label={offer.location.name} disabled={disabled || cardOffers.length === 1} />
                      <div className="mid">
                        <div className="ts">{offer.location.name}</div>
                        {!checked && offer.priceOwn
                          ? <p className="c num"><span className="bd bd-p" style={{ height: 20 }}>{t('card.ownPriceKept', { price: price(now) })}</span> не меняется</p>
                          : <p className="c num">{changing ? `${formatAmount(now!)} → ${price(commonAmount)}` : price(now)}</p>}
                      </div>
                    </label>
                  );
                })}
                {available.length > 0 && (
                  <>
                    <div className="ov" style={{ marginTop: 8 }}>{t('card.addToPoints')}</div>
                    {available.map((location) => (
                      <label key={location.id} className="li" style={{ minHeight: 48, cursor: 'pointer' }}>
                        <Check checked={values.points[location.id]?.selected ?? false} onChange={(next) => togglePoint(location.id, next)} label={location.name} disabled={disabled} />
                        <div className="mid"><div className="ts">{location.name}</div><p className="c">{location.addressText}</p></div>
                      </label>
                    ))}
                  </>
                )}
                {errors.points && <ErrorLine>{t(errors.points)}</ErrorLine>}
                <p className="c c2">
                  {t(pluralKey('card.willChange', willChange), { count: willChange })}
                  {willCreate > 0 && <> · {t(pluralKey('card.willCreate', willCreate), { count: willCreate })}</>}
                </p>
              </section>
            )}

            {draftId && (
              <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0, color: 'var(--danger)' }} onClick={() => setOverlay('deleteDraft')} disabled={disabled}>
                <Ic name="trash" className="sm" />{t('card.deleteDraft')}
              </button>
            )}
          </>
        )}
      </main>

      {pointAdded && <Toast bottom={isCreate ? 150 : 96}>{t('card.pointAdded')}</Toast>}

      <div className="foot">
        {busy === 'send' ? (
          <>
            <button type="button" className="btn btn-p lg w" aria-disabled="true"><span className="spin" />{t('card.sending')}</button>
            <p className="c" style={{ textAlign: 'center' }}>Не закрывайте приложение пару секунд</p>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-p lg w" onClick={() => void send()} disabled={disabled}>
              {failure === 'send' ? <><Ic name="refresh" className="sm" />{t('editor.retry')}</> : isCreate ? t('card.review') : t('card.reviewEdit')}
            </button>
            {isCreate && (
              <button type="button" className="btn btn-g w" onClick={() => void saveDraft()} disabled={disabled}>{busy === 'draft' ? t('card.savingDraft') : t('card.saveDraft')}</button>
            )}
          </>
        )}
      </div>

      {overlay === 'unit' && (
        <Sheet title={t('card.unit')} onClose={() => setOverlay(null)}>
          <div role="radiogroup" aria-label={t('card.unit')} style={{ display: 'flex', flexDirection: 'column' }}>
            {UNIT_CODES.map((code) => (
              <button key={code} type="button" className="li" role="radio" aria-checked={values.unit.code === code} onClick={() => chooseUnit(code)}
                data-autofocus={values.unit.code === code || (values.unit.code === '' && code === 'kg') ? true : undefined}>
                <Radio on={values.unit.code === code} />
                <div className="mid"><div className="ts">{code === 'other' ? t('card.unitOther') : code === 'piece' ? 'шт.' : PRICE_UNIT_LABELS[locale][code]}</div><p className="c">{t(`card.unitHint.${code}`)}</p></div>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {overlay === 'points' && (
        <Sheet title={t('card.points')} onClose={() => setOverlay(null)} closeButton={false}>
          {locations.length > 1 && <p className="c c2">{t('card.pointsChoose')}</p>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {locations.length > 1 && (
              <label className="li" style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                <Check checked={selectedPoints.length === locations.length} indeterminate={selectedPoints.length > 0 && selectedPoints.length < locations.length}
                  onChange={(next) => toggleAllPoints(next)} label={t('card.pointsAll')} />
                <div className="mid"><div className="ts">{t('card.pointsAll')}</div></div>
                <span className="c num">{selectedPoints.length === 0 ? locations.length : `${selectedPoints.length} из ${locations.length}`}</span>
              </label>
            )}
            {locations.map((location) => (
              <label key={location.id} className="li" style={{ cursor: 'pointer' }}>
                <Check checked={values.points[location.id]?.selected ?? false} onChange={(next) => togglePoint(location.id, next)} label={location.name} />
                <div className="mid"><div className="ts">{location.name}</div><p className="c">{location.addressText}</p></div>
              </label>
            ))}
          </div>
          {locations.length === 1 && values.points[locations[0]!.id]?.selected && (
            <div className="banner gray" style={{ padding: '10px 12px', borderRadius: 12, flexDirection: 'row', gap: 8 }}><Ic name="info" className="sm c2" /><p className="c c2">{t('card.pointAuto')}</p></div>
          )}
          {(selectedPoints.length === 0 || locations.length === 1) && (
            <button type="button" className="li" style={{ color: 'var(--primary-text)' }} onClick={() => { setOverlay(null); setView('newPoint'); }}>
              <Ic name="plus" /><div className="mid"><div className="ts">{t('card.pointAdd')}</div></div>
            </button>
          )}
          {selectedPoints.length > 1 ? (
            <div className="banner soft" style={{ padding: '10px 12px', borderRadius: 12, gap: 4 }}>
              <div className="ts"><Ic name="layers" className="sm" style={{ verticalAlign: -4 }} /> {t(pluralKey('card.willCreate', selectedPoints.length), { count: selectedPoints.length })}</div>
              <p className="c c2">{selectedPoints.length === locations.length ? 'По одной на каждую точку' : 'Одинаковые данные для всех'}</p>
            </div>
          ) : selectedPoints.length === 1 ? (
            <p className="t" style={{ fontWeight: 500 }}><Ic name="layers" className="sm" style={{ verticalAlign: -4 }} /> {t(pluralKey('card.willCreate', 1), { count: 1 })}</p>
          ) : null}
          {selectedPoints.length > 1 && (
            <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => { setOverlay(null); setView('prices'); }}>{t('card.setPrices')}</button>
          )}
          <button type="button" className={`btn btn-p lg w${selectedPoints.length === 0 ? ' dis' : ''}`} disabled={selectedPoints.length === 0} aria-describedby={selectedPoints.length === 0 ? `${ids}-why` : undefined} onClick={() => setOverlay(null)}>Готово</button>
          {selectedPoints.length === 0 && <p className="c" id={`${ids}-why`} style={{ textAlign: 'center' }}>{t('card.pointChoose')}</p>}
        </Sheet>
      )}

      {overlay === 'discard' && (
        <Sheet title={t('card.discardTitle')} onClose={() => setOverlay(null)} role="alertdialog" closeButton={false} describedBy={`${ids}-discard`}>
          <p className="t c2" id={`${ids}-discard`}>{t('card.discardText')}</p>
          <button type="button" className="btn btn-p lg w" onClick={() => setOverlay(null)} data-autofocus>{t('card.keep')}</button>
          {isCreate && <button type="button" className="btn btn-o w" onClick={() => void saveDraft()}>{t('card.saveDraft')}</button>}
          <button type="button" className="btn btn-g w" style={{ color: 'var(--danger)' }} onClick={onClose}>{t('card.close')}</button>
        </Sheet>
      )}

      {overlay === 'deleteDraft' && (
        <Sheet title={t('card.deleteDraftTitle')} onClose={() => setOverlay(null)} role="alertdialog" closeButton={false} describedBy={`${ids}-delete`}>
          <p className="t c2" id={`${ids}-delete`}>{t('card.deleteDraftText')}</p>
          <button type="button" className="btn btn-p lg w" onClick={() => setOverlay(null)} data-autofocus>{t('card.keep')}</button>
          <button type="button" className="btn btn-do w" onClick={() => void deleteDraft()}>{t('card.delete')}</button>
        </Sheet>
      )}
    </Phone>
  );
}
