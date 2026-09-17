import { z } from 'zod';
import { locationIdentitySchema, type LocationView } from '../../locations/contracts/location.contract';

const sellerInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
}).strict();

export const sellerSetupBodySchema = z.object({
  seller: sellerInputSchema,
  location: locationIdentitySchema,
}).strict();

export type SellerSetupInput = z.infer<typeof sellerSetupBodySchema>;

export type SellerView = {
  id: string;
  displayName: string;
  locations: LocationView[];
};
