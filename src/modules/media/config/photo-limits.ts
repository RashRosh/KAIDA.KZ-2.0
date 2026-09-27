// Photo limits of the offer-photos contract §2. Changing a value here is a product decision, not a refactor.
export const PHOTO_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const PHOTO_MIN_SHORT_SIDE_PX = 300;
export const PHOTO_MAX_INPUT_PIXELS = 50_000_000;
export const PHOTO_DISPLAY_LONG_SIDE_PX = 1600;
export const PHOTO_THUMB_LONG_SIDE_PX = 480;
export const PHOTO_MAX_UNATTACHED_PER_OWNER = 50;
export const PHOTO_ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'] as const;
