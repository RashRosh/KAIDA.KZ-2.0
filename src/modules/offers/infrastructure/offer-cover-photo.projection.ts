import { sql } from 'drizzle-orm';

// Cover = position 0 of the Offer photo list; null when the Offer has no photos. The outer reference is written
// out in full because drizzle may leave single-table column refs unqualified inside a subquery.
export const offerCoverPhotoIdSelection = sql<string | null>`(
  select op.photo_id from offer_photos op where op.offer_id = "offers"."id" and op.position = 0
)`;
