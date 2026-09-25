import { and, eq, inArray, notExists, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { offers } from '../../offers/db/offers.table';
import { offerPhotos } from '../../offers/db/offer-photos.table';
import { photos } from '../db/photos.table';

export type PhotoDb = Pick<Database, 'insert' | 'select'>;

export async function insertPhoto(database: PhotoDb, values: { id: string; ownerUserId: string; width: number; height: number }) {
  await database.insert(photos).values(values);
}

// Unattached = not in any Offer photo list yet (uploaded, maybe proposed in an unconfirmed ChangeSet).
export async function countUnattachedPhotos(database: PhotoDb, ownerUserId: string): Promise<number> {
  const rows = await database.select({ count: sql<number>`count(*)::int` }).from(photos).where(and(
    eq(photos.ownerUserId, ownerUserId),
    notExists(database.select({ one: sql`1` }).from(offerPhotos).where(eq(offerPhotos.photoId, photos.id))),
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
    publicViaActiveOffer: sql<boolean>`exists (
      select 1 from ${offerPhotos} inner join ${offers} on ${offers.id} = ${offerPhotos.offerId}
      where ${offerPhotos.photoId} = ${photos.id} and ${offers.status} = 'active'
    )`,
  }).from(photos).where(eq(photos.id, photoId)).limit(1);
  return rows[0] ?? null;
}
