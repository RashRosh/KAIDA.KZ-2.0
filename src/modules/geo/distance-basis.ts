import { z } from 'zod';

export const distanceBasisSchema = z.enum(['straight', 'road']);
export type DistanceBasis = z.infer<typeof distanceBasisSchema>;
