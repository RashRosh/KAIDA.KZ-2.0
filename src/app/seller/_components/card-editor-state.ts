import { PACK_AMOUNT_PATTERN, type PackUnit } from '../../../modules/offers/pack/pack';
import type { CanonicalPriceUnitCode, PriceUnit } from '../../../modules/offers/price-unit/price-unit';
import type { OfferDraftPayload } from '../../../modules/offers/drafts/offer-draft.contract';
import { normalizeOfferTitle, OFFER_TITLE_MAX_LENGTH, OFFER_TITLE_MIN_LENGTH } from '../../../modules/offers/title/offer-title';
import { SELLER_INPUT_PRICE_AMOUNT_PATTERN } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { MessageKey } from '../../../i18n/messages';

// seller-showcase-editor §2 «Editor»: field rules and request bodies of the one card editor.

export type UnitCode = CanonicalPriceUnitCode | 'other';
export type UnitDraft = { code: UnitCode | ''; custom: string };
export type PointChoice = { selected: boolean; ownPrice: string | null };

export type CardValues = {
  title: string;
  // Catalog link of a chosen suggestion and the name it was chosen with.
  productId: string | null;
  linkedName: string | null;
  amount: string;
  unit: UnitDraft;
  packOpen: boolean;
  packAmount: string;
  packUnit: PackUnit;
  comment: string;
  // Create: chosen points with an optional own price. Edit: points to add to the card.
  points: Record<string, PointChoice>;
  // Edit: Offers of the card that take the common price.
  applyPrice: Record<string, boolean>;
};

export type CardField = 'title' | 'price' | 'unit' | 'pack' | 'points' | 'ownPrice';
export type CardErrors = Partial<Record<CardField, MessageKey>>;
export const FIELD_ORDER: CardField[] = ['title', 'price', 'unit', 'pack', 'ownPrice', 'points'];

export const emptyUnit: UnitDraft = { code: '', custom: '' };

export function emptyCardValues(): CardValues {
  return {
    title: '', productId: null, linkedName: null, amount: '', unit: emptyUnit, packOpen: false, packAmount: '', packUnit: 'g',
    comment: '', points: {}, applyPrice: {},
  };
}

// What a price field may contain while it is typed or pasted: digits, group spaces and at most one decimal separator (. or ,).
// A change that brings in anything else (a letter, a sign, a second separator) is refused as a whole — the field keeps its previous
// text, so «12abc34» is never turned into another price. Whether the amount is valid (range, two decimals) is judged by priceError
// and, on the server, by SELLER_INPUT_PRICE_AMOUNT_PATTERN; this only keeps stray characters out.
const AMOUNT_TYPING = /^[\d\s  ]*(?:[.,][\d\s  ]*)?$/u;
export function acceptAmountInput(previous: string, next: string): string {
  return AMOUNT_TYPING.test(next) ? next : previous;
}

export function normalizeAmount(value: string): string {
  return value.replace(/[\s  ]/g, '').replace(',', '.');
}

export function unitDraftFrom(unit: PriceUnit | null | undefined): UnitDraft {
  if (!unit) return emptyUnit;
  return unit.code === 'other' ? { code: 'other', custom: unit.value } : { code: unit.code, custom: '' };
}

export function packAllowed(code: UnitDraft['code']) {
  return code === 'package' || code === 'piece';
}

// A chosen suggestion stays linked while the title still starts with its name (the Seller may add words after it).
export function keepsLink(title: string, linkedName: string | null): boolean {
  if (!linkedName) return false;
  const typed = normalizeOfferTitle(title).toLocaleLowerCase('ru');
  return typed.startsWith(normalizeOfferTitle(linkedName).toLocaleLowerCase('ru'));
}

function validPrice(value: string): string | null {
  const amount = normalizeAmount(value);
  return SELLER_INPUT_PRICE_AMOUNT_PATTERN.test(amount) && Number(amount) > 0 ? amount : null;
}

export function priceError(value: string): MessageKey | null {
  const amount = normalizeAmount(value);
  if (amount === '' || Number(amount) === 0) return 'card.priceRequired';
  return validPrice(value) ? null : 'card.priceInvalid';
}

function unitValue(unit: UnitDraft): PriceUnit | null {
  if (unit.code === '') return null;
  if (unit.code !== 'other') return { code: unit.code };
  const value = unit.custom.trim();
  return /^\p{L}{1,20}$/u.test(value) ? { code: 'other', value } : null;
}

export type CardMode = 'create' | 'edit' | 'point';

export type CardPayload = {
  title: string;
  productId: string | null;
  price: string;
  unit: PriceUnit;
  pack: { amount: string; unit: PackUnit } | null;
  sellerComment: string;
};

