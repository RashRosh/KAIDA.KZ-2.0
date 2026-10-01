import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createDatabase } from '../db/client';
import { importAddressDirectory } from '../modules/address-directory/import/address-directory-import';
import { deduplicateAddressDirectoryEntries, transformOsmFeature } from '../modules/address-directory/import/osm-feature-transform';

const ALMATY_RELATION = 'r2465058';
const IMPORTER_VERSION = 'almaty-osmium-v1';

function argument(name: string): string {
  const position = process.argv.indexOf(`--${name}`);
  const value = position >= 0 ? process.argv[position + 1] : undefined;
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function optionalArgument(name: string): string | undefined {
  const position = process.argv.indexOf(`--${name}`);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

async function checksum(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function main() {
  const pbf = resolve(argument('pbf'));
  const sourceUrl = argument('source-url');
  const expectedChecksum = argument('checksum').toLowerCase();
  const osmiumImage = optionalArgument('osmium-docker-image');
  const sourceTimestamp = new Date(argument('source-timestamp'));
  if (Number.isNaN(sourceTimestamp.valueOf())) throw new Error('Invalid --source-timestamp');
  if (!/^https:\/\//.test(sourceUrl)) throw new Error('--source-url must be HTTPS');
  if (!/^[0-9a-f]{64}$/.test(expectedChecksum)) throw new Error('--checksum must be a SHA-256 digest');
  if ((await checksum(pbf)) !== expectedChecksum) throw new Error('PBF checksum does not match --checksum');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const work = await mkdtemp(join(tmpdir(), 'kaida-address-directory-'));
  const boundaryPbf = join(work, 'almaty-boundary.osm.pbf');
  const boundaryGeoJson = join(work, 'almaty-boundary.geojson');
  const almatyPbf = join(work, 'almaty.osm.pbf');
  const filteredPbf = join(work, 'almaty-filtered.osm.pbf');
  const sequence = join(work, 'features.geojsonseq');
  const osmium = async (args: string[]) => {
    if (!osmiumImage) return run('osmium', args);
    const mapped = args.map((value) => {
      if (value === pbf) return `/source/${basename(pbf)}`;
      if (value.startsWith(work)) return `/work/${basename(value)}`;
      return value;
    });
    return run('docker', ['run', '--rm', '-v', `${dirname(pbf)}:/source:ro`, '-v', `${work}:/work`, osmiumImage, ...mapped]);
  };
  try {
    await osmium(['getid', '-r', pbf, ALMATY_RELATION, '-o', boundaryPbf, '-O']);
    await osmium(['export', boundaryPbf, '--geometry-types=polygon', '-o', boundaryGeoJson, '-O']);
    const boundary = JSON.parse(await readFile(boundaryGeoJson, 'utf8')) as { features?: unknown[] };
    if (!boundary.features?.length) throw new Error('Almaty relation did not produce a polygon');
    await osmium(['extract', '--polygon', boundaryPbf, pbf, '-o', almatyPbf, '-O']);
    await osmium(['tags-filter', almatyPbf, 'nwr/addr:housenumber', 'w/highway', 'nwr/amenity=marketplace', 'nwr/shop=mall', 'nwr/building=retail', '-o', filteredPbf, '-O']);
    await osmium(['export', filteredPbf, '-f', 'geojsonseq', '-a', 'type,id', '-x', 'print_record_separator=false', '-o', sequence, '-O']);

    const entries = [];
    const input = createInterface({ input: createReadStream(sequence), crlfDelay: Infinity });
    for await (const line of input) {
      if (!line.trim()) continue;
      const entry = transformOsmFeature(JSON.parse(line));
      if (entry) entries.push(entry);
    }
    const deduplicated = deduplicateAddressDirectoryEntries(entries);
    if (deduplicated.length === 0) throw new Error('Import produced no address-directory entries');

    const { db, pool } = createDatabase(databaseUrl);
    try {
      const result = await importAddressDirectory(db, {
        sourceUrl,
        sourceTimestamp,
        sourceChecksum: expectedChecksum,
        importerVersion: IMPORTER_VERSION,
      }, deduplicated);
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } finally {
      await pool.end();
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unknown import error'}\n`);
  process.exitCode = 1;
});
