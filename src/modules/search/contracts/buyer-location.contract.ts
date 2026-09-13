import { z } from 'zod';
import { searchQuerySchema } from './search.contract';

export const buyerLocationSchema = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export type BuyerLocation = z.infer<typeof buyerLocationSchema>;

export const geoSearchRequestSchema = z.strictObject({
  q: searchQuerySchema,
  buyerLocation: buyerLocationSchema,
});

export type GeoSearchRequest = z.infer<typeof geoSearchRequestSchema>;