export function validateCard(values: CardValues, mode: CardMode, existingPoints: number):
  { errors: CardErrors; payload: CardPayload | null } {
  const errors: CardErrors = {};
  const title = normalizeOfferTitle(values.title);
  const price = validPrice(values.amount);
  const priceProblem = priceError(values.amount);
  if (priceProblem) errors.price = priceProblem;
  if (mode === 'point') return { errors, payload: null };

  if (title === '') errors.title = 'card.nameRequired';
  else if (title.length < OFFER_TITLE_MIN_LENGTH || title.length > OFFER_TITLE_MAX_LENGTH) errors.title = 'card.nameLength';
  const unit = unitValue(values.unit);
  if (values.unit.code === '') errors.unit = 'card.unitRequired';
  else if (!unit) errors.unit = 'card.customUnitInvalid';
  const packShown = values.packOpen && packAllowed(values.unit.code);
  const packAmount = normalizeAmount(values.packAmount);
  if (packShown && packAmount !== '' && !(PACK_AMOUNT_PATTERN.test(packAmount) && Number(packAmount) > 0)) errors.pack = 'card.packInvalid';
  if (mode === 'create') {
    const chosen = Object.values(values.points).filter((point) => point.selected);
    if (chosen.length === 0) errors.points = existingPoints === 0 ? 'card.pointRequired' : 'card.pointChoose';
    if (chosen.some((point) => point.ownPrice !== null && validPrice(point.ownPrice) === null)) errors.ownPrice = 'card.priceRequired';
  }
  if (Object.keys(errors).length > 0 || !price || !unit) return { errors, payload: null };
  return {
    errors,
    payload: {
      title,
      productId: keepsLink(title, values.linkedName) ? values.productId : null,
      price,
      unit,
      pack: packShown && packAmount !== '' ? { amount: packAmount, unit: values.packUnit } : null,
      sellerComment: values.comment,
    },
  };
}

export function createBody(values: CardValues, payload: CardPayload, photoIds: string[], draftId: string | null) {
  return {
    ...payload,
    photoIds,
    points: Object.entries(values.points).filter(([, point]) => point.selected).map(([locationId, point]) => ({
      locationId,
      ...(point.ownPrice !== null && validPrice(point.ownPrice) ? { ownPrice: validPrice(point.ownPrice)! } : {}),
    })),
    ...(draftId ? { draftId } : {}),
  };
}

export function updateBody(values: CardValues, payload: CardPayload, photoIds: string[], offers: { id: string; revision: number }[]) {
  return {
    ...payload,
    photoIds,
    offers: offers.map((offer) => ({ offerId: offer.id, revision: offer.revision, applyPrice: values.applyPrice[offer.id] ?? true })),
    addPoints: Object.entries(values.points).filter(([, point]) => point.selected).map(([locationId]) => locationId),
  };
}

// A draft keeps everything as typed; nothing is validated beyond size.
export function draftPayload(values: CardValues, photoIds: string[]): OfferDraftPayload {
  const unit = values.unit.code === '' ? null
    : values.unit.code === 'other' ? { code: 'other' as const, value: values.unit.custom.slice(0, 40) } : { code: values.unit.code };
  return {
    title: values.title.slice(0, 200),
    productId: keepsLink(values.title, values.linkedName) ? values.productId : null,
    price: values.amount.slice(0, 40),
    unit,
    pack: values.packOpen && packAllowed(values.unit.code) && values.packAmount.trim() !== ''
      ? { amount: values.packAmount.slice(0, 20), unit: values.packUnit } : null,
    sellerComment: values.comment.slice(0, 500),
    photoIds,
    points: Object.entries(values.points).filter(([, point]) => point.selected)
      .map(([locationId, point]) => ({ locationId, ownPrice: point.ownPrice })),
  };
}

export function valuesFromDraft(payload: OfferDraftPayload, knownLocations: Set<string>): CardValues {
  return {
    ...emptyCardValues(),
    title: payload.title,
    productId: payload.productId,
    linkedName: payload.productId ? payload.title : null,
    amount: payload.price,
    unit: unitDraftFrom(payload.unit ? (payload.unit.code === 'other' ? { code: 'other', value: payload.unit.value } : { code: payload.unit.code }) : null),
    packOpen: payload.pack !== null,
    packAmount: payload.pack?.amount ?? '',
    packUnit: payload.pack?.unit ?? 'g',
    comment: payload.sellerComment,
    points: Object.fromEntries(payload.points.filter((point) => knownLocations.has(point.locationId))
      .map((point) => [point.locationId, { selected: true, ownPrice: point.ownPrice }])),
  };
}

export function sameCardValues(left: CardValues, right: CardValues): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

