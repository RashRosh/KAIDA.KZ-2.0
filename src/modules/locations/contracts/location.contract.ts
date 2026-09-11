import { z } from 'zod';

export const LOCATION_TYPES = ['market', 'shop', 'pavilion', 'home', 'other'] as const;

export const locationTypeSchema = z.enum(LOCATION_TYPES);

export type LocationType = z.infer<typeof locationTypeSchema>;

export type LocationView = {
  id: string;
  name: string;
  addressText: string;
  type: LocationType;
};
