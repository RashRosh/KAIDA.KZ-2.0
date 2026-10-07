import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateBundle, type ValidBundle } from './bundle';
import { listFiles, photoFileName, PHOTO_VARIANTS } from './fs-walk';
import { PreflightError, RESTORE_MARKER, RuntimeFailure } from './guards';
import { DUMP_FILE, PHOTOS_DIR, sameMigrations, sha256OfFile, type MigrationFingerprint } from './manifest';

// R2 restore (SLICE_CONTRACT §3.3). Two kinds of failure:
//   • preflight (PreflightError, exit 2): invalid bundle, wrong application version, unsafe or non-empty target — nothing was changed;
//   • runtime (RuntimeFailure, exit 3): something failed after the target was modified. The target is left as it is, carrying
//     RESTORE_MARKER in its photo directory, and is never reported as ready. Cleanup: recreate the disposable target (runbook).

export type TargetDatabase = {
  // Why the database is not an empty restore target, or null when it is empty (no user tables, no user schemas besides public).
  describeNonEmpty(): Promise<string | null>;
  restoreDump(file: string): Promise<void>;
  tableRows(): Promise<Record<string, number>>;
  migrations(): Promise<MigrationFingerprint>;
  photoIds(): Promise<string[]>;
};

export type RestoreDependencies = {
  target: TargetDatabase;
  bundle: string;
  photosDir: string;
  // The migration fingerprint of the application version running the tool; the bundle must have been made by the same migrations.
  appMigrations: MigrationFingerprint;
};

export type VerificationReport = {
  tableRowsChecked: number;
  photoRows: number;
  photoFilesChecked: number;
  orphanPhotoFiles: number;
};

export async function verifyRestored(deps: Pick<RestoreDependencies, 'target' | 'photosDir'>, valid: ValidBundle): Promise<VerificationReport> {
  const problems: string[] = [];
  const rows = await deps.target.tableRows();
  const expected = valid.manifest.tableRows;
  for (const table of new Set([...Object.keys(expected), ...Object.keys(rows)])) {
    if (rows[table] !== expected[table]) problems.push(`table ${table}: manifest ${expected[table] ?? 'absent'}, restored ${rows[table] ?? 'absent'}`);
  }
  if (!sameMigrations(await deps.target.migrations(), valid.manifest.migrations)) problems.push('applied migrations differ from the manifest');

  const photoIds = await deps.target.photoIds();
  if (photoIds.length !== valid.manifest.photoRows) problems.push(`photo rows: manifest ${valid.manifest.photoRows}, restored ${photoIds.length}`);
  const referenced = new Set<string>();
  for (const id of photoIds) {
    for (const variant of PHOTO_VARIANTS) {
      const file = photoFileName(id, variant);
      referenced.add(file);
      const expectedHash = valid.sums.get(`${PHOTOS_DIR}/${file}`);
      let actual: string | null = null;
      try {
        actual = await sha256OfFile(path.join(deps.photosDir, file));
      } catch {
        actual = null;
      }
      if (actual === null) problems.push(`photo file missing: ${file}`);
      else if (expectedHash === undefined || actual !== expectedHash) problems.push(`photo file differs from the bundle: ${file}`);
    }
  }
  const onDisk = (await listFiles(deps.photosDir)).filter((file) => file !== RESTORE_MARKER);
  if (problems.length > 0) {
    throw new RuntimeFailure(`Verification failed (${problems.length}): ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '; …' : ''}`);
  }
  return {
    tableRowsChecked: Object.keys(expected).length,
    photoRows: photoIds.length,
    photoFilesChecked: photoIds.length * PHOTO_VARIANTS.length,
    orphanPhotoFiles: onDisk.filter((file) => !referenced.has(file)).length,
  };
}

async function describePhotoTarget(photosDir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(photosDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (entries.includes(RESTORE_MARKER)) return `the photo directory ${photosDir} carries ${RESTORE_MARKER} (an earlier restore did not finish)`;
  return entries.length === 0 ? null : `the photo directory ${photosDir} is not empty`;
}

export async function restoreBackup(deps: RestoreDependencies): Promise<VerificationReport> {
  const photosDir = path.resolve(deps.photosDir);
  const bundle = path.resolve(deps.bundle);

  // ── preflight: nothing below changes the target or the bundle ──
  const valid = await validateBundle(bundle);
  if (!sameMigrations(valid.manifest.migrations, deps.appMigrations)) {
    throw new PreflightError(`The bundle was made with a different set of migrations (bundle ${valid.manifest.migrations.count}, this application ${deps.appMigrations.count}). Restore with the matching application version.`);
  }
  const nonEmptyDatabase = await deps.target.describeNonEmpty();
  if (nonEmptyDatabase !== null) throw new PreflightError(`Refusing: the target database is not empty (${nonEmptyDatabase}). Restore goes into a new, empty database only.`);
  const nonEmptyPhotos = await describePhotoTarget(photosDir);
  if (nonEmptyPhotos !== null) throw new PreflightError(`Refusing: ${nonEmptyPhotos}. Restore goes into a missing or empty directory only.`);

  // ── execution: from here on a failure leaves a partly restored disposable target ──
  try {
    await mkdir(photosDir, { recursive: true });
    await writeFile(path.join(photosDir, RESTORE_MARKER), 'restore in progress or failed; this target is NOT ready\n');
    await deps.target.restoreDump(path.join(bundle, DUMP_FILE));
    for (const file of valid.photoFiles) {
      const target = path.join(photosDir, file);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(bundle, PHOTOS_DIR, file), target);
    }
    const report = await verifyRestored({ target: deps.target, photosDir }, valid);
    await rm(path.join(photosDir, RESTORE_MARKER));
    return report;
  } catch (error) {
    if (error instanceof RuntimeFailure) throw error;
    throw new RuntimeFailure(error instanceof Error ? error.message : 'restore failed');
  }
}

// `backup:verify`: read-only check of an already restored target against its bundle.
export async function verifyTarget(deps: Pick<RestoreDependencies, 'target' | 'bundle' | 'photosDir'>): Promise<VerificationReport> {
  const photosDir = path.resolve(deps.photosDir);
  try {
    await stat(path.join(photosDir, RESTORE_MARKER));
    throw new PreflightError(`${photosDir} carries ${RESTORE_MARKER}: the restore did not finish, this target is NOT ready.`);
  } catch (error) {
    if (error instanceof PreflightError) throw error;
  }
  const valid = await validateBundle(path.resolve(deps.bundle));
  return verifyRestored({ target: deps.target, photosDir }, valid);
}
