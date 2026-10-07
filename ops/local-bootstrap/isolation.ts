// R1 guard: the bootstrap check and smoke must never reach the development stack. Both the DB-state check and the
// Playwright config call this before doing anything.
const DEVELOPMENT_DATABASES = ['kaida', 'kaida_test'];

export function assertIsolatedDatabase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required (the isolated bootstrap database).');
  const parsed = new URL(url);
  const port = parsed.port || '5432';
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (port === '5432' || DEVELOPMENT_DATABASES.includes(database)) {
    throw new Error(`Refusing to run: DATABASE_URL points at the development stack (port ${port}, database ${database}).`);
  }
  return url;
}

export function requirePhotoStorageDirectory(): string {
  const directory = process.env.PHOTO_STORAGE_DIR;
  if (!directory) throw new Error('PHOTO_STORAGE_DIR is required (the isolated bootstrap photo directory).');
  return directory;
}
