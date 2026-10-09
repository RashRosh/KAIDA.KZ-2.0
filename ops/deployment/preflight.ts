import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { PRODUCTION_KB_PACKAGE_V1 } from '../../src/modules/catalog/kb-import/package-metadata';
import { checkRuntimeEnvironment, formatFinding, hasErrors, type Finding } from './preflight-rules';

// R3 `pnpm deploy:preflight`: configuration and state checks inside the tools container, after the database is up and the
// migrations and the Production KB import have run. Prints findings only; never prints a secret or a connection string.

async function main(): Promise<number> {
  const findings: Finding[] = checkRuntimeEnvironment(process.env);
  const add = (level: Finding['level'], code: string, message: string) => findings.push({ level, code, message });

  if (!hasErrors(findings)) {
    const directory = process.env.PHOTO_STORAGE_DIR as string;
    const probe = path.join(directory, `.preflight-${randomUUID()}`);
    try {
      await writeFile(probe, 'ok');
      await rm(probe);
      add('info', 'photos-writable', 'The photo directory is writable.');
    } catch {
      add('error', 'photos-writable', 'The photo directory is missing or not writable by the application user.');
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
    try {
      await pool.query('select 1');
      add('info', 'database', 'The database answers.');
      const journal = JSON.parse(await readFile(path.join('drizzle', 'migrations', 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> };
      const rows = (await pool.query<{ hash: string }>('select hash from drizzle.__drizzle_migrations order by created_at')).rows;
      const hashes = await Promise.all(journal.entries.map(async ({ tag }) => createHash('sha256').update(await readFile(path.join('drizzle', 'migrations', `${tag}.sql`), 'utf8')).digest('hex')));
      const applied = rows.length;
      if (applied === hashes.length && rows.every((row, i) => row.hash === hashes[i])) add('info', 'migrations', `All ${applied} migrations are applied and match this checkout.`);
      else add('error', 'migrations', `Applied migrations: ${applied}, expected ${journal.entries.length}. Run the migrate step.`);
      const kb = PRODUCTION_KB_PACKAGE_V1.counts;
      const products = Number((await pool.query('select count(*) as n from products')).rows[0].n);
      const categories = Number((await pool.query('select count(*) as n from product_categories')).rows[0].n);
      const aliases = Number((await pool.query('select count(*) as n from product_aliases where kb_alias_id is not null')).rows[0].n);
      const installs = (await pool.query('select package_name, package_version, manifest_sha256, products_count, aliases_count, categories_count from kb_package_install')).rows;
      const install = installs[0];
      const expected = PRODUCTION_KB_PACKAGE_V1;
      if (installs.length === 1 && install.package_name === expected.packageName && install.package_version === expected.packageVersion && install.manifest_sha256 === expected.manifestSha256 && install.products_count === kb.products && install.aliases_count === kb.aliases && install.categories_count === kb.categories && products >= kb.products && aliases === kb.aliases && categories === kb.categories) {
        add('info', 'catalog', `Production KB installed (${products} products, ${aliases} aliases, ${categories} categories).`);
      } else {
        add('error', 'catalog', 'Production KB does not match the approved package. Run the import step.');
      }
    } catch {
      add('error', 'database', 'The database is unreachable or its schema is incomplete (no details are printed on purpose).');
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  for (const finding of findings) console.log(formatFinding(finding));
  return hasErrors(findings) ? 2 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  () => { console.error('Preflight failed unexpectedly.'); process.exitCode = 3; },
);
