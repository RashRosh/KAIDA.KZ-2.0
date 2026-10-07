import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createBackup } from './backup';
import { DockerDatabase, inspectContainer } from './docker';
import { assertOutsideRepository, assertSafeContainer, PreflightError, RuntimeFailure } from './guards';
import type { MigrationFingerprint } from './manifest';
import { restoreBackup, verifyTarget } from './restore';

// R2 operator CLI (docs/ops/BACKUP_RESTORE.md): `backup:create`, `backup:restore`, `backup:verify`.
// Exit codes: 0 done · 1 usage · 2 refused before anything was changed (preflight) · 3 failed (a restore target is NOT ready).

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function appMigrationFingerprint(): Promise<MigrationFingerprint> {
  const folder = path.join(REPO_ROOT, 'drizzle', 'migrations');
  const journal = JSON.parse(await readFile(path.join(folder, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> };
  const last = journal.entries[journal.entries.length - 1];
  // drizzle stores the sha256 of the migration file's text as the migration hash
  const sql = await readFile(path.join(folder, `${last.tag}.sql`), 'utf8');
  return { count: journal.entries.length, lastHash: createHash('sha256').update(sql).digest('hex') };
}

function gitSha(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT }, (error, stdout) => resolve(error ? null : stdout.trim()));
  });
}

const USAGE = `Usage:
  pnpm backup:create  --db-container <name> --photos <dir> --out <new dir outside the repository>
  pnpm backup:restore --bundle <dir> --db-container <name> --photos <empty dir outside the repository>
  pnpm backup:verify  --bundle <dir> --db-container <name> --photos <dir>
Options: --db-user, --db-name override the values read from the container's POSTGRES_USER / POSTGRES_DB.`;

async function connect(values: { 'db-container'?: string; 'db-user'?: string; 'db-name'?: string }): Promise<DockerDatabase> {
  const container = values['db-container'];
  if (!container) throw new Error('usage');
  const inspected = await inspectContainer(container);
  const user = values['db-user'] ?? inspected.user;
  const database = values['db-name'] ?? inspected.database;
  if (!user || !database) throw new PreflightError('The database user and name are unknown: pass --db-user and --db-name.');
  assertSafeContainer({ ...inspected.facts, database }, REPO_ROOT);
  return new DockerDatabase(container, user, database);
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest.filter((argument) => argument !== '--'),
    options: {
      'db-container': { type: 'string' }, 'db-user': { type: 'string' }, 'db-name': { type: 'string' },
      photos: { type: 'string' }, out: { type: 'string' }, bundle: { type: 'string' },
    },
    strict: true,
  });
  if (!values.photos) throw new Error('usage');

  if (command === 'create') {
    if (!values.out) throw new Error('usage');
    assertOutsideRepository(values.photos, REPO_ROOT, 'the photo directory');
    assertOutsideRepository(values.out, REPO_ROOT, 'the backup directory');
    const source = await connect(values);
    const report = await createBackup({ source, photosDir: values.photos, outDir: values.out, appGitSha: await gitSha() });
    const m = report.manifest;
    console.log(`Backup complete: ${path.resolve(values.out)}`);
    console.log(`  tables ${Object.keys(m.tableRows).length}, migrations ${m.migrations.count}, photo rows ${m.photoRows}, photo files ${m.photoFiles} (${report.orphanPhotoFiles} orphan, ${report.skippedFiles} skipped), ${m.photoBytes} bytes`);
    console.log('  The bundle holds personal data and live sessions: keep it confidential and out of Git. Secrets are NOT included.');
    return 0;
  }

  if (command === 'restore' || command === 'verify') {
    if (!values.bundle) throw new Error('usage');
    assertOutsideRepository(values.photos, REPO_ROOT, 'the photo directory');
    const target = await connect(values);
    if (command === 'verify') {
      const report = await verifyTarget({ target, bundle: values.bundle, photosDir: values.photos });
      console.log(`Verified: ${report.tableRowsChecked} tables, ${report.photoRows} photo rows, ${report.photoFilesChecked} photo files match the bundle (${report.orphanPhotoFiles} orphan files, informational).`);
      return 0;
    }
    const report = await restoreBackup({ target, bundle: values.bundle, photosDir: values.photos, appMigrations: await appMigrationFingerprint() });
    console.log(`Restore OK and verified: ${report.tableRowsChecked} tables, ${report.photoRows} photo rows, ${report.photoFilesChecked} photo files (${report.orphanPhotoFiles} orphan files, informational).`);
    console.log('  Start the application with its own configuration; secrets are not part of the bundle (see the runbook).');
    return 0;
  }
  throw new Error('usage');
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    if (error instanceof PreflightError) {
      console.error(`REFUSED (nothing was changed): ${error.message}`);
      process.exit(2);
    }
    if (error instanceof RuntimeFailure) {
      console.error(`FAILED: ${error.message}`);
      console.error('NOT READY. A restore target must be removed and recreated (docs/ops/BACKUP_RESTORE.md); the source and the bundle were only read.');
      process.exit(3);
    }
    if (error instanceof Error && (error.message === 'usage' || String((error as { code?: string }).code).startsWith('ERR_PARSE_ARGS'))) {
      console.error(USAGE);
      process.exit(1);
    }
    console.error(`FAILED unexpectedly: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exit(3);
  },
);
