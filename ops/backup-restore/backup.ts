import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { listFiles, photoFileName, PHOTO_FILE, PHOTO_VARIANTS } from './fs-walk';
import { PreflightError, RESTORE_MARKER, RuntimeFailure } from './guards';
import { DUMP_FILE, MANIFEST_FILE, MANIFEST_FORMAT_VERSION, PHOTOS_DIR, SUMS_FILE, formatSums, sha256OfFile, type Manifest, type MigrationFingerprint } from './manifest';

// R2 backup (SLICE_CONTRACT §3.1–3.2). Consistency mechanism, in this order:
//   1. one exported database snapshot gives the dump, the row counts and the list of photo rows (all the same instant T);
//   2. the photo files are copied AFTER the dump — every photo a row of the snapshot points at was written to disk before
//      that row existed and is never changed or deleted, so the copy contains it;
//   3. the copy is checked against the photo rows of the snapshot; a missing file fails the backup and no manifest is written.
// Photos uploaded after T may be in the copy: they are orphans, harmless by design. The writes of the application are not paused.

export type SnapshotHandle = {
  tableRows: Record<string, number>;
  migrations: MigrationFingerprint;
  photoIds: string[];
  postgresVersion: string;
  dumpTo(file: string): Promise<void>;
  close(): Promise<void>;
};

export type SourceDatabase = { openSnapshot(): Promise<SnapshotHandle> };

export type BackupDependencies = {
  source: SourceDatabase;
  photosDir: string;
  outDir: string;
  appGitSha: string | null;
  now?: () => Date;
  // Test seam: runs after the dump was taken and before the photo files are copied.
  afterDump?: () => Promise<void>;
};

export type BackupReport = { manifest: Manifest; orphanPhotoFiles: number; skippedFiles: number };

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function createBackup(deps: BackupDependencies): Promise<BackupReport> {
  const photosDir = path.resolve(deps.photosDir);
  const outDir = path.resolve(deps.outDir);
  if (await exists(outDir)) throw new PreflightError(`Refusing: ${outDir} already exists. A backup goes into a new directory.`);
  try {
    if (!(await stat(photosDir)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new PreflightError(`The photo directory ${photosDir} does not exist or is not a directory.`);
  }
  if (await exists(path.join(photosDir, RESTORE_MARKER))) {
    throw new PreflightError(`Refusing: ${photosDir} carries ${RESTORE_MARKER} — it is an unfinished restore target, not a source.`);
  }

  await mkdir(outDir, { recursive: false });
  try {
    const snapshot = await deps.source.openSnapshot();
    try {
      await snapshot.dumpTo(path.join(outDir, DUMP_FILE));
    } finally {
      await snapshot.close();
    }
    await deps.afterDump?.();

    const photoFiles: string[] = [];
    let skipped = 0;
    for (const file of await listFiles(photosDir)) {
      // temporary upload files and anything the application does not write are not part of the set
      if (!PHOTO_FILE.test(file)) { skipped += 1; continue; }
      const target = path.join(outDir, PHOTOS_DIR, file);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(photosDir, file), target);
      photoFiles.push(file);
    }
    await mkdir(path.join(outDir, PHOTOS_DIR), { recursive: true });

    const present = new Set(photoFiles);
    const missing = snapshot.photoIds.flatMap((id) => PHOTO_VARIANTS.map((variant) => photoFileName(id, variant))).filter((file) => !present.has(file));
    if (missing.length > 0) {
      throw new RuntimeFailure(`Inconsistent set: ${missing.length} photo file(s) referenced by the database snapshot are missing from the photo directory (first: ${missing[0]}). No backup was produced.`);
    }

    const sums = new Map<string, string>();
    let photoBytes = 0;
    const dumpSha256 = await sha256OfFile(path.join(outDir, DUMP_FILE));
    sums.set(DUMP_FILE, dumpSha256);
    for (const file of photoFiles) {
      const full = path.join(outDir, PHOTOS_DIR, file);
      sums.set(`${PHOTOS_DIR}/${file}`, await sha256OfFile(full));
      photoBytes += (await stat(full)).size;
    }
    await writeFile(path.join(outDir, SUMS_FILE), formatSums(sums));

    const referenced = new Set(snapshot.photoIds.flatMap((id) => PHOTO_VARIANTS.map((variant) => photoFileName(id, variant))));
    const manifest: Manifest = {
      formatVersion: MANIFEST_FORMAT_VERSION,
      createdAt: (deps.now?.() ?? new Date()).toISOString(),
      appGitSha: deps.appGitSha,
      postgresVersion: snapshot.postgresVersion,
      migrations: snapshot.migrations,
      tableRows: snapshot.tableRows,
      dumpSha256,
      photoRows: snapshot.photoIds.length,
      photoFiles: photoFiles.length,
      photoBytes,
    };
    // Last: its presence is what says «this backup is complete».
    await writeFile(path.join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n');
    return { manifest, orphanPhotoFiles: photoFiles.filter((file) => !referenced.has(file)).length, skippedFiles: skipped };
  } catch (error) {
    // Only the directory this run created, and only because the backup did not finish.
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }
}
