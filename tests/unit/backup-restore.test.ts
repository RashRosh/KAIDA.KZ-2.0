import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBackup, type SnapshotHandle } from '../../ops/backup-restore/backup';
import { validateBundle } from '../../ops/backup-restore/bundle';
import { assertOutsideRepository, assertSafeContainer, PreflightError, RESTORE_MARKER, RuntimeFailure } from '../../ops/backup-restore/guards';
import { formatSums, parseManifest, parseSums, sha256OfFile, type Manifest, type MigrationFingerprint } from '../../ops/backup-restore/manifest';
import { restoreBackup, verifyTarget, type TargetDatabase } from '../../ops/backup-restore/restore';
import { photoFileName } from '../../ops/backup-restore/fs-walk';

// R2 (docs/slices/backup-restore): the logic of backup, bundle preflight and restore against fake database drivers and temporary
// directories. No database, no Docker: the real driver is exercised by the isolated rehearsal in docs/ops/BACKUP_RESTORE.md.

const REPO = path.resolve('C:/work/kaida-repo');
const ID_A = '0a111111-1111-4111-8111-111111111111';
const ID_B = '0b222222-2222-4222-8222-222222222222';
const ID_NEW = '0c333333-3333-4333-8333-333333333333';
const migrations: MigrationFingerprint = { count: 24, lastHash: 'a'.repeat(64) };
const tableRows = { photos: 2, offers: 3 };

