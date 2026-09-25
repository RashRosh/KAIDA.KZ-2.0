import { findPhotosOwnedBy, type PhotoDb } from '../../media/infrastructure/photos.repository';
import { PhotoNotFoundError } from '../contracts/seller-change-set.contract';

// Every photo in a proposal must exist and belong to the proposing user; otherwise the whole ChangeSet is refused.
export async function assertPhotosOwnedBy(database: PhotoDb, photoIds: string[], ownerUserId: string) {
  if (photoIds.length === 0) return;
  const owned = await findPhotosOwnedBy(database, photoIds, ownerUserId);
  if (owned.length !== photoIds.length) throw new PhotoNotFoundError();
}
