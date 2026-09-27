import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readPhotoStorageDirectory } from '../config/photo-storage.config';
import type { PhotoVariant } from '../contracts/photo.contract';

// Storage boundary: an S3-compatible store can replace the disk later without touching Offer data.
export type PhotoStorage = {
  write(photoId: string, variant: PhotoVariant, data: Buffer): Promise<void>;
  read(photoId: string, variant: PhotoVariant): Promise<Buffer | null>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createDiskPhotoStorage(directory: string = readPhotoStorageDirectory()): PhotoStorage {
  const fileOf = (photoId: string, variant: PhotoVariant) => {
    if (!UUID_PATTERN.test(photoId)) throw new Error('Photo id must be a lowercase UUID');
    return path.join(directory, photoId.slice(0, 2), `${photoId}.${variant}.webp`);
  };
  return {
    async write(photoId, variant, data) {
      const file = fileOf(photoId, variant);
      await mkdir(path.dirname(file), { recursive: true });
      // Write-then-rename so a reader never sees a half-written file.
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, data);
      await rename(temporary, file);
    },
    async read(photoId, variant) {
      try {
        return await readFile(fileOf(photoId, variant));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
  };
}

let defaultStorage: PhotoStorage | undefined;

export function getPhotoStorage(): PhotoStorage {
  defaultStorage ??= createDiskPhotoStorage();
  return defaultStorage;
}
