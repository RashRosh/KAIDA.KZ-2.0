import { z } from 'zod';

export const interestProductIdSchema = z.string().uuid();

export const interestSchema = z.object({
  product: z.object({
    id: interestProductIdSchema,
    name: z.string(),
  }),
});

export const interestsResponseSchema = z.object({
  interests: z.array(interestSchema),
});

export const interestResponseSchema = z.object({
  interest: interestSchema,
});

export type BuyerInterest = z.infer<typeof interestSchema>;
export type InterestsResponse = z.infer<typeof interestsResponseSchema>;
