import { z } from 'zod';
import { buyerLocationSchema } from '../../search/contracts/buyer-location.contract';
import { searchOfferSchema } from '../../search/contracts/search.contract';

export const nearbyRequestSchema = z.strictObject({
  buyerLocation: buyerLocationSchema,
});

export const discoveryOfferSchema = searchOfferSchema.extend({
  distanceMeters: z.number().int().nonnegative(),
});

export const nearbyResponseSchema = z.strictObject({
  offers: z.array(discoveryOfferSchema),
});

export type NearbyRequest = z.infer<typeof nearbyRequestSchema>;
export type DiscoveryOffer = z.infer<typeof discoveryOfferSchema>;
export type NearbyResponse = z.infer<typeof nearbyResponseSchema>;