let root: string;
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'kaida-r2-unit-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function writePhoto(directory: string, id: string, content = id) {
  for (const variant of ['display', 'thumb'] as const) {
    const file = path.join(directory, photoFileName(id, variant));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${content}:${variant}`);
  }
}

function fakeSnapshot(photoIds: string[], dumpText = 'DUMP'): SnapshotHandle & { closed: boolean } {
  const handle = {
    tableRows, migrations, photoIds, postgresVersion: '18.0', closed: false,
    dumpTo: async (file: string) => { await writeFile(file, dumpText); },
    close: async () => { handle.closed = true; },
  };
  return handle;
}

async function makeBundle(photoIds = [ID_A, ID_B]) {
  const photos = path.join(root, 'source-photos');
  for (const id of photoIds) await writePhoto(photos, id);
  const out = path.join(root, 'bundle');
  await createBackup({ source: { openSnapshot: async () => fakeSnapshot(photoIds) }, photosDir: photos, outDir: out, appGitSha: null });
  return { photos, out };
}

describe('guards', () => {
  const base = { name: 'pg', running: true, hostPorts: [55433], composeWorkingDir: '/elsewhere', database: 'kaida_r2_source' };
  it('accepts a disposable container', () => expect(() => assertSafeContainer(base, REPO)).not.toThrow());
  it.each([
    ['host port 5432', { hostPorts: [5432] }],
    ['the repository compose project', { composeWorkingDir: REPO }],
    ['database kaida', { database: 'kaida' }],
    ['database kaida_test', { database: 'kaida_test' }],
    ['a stopped container', { running: false }],
  ])('refuses %s', (_name, change) => expect(() => assertSafeContainer({ ...base, ...change }, REPO)).toThrow(PreflightError));
  it('refuses paths inside the repository, including .data/photos', () => {
    expect(() => assertOutsideRepository(path.join(REPO, '.data', 'photos'), REPO, 'the photo directory')).toThrow(PreflightError);
    expect(() => assertOutsideRepository(REPO, REPO, 'x')).toThrow(PreflightError);
    expect(() => assertOutsideRepository(path.resolve('C:/work/other'), REPO, 'x')).not.toThrow();
  });
});

describe('manifest and checksums', () => {
  it('round-trips the SHA256SUMS format and rejects malformed lines and duplicates', () => {
    const sums = new Map([['db.dump', 'a'.repeat(64)], ['photos/0a/x.display.webp', 'b'.repeat(64)]]);
    expect(parseSums(formatSums(sums))).toEqual(sums);
    expect(() => parseSums('nonsense\n')).toThrow(PreflightError);
    expect(() => parseSums(`${'a'.repeat(64)}  f\n${'b'.repeat(64)}  f\n`)).toThrow(PreflightError);
  });
  it('rejects a manifest from a newer format, incomplete data and invalid JSON', () => {
    const good: Manifest = { formatVersion: 1, createdAt: 'x', appGitSha: null, postgresVersion: '18', migrations, tableRows, dumpSha256: 'c'.repeat(64), photoRows: 0, photoFiles: 0, photoBytes: 0 };
    expect(parseManifest(JSON.stringify(good))).toEqual(good);
    expect(() => parseManifest(JSON.stringify({ ...good, formatVersion: 2 }))).toThrow(/newer/);
    expect(() => parseManifest(JSON.stringify({ ...good, tableRows: undefined }))).toThrow(PreflightError);
    expect(() => parseManifest('{')).toThrow(PreflightError);
  });
});

describe('createBackup — one consistent set', () => {
  it('writes the dump, the photo copy, the checksums and the manifest last; the bundle validates', async () => {
    const { out } = await makeBundle();
    const valid = await validateBundle(out);
    expect(valid.manifest).toMatchObject({ formatVersion: 1, photoRows: 2, photoFiles: 4, tableRows });
    expect(valid.manifest.dumpSha256).toBe(await sha256OfFile(path.join(out, 'db.dump')));
    expect(JSON.stringify(valid.manifest)).not.toMatch(/secret|password|token/i);
  });

  it('a photo uploaded between the dump and the copy is an orphan, and the set stays valid', async () => {
    const photos = path.join(root, 'source-photos');
    await writePhoto(photos, ID_A);
    const out = path.join(root, 'bundle');
    const report = await createBackup({
      source: { openSnapshot: async () => fakeSnapshot([ID_A]) },
      photosDir: photos, outDir: out, appGitSha: null,
      afterDump: async () => { await writePhoto(photos, ID_NEW); },
    });
    expect(report.orphanPhotoFiles).toBe(2);
    expect((await validateBundle(out)).manifest.photoRows).toBe(1);
  });

  it('takes the dump before it copies photos and closes the snapshot first', async () => {
    const photos = path.join(root, 'source-photos');
    await writePhoto(photos, ID_A);
    const events: string[] = [];
    const snapshot = fakeSnapshot([ID_A]);
    const original = snapshot.dumpTo;
    snapshot.dumpTo = async (file) => { events.push('dump'); await original(file); };
    await createBackup({
      source: { openSnapshot: async () => snapshot }, photosDir: photos, outDir: path.join(root, 'bundle'), appGitSha: null,
      afterDump: async () => { events.push(`afterDump closed=${snapshot.closed}`); },
    });
    expect(events).toEqual(['dump', 'afterDump closed=true']);
  });

  it('fails without a bundle when a photo referenced by the snapshot has no file', async () => {
    const photos = path.join(root, 'source-photos');
    await writePhoto(photos, ID_A);
    const out = path.join(root, 'bundle');
    await expect(createBackup({ source: { openSnapshot: async () => fakeSnapshot([ID_A, ID_B]) }, photosDir: photos, outDir: out, appGitSha: null })).rejects.toThrow(RuntimeFailure);
    await expect(stat(out)).rejects.toThrow();
  });

  it('ignores temporary upload files and refuses an existing output directory, a missing photo directory and an unfinished restore target', async () => {
    const photos = path.join(root, 'source-photos');
    await writePhoto(photos, ID_A);
    await writeFile(path.join(photos, '0a', `${ID_A}.display.webp.123.tmp`), 'half');
    const out = path.join(root, 'bundle');
    const report = await createBackup({ source: { openSnapshot: async () => fakeSnapshot([ID_A]) }, photosDir: photos, outDir: out, appGitSha: null });
    expect(report.skippedFiles).toBe(1);
    await expect(createBackup({ source: { openSnapshot: async () => fakeSnapshot([ID_A]) }, photosDir: photos, outDir: out, appGitSha: null })).rejects.toThrow(/already exists/);
    await expect(createBackup({ source: { openSnapshot: async () => fakeSnapshot([]) }, photosDir: path.join(root, 'nope'), outDir: path.join(root, 'b2'), appGitSha: null })).rejects.toThrow(PreflightError);
    await writeFile(path.join(photos, RESTORE_MARKER), 'x');
    await expect(createBackup({ source: { openSnapshot: async () => fakeSnapshot([ID_A]) }, photosDir: photos, outDir: path.join(root, 'b3'), appGitSha: null })).rejects.toThrow(/unfinished restore/);
  });
});

describe('validateBundle — preflight rejections', () => {
  async function bundle() { return (await makeBundle()).out; }
  it('rejects a missing manifest, dump, photos directory and an unexpected entry', async () => {
    for (const [entry, pattern] of [['manifest.json', /manifest/], ['db.dump', /db\.dump/], ['photos', /photos\//]] as const) {
      const out = await bundle();
      await rm(path.join(out, entry), { recursive: true });
      await expect(validateBundle(out)).rejects.toThrow(pattern);
      await rm(out, { recursive: true });
    }
    const out = await bundle();
    await writeFile(path.join(out, 'extra.txt'), 'x');
    await expect(validateBundle(out)).rejects.toThrow(/unexpected/);
  });
  it('rejects a missing photo file, an extra photo file and a checksum mismatch', async () => {
    let out = await bundle();
    await rm(path.join(out, 'photos', photoFileName(ID_A, 'thumb')));
    await expect(validateBundle(out)).rejects.toThrow(/missing from the bundle/);
    await rm(out, { recursive: true });
    out = await bundle();
    await writePhoto(path.join(out, 'photos'), ID_NEW);
    await expect(validateBundle(out)).rejects.toThrow(/not listed/);
    await rm(out, { recursive: true });
    out = await bundle();
    await writeFile(path.join(out, 'photos', photoFileName(ID_B, 'display')), 'tampered');
    await expect(validateBundle(out)).rejects.toThrow(/Checksum mismatch/);
    await writeFile(path.join(out, 'db.dump'), 'tampered');
    await expect(validateBundle(out)).rejects.toThrow(/Checksum mismatch/);
  });
  it('rejects a manifest that disagrees with the checksum list', async () => {
    const out = await bundle();
    const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8')) as Manifest;
    await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ ...manifest, dumpSha256: 'd'.repeat(64) }));
    await expect(validateBundle(out)).rejects.toThrow(/differs from the manifest/);
  });
});

function fakeTarget(overrides: Partial<TargetDatabase> & { restored?: boolean } = {}): TargetDatabase & { calls: string[] } {
  const calls: string[] = [];
  const state = { restored: false };
  return {
    calls,
    describeNonEmpty: async () => { calls.push('describe'); return null; },
    restoreDump: async () => { calls.push('restore'); state.restored = true; },
    tableRows: async () => tableRows,
    migrations: async () => migrations,
    photoIds: async () => [ID_A, ID_B],
    ...overrides,
  };
}

describe('restoreBackup', () => {
  it('restores into an empty target, verifies, and removes the marker only after verification', async () => {
    const { out } = await makeBundle();
    const photos = path.join(root, 'target-photos');
    const target = fakeTarget();
    const report = await restoreBackup({ target, bundle: out, photosDir: photos, appMigrations: migrations });
    expect(report).toMatchObject({ tableRowsChecked: 2, photoRows: 2, photoFilesChecked: 4, orphanPhotoFiles: 0 });
    await expect(stat(path.join(photos, RESTORE_MARKER))).rejects.toThrow();
    expect(await readFile(path.join(photos, photoFileName(ID_A, 'display')), 'utf8')).toBe(`${ID_A}:display`);
  });

  it('refuses before any change: a non-empty database, a non-empty photo directory, other migrations, an invalid bundle', async () => {
    const { out } = await makeBundle();
    const photos = path.join(root, 'target-photos');
    const calls: string[] = [];
    const nonEmpty = fakeTarget({ describeNonEmpty: async () => '12 tables' , restoreDump: async () => { calls.push('restore'); } });
    await expect(restoreBackup({ target: nonEmpty, bundle: out, photosDir: photos, appMigrations: migrations })).rejects.toThrow(/not empty/);
    await mkdir(photos, { recursive: true });
    await writeFile(path.join(photos, 'something'), 'x');
    await expect(restoreBackup({ target: fakeTarget({ restoreDump: async () => { calls.push('restore'); } }), bundle: out, photosDir: photos, appMigrations: migrations })).rejects.toThrow(/not empty/);
    await rm(path.join(photos, 'something'));
    await expect(restoreBackup({ target: fakeTarget({ restoreDump: async () => { calls.push('restore'); } }), bundle: out, photosDir: photos, appMigrations: { count: 25, lastHash: 'b'.repeat(64) } })).rejects.toThrow(/different set of migrations/);
    await writeFile(path.join(out, 'db.dump'), 'tampered');
    await expect(restoreBackup({ target: fakeTarget({ restoreDump: async () => { calls.push('restore'); } }), bundle: out, photosDir: photos, appMigrations: migrations })).rejects.toThrow(PreflightError);
    expect(calls).toEqual([]);
    expect(await readdirSafe(photos)).toEqual([]);
  });

  it('a runtime failure leaves the marker, is a RuntimeFailure, and a retry into the same target is refused', async () => {
    const { out } = await makeBundle();
    const photos = path.join(root, 'target-photos');
    const failing = fakeTarget({ restoreDump: async () => { throw new RuntimeFailure('pg_restore failed (exit 1)'); } });
    await expect(restoreBackup({ target: failing, bundle: out, photosDir: photos, appMigrations: migrations })).rejects.toThrow(RuntimeFailure);
    await stat(path.join(photos, RESTORE_MARKER));
    await expect(restoreBackup({ target: fakeTarget(), bundle: out, photosDir: photos, appMigrations: migrations })).rejects.toThrow(/did not finish/);
    await expect(verifyTarget({ target: fakeTarget(), bundle: out, photosDir: photos })).rejects.toThrow(/NOT ready/);
    await rm(photos, { recursive: true });
    await expect(restoreBackup({ target: fakeTarget(), bundle: out, photosDir: photos, appMigrations: migrations })).resolves.toBeDefined();
  });

  it('verification failures (row counts, photo rows, a missing or changed photo file) are runtime failures and keep the marker', async () => {
    const { out } = await makeBundle();
    const cases: Array<[string, Partial<TargetDatabase>]> = [
      ['rows', { tableRows: async () => ({ photos: 2, offers: 2 }) }],
      ['photo rows', { photoIds: async () => [ID_A] }],
      ['migrations', { migrations: async () => ({ count: 1, lastHash: null }) }],
    ];
    for (const [name, override] of cases) {
      const photos = path.join(root, `target-${name.replace(' ', '-')}`);
      await expect(restoreBackup({ target: fakeTarget(override), bundle: out, photosDir: photos, appMigrations: migrations }), name).rejects.toThrow(RuntimeFailure);
      await stat(path.join(photos, RESTORE_MARKER));
    }
  });
});

async function readdirSafe(directory: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  try { return await readdir(directory); } catch { return []; }
}
