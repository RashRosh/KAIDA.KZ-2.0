import { z } from 'zod';

export const photoVariants = ['display', 'thumb'] as const;
export type PhotoVariant = typeof photoVariants[number];

export const photoIdSchema = z.uuid();
export const photoVariantSchema = z.enum(photoVariants);

export type UploadedPhotoView = { id: string; width: number; height: number };

export function photoUrl(photoId: string, variant: PhotoVariant): string {
  return `/media/photos/${photoId}/${variant}`;
}

export type PhotoRejectionCode =
  | 'PHOTO_UNSUPPORTED_TYPE'
  | 'PHOTO_TOO_LARGE'
  | 'PHOTO_TOO_SMALL'
  | 'PHOTO_UNATTACHED_LIMIT';

export class PhotoRejectedError extends Error {
  constructor(readonly code: PhotoRejectionCode) {
    super(code);
    this.name = 'PhotoRejectedError';
  }
}
