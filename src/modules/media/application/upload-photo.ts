import { randomUUID } from 'node:crypto';
import { getDatabase, type Database } from '../../../db/client';
import { PHOTO_MAX_UNATTACHED_PER_OWNER } from '../config/photo-limits';
import { PhotoRejectedError, type UploadedPhotoView } from '../contracts/photo.contract';
import { countUnattachedPhotos, insertPhoto } from '../infrastructure/photos.repository';
import { processPhoto } from '../processing/process-photo';
import { getPhotoStorage, type PhotoStorage } from '../storage/photo-storage';

export async function uploadPhoto(
  ownerUserId: string,
  input: Buffer,
  dependencies: { database?: Database; storage?: PhotoStorage } = {},
): Promise<UploadedPhotoView> {
  const database = dependencies.database ?? getDatabase();
  const storage = dependencies.storage ?? getPhotoStorage();

  if (await countUnattachedPhotos(database, ownerUserId) >= PHOTO_MAX_UNATTACHED_PER_OWNER) {
    throw new PhotoRejectedError('PHOTO_UNATTACHED_LIMIT');
  }
  const processed = await processPhoto(input);
  const id = randomUUID();
  // Files first: a row never points at missing files; a failed insert only leaves unreachable files behind.
  await storage.write(id, 'display', processed.display);
  await storage.write(id, 'thumb', processed.thumb);
  await insertPhoto(database, { id, ownerUserId, width: processed.width, height: processed.height });
  return { id, width: processed.width, height: processed.height };
}
