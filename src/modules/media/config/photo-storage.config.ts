import path from 'node:path';

export type PhotoStorageEnvironment = Readonly<Record<string, string | undefined>>;

// Photos live on the KAIDA server's own disk (PROJECT_RULES §10.1); deployment mounts a volume at this directory.
export function readPhotoStorageDirectory(env: PhotoStorageEnvironment = process.env): string {
  const raw = env.PHOTO_STORAGE_DIR;
  return path.resolve(raw === undefined || raw === '' ? '.data/photos' : raw);
}
