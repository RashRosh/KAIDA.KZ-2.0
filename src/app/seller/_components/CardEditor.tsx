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
import { LanguageSwitch } from '../../_components/LanguageSwitch';
import { formatAmount } from '../../_components/OfferCard';
import styles from './offer-editor.module.css';
import card from './card-editor.module.css';
import { CabinetIcon } from './SellerCabinetFrame';
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

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
const UNIT_CODES: UnitCode[] = ['kg', 'liter', 'piece', 'package', 'other'];

function price(amount: string | null | undefined) {
  return amount ? `${formatAmount(amount)} ₸` : '';
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
      amount: mode.kind === 'point' ? mode.offer.price?.amount ?? '' : mode.card.commonPrice ?? lead.price?.amount ?? '',
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
  const [overlay, setOverlay] = useState<'discard' | 'deleteDraft' | 'unit' | 'point' | null>(null);
  const [pricesOpen, setPricesOpen] = useState(() => Object.values(start.points).some((point) => point.ownPrice !== null));
  const [pointAdded, setPointAdded] = useState(false);
  const [newPoint, setNewPoint] = useState<NewPoint>({ name: '', addressText: '', type: 'shop', sellerName: '' });
  const [newPointErrors, setNewPointErrors] = useState<{ name?: boolean; address?: boolean }>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [titleFocused, setTitleFocused] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const unitButtonRef = useRef<HTMLButtonElement>(null);
  const requestCloseRef = useRef<() => void>(() => undefined);
  const overlayRef = useRef(overlay);
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
    else if (dirty) setOverlay('discard');
    else onClose();
  }
  useEffect(() => { requestCloseRef.current = requestClose; });
  useEffect(() => { overlayRef.current = overlay; }, [overlay]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>('input:not([readonly]):not([type="file"]), textarea')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const scope = overlayRef.current ? dialog.querySelector<HTMLElement>('[data-overlay="true"]') ?? dialog : dialog;
      const focusable = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
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

  function chooseSuggestion(suggestion: Suggestion) {
    update({ title: suggestion.name, productId: suggestion.id, linkedName: suggestion.name });
    setSuggestDismissed(true);
    setSuggestions([]);
    requestAnimationFrame(() => document.getElementById(`${ids}-title`)?.focus());
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
    requestAnimationFrame(() => (code === 'other' ? document.getElementById(`${ids}-custom`) : unitButtonRef.current)?.focus());
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
    requestAnimationFrame(() => { if (target) document.getElementById(target)?.focus(); });
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
      setOverlay(null);
      setPointAdded(true);
    } catch {
      busyRef.current = false;
      setBusy(null);
      setFailure('send');
    }
  }

  const unitLabel = (code: UnitDraft['code'], custom: string) => code === '' ? ''
    : code === 'other' ? custom.trim() || t('card.unitOther') : PRICE_UNIT_LABELS[locale][code];
  const errorCount = Object.keys(errors).length;
  const describedBy = (field: keyof CardErrors, extra?: string) => [errors[field] ? `${ids}-${field}-error` : '', extra ?? ''].filter(Boolean).join(' ') || undefined;
  const title = mode.kind === 'point' ? t('card.pointTitle') : mode.kind === 'edit' ? t('card.editTitle') : draftId ? t('card.draftTitle') : t('card.createTitle');
  const selectedPoints = Object.entries(values.points).filter(([, point]) => point.selected);
  const commonPriceText = price(normalizeAmount(values.amount)) || '—';
  const packShown = packAllowed(values.unit.code) && values.packOpen;
  const buyerName = packShown && values.packAmount.trim()
    ? `${values.title.trim() || '…'} · ${values.packAmount.trim()} ${PACK_UNIT_LABELS[locale][values.packUnit]}` : null;
  const available = locations.filter((location) => !cardLocationIds.has(location.id));
  const willChange = mode.kind === 'edit' ? mode.card.offers.length : 0;
  const willCreate = mode.kind === 'edit' ? selectedPoints.filter(([id]) => !cardLocationIds.has(id)).length : selectedPoints.length;
  const disabled = busy !== null;
  const pointOffer = mode.kind === 'point' ? mode.offer : null;
  const lead = mode.kind === 'create' ? null : mode.card.lead;
  const common = mode.kind === 'point' ? mode.card.commonPrice : null;

  return (
    <div className={styles.backdrop} onClick={requestClose}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`${ids}-heading`} aria-busy={busy === 'send'} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <button type="button" className={styles.iconButton} data-mobile-only="true" onClick={requestClose} aria-label={t('card.close')} disabled={disabled}>
            <CabinetIcon name="back" />
          </button>
          <h2 id={`${ids}-heading`} tabIndex={-1}>{title}</h2>
          <LanguageSwitch />
          <button type="button" className={styles.iconButton} data-desktop-only="true" onClick={requestClose} aria-label={t('card.close')} disabled={disabled}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <form id={`${ids}-form`} className={styles.body} onSubmit={(event) => { event.preventDefault(); void send(); }} noValidate>
          {failure && (
            <div className={styles.banner} role="alert">
              <strong>{failure === 'conflict' ? t('card.changedElsewhere') : failure === 'noChanges' ? t('card.noChanges') : failure === 'draft' ? t('card.draftError') : t('card.sendError')}</strong>
              {failure === 'send' && <span>{t('card.sendErrorText')}</span>}
              {failure === 'conflict' && (
                <button type="button" className={styles.secondary} onClick={() => onReload(values, currentPhotoIds)}><CabinetIcon name="retry" />{t('card.reload')}</button>
              )}
            </div>
          )}
          {attempted && errorCount > 0 && (
            <p className={styles.summary} role="alert">
              <CabinetIcon name="alert" />
              <span className={card.summaryText}><strong>{t(pluralKey('card.summary', errorCount), { count: errorCount })}</strong><span>{t('card.summaryHint')}</span></span>
            </p>
          )}

          {pointOffer ? (
            <>
              <p className={card.pointOnly}>{t('card.pointOnly', { name: pointOffer.location.name, count: cardOffers.length - 1 })}</p>
              <dl className={card.sharedRows}>
                <div><dt>{t('card.name')}</dt><dd>{lead?.product.name}{lead?.packLabel ? ` · ${lead.packLabel}` : ''}</dd></div>
                <div><dt>{t('card.unit')}</dt><dd>{lead?.price?.unit ?? '—'}</dd></div>
                <div><dt>{t('card.comment')}</dt><dd>{lead?.sellerComment ?? t('showcase.noComment')}</dd></div>
              </dl>
              <p className={styles.hint}>{t('card.shared')}</p>
            </>
          ) : (
            <>
              <div id={`${ids}-photos`} className={styles.field}>
                <PhotoField
                  tiles={photos}
                  setTiles={(next) => { setPhotos(next); setPhotoBlock(null); setFailure(null); }}
                  disabled={disabled}
                  blockedMessage={photoBlock ?? undefined}
                />
              </div>

              <div className={`${styles.field} ${card.suggestWrap}`}>
                <label htmlFor={`${ids}-title`}>{t('card.name')}</label>
                <input
                  id={`${ids}-title`}
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
                  aria-describedby={describedBy('title', mode.kind === 'edit' && cardOffers.length > 1 ? `${ids}-title-shared` : undefined)}
                  disabled={disabled}
                />
                {suggestOpen && (
                  <ul id={`${ids}-suggestions`} className={card.suggestions} role="listbox" aria-label={t('card.suggestions')}>
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={suggestion.id}
                        id={`${ids}-suggestion-${index}`}
                        role="option"
                        aria-selected={index === activeSuggestion}
                        className={card.suggestion}
                        onMouseDown={(event) => { event.preventDefault(); chooseSuggestion(suggestion); }}
                      >
                        {suggestion.name}
                      </li>
                    ))}
                  </ul>
                )}
                {mode.kind === 'edit' && cardOffers.length > 1 && <p id={`${ids}-title-shared`} className={styles.hint}>{t('card.shared')}</p>}
                {errors.title && <p id={`${ids}-title-error`} className={styles.fieldError}>{t(errors.title)}</p>}
              </div>
            </>
          )}

          <div className={card.priceRow}>
            <div className={styles.field}>
              <label htmlFor={`${ids}-price`}>{pointOffer ? `${t('card.price')} · ${pointOffer.location.name}` : t('card.price')}</label>
              <div className={styles.priceWrap}>
                <input
                  id={`${ids}-price`}
                  value={values.amount}
                  onChange={(event) => update({ amount: event.target.value })}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t('card.pricePlaceholder')}
                  aria-invalid={errors.price ? true : undefined}
                  aria-describedby={describedBy('price', mode.kind !== 'create' ? `${ids}-price-previous` : undefined)}
                  disabled={disabled}
                />
                <span className={styles.currency} aria-hidden="true">₸</span>
              </div>
              {mode.kind === 'edit' && mode.card.commonPrice && (
                <p id={`${ids}-price-previous`} className={styles.hint}>{t('card.pricePrevious', { price: price(mode.card.commonPrice) })}</p>
              )}
              {pointOffer?.price && (
                <p id={`${ids}-price-previous`} className={styles.hint}>{t('card.pricePrevious', { price: price(pointOffer.price.amount) })}</p>
              )}
              {errors.price && <p id={`${ids}-price-error`} className={styles.fieldError}>{t(errors.price)}</p>}
            </div>
            {!pointOffer && (
              <div className={styles.field}>
                <span className={card.label} id={`${ids}-unit-label`}>{t('card.unit')}</span>
                <button
                  ref={unitButtonRef}
                  id={`${ids}-unit`}
                  type="button"
                  className={card.unitButton}
                  aria-haspopup="dialog"
                  aria-labelledby={`${ids}-unit-label ${ids}-unit`}
                  aria-invalid={errors.unit && values.unit.code === '' ? true : undefined}
                  aria-describedby={values.unit.code === '' ? describedBy('unit') : undefined}
                  onClick={() => setOverlay('unit')}
                  disabled={disabled}
                >
                  {unitLabel(values.unit.code, values.unit.custom) || t('card.unitChoose')}
                </button>
                {errors.unit && values.unit.code === '' && <p id={`${ids}-unit-error`} className={styles.fieldError}>{t(errors.unit)}</p>}
              </div>
            )}
          </div>

          {pointOffer && pointOffer.priceOwn && common && (
            <button type="button" className={styles.linkButton} onClick={() => void send(true)} disabled={disabled}>
              {t('card.resetPrice', { price: price(common) })}
            </button>
          )}

          {!pointOffer && values.unit.code === 'other' && (
            <div className={styles.field}>
              <label htmlFor={`${ids}-custom`}>{t('card.customUnit')}</label>
              <input
                id={`${ids}-custom`}
                value={values.unit.custom}
                onChange={(event) => update({ unit: { code: 'other', custom: event.target.value } })}
                maxLength={20}
                placeholder={t('card.customUnitPlaceholder')}
                autoComplete="off"
                aria-invalid={errors.unit ? true : undefined}
                aria-describedby={describedBy('unit', `${ids}-custom-hint`)}
                disabled={disabled}
              />
              <p id={`${ids}-custom-hint`} className={styles.hint}>{t('card.customUnitRule')}</p>
              {errors.unit && <p id={`${ids}-unit-error`} className={styles.fieldError}>{t(errors.unit)}</p>}
            </div>
          )}

          {!pointOffer && packAllowed(values.unit.code) && (
            packShown ? (
              <div className={styles.field}>
                <label htmlFor={`${ids}-pack`}>{t('card.pack')} <span className={styles.optional}>· {t('editor.optional')}</span></label>
                <div className={card.packRow}>
                  <input
                    id={`${ids}-pack`}
                    value={values.packAmount}
                    onChange={(event) => update({ packAmount: event.target.value })}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={t('card.packAmount')}
                    aria-invalid={errors.pack ? true : undefined}
                    aria-describedby={describedBy('pack')}
                    disabled={disabled}
                  />
                  <select aria-label={t('card.packUnit')} value={values.packUnit} onChange={(event) => update({ packUnit: event.target.value as PackUnit })} disabled={disabled}>
                    {PACK_UNITS.map((unit) => <option key={unit} value={unit}>{PACK_UNIT_LABELS[locale][unit]}</option>)}
                  </select>
                </div>
                {buyerName && (
                  <p className={styles.hint}>{t('card.packPreview', { name: buyerName, price: `${commonPriceText} / ${unitLabel(values.unit.code, '')}` })}</p>
                )}
                {errors.pack && <p id={`${ids}-pack-error`} className={styles.fieldError}>{t(errors.pack)}</p>}
              </div>
            ) : (
              <button type="button" className={styles.linkButton} onClick={() => update({ packOpen: true })} disabled={disabled}>
                <CabinetIcon name="plus" />{t('card.packAdd')}
              </button>
            )
          )}

          {!pointOffer && (
            <div className={styles.field}>
              <label htmlFor={`${ids}-comment`}>{t('card.comment')} <span className={styles.optional}>· {t('editor.optional')}</span></label>
              <textarea
                id={`${ids}-comment`}
                value={values.comment}
                onChange={(event) => update({ comment: event.target.value })}
                maxLength={500}
                rows={3}
                placeholder={t('card.commentPlaceholder')}
                disabled={disabled}
              />
              <div className={card.dictate}>
                <button type="button" disabled aria-describedby={`${ids}-dictate-off`}>{t('card.dictate')}</button>
                <span id={`${ids}-dictate-off`}>{t('source.unavailable')}</span>
              </div>
              <CommentTranslationAssist enabled={commentTranslationEnabled} comment={values.comment} />
            </div>
          )}

          {mode.kind === 'create' && (
            <fieldset id={`${ids}-points`} className={card.points} tabIndex={-1} aria-describedby={describedBy('points')}>
              <legend>{t('card.points')}</legend>
              {locations.length === 0 && <p className={styles.hint}>{t('card.pointsNone')}</p>}
              {locations.length === 1 && values.points[locations[0]!.id]?.selected && (
                <div className={card.pointChosen}>
                  <strong>{locations[0]!.name}</strong>
                  <span>{locations[0]!.addressText}</span>
                  <span className={styles.hint}>{t('card.pointAuto')}</span>
                </div>
              )}
              {(locations.length > 1 || (locations.length === 1 && !values.points[locations[0]!.id]?.selected)) && (
                <>
                  <p className={styles.hint}>{t('card.pointsChoose')}</p>
                  {locations.length > 1 && (
                    <label className={card.pointOption}>
                      <input type="checkbox" checked={selectedPoints.length === locations.length} onChange={(event) => toggleAllPoints(event.target.checked)} disabled={disabled} />
                      <span><strong>{t('card.pointsAll')}</strong> <span className={styles.hint}>{selectedPoints.length} / {locations.length}</span></span>
                    </label>
                  )}
                  {locations.map((location) => (
                    <label key={location.id} className={card.pointOption}>
                      <input type="checkbox" checked={values.points[location.id]?.selected ?? false} onChange={(event) => togglePoint(location.id, event.target.checked)} disabled={disabled} />
                      <span><strong>{location.name}</strong><span className={styles.hint}>{location.addressText}</span></span>
                    </label>
                  ))}
                </>
              )}
              {pointAdded && <p className={card.added} role="status">{t('card.pointAdded')}</p>}
              <button type="button" className={styles.linkButton} onClick={() => setOverlay('point')} disabled={disabled}>
                <CabinetIcon name="plus" />{t('card.pointAdd')}
              </button>
              {errors.points && <p id={`${ids}-points-error`} className={styles.fieldError}>{t(errors.points)}</p>}
              {selectedPoints.length > 0 && <p className={card.count}>{t(pluralKey('card.willCreate', selectedPoints.length), { count: selectedPoints.length })}</p>}
              {selectedPoints.length > 1 && (
                <>
                  <button type="button" className={styles.linkButton} aria-expanded={pricesOpen} onClick={() => setPricesOpen((open) => !open)} disabled={disabled}>
                    {t('card.setPrices')}
                  </button>
                  {pricesOpen && (
                    <div className={card.perPoint}>
                      <p className={styles.hint}>{t('card.sharedFields')}</p>
                      {selectedPoints.map(([locationId, point]) => {
                        const location = locations.find((item) => item.id === locationId);
                        if (!location) return null;
                        const own = point.ownPrice !== null;
                        return (
                          <div key={locationId} className={card.perPointRow}>
                            <strong>{location.name}</strong>
                            {own ? (
                              <>
                                <div className={styles.priceWrap}>
                                  <input
                                    value={point.ownPrice ?? ''}
                                    onChange={(event) => update({ points: { ...values.points, [locationId]: { selected: true, ownPrice: event.target.value } } })}
                                    inputMode="decimal"
                                    aria-label={t('card.ownPriceFor', { name: location.name })}
                                    aria-invalid={errors.ownPrice && !(Number(normalizeAmount(point.ownPrice ?? '')) > 0) ? true : undefined}
                                    disabled={disabled}
                                  />
                                  <span className={styles.currency} aria-hidden="true">₸</span>
                                </div>
                                <button type="button" className={styles.linkButton} onClick={() => update({ points: { ...values.points, [locationId]: { selected: true, ownPrice: null } } })} disabled={disabled}>
                                  {t('card.resetPrice', { price: commonPriceText })}
                                </button>
                              </>
                            ) : (
                              <>
                                <span className={styles.hint}>{t('card.samePrice')} · {commonPriceText}</span>
                                <button type="button" className={styles.linkButton} onClick={() => update({ points: { ...values.points, [locationId]: { selected: true, ownPrice: normalizeAmount(values.amount) } } })} disabled={disabled}>
                                  {t('card.ownPrice')}
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {errors.ownPrice && <p className={styles.fieldError}>{t(errors.ownPrice)}</p>}
                    </div>
                  )}
                </>
              )}
            </fieldset>
          )}

          {mode.kind === 'edit' && (
            <fieldset id={`${ids}-points`} className={card.points} tabIndex={-1}>
              <legend>{cardOffers.length > 1 ? t('card.alsoChange') : t('card.points')}</legend>
              {cardOffers.map((offer) => {
                const checked = values.applyPrice[offer.id] ?? true;
                const now = offer.price?.amount ?? null;
                const next = normalizeAmount(values.amount);
                const text = checked
                  ? (now && next && Number(now) !== Number(next) ? `${formatAmount(now)} → ${price(next)}` : price(now))
                  : offer.priceOwn ? t('card.ownPriceKept', { price: price(now) }) : price(now);
                return (
                  <label key={offer.id} className={card.pointOption}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => update({ applyPrice: { ...values.applyPrice, [offer.id]: event.target.checked } })}
                      disabled={disabled || cardOffers.length === 1}
                    />
                    <span><strong>{offer.location.name}</strong><span className={styles.hint}>{text}</span></span>
                  </label>
                );
              })}
              {available.length > 0 && (
                <>
                  <p className={card.subLegend}>{t('card.addToPoints')}</p>
                  {available.map((location) => (
                    <label key={location.id} className={card.pointOption}>
                      <input type="checkbox" checked={values.points[location.id]?.selected ?? false} onChange={(event) => togglePoint(location.id, event.target.checked)} disabled={disabled} />
                      <span><strong>{location.name}</strong><span className={styles.hint}>{location.addressText}</span></span>
                    </label>
                  ))}
                </>
              )}
              {errors.points && <p className={styles.fieldError}>{t(errors.points)}</p>}
              <p className={card.count}>
                {t(pluralKey('card.willChange', willChange), { count: willChange })}
                {willCreate > 0 && <> · {t(pluralKey('card.willCreate', willCreate), { count: willCreate })}</>}
              </p>
            </fieldset>
          )}

          {draftId && (
            <button type="button" className={`${styles.linkButton} ${card.danger}`} onClick={() => setOverlay('deleteDraft')} disabled={disabled}>{t('card.deleteDraft')}</button>
          )}
        </form>

        <footer className={styles.footer}>
          <div className={styles.footerActions}>
            {isCreate ? (
              <button type="button" className={styles.secondary} onClick={() => void saveDraft()} disabled={disabled}>
                {busy === 'draft' ? t('card.savingDraft') : t('card.saveDraft')}
              </button>
            ) : (
              <button type="button" className={styles.secondary} data-desktop-only="true" onClick={requestClose} disabled={disabled}>{t('editor.cancel')}</button>
            )}
            <button type="submit" form={`${ids}-form`} className={styles.primary} disabled={disabled} aria-busy={busy === 'send'}>
              {failure === 'send' && busy === null && <CabinetIcon name="retry" />}
              {busy === 'send' ? t('card.sending') : failure === 'send' ? t('editor.retry') : isCreate ? t('card.review') : t('card.reviewEdit')}
            </button>
          </div>
        </footer>

        {overlay === 'unit' && (
          <div className={card.sheetBackdrop} onClick={() => setOverlay(null)}>
            <div className={card.sheet} data-overlay="true" role="dialog" aria-modal="true" aria-labelledby={`${ids}-unit-sheet`} onClick={(event) => event.stopPropagation()}>
              <h3 id={`${ids}-unit-sheet`}>{t('card.unit')}</h3>
              <ul className={card.unitList}>
                {UNIT_CODES.map((code) => (
                  <li key={code}>
                    <button type="button" className={card.unitOption} aria-pressed={values.unit.code === code} onClick={() => chooseUnit(code)} autoFocus={values.unit.code === code || (values.unit.code === '' && code === 'kg')}>
                      <strong>{code === 'other' ? t('card.unitOther') : PRICE_UNIT_LABELS[locale][code]}</strong>
                      <span>{t(`card.unitHint.${code}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {overlay === 'point' && (
          <div className={card.sheetBackdrop} onClick={() => setOverlay(null)}>
            <div className={card.sheet} data-overlay="true" role="dialog" aria-modal="true" aria-labelledby={`${ids}-point-sheet`} onClick={(event) => event.stopPropagation()}>
              <h3 id={`${ids}-point-sheet`}>{t('card.newPoint')}</h3>
              <div className={styles.field}>
                <label htmlFor={`${ids}-point-name`}>{t('point.name')}</label>
                <input id={`${ids}-point-name`} autoFocus value={newPoint.name} maxLength={120} autoComplete="off" aria-invalid={newPointErrors.name || undefined}
                  onChange={(event) => { setNewPoint((current) => ({ ...current, name: event.target.value })); setNewPointErrors((current) => ({ ...current, name: false })); }} disabled={disabled} />
                {newPointErrors.name && <p className={styles.fieldError}>{t('points.nameRequired')}</p>}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${ids}-point-address`}>{t('point.address')}</label>
                <input id={`${ids}-point-address`} value={newPoint.addressText} maxLength={500} autoComplete="off" aria-invalid={newPointErrors.address || undefined}
                  onChange={(event) => { setNewPoint((current) => ({ ...current, addressText: event.target.value })); setNewPointErrors((current) => ({ ...current, address: false })); }} disabled={disabled} />
                {newPointErrors.address && <p className={styles.fieldError}>{t('points.addressRequired')}</p>}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${ids}-point-type`}>{t('point.type')}</label>
                <select id={`${ids}-point-type`} value={newPoint.type} onChange={(event) => setNewPoint((current) => ({ ...current, type: event.target.value as LocationType }))} disabled={disabled}>
                  {LOCATION_TYPES.map((type) => <option key={type} value={type}>{t(`points.type.${type}`)}</option>)}
                </select>
              </div>
              {!seller && (
                <div className={styles.field}>
                  <label htmlFor={`${ids}-seller-name`}>{t('point.sellerName')} <span className={styles.optional}>· {t('editor.optional')}</span></label>
                  <input id={`${ids}-seller-name`} value={newPoint.sellerName} maxLength={120} autoComplete="organization" aria-describedby={`${ids}-seller-name-hint`}
                    onChange={(event) => setNewPoint((current) => ({ ...current, sellerName: event.target.value }))} disabled={disabled} />
                  <p id={`${ids}-seller-name-hint`} className={styles.hint}>{t('point.sellerNameHint')}</p>
                  {derivedSellerName(newPoint.sellerName, newPoint.name) && (
                    <p className={styles.preview} aria-live="polite">{t('point.sellerNamePreview', { name: derivedSellerName(newPoint.sellerName, newPoint.name) })}</p>
                  )}
                </div>
              )}
              <p className={styles.hint}>{t('card.pointLater')}</p>
              <div className={styles.footerActions}>
                <button type="button" className={styles.secondary} onClick={() => setOverlay(null)} disabled={disabled}>{t('editor.cancel')}</button>
                <button type="button" className={styles.primary} onClick={() => void savePoint()} disabled={disabled}>{t('card.savePoint')}</button>
              </div>
            </div>
          </div>
        )}

        {overlay === 'discard' && (
          <Confirm
            title={t('card.discardTitle')}
            text={t('card.discardText')}
            actions={[
              { label: t('card.keep'), onClick: () => setOverlay(null), primary: true },
              ...(isCreate ? [{ label: t('card.saveDraft'), onClick: () => void saveDraft() }] : []),
              { label: t('card.close'), onClick: onClose, danger: true },
            ]}
          />
        )}
        {overlay === 'deleteDraft' && (
          <Confirm
            title={t('card.deleteDraftTitle')}
            text={t('card.deleteDraftText')}
            actions={[
              { label: t('card.keep'), onClick: () => setOverlay(null), primary: true },
              { label: t('card.delete'), onClick: () => void deleteDraft(), danger: true },
            ]}
          />
        )}
      </div>
    </div>
  );
}

function Confirm({ title, text, actions }: { title: string; text: string; actions: { label: string; onClick: () => void; primary?: boolean; danger?: boolean }[] }) {
  const ids = useId();
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  return (
    <div className={styles.discardBackdrop}>
      <div className={styles.discard} data-overlay="true" role="alertdialog" aria-modal="true" aria-labelledby={`${ids}-t`} aria-describedby={`${ids}-d`}>
        <h3 id={`${ids}-t`}>{title}</h3>
        <p id={`${ids}-d`}>{text}</p>
        <div className={card.confirmActions}>
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              ref={index === 0 ? firstRef : undefined}
              className={action.danger ? styles.danger : action.primary ? styles.primary : styles.secondary}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
