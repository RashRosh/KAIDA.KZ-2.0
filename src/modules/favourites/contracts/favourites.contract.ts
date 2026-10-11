import { z } from 'zod';
import { searchOfferSchema } from '../../search/contracts/search.contract';

const reference = { id: z.uuid(), offerId: z.uuid(), locationId: z.uuid(), savedAt: z.iso.datetime() };
export const favouriteSchema = z.discriminatedUnion('state', [
  z.object({ ...reference, state: z.literal('available'), offer: searchOfferSchema }).strict(),
  z.object({ ...reference, state: z.literal('unavailable'), title: z.string(), sellerName: z.string(), pointName: z.string(), coverPhotoId: z.uuid().optional() }).strict(),
]);
export const favouritesResponseSchema = z.object({ userId: z.uuid(), favourites: z.array(favouriteSchema), count: z.number().int().nonnegative() }).strict();
export type Favourite = z.infer<typeof favouriteSchema>;
export class FavouriteUnavailable extends Error {}
