import { z } from 'zod';

export const searchQuerySchema = z.string().trim().min(1, 'Введите название товара.');

export const searchOfferSchema = z.object({
  id: z.uuid(),
  product: z.object({ id: z.uuid(), name: z.string() }),
  seller: z.object({ id: z.uuid(), displayName: z.string() }),
  location: z.object({ id: z.uuid(), name: z.string(), addressText: z.string() }),
  price: z.object({
    amount: z.string().regex(/^\d+(?:\.\d+)?$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    unit: z.string().nullable(),
  }).nullable(),
  sellerComment: z.string().nullable(),
});

export const searchResponseSchema = z.object({
  query: z.string(),
  offers: z.array(searchOfferSchema),
});

export type SearchOffer = z.infer<typeof searchOfferSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
