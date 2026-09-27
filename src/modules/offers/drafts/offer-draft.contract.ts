import { z } from 'zod';

// seller-showcase-editor §2 «Drafts»: the editor of a new card as it is; any field may be empty. Validated only for
// shape and size — the full rules apply when the draft is published.
export const offerDraftPayloadSchema = z.object({
  title: z.string().max(200),
  productId: z.uuid().nullable(),
  price: z.string().max(40),
  unit: z.union([
    z.object({ code: z.enum(['kg', 'piece', 'liter', 'package']) }).strict(),
    z.object({ code: z.literal('other'), value: z.string().max(40) }).strict(),
  ]).nullable(),
  pack: z.object({ amount: z.string().max(20), unit: z.enum(['g', 'kg', 'ml', 'l']) }).strict().nullable(),
  sellerComment: z.string().max(500),
  photoIds: z.array(z.uuid()).max(5),
  points: z.array(z.object({ locationId: z.uuid(), ownPrice: z.string().max(40).nullable() }).strict()).max(50),
}).strict();

export type OfferDraftPayload = z.infer<typeof offerDraftPayloadSchema>;

export type OfferDraftView = {
  id: string;
  payload: OfferDraftPayload;
  createdAt: string;
  updatedAt: string;
};
