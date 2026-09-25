import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { photos } from '../db/photos.table';

export type PhotoDb = Pick<Database, 'insert' | 'select'>;

export async function insertPhoto(database: PhotoDb, values: { id: string; ownerUserId: string; width: number; height: number }) {
  await database.insert(photos).values(values);
}

// Unattached = not in any Offer photo list yet (uploaded, maybe proposed in an unconfirmed ChangeSet).
export async function countUnattachedPhotos(database: PhotoDb, ownerUserId: string): Promise<number> {
  const rows = await database.select({ count: sql<number>`count(*)::int` }).from(photos).where(and(
    eq(photos.ownerUserId, ownerUserId),
    sql`not exists (select 1 from offer_photos op where op.photo_id = "photos"."id")`,
  ));
  return rows[0]?.count ?? 0;
}

export async function findPhotosOwnedBy(database: PhotoDb, photoIds: string[], ownerUserId: string) {
  if (photoIds.length === 0) return [];
  return database.select({ id: photos.id }).from(photos)
    .where(and(inArray(photos.id, photoIds), eq(photos.ownerUserId, ownerUserId)));
}

export async function findPhotoAccess(database: PhotoDb, photoId: string) {
  const rows = await database.select({
    ownerUserId: photos.ownerUserId,
    // Explicit aliases: drizzle leaves single-table column refs unqualified, which would bind to the inner tables.
    publicViaActiveOffer: sql<boolean>`exists (
      select 1 from offer_photos op inner join offers o on o.id = op.offer_id
      where op.photo_id = "photos"."id" and o.status = 'active'
    )`,
  }).from(photos).where(eq(photos.id, photoId)).limit(1);
  return rows[0] ?? null;
}
