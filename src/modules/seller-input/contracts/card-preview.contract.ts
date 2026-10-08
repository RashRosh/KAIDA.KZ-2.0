import { z } from 'zod';
import { packInputSchema } from '../../offers/pack/pack';
import {
  CARD_POINT_LIMIT,
  cardCommentSchema,
  cardPhotoIdsSchema,
  cardPriceAmountSchema,
  cardTitleSchema,
  cardUnitSchema,
} from './seller-card.contract';

// pre-publication-buyer-preview (docs/slices/pre-publication-buyer-preview, contract rev 1 §3.3): the values of the card editor
// as the Seller sees them right now — the same field schemas as the publication of a card. Nothing is saved from this body.
// The unit and the pack may be missing (a buyer page can show a price without them; publication still requires the unit).

const uniqueBy = <T>(key: (item: T) => string) => (items: T[]) => new Set(items.map(key)).size === items.length;

const previewFields = {
  title: cardTitleSchema,
  price: cardPriceAmountSchema,
  unit: cardUnitSchema.nullable(),
  pack: packInputSchema.nullable(),
  sellerComment: cardCommentSchema,
  photoIds: cardPhotoIdsSchema,
};

export const cardPreviewBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('create'),
    ...previewFields,
    // ownPrice omitted = the common price
    points: z.array(z.object({ locationId: z.uuid(), ownPrice: cardPriceAmountSchema.optional() }).strict())
      .min(1).max(CARD_POINT_LIMIT)
      .refine(uniqueBy((point: { locationId: string }) => point.locationId), 'Points must be unique'),
  }).strict(),
  z.object({
    kind: z.literal('update'),
    ...previewFields,
    // the Offers of the published card; applyPrice = take the common price
    offers: z.array(z.object({ offerId: z.uuid(), applyPrice: z.boolean() }).strict())
      .min(1).max(CARD_POINT_LIMIT)
      .refine(uniqueBy((offer: { offerId: string }) => offer.offerId), 'Offers must be unique'),
    // points the card is added to, each at the common price
    addPoints: z.array(z.uuid()).max(CARD_POINT_LIMIT).refine(uniqueBy((id: string) => id), 'Points must be unique'),
  }).strict(),
]).refine((value) => value.pack === null || (value.unit !== null && (value.unit.code === 'package' || value.unit.code === 'piece')), 'Pack is only for packages and pieces');

export type CardPreviewInput = z.infer<typeof cardPreviewBodySchema>;
