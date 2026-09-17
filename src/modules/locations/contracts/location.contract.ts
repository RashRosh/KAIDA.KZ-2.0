import { z } from 'zod';

export const LOCATION_TYPES = ['market', 'shop', 'pavilion', 'home', 'other'] as const;

export const locationTypeSchema = z.enum(LOCATION_TYPES);

export const locationIdentitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: locationTypeSchema,
  addressText: z.string().trim().min(1).max(500),
}).strict();

export const locationGeoSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

export type LocationType = z.infer<typeof locationTypeSchema>;
export type LocationGeo = z.infer<typeof locationGeoSchema>;
export type LocationIdentityInput = z.infer<typeof locationIdentitySchema>;

export type LocationView = {
  id: string;
  name: string;
  addressText: string;
  type: LocationType;
  geo: LocationGeo | null;
};
