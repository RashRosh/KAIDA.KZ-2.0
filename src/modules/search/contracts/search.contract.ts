import { z } from 'zod';
import { sellerPublicContactsSchema } from '../../sellers/contracts/seller-contact.contract';

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
    contacts: sellerPublicContactsSchema.optional(),
  }),
  location: z.object({ id: z.uuid(), name: z.string(), addressText: z.string() }),
  price: z.object({
    amount: z.string().regex(/^\d+(?:\.\d+)?$/),
    currency: z.literal('KZT'),
    unit: z.string().nullable(),
  }),
  sellerComment: z.string().nullable(),
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