// «Вернуться к правке»: the editor reopens with exactly what was sent in the proposed ChangeSet.
export function valuesFromChangeSet(
  changeSet: { items: {
    action: string;
    product: { id: string | null; name: string };
    location: { id: string };
    price: { amount: string; unitChoice: PriceUnit | null } | null;
    priceOwn: boolean;
    pack: { amount: string; unit: PackUnit } | null;
    sellerComment: string | null;
    photos?: { id: string }[];
  }[] },
  offerIdByLocation: Map<string, string>,
): { values: Partial<CardValues>; photoIds?: string[] } | null {
  const items = changeSet.items.filter((item) => item.action === 'create_offer' || item.action === 'update_offer');
  const first = items[0];
  if (!first?.price) return null;
  const common = items.find((item) => !item.priceOwn)?.price?.amount ?? first.price.amount;
  const creates = items.filter((item) => item.action === 'create_offer');
  const updates = items.filter((item) => item.action === 'update_offer');
  const isCardCreate = updates.length === 0;
  return {
    values: {
      title: first.product.name,
      productId: first.product.id,
      linkedName: first.product.id ? first.product.name : null,
      amount: common,
      unit: unitDraftFrom(first.price.unitChoice),
      packOpen: first.pack !== null,
      packAmount: first.pack?.amount ?? '',
      packUnit: first.pack?.unit ?? 'g',
      comment: first.sellerComment ?? '',
      points: Object.fromEntries(creates.map((item) => [item.location.id, {
        selected: true,
        ownPrice: isCardCreate && item.priceOwn ? item.price?.amount ?? null : null,
      }])),
      applyPrice: Object.fromEntries(updates.flatMap((item) => {
        const offerId = offerIdByLocation.get(item.location.id);
        return offerId ? [[offerId, !item.priceOwn]] : [];
      })),
    },
    ...(first.photos ? { photoIds: first.photos.map((photo) => photo.id) } : {}),
  };
}

// pre-publication-buyer-preview (docs/slices/pre-publication-buyer-preview §3.2): the minimum that makes a card worth showing as a
// buyer would see it — a valid title, a valid price, at least one point on the showcase and no photo still uploading. Everything
// else (unit, pack, comment, photos) may be empty, as for buyers. Pure; the reasons are shown under the button.
export type PreviewReason = 'titlePrice' | 'point' | 'upload';

export function previewAvailability(
  values: CardValues,
  mode: CardMode,
  context: { activePoints: number; uploading: boolean },
): { ok: boolean; reasons: PreviewReason[] } {
  const reasons: PreviewReason[] = [];
  const title = normalizeOfferTitle(values.title);
  const titleOk = title.length >= OFFER_TITLE_MIN_LENGTH && title.length <= OFFER_TITLE_MAX_LENGTH;
  if (!titleOk || priceError(values.amount) !== null) reasons.push('titlePrice');
  const chosen = Object.values(values.points).filter((point) => point.selected).length;
  if (mode === 'create' ? chosen === 0 : context.activePoints + chosen === 0) reasons.push('point');
  if (context.uploading) reasons.push('upload');
  return { ok: reasons.length === 0, reasons };
}

// The body of the preview request: the editor values as they are right now. An unusable unit or pack is simply left out (a
// preview shows what can be shown; the publication still validates them).
export function previewBody(
  values: CardValues,
  mode: { kind: 'create' } | { kind: 'edit'; offerIds: string[] },
  photoIds: string[],
) {
  const price = validPrice(values.amount);
  const unit = unitValue(values.unit);
  const packAmount = normalizeAmount(values.packAmount);
  const packOk = values.packOpen && unit !== null && (unit.code === 'package' || unit.code === 'piece')
    && PACK_AMOUNT_PATTERN.test(packAmount) && Number(packAmount) > 0;
  const shared = {
    title: normalizeOfferTitle(values.title),
    price,
    unit,
    pack: packOk ? { amount: packAmount, unit: values.packUnit } : null,
    sellerComment: values.comment,
    photoIds,
  };
  const chosen = Object.entries(values.points).filter(([, point]) => point.selected);
  if (mode.kind === 'create') {
    return {
      kind: 'create' as const,
      ...shared,
      points: chosen.map(([locationId, point]) => ({
        locationId,
        ...(point.ownPrice !== null && validPrice(point.ownPrice) ? { ownPrice: validPrice(point.ownPrice)! } : {}),
      })),
    };
  }
  return {
    kind: 'update' as const,
    ...shared,
    offers: mode.offerIds.map((offerId) => ({ offerId, applyPrice: values.applyPrice[offerId] ?? true })),
    addPoints: chosen.map(([locationId]) => locationId),
  };
}
