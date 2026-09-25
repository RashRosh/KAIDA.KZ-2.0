import { getDatabase, type Database } from '../../../db/client';
import type { PhotoVariant } from '../contracts/photo.contract';
import { findPhotoAccess } from '../infrastructure/photos.repository';
import { getPhotoStorage, type PhotoStorage } from '../storage/photo-storage';

export type PhotoReadResult =
  | { status: 'ok'; data: Buffer; visibility: 'public' | 'owner' }
  | { status: 'not_found' };

// A photo is public while it is attached to an active Offer; otherwise only its owner may fetch it.
// Everything else answers not_found, so a guessed id reveals nothing.
export async function readPhoto(
  photoId: string,
  variant: PhotoVariant,
  viewerUserId: string | null,
  dependencies: { database?: Database; storage?: PhotoStorage } = {},
): Promise<PhotoReadResult> {
  const database = dependencies.database ?? getDatabase();
  const storage = dependencies.storage ?? getPhotoStorage();
  const access = await findPhotoAccess(database, photoId);
  if (!access) return { status: 'not_found' };
  const visibility = access.publicViaActiveOffer ? 'public' : access.ownerUserId === viewerUserId ? 'owner' : null;
  if (!visibility) return { status: 'not_found' };
  const data = await storage.read(photoId, variant);
  return data ? { status: 'ok', data, visibility } : { status: 'not_found' };
}
