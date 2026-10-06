import { z } from 'zod';
import { searchIntentSchema, searchProductIdSchema, searchQuerySchema, searchSortDirectionSchema, searchSortModeSchema } from './search.contract';

export const buyerLocationSchema = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export type BuyerLocation = z.infer<typeof buyerLocationSchema>;

export const geoSearchRequestSchema = z.strictObject({
  q: searchQuerySchema,
  // S15B-3: with `productId` the Search runs on that Product only; `q` stays the display text.
  productId: searchProductIdSchema.optional(),
  buyerLocation: buyerLocationSchema,
  // Stage 6 Rev 3: the sort criterion and its direction; numeric weights are not part of the public request contract
  // and are rejected by this strict schema.
  sort: searchSortModeSchema.optional(),
  direction: searchSortDirectionSchema.optional(),
  // S15C / D0: the intentional-search marker.
  intent: searchIntentSchema.optional(),
}).refine((request) => request.sort !== 'relevance' || request.direction === undefined, {
  // S15B-4b: an explicit relevance order has no direction.
  path: ['direction'],
});

export type GeoSearchRequest = z.infer<typeof geoSearchRequestSchema>;
