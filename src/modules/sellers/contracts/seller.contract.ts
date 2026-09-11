import { z } from 'zod';
import { locationTypeSchema, type LocationView } from '../../locations/contracts/location.contract';

const sellerInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
}).strict();

const locationInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: locationTypeSchema,
  addressText: z.string().trim().min(1).max(500),
}).strict();

export const sellerSetupBodySchema = z.object({
  seller: sellerInputSchema,
  location: locationInputSchema,
}).strict();

export type SellerSetupInput = z.infer<typeof sellerSetupBodySchema>;

export type SellerView = {
  id: string;
  displayName: string;
  locations: LocationView[];
};
