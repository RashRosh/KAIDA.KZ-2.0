import { z } from 'zod';
import type { LocationType } from '../../locations/contracts/location.contract';
import type { OfferStatus } from '../../offers/db/offers.table';
import { priceUnitInputSchema, type PriceUnit } from '../../offers/price-unit/price-unit';
import type { SellerChangeAction } from '../db/seller-change-items.table';
import type { SellerChangeSetStatus } from '../db/seller-change-sets.table';

export const SELLER_INPUT_PRICE_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

const optionalCommentSchema = z.string().trim().max(500)
  .transform((value) => value === '' ? null : value)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const requiredCommentSchema = z.string().trim().max(500)
  .transform((value) => value === '' ? null : value)
  .nullable();

// Ordered photo ids, first = cover. Uniqueness keeps positions meaningful; ownership is checked by the use case.
const photoIdsSchema = z.array(z.uuid()).max(5)
  .refine((ids) => new Set(ids).size === ids.length, 'Photo ids must be unique');

const priceSchema = z.object({
  amount: z.string().trim().regex(SELLER_INPUT_PRICE_AMOUNT_PATTERN),
  unit: priceUnitInputSchema,
}).strict();

export const sellerChangeSetCreateBodySchema = z.object({
  productName: z.string().trim().min(1),
  locationId: z.string().uuid(),
  price: priceSchema,
  sellerComment: optionalCommentSchema,
  photoIds: photoIdsSchema.optional(),
}).strict();

export const sellerOfferChangeBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_offer'),
    price: priceSchema,
    sellerComment: requiredCommentSchema,
    // Omitted = photos unchanged; an array (possibly empty) replaces the Offer photo list.
    photoIds: photoIdsSchema.optional(),
  }).strict(),
  z.object({ action: z.literal('deactivate_offer') }).strict(),
  z.object({ action: z.literal('activate_offer') }).strict(),
]);

const sellerBatchChangeItemSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_offer'),
    productName: z.string().trim().min(1),
    locationId: z.string().uuid(),
    price: priceSchema,
    sellerComment: optionalCommentSchema,
  }).strict(),
  z.object({
    action: z.literal('update_offer'),
    offerId: z.string().uuid(),
    price: priceSchema,
    sellerComment: requiredCommentSchema,
  }).strict(),
  z.object({
    action: z.literal('deactivate_offer'),
    offerId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal('activate_offer'),
    offerId: z.string().uuid(),
  }).strict(),
]);

export const sellerBatchChangeSetCreateBodySchema = z.object({
  items: z.array(sellerBatchChangeItemSchema).min(2),
}).strict();

export const sellerChangeSetIdSchema = z.string().uuid();
export const sellerOfferIdSchema = z.string().uuid();

export type SellerChangeSetCreateInput = z.infer<typeof sellerChangeSetCreateBodySchema>;
export type SellerOfferChangeInput = z.infer<typeof sellerOfferChangeBodySchema>;
export type SellerBatchChangeSetCreateInput = z.infer<typeof sellerBatchChangeSetCreateBodySchema>;
export type SellerBatchChangeItemInput = SellerBatchChangeSetCreateInput['items'][number];

export type SellerChangeSetItemView = {
  id: string;
  action: SellerChangeAction;
  product: { id: string; name: string };
  location: { id: string; name: string; addressText: string; type: LocationType };
  price: { amount: string; currency: 'KZT'; unit: string | null; unitChoice: PriceUnit | null } | null;
  sellerComment: string | null;
  // Present only when the item sets a photo list: a create_offer with photos, or an update_offer that replaces them.
  photos?: { id: string }[];
  resultOffer: { id: string; status: OfferStatus; lastConfirmedAt: string } | null;
};

export type SellerChangeSetView = {
  id: string;
  status: SellerChangeSetStatus;
  createdAt: string;
  confirmedAt: string | null;
  seller: { id: string; displayName: string };
  items: SellerChangeSetItemView[];
};

export class SellerRequiredError extends Error {
  readonly code = 'SELLER_REQUIRED' as const;
  constructor() {
    super('Сначала создайте продавца и точку.');
    this.name = 'SellerRequiredError';
  }
}

export class ProductNotFoundError extends Error {
  readonly code = 'PRODUCT_NOT_FOUND' as const;
  constructor() {
    super('Такого товара пока нет в каталоге.');
    this.name = 'ProductNotFoundError';
  }
}

export class ProductAmbiguousError extends Error {
  readonly code = 'PRODUCT_AMBIGUOUS' as const;
  constructor() {
    super('Товар в каталоге определён неоднозначно.');
    this.name = 'ProductAmbiguousError';
  }
}

export class LocationNotFoundError extends Error {
  readonly code = 'LOCATION_NOT_FOUND' as const;
  constructor() {
    super('Точка продавца не найдена.');
    this.name = 'LocationNotFoundError';
  }
}

export class PhotoNotFoundError extends Error {
  readonly code = 'PHOTO_NOT_FOUND' as const;
  constructor() {
    super('Фото не найдено. Загрузите его ещё раз.');
    this.name = 'PhotoNotFoundError';
  }
}

export class OfferNotFoundError extends Error {
  readonly code = 'OFFER_NOT_FOUND' as const;
  constructor() {
    super('Предложение не найдено.');
    this.name = 'OfferNotFoundError';
  }
}

export class OfferUpdateNoChangesError extends Error {
  readonly code = 'OFFER_UPDATE_NO_CHANGES' as const;
  constructor() {
    super('Изменения совпадают с текущим предложением.');
    this.name = 'OfferUpdateNoChangesError';
  }
}

export class OfferAlreadyInactiveError extends Error {
  readonly code = 'OFFER_ALREADY_INACTIVE' as const;
  constructor() {
    super('Предложение уже выключено.');
    this.name = 'OfferAlreadyInactiveError';
  }
}

export class OfferPriceRequiredError extends Error {
  readonly code = 'OFFER_PRICE_REQUIRED' as const;
  constructor() {
    super('Укажите цену предложения перед публикацией.');
    this.name = 'OfferPriceRequiredError';
  }
}

export class BatchOfferConflictError extends Error {
  readonly code = 'BATCH_OFFER_CONFLICT' as const;
  constructor() {
    super('В одном пакете нельзя изменять одно предложение несколько раз.');
    this.name = 'BatchOfferConflictError';
  }
}

export class OfferChangedError extends Error {
  readonly code = 'OFFER_CHANGED' as const;
  constructor() {
    super('Предложение изменилось после создания этого изменения. Создайте новое изменение из актуальных данных.');
    this.name = 'OfferChangedError';
  }
}

export class ChangeSetNotFoundError extends Error {
  readonly code = 'CHANGE_SET_NOT_FOUND' as const;
  constructor() {
    super('Изменение не найдено.');
    this.name = 'ChangeSetNotFoundError';
  }
}

export class SellerInputInvariantError extends Error {
  readonly code = 'SELLER_INPUT_INVARIANT' as const;
  constructor(message = 'Нарушена целостность изменения продавца.') {
    super(message);
    this.name = 'SellerInputInvariantError';
  }
}
