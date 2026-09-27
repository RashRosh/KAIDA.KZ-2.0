'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import { LOCATION_TYPES, type LocationType, type LocationView } from '../../../modules/locations/contracts/location.contract';
import { PRICE_UNIT_LABELS } from '../../../modules/offers/price-unit/price-unit';
import type { SellerChangeSetView } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import { LanguageSwitch } from '../../_components/LanguageSwitch';
import { formatAmount } from '../../_components/OfferCard';
import styles from './offer-editor.module.css';
import { CabinetIcon } from './SellerCabinetFrame';
import { CommentTranslationAssist } from './CommentTranslationAssist';
import { PriceUnitField, emptyPriceUnitDraft, priceUnitDraftFrom } from './PriceUnitField';
import { PhotoField, readyPhotoIds, readyTiles, type PhotoTile } from './PhotoField';
import {
  automaticLocationId,
  derivedSellerName,
  fieldErrorForCode,
  normalizePriceInput,
  sameValues,
  validateEditor,
  type EditorErrors,
  type EditorValues,
} from './offer-editor-state';

export type EditorMode = { kind: 'create' } | { kind: 'edit'; offer: SellerOfferView };
export type EditorInitial = Partial<EditorValues> & { locationId?: string; photoIds?: string[] };

type ApiResult = { changeSet?: SellerChangeSetView; seller?: SellerView; location?: LocationView; error?: { code?: string } };
type NewPoint = { name: string; addressText: string; type: LocationType; sellerName: string };
type PointErrors = Partial<Record<'name' | 'address', 'points.nameRequired' | 'points.addressRequired'>>;

