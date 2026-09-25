import type { PriceUnit } from '../../../modules/offers/price-unit/price-unit';
import { SELLER_INPUT_PRICE_AMOUNT_PATTERN } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { MessageKey } from '../../../i18n/messages';
import { priceUnitFromDraft, type PriceUnitDraft } from './PriceUnitField';

// seller-offer-editor (S-06): field rules for the one create/edit form. No new validation rules: the price uses the
// server pattern after trimming the grouping spaces and the decimal comma people type; the product is checked by
// the catalog on submit (PRODUCT_NOT_FOUND / PRODUCT_AMBIGUOUS).
export type EditorValues = { productName: string; amount: string; unit: PriceUnitDraft; comment: string };
export type EditorField = 'product' | 'price' | 'unit';
export type EditorErrors = Partial<Record<EditorField, MessageKey>>;

export function normalizePriceInput(value: string): string {
  return value.replace(/[\s  ]/g, '').replace(',', '.');
}

export function validateEditor(values: EditorValues, mode: 'create' | 'edit'):
  { errors: EditorErrors; payload: { amount: string; unit: PriceUnit | null } | null } {
  const errors: EditorErrors = {};
  if (mode === 'create' && values.productName.trim() === '') errors.product = 'editor.productRequired';
  const amount = normalizePriceInput(values.amount);
  if (amount === '') errors.price = 'editor.priceRequired';
  else if (!SELLER_INPUT_PRICE_AMOUNT_PATTERN.test(amount)) errors.price = 'editor.priceInvalid';
  const unit = priceUnitFromDraft(values.unit);
  if (unit === null) errors.unit = 'unit.customRequired';
  if (Object.keys(errors).length > 0 || unit === null) return { errors, payload: null };
  return { errors, payload: { amount, unit: unit.unit } };
}

// Server codes that belong to a field go back to that field; anything else is a submit error with the draft kept.
export function fieldErrorForCode(code: string | undefined): EditorErrors | null {
  if (code === 'PRODUCT_NOT_FOUND') return { product: 'editor.productNotFound' };
  if (code === 'PRODUCT_AMBIGUOUS') return { product: 'editor.productAmbiguous' };
  if (code === 'OFFER_UPDATE_NO_CHANGES') return { price: 'editor.noChanges' };
  return null;
}

export function sameValues(left: EditorValues, right: EditorValues): boolean {
  return left.productName === right.productName
    && left.amount === right.amount
    && left.unit.code === right.unit.code
    && left.unit.custom === right.unit.custom
    && left.comment === right.comment;
}

// The Seller display name a first-run setup will send: the typed name, or the first point name when left blank.
export function derivedSellerName(sellerName: string, pointName: string): string {
  return sellerName.trim() || pointName.trim();
}

// #36 point rule: exactly one point is shown chosen; with none or several nothing is pre-selected.
export function automaticLocationId(seller: { locations: { id: string }[] } | null): string {
  return seller?.locations.length === 1 ? seller.locations[0]!.id : '';
}
