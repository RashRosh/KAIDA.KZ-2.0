import { sql } from 'drizzle-orm';
import { offers } from '../db/offers.table';

// Cover = position 0 of the Offer photo list; null when the Offer has no photos.
export const offerCoverPhotoIdSelection = sql<string | null>`(
  select op.photo_id from offer_photos op where op.offer_id = ${offers.id} and op.position = 0
)`;