function without<T extends object>(record: T, key: keyof T): T {
  const next = { ...record };
  delete next[key];
  return next;
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

function initialValues(mode: EditorMode, initial?: EditorInitial): EditorValues {
  const offer = mode.kind === 'edit' ? mode.offer : null;
  return {
    productName: initial?.productName ?? '',
    amount: initial?.amount ?? offer?.price?.amount ?? '',
    unit: initial?.unit ?? (offer ? priceUnitDraftFrom(offer.price?.unitChoice) : emptyPriceUnitDraft),
    comment: initial?.comment ?? offer?.sellerComment ?? '',
  };
}

// S-06 form and S-07 point step (seller-offer-editor). One state machine; the stylesheet turns it into a full-screen
// step on phones and a dialog over the cabinet on desktop. Overlay rules: DESIGN_SYSTEM.md §13.1.
export function OfferEditor({ mode, seller: initialSeller, initial, returnPath, commentTranslationEnabled, onClose }: {
  mode: EditorMode;
  seller: SellerView | null;
  initial?: EditorInitial;
  returnPath: string;
  commentTranslationEnabled: boolean;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const ids = useId();
  const isEdit = mode.kind === 'edit';
  const [start] = useState(() => initialValues(mode, initial));
  const [values, setValues] = useState<EditorValues>(start);
  const [startPhotoIds] = useState<string[]>(() => initial?.photoIds ?? (mode.kind === 'edit' ? mode.offer.photos?.map((photo) => photo.id) ?? [] : []));
  const [photos, setPhotos] = useState<PhotoTile[]>(() => readyTiles(startPhotoIds));
  const [photoBlock, setPhotoBlock] = useState<'photos.waitUpload' | 'photos.fixFailed' | null>(null);
  const [step, setStep] = useState<'form' | 'point'>('form');
  const [errors, setErrors] = useState<EditorErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [seller, setSeller] = useState<SellerView | null>(initialSeller);
  const locations = seller?.locations ?? [];
  const [chosenId, setChosenId] = useState<string>(() => {
    if (initial?.locationId && locations.some((location) => location.id === initial.locationId)) return initial.locationId;
    return automaticLocationId(seller);
  });
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPoint, setNewPoint] = useState<NewPoint>({ name: '', addressText: '', type: 'shop', sellerName: '' });
  const [pointErrors, setPointErrors] = useState<PointErrors>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestCloseRef = useRef<() => void>(() => undefined);
  const discardOpenRef = useRef(false);
  const submittingRef = useRef(false);

  const currentPhotoIds = readyPhotoIds(photos);
  const photosChanged = photos.length !== startPhotoIds.length || currentPhotoIds.some((id, index) => id !== startPhotoIds[index]);
  const dirty = !sameValues(values, start) || photosChanged || newPoint.name !== '' || newPoint.addressText !== '' || newPoint.sellerName !== '';
  const creatingPoint = !isEdit && (addingPoint || locations.length === 0);

  function requestClose() {
    if (submitting) return;
    if (discardOpen) setDiscardOpen(false);
    else if (dirty) setDiscardOpen(true);
    else onClose();
  }
  useEffect(() => { requestCloseRef.current = requestClose; });
  useEffect(() => { discardOpenRef.current = discardOpen; }, [discardOpen]);

  // Focus moves in once and returns to the opener on close; the key handler lives for the whole open session.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>('input:not([readonly]), select, textarea')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusScope = discardOpenRef.current
        ? dialog.querySelector<HTMLElement>('[role="alertdialog"]')
        : dialog;
      if (!focusScope) return;
      const focusable = [...focusScope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null);
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

  function goToStep(next: 'form' | 'point') {
    setStep(next);
    setSubmitFailed(false);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function update(patch: Partial<EditorValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setSubmitFailed(false);
  }

  function focusFirstError(found: EditorErrors) {
    const order: (keyof EditorErrors)[] = ['product', 'price', 'unit'];
    const field = order.find((key) => found[key]);
    const target = field === 'unit' ? `${ids}-unit-custom` : field ? `${ids}-${field}` : null;
    requestAnimationFrame(() => { if (target) document.getElementById(target)?.focus(); });
  }

  async function post(url: string, body: unknown): Promise<{ ok: boolean; data: ApiResult }> {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({})) as ApiResult;
    return { ok: response.ok, data };
  }

  function openReview(changeSetId: string) {
    const next = new URLSearchParams({ back: returnPath });
    if (mode.kind === 'edit') next.set('offer', mode.offer.id);
    router.push(`/seller/change-sets/${changeSetId}?${next.toString()}`);
  }

  // Server answers that belong to a field return the Seller to the form with that field marked.
  function handleFailure(code: string | undefined) {
    const fieldErrors = fieldErrorForCode(code);
    if (fieldErrors) {
      setErrors(fieldErrors);
      setStep('form');
      focusFirstError(fieldErrors);
    } else {
      setSubmitFailed(true);
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  async function submitForm(event?: FormEvent) {
    event?.preventDefault();
    if (submittingRef.current) return;
    const { errors: found, payload } = validateEditor(values, isEdit ? 'edit' : 'create');
    setErrors(found);
    if (!payload) {
      focusFirstError(found);
      return;
    }
    // Photos are optional, but a card is never sent while one is still uploading or has failed unnoticed.
    const pending = photos.some((tile) => tile.status === 'uploading') ? 'photos.waitUpload'
      : photos.some((tile) => tile.status === 'error') ? 'photos.fixFailed' : null;
    setPhotoBlock(pending);
    if (pending) {
      requestAnimationFrame(() => document.getElementById(`${ids}-photos`)?.scrollIntoView({ block: 'center' }));
      return;
    }
    if (mode.kind === 'create') {
      goToStep('point');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      const { ok, data } = await post(`/api/seller/offers/${mode.offer.id}/change-sets`, {
        action: 'update_offer',
        price: payload,
        sellerComment: values.comment,
        photoIds: currentPhotoIds,
      });
      if (ok && data.changeSet) {
        openReview(data.changeSet.id);
        return;
      }
      handleFailure(data.error?.code);
    } catch {
      handleFailure(undefined);
    }
  }

  async function continueFromPoint() {
    if (submittingRef.current) return;
    const { payload } = validateEditor(values, 'create');
    if (!payload) {
      goToStep('form');
      return;
    }
    let locationId = chosenId;
    if (creatingPoint) {
      const found: PointErrors = {};
      if (newPoint.name.trim() === '') found.name = 'points.nameRequired';
      if (newPoint.addressText.trim() === '') found.address = 'points.addressRequired';
      setPointErrors(found);
      if (found.name || found.address) {
        requestAnimationFrame(() => document.getElementById(`${ids}-point-${found.name ? 'name' : 'address'}`)?.focus());
        return;
      }
    } else if (!locationId) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      if (creatingPoint) {
        const location = { name: newPoint.name, type: newPoint.type, addressText: newPoint.addressText };
        if (!seller) {
          const { ok, data } = await post('/api/seller/setup', {
            seller: { displayName: derivedSellerName(newPoint.sellerName, newPoint.name) },
            location,
          });
          if (!ok || !data.seller?.locations[0]) return handleFailure(data.error?.code);
          setSeller(data.seller);
          locationId = data.seller.locations[0].id;
        } else {
          const { ok, data } = await post('/api/seller/locations', location);
          if (!ok || !data.location) return handleFailure(data.error?.code);
          const created = data.location;
          setSeller((current) => current ? { ...current, locations: [...current.locations, created] } : current);
          locationId = created.id;
        }
        // The point now exists; a retry or a return to the form reuses it instead of creating another one.
        setChosenId(locationId);
        setAddingPoint(false);
        setNewPoint({ name: '', addressText: '', type: 'shop', sellerName: '' });
      }
      const { ok, data } = await post('/api/seller/change-sets', {
        productName: values.productName,
        locationId,
        price: payload,
        sellerComment: values.comment,
        photoIds: currentPhotoIds,
      });
      if (ok && data.changeSet) {
        openReview(data.changeSet.id);
        return;
      }
      handleFailure(data.error?.code);
    } catch {
      handleFailure(undefined);
    }
  }

  const errorCount = Object.keys(errors).length;
  const unitLabel = (() => {
    if (values.unit.code === '') return '';
    return values.unit.code === 'other' ? values.unit.custom.trim() : PRICE_UNIT_LABELS[locale][values.unit.code];
  })();
  const keptSummary = `${values.productName.trim()} · ${formatAmount(normalizePriceInput(values.amount))} ₸${unitLabel ? ` / ${unitLabel}` : ''}`;
  const title = step === 'point' ? t('point.title') : isEdit ? t('editor.editTitle') : t('editor.createTitle');
  const describedBy = (field: keyof EditorErrors) => (errors[field] ? `${ids}-${field}-error` : undefined);
  const primaryLabel = submitting ? t('editor.submitting') : submitFailed ? t('editor.retry') : step === 'point' ? t('point.continue') : t('editor.next');
  const pointChoiceMissing = step === 'point' && !creatingPoint && !chosenId;

  return (
    <div className={styles.backdrop} onClick={requestClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <button
            type="button"
            className={styles.iconButton}
            data-mobile-only="true"
            onClick={step === 'point' ? () => goToStep('form') : requestClose}
            aria-label={step === 'point' ? t('editor.back') : t('cabinet.close')}
            disabled={submitting}
          >
            <CabinetIcon name="back" />
          </button>
          <h2 id={`${ids}-title`} ref={headingRef} tabIndex={-1}>{title}</h2>
          <LanguageSwitch />
          <button type="button" className={styles.iconButton} data-desktop-only="true" onClick={requestClose} aria-label={t('cabinet.close')} disabled={submitting}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <form id={`${ids}-form`} className={styles.body} onSubmit={(event) => { event.preventDefault(); void (step === 'form' ? submitForm() : continueFromPoint()); }} noValidate>
          {submitFailed && (
            <div className={styles.banner} role="alert">
              <strong>{t('editor.errorTitle')}</strong>
              <span>{t('editor.errorText')}</span>
            </div>
          )}

          {step === 'form' && (
            <>
              {errorCount > 0 && (
                <p className={styles.summary} role="alert">
                  <CabinetIcon name="alert" />
                  {errorCount === 1 ? t('editor.summaryOne') : t('editor.summaryMany', { count: errorCount })}
                </p>
              )}
              <div id={`${ids}-photos`} className={styles.field}>
                <PhotoField
                  tiles={photos}
                  setTiles={(next) => { setPhotos(next); setPhotoBlock(null); setSubmitFailed(false); }}
                  disabled={submitting}
                  blockedMessage={photoBlock ?? undefined}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor={`${ids}-product`}>{t('editor.product')}</label>
                {isEdit ? (
                  <input id={`${ids}-product`} value={mode.offer.product.name} lang={mode.offer.product.nameLocale} readOnly className={styles.readOnly} />
                ) : (
                  <input
                    id={`${ids}-product`}
                    value={values.productName}
                    onChange={(event) => { update({ productName: event.target.value }); setErrors((current) => without(current, 'product')); }}
                    placeholder={t('editor.productPlaceholder')}
                    autoComplete="off"
                    aria-invalid={errors.product ? true : undefined}
                    aria-describedby={describedBy('product')}
                    disabled={submitting}
                  />
                )}
                {errors.product && <p id={`${ids}-product-error`} className={styles.fieldError}>{t(errors.product)}</p>}
              </div>

              <div className={styles.field}>
                <label htmlFor={`${ids}-price`}>{t('editor.price')}</label>
                <div className={styles.priceWrap}>
                  <input
                    id={`${ids}-price`}
                    value={values.amount}
                    onChange={(event) => { update({ amount: event.target.value }); setErrors((current) => without(current, 'price')); }}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-invalid={errors.price ? true : undefined}
                    aria-describedby={[describedBy('price'), isEdit && mode.offer.price ? `${ids}-price-previous` : ''].filter(Boolean).join(' ') || undefined}
                    disabled={submitting}
                  />
                  <span className={styles.currency} aria-hidden="true">₸</span>
                </div>
                {isEdit && mode.offer.price && (
                  <p id={`${ids}-price-previous`} className={styles.hint}>{t('editor.pricePrevious', { price: `${formatAmount(mode.offer.price.amount)} ₸` })}</p>
                )}
                {errors.price && <p id={`${ids}-price-error`} className={styles.fieldError}>{t(errors.price)}</p>}
              </div>

              <div className={styles.field}>
                <PriceUnitField
                  id={`${ids}-unit`}
                  draft={values.unit}
                  onChange={(unit) => { update({ unit }); setErrors((current) => without(current, 'unit')); }}
                  disabled={submitting}
                  showError={Boolean(errors.unit)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor={`${ids}-comment`}>{t('editor.comment')} <span className={styles.optional}>· {t('editor.optional')}</span></label>
                <textarea
                  id={`${ids}-comment`}
                  value={values.comment}
                  onChange={(event) => update({ comment: event.target.value })}
                  maxLength={500}
                  rows={3}
                  placeholder={t('editor.commentPlaceholder')}
                  disabled={submitting}
                />
                <CommentTranslationAssist enabled={commentTranslationEnabled} comment={values.comment} />
              </div>

              {isEdit && (
                <p className={styles.pointRow}><span>{t('editor.point')}</span><span>{mode.offer.location.name}</span></p>
              )}
            </>
          )}

          {step === 'point' && (
            <>
              <p className={styles.kept}>{t('point.kept', { summary: keptSummary })}</p>
              {creatingPoint ? (
                <>
                  {locations.length === 0 && <p className={styles.hint}>{t('point.none')}</p>}
                  <div className={styles.field}>
                    <label htmlFor={`${ids}-point-name`}>{t('point.name')}</label>
                    <input
                      id={`${ids}-point-name`}
                      value={newPoint.name}
                      onChange={(event) => { setNewPoint((current) => ({ ...current, name: event.target.value })); setPointErrors((current) => without(current, 'name')); }}
                      maxLength={120}
                      autoComplete="off"
                      aria-invalid={pointErrors.name ? true : undefined}
                      aria-describedby={pointErrors.name ? `${ids}-point-name-error` : undefined}
                      disabled={submitting}
                    />
                    {pointErrors.name && <p id={`${ids}-point-name-error`} className={styles.fieldError}>{t(pointErrors.name)}</p>}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`${ids}-point-address`}>{t('point.address')}</label>
                    <input
                      id={`${ids}-point-address`}
                      value={newPoint.addressText}
                      onChange={(event) => { setNewPoint((current) => ({ ...current, addressText: event.target.value })); setPointErrors((current) => without(current, 'address')); }}
                      maxLength={500}
                      autoComplete="off"
                      aria-invalid={pointErrors.address ? true : undefined}
                      aria-describedby={[pointErrors.address ? `${ids}-point-address-error` : '', `${ids}-point-address-hint`].filter(Boolean).join(' ')}
                      disabled={submitting}
                    />
                    <p id={`${ids}-point-address-hint`} className={styles.hint}>{t('point.addressHint')}</p>
                    {pointErrors.address && <p id={`${ids}-point-address-error`} className={styles.fieldError}>{t(pointErrors.address)}</p>}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`${ids}-point-type`}>{t('point.type')}</label>
                    <select
                      id={`${ids}-point-type`}
                      value={newPoint.type}
                      onChange={(event) => setNewPoint((current) => ({ ...current, type: event.target.value as LocationType }))}
                      disabled={submitting}
                    >
                      {LOCATION_TYPES.map((type) => <option key={type} value={type}>{t(`points.type.${type}`)}</option>)}
                    </select>
                  </div>
                  {!seller && (
                    <div className={styles.field}>
                      <label htmlFor={`${ids}-seller-name`}>{t('point.sellerName')} <span className={styles.optional}>· {t('editor.optional')}</span></label>
                      <input
                        id={`${ids}-seller-name`}
                        value={newPoint.sellerName}
                        onChange={(event) => setNewPoint((current) => ({ ...current, sellerName: event.target.value }))}
                        maxLength={120}
                        autoComplete="organization"
                        aria-describedby={derivedSellerName(newPoint.sellerName, newPoint.name)
                          ? `${ids}-seller-name-hint ${ids}-seller-name-preview`
                          : `${ids}-seller-name-hint`}
                        disabled={submitting}
                      />
                      <p id={`${ids}-seller-name-hint`} className={styles.hint}>{t('point.sellerNameHint')}</p>
                      {derivedSellerName(newPoint.sellerName, newPoint.name) && (
                        <p id={`${ids}-seller-name-preview`} className={styles.preview} aria-live="polite">
                          {t('point.sellerNamePreview', { name: derivedSellerName(newPoint.sellerName, newPoint.name) })}
                        </p>
                      )}
                    </div>
                  )}
                  {locations.length > 0 && (
                    <button type="button" className={styles.linkButton} onClick={() => setAddingPoint(false)} disabled={submitting}>{t('point.chooseExisting')}</button>
                  )}
                </>
              ) : (
                <fieldset className={styles.points}>
                  <legend>{locations.length === 1 ? t('point.one') : t('point.many')}</legend>
                  {locations.map((location) => (
                    <label key={location.id} className={styles.pointOption}>
                      <input
                        type="radio"
                        name={`${ids}-point`}
                        value={location.id}
                        checked={chosenId === location.id}
                        onChange={() => setChosenId(location.id)}
                        disabled={submitting}
                      />
                      <span className={styles.pointText}>
                        <strong>{location.name}</strong>
                        <span>{location.addressText}</span>
                        <span className={styles.pointMeta}>{t(`points.type.${location.type}`)} · {location.geo ? t('point.geoYes') : t('point.geoNo')}</span>
                      </span>
                    </label>
                  ))}
                  <button type="button" className={styles.linkButton} onClick={() => setAddingPoint(true)} disabled={submitting}>
                    <CabinetIcon name="plus" />{t('point.new')}
                  </button>
                </fieldset>
              )}
            </>
          )}
        </form>

        <footer className={styles.footer}>
          {pointChoiceMissing && <p className={styles.footerNote}>{t('point.chooseFirst')}</p>}
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.secondary}
              data-desktop-only="true"
              onClick={step === 'point' ? () => goToStep('form') : requestClose}
              disabled={submitting}
            >
              {step === 'point' ? t('editor.back') : t('editor.cancel')}
            </button>
            <button type="submit" form={`${ids}-form`} className={styles.primary} disabled={submitting || pointChoiceMissing}>
              {submitFailed && !submitting && <CabinetIcon name="retry" />}{primaryLabel}
            </button>
          </div>
        </footer>

        {discardOpen && (
          <DiscardConfirm onKeep={() => setDiscardOpen(false)} onDiscard={onClose} />
        )}
      </div>
    </div>
  );
}

function DiscardConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  const { t } = useI18n();
  const ids = useId();
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { keepRef.current?.focus(); }, []);
  return (
    <div className={styles.discardBackdrop}>
      <div className={styles.discard} role="alertdialog" aria-modal="true" aria-labelledby={`${ids}-t`} aria-describedby={`${ids}-d`}>
        <h3 id={`${ids}-t`}>{t('editor.discardTitle')}</h3>
        <p id={`${ids}-d`}>{t('editor.discardText')}</p>
        <div className={styles.footerActions}>
          <button type="button" ref={keepRef} className={styles.secondary} onClick={onKeep}>{t('editor.keepEditing')}</button>
          <button type="button" className={styles.danger} onClick={onDiscard}>{t('editor.discard')}</button>
        </div>
      </div>
    </div>
  );
}
