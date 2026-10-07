import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PreflightError } from './guards';

// R2 bundle format (SLICE_CONTRACT §3.1). The manifest holds no secrets, no configuration values and no query text.
export const MANIFEST_FORMAT_VERSION = 1;
export const MANIFEST_FILE = 'manifest.json';
export const DUMP_FILE = 'db.dump';
export const PHOTOS_DIR = 'photos';
export const SUMS_FILE = 'SHA256SUMS';

export type MigrationFingerprint = { count: number; lastHash: string | null };

export type Manifest = {
  formatVersion: number;
  createdAt: string;
  appGitSha: string | null;
  postgresVersion: string;
  migrations: MigrationFingerprint;
  tableRows: Record<string, number>;
  dumpSha256: string;
  photoRows: number;
  photoFiles: number;
  photoBytes: number;
};

export function sha256OfFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')));
  });
}

// `<sha256>␣␣<relative path with forward slashes>`, one line per file, sorted: the format of `sha256sum -c`.
export function formatSums(entries: Map<string, string>): string {
  return [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([file, hash]) => `${hash}  ${file}`).join('\n') + '\n';
}

export function parseSums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    if (!match) throw new PreflightError(`${SUMS_FILE} has a malformed line.`);
    if (sums.has(match[2])) throw new PreflightError(`${SUMS_FILE} lists ${match[2]} twice.`);
    sums.set(match[2], match[1]);
  }
  return sums;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function parseManifest(text: string): Manifest {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new PreflightError(`${MANIFEST_FILE} is not valid JSON.`);
  }
  const m = value as Partial<Manifest> | null;
  if (typeof m !== 'object' || m === null || !isNonNegativeInteger(m.formatVersion)) throw new PreflightError(`${MANIFEST_FILE} has no valid formatVersion.`);
  if (m.formatVersion > MANIFEST_FORMAT_VERSION) {
    throw new PreflightError(`The bundle format ${m.formatVersion} is newer than this tool supports (${MANIFEST_FORMAT_VERSION}).`);
  }
  if (m.formatVersion !== MANIFEST_FORMAT_VERSION) throw new PreflightError(`Unsupported bundle format ${m.formatVersion}.`);
  const tableRows = m.tableRows;
  const migrations = m.migrations;
  const valid = typeof m.createdAt === 'string' && typeof m.postgresVersion === 'string' && typeof m.dumpSha256 === 'string' && /^[0-9a-f]{64}$/.test(m.dumpSha256)
    && typeof tableRows === 'object' && tableRows !== null && Object.values(tableRows).every(isNonNegativeInteger)
    && typeof migrations === 'object' && migrations !== null && isNonNegativeInteger(migrations.count) && (migrations.lastHash === null || typeof migrations.lastHash === 'string')
    && isNonNegativeInteger(m.photoRows) && isNonNegativeInteger(m.photoFiles) && isNonNegativeInteger(m.photoBytes)
    && (m.appGitSha === null || typeof m.appGitSha === 'string');
  if (!valid) throw new PreflightError(`${MANIFEST_FILE} is incomplete or malformed.`);
  return m as Manifest;
}

export async function readManifest(bundle: string): Promise<Manifest> {
  let text: string;
  try {
    text = await readFile(path.join(bundle, MANIFEST_FILE), 'utf8');
  } catch {
    throw new PreflightError(`${MANIFEST_FILE} is missing: the backup did not finish (or this is not a bundle).`);
  }
  return parseManifest(text);
}

export function sameMigrations(a: MigrationFingerprint, b: MigrationFingerprint): boolean {
  return a.count === b.count && a.lastHash === b.lastHash;
}
