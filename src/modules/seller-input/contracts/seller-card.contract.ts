import { z } from 'zod';
import { CANONICAL_PRICE_UNIT_CODES, type PriceUnit } from '../../offers/price-unit/price-unit';
import { packInputSchema } from '../../offers/pack/pack';
import { normalizeOfferTitle, OFFER_TITLE_MAX_LENGTH, OFFER_TITLE_MIN_LENGTH } from '../../offers/title/offer-title';
import { SELLER_INPUT_PRICE_AMOUNT_PATTERN } from './seller-change-set.contract';

// seller-showcase-editor: one product card in one or more points (§2 «Product card», «Editor», «Edit a published card»).

export const CARD_CUSTOM_UNIT_MAX_LENGTH = 20;
export const CARD_POINT_LIMIT = 50;

export const cardTitleSchema = z.string().transform(normalizeOfferTitle)
  .pipe(z.string().min(OFFER_TITLE_MIN_LENGTH).max(OFFER_TITLE_MAX_LENGTH));

// A number greater than 0 with up to 2 decimals.
export const cardPriceAmountSchema = z.string().trim().regex(SELLER_INPUT_PRICE_AMOUNT_PATTERN)
  .refine((value) => Number(value) > 0, 'Price must be greater than 0');

// «Другое» is one word: letters only, no spaces or digits, 1–20 characters.
export const cardUnitSchema = z.union([
  z.object({ code: z.enum(CANONICAL_PRICE_UNIT_CODES) }).strict(),
  z.object({ code: z.literal('other'), value: z.string().trim().regex(/^\p{L}{1,20}$/u) }).strict(),
]).transform((value): PriceUnit => value);

const commentSchema = z.string().trim().max(500).transform((value) => value === '' ? null : value).nullable();

const photoIdsSchema = z.array(z.uuid()).max(5)
  .refine((ids) => new Set(ids).size === ids.length, 'Photo ids must be unique');

const sharedFields = {
  title: cardTitleSchema,
  // The catalog product of a chosen suggestion; null = none chosen (the server may still link an exact match).
  productId: z.uuid().nullable(),
  price: cardPriceAmountSchema,
  unit: cardUnitSchema,
  pack: packInputSchema.nullable(),
  sellerComment: commentSchema,
  photoIds: photoIdsSchema,
};

function packFitsUnit(value: { unit: PriceUnit; pack: unknown }) {
  return value.pack === null || value.unit.code === 'package' || value.unit.code === 'piece';
}

const uniqueBy = <T>(key: (item: T) => string) => (items: T[]) => new Set(items.map(key)).size === items.length;

export const cardCreateBodySchema = z.object({
  ...sharedFields,
  // ownPrice omitted = the common price.
  points: z.array(z.object({ locationId: z.uuid(), ownPrice: cardPriceAmountSchema.optional() }).strict())
    .min(1).max(CARD_POINT_LIMIT)
    .refine(uniqueBy((point: { locationId: string }) => point.locationId), 'Points must be unique'),
  // The draft being published, if any: it is removed when this card is confirmed.
  draftId: z.uuid().optional(),
}).strict().refine(packFitsUnit, 'Pack is only for packages and pieces');

export const cardUpdateBodySchema = z.object({
  ...sharedFields,
  // Every Offer of the card with the revision the editor saw; applyPrice = take the common price.
  offers: z.array(z.object({ offerId: z.uuid(), revision: z.number().int().min(1), applyPrice: z.boolean() }).strict())
    .min(1).max(CARD_POINT_LIMIT)
    .refine(uniqueBy((offer: { offerId: string }) => offer.offerId), 'Offers must be unique'),
  // Points the card is added to, each at the common price.
  addPoints: z.array(z.uuid()).max(CARD_POINT_LIMIT).refine(uniqueBy((id: string) => id), 'Points must be unique'),
}).strict().refine(packFitsUnit, 'Pack is only for packages and pieces');

export const pointPriceBodySchema = z.object({
  revision: z.number().int().min(1),
  // null = back to the common price of the card.
  price: cardPriceAmountSchema.nullable(),
}).strict();

export type CardCreateInput = z.infer<typeof cardCreateBodySchema>;
export type CardUpdateInput = z.infer<typeof cardUpdateBodySchema>;
export type PointPriceInput = z.infer<typeof pointPriceBodySchema>;

export class CardNotFoundError extends Error {
  readonly code = 'CARD_NOT_FOUND' as const;
  constructor() {
    super('Карточка не найдена.');
    this.name = 'CardNotFoundError';
  }
}

export class CardPointAlreadyAddedError extends Error {
  readonly code = 'CARD_POINT_ALREADY_ADDED' as const;
  constructor() {
    super('Товар уже есть в этой точке.');
    this.name = 'CardPointAlreadyAddedError';
  }
}

export class CommonPriceMissingError extends Error {
  readonly code = 'COMMON_PRICE_MISSING' as const;
  constructor() {
    super('У карточки нет общей цены.');
    this.name = 'CommonPriceMissingError';
  }
}

export class CardSharedFieldsError extends Error {
  readonly code = 'CARD_SHARED_FIELDS' as const;
  constructor() {
    super('Этот товар продаётся в нескольких точках — «Цену за», фото и комментарий меняйте на «Моей витрине».');
    this.name = 'CardSharedFieldsError';
  }
}
