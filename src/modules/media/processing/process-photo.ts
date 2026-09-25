import sharp, { type Metadata } from 'sharp';
import {
  PHOTO_ACCEPTED_FORMATS,
  PHOTO_DISPLAY_LONG_SIDE_PX,
  PHOTO_MAX_INPUT_PIXELS,
  PHOTO_MAX_UPLOAD_BYTES,
  PHOTO_MIN_SHORT_SIDE_PX,
  PHOTO_THUMB_LONG_SIDE_PX,
} from '../config/photo-limits';
import { PhotoRejectedError } from '../contracts/photo.contract';

export type ProcessedPhoto = {
  display: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
};

// Re-encodes an uploaded image. sharp drops every metadata block (EXIF with GPS, XMP, ICC comments) unless asked to
// keep it, so the stored variants never carry where or on what the photo was taken. The original is not kept.
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.byteLength > PHOTO_MAX_UPLOAD_BYTES) throw new PhotoRejectedError('PHOTO_TOO_LARGE');

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: PHOTO_MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new PhotoRejectedError('PHOTO_UNSUPPORTED_TYPE');
  }
  if (!metadata.format || !(PHOTO_ACCEPTED_FORMATS as readonly string[]).includes(metadata.format)) {
    throw new PhotoRejectedError('PHOTO_UNSUPPORTED_TYPE');
  }
  if (!metadata.width || !metadata.height) throw new PhotoRejectedError('PHOTO_UNSUPPORTED_TYPE');
  if (Math.min(metadata.width, metadata.height) < PHOTO_MIN_SHORT_SIDE_PX) {
    throw new PhotoRejectedError('PHOTO_TOO_SMALL');
  }

  const encode = (longSide: number) => sharp(input, { limitInputPixels: PHOTO_MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: longSide, height: longSide, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  try {
    const display = await encode(PHOTO_DISPLAY_LONG_SIDE_PX);
    const thumb = await encode(PHOTO_THUMB_LONG_SIDE_PX);
    return { display: display.data, thumb: thumb.data, width: display.info.width, height: display.info.height };
  } catch {
    throw new PhotoRejectedError('PHOTO_UNSUPPORTED_TYPE');
  }
}
