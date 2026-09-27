import { z } from 'zod';
import { openingHoursSchema } from '../../locations/hours/opening-hours';
import { pointPublicContactsSchema } from '../../locations/details/point-public-contacts';

export const searchQuerySchema = z.string().trim().min(1, 'Введите название товара.');

export const searchOfferSchema = z.object({
  id: z.uuid(),
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    nameLocale: z.enum(['ru', 'kk']).optional(),
  }),
  seller: z.object({
    id: z.uuid(),
    displayName: z.string(),
  }),
  // point-contacts-hours: contacts belong to the point and are public only when verified; hours are always present.
  location: z.object({
    id: z.uuid(),
    name: z.string(),
    addressText: z.string(),
    contacts: pointPublicContactsSchema.optional(),
    openingHours: openingHoursSchema,
  }),
  price: z.object({
    amount: z.string().regex(/^\d+(?:\.\d+)?$/),
    currency: z.literal('KZT'),
    unit: z.string().nullable(),
  }),
  sellerComment: z.string().nullable(),
  // Present only when the Offer has photos; the thumbnail URL is built from it.
  coverPhotoId: z.uuid().optional(),
  // Present only while the translator is enabled and the comment is not already in the interface locale.
  sellerCommentTranslation: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('translated'),
      text: z.string(),
      locale: z.enum(['ru', 'kk']),
      originalLocale: z.enum(['ru', 'kk']).optional(),
    }),
    z.object({ status: z.literal('unavailable') }),
  ]).optional(),
});

export const searchResponseSchema = z.object({
  query: z.string(),
  offers: z.array(searchOfferSchema),
});

export type SearchOffer = z.infer<typeof searchOfferSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
