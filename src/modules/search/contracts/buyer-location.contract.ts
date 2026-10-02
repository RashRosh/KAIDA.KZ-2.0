import { z } from 'zod';
import { searchQuerySchema, searchSortModeSchema } from './search.contract';

export const buyerLocationSchema = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export type BuyerLocation = z.infer<typeof buyerLocationSchema>;

export const geoSearchRequestSchema = z.strictObject({
  q: searchQuerySchema,
  buyerLocation: buyerLocationSchema,
  // stage #5: additive sort mode; numeric weights are not part of the public request contract and are rejected
  // by this strict schema.
  sort: searchSortModeSchema.optional(),
});

export type GeoSearchRequest = z.infer<typeof geoSearchRequestSchema>;
