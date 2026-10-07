import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { listFiles, PHOTO_FILE } from './fs-walk';
import { PreflightError } from './guards';
import { DUMP_FILE, MANIFEST_FILE, PHOTOS_DIR, SUMS_FILE, parseSums, readManifest, sha256OfFile, type Manifest } from './manifest';

export type ValidBundle = { manifest: Manifest; sums: Map<string, string>; photoFiles: string[] };

function sample(names: string[]): string {
  return names.slice(0, 3).join(', ') + (names.length > 3 ? `, … (${names.length} in total)` : '');
}

// Restore preflight, part 1 (SLICE_CONTRACT §3.3–3.4): everything that can be learned from the bundle alone. Read-only.
export async function validateBundle(bundle: string): Promise<ValidBundle> {
  let rootEntries: string[];
  try {
    if (!(await stat(bundle)).isDirectory()) throw new Error('not a directory');
    rootEntries = await readdir(bundle);
  } catch {
    throw new PreflightError(`Bundle ${bundle} is not a readable directory.`);
  }
  const manifest = await readManifest(bundle);
  for (const required of [DUMP_FILE, SUMS_FILE]) {
    if (!rootEntries.includes(required)) throw new PreflightError(`${required} is missing from the bundle.`);
  }
  if (!rootEntries.includes(PHOTOS_DIR)) throw new PreflightError(`${PHOTOS_DIR}/ is missing from the bundle.`);
  const unexpected = rootEntries.filter((entry) => ![MANIFEST_FILE, DUMP_FILE, SUMS_FILE, PHOTOS_DIR].includes(entry));
  if (unexpected.length > 0) throw new PreflightError(`The bundle contains unexpected entries: ${sample(unexpected)}.`);

  const sums = parseSums(await readFile(path.join(bundle, SUMS_FILE), 'utf8'));
  if (!sums.has(DUMP_FILE)) throw new PreflightError(`${SUMS_FILE} has no entry for ${DUMP_FILE}.`);
  if (sums.get(DUMP_FILE) !== manifest.dumpSha256) throw new PreflightError(`${DUMP_FILE} checksum in ${SUMS_FILE} differs from the manifest.`);

  const onDisk = (await listFiles(path.join(bundle, PHOTOS_DIR))).map((file) => `${PHOTOS_DIR}/${file}`);
  const listed = [...sums.keys()].filter((file) => file !== DUMP_FILE);
  const missing = listed.filter((file) => !onDisk.includes(file));
  const extra = onDisk.filter((file) => !sums.has(file));
  if (missing.length > 0) throw new PreflightError(`Photo files listed in ${SUMS_FILE} are missing from the bundle: ${sample(missing)}.`);
  if (extra.length > 0) throw new PreflightError(`The bundle has photo files not listed in ${SUMS_FILE}: ${sample(extra)}.`);
  const photoFiles = onDisk.map((file) => file.slice(PHOTOS_DIR.length + 1));
  const malformed = photoFiles.filter((file) => !PHOTO_FILE.test(file));
  if (malformed.length > 0) throw new PreflightError(`The bundle has files that are not photo files: ${sample(malformed)}.`);
  if (photoFiles.length !== manifest.photoFiles) throw new PreflightError(`The manifest says ${manifest.photoFiles} photo files, the bundle has ${photoFiles.length}.`);

  const mismatched: string[] = [];
  for (const [file, expected] of sums) {
    if ((await sha256OfFile(path.join(bundle, file))) !== expected) mismatched.push(file);
  }
  if (mismatched.length > 0) throw new PreflightError(`Checksum mismatch: ${sample(mismatched)}.`);
  return { manifest, sums, photoFiles };
}
