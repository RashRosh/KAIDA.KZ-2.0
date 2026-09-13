import { z } from 'zod';

export const LOCATION_TYPES = ['market', 'shop', 'pavilion', 'home', 'other'] as const;

export const locationTypeSchema = z.enum(LOCATION_TYPES);

export const locationGeoSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

export type LocationType = z.infer<typeof locationTypeSchema>;
export type LocationGeo = z.infer<typeof locationGeoSchema>;

export type LocationView = {
  id: string;
  name: string;
  addressText: string;
  type: LocationType;
  geo: LocationGeo | null;
};
