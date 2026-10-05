import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedDatabase, seedIds } from '../../src/db/seed';
import { importProductionKbPackage, loadProductionKbPackage, ProductionKbImportError } from '../../src/modules/catalog/kb-import/production-kb-importer';
import { PRODUCTION_KB_PACKAGE_V1 } from '../../src/modules/catalog/kb-import/package-metadata';
import { withMigrationTestDatabase } from './migration-test-database';

const packageDir = join(process.cwd(), 'src/modules/catalog/kb-package/v1');

async function withProductionKbImportTestDatabase<T>(
  suffix: string,
  run: (pool: Pool, db: Database) => Promise<T>,
) {
  return await withMigrationTestDatabase({ name: `kaida_production_kb_importer_${suffix}_test`, maxConnections: 8 }, async (pool, db) => {
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    const typedDb = db as Database;
    await seedDatabase(typedDb, new Date('2026-10-05T00:00:00Z'));
    return await run(pool, typedDb);
  });
}

async function copyPackageFixture() {
  const dir = join(tmpdir(), `kaida-kb-package-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  for (const file of ['products.csv', 'aliases.csv', 'categories.csv', 'CONTRACT.md', 'manifest.json']) {
    await copyFile(join(packageDir, file), join(dir, file));
  }
  return dir;
}

async function tamperManifest(dir: string, update: (manifest: Record<string, unknown>) => void) {
  const path = join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  update(manifest);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

describe('Production KB Importer v1', () => {
  it('validates the verified package identity and counts before DB mutation', async () => {
    const loaded = await loadProductionKbPackage();
    expect(loaded.manifest.package_name).toBe(PRODUCTION_KB_PACKAGE_V1.packageName);
    expect(loaded.products).toHaveLength(682);
    expect(loaded.aliases).toHaveLength(210);
    expect(loaded.categories).toHaveLength(35);
  });

  it('rejects direct manifest tampering before DB mutation', async () => {
    const fixture = await copyPackageFixture();
    try {
      await tamperManifest(fixture, (manifest) => { manifest.package_schema_version = 2; });
      await expect(loadProductionKbPackage(fixture)).rejects.toBeInstanceOf(ProductionKbImportError);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it('rejects CSV plus internal hash co-tampering by pinned manifest SHA', async () => {
    const fixture = await copyPackageFixture();
    try {
      const productsPath = join(fixture, 'products.csv');
      const changed = (await readFile(productsPath, 'utf8')).replace('Говядина', 'Говядина tampered');
      await writeFile(productsPath, changed, 'utf8');
      await tamperManifest(fixture, (manifest) => {
        manifest.file_hashes = { ...(manifest.file_hashes as Record<string, string>), 'products.csv': '0'.repeat(64) };
      });
      await expect(loadProductionKbPackage(fixture)).rejects.toThrow(/manifest SHA mismatch/);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it('imports package data, adopts seed Products and preserves Offer product UUIDs', async () => {
    await withProductionKbImportTestDatabase('import', async (pool, db) => {
      const before = await pool.query('SELECT id, product_id FROM offers WHERE id IN ($1,$2) ORDER BY id', [seedIds.lambOffer, seedIds.beefOffer]);
      const result = await importProductionKbPackage(db);
      expect(result.products).toBe(682);
      expect(result.aliases).toBe(210);
      expect(result.categories).toBe(35);

      await expect(pool.query('SELECT id FROM products WHERE id=$1 AND kb_product_id=$2', [seedIds.beefProduct, 'KAIDA-P0001']))
        .resolves.toMatchObject({ rowCount: 1 });
      await expect(pool.query('SELECT id FROM products WHERE id=$1 AND kb_product_id=$2', [seedIds.lambProduct, 'KAIDA-P0031']))
        .resolves.toMatchObject({ rowCount: 1 });
      expect((await pool.query('SELECT id, product_id FROM offers WHERE id IN ($1,$2) ORDER BY id', [seedIds.lambOffer, seedIds.beefOffer])).rows).toEqual(before.rows);

      expect(Number((await pool.query('SELECT count(*) FROM products WHERE kb_product_id IS NOT NULL')).rows[0].count)).toBe(682);
      expect(Number((await pool.query('SELECT count(*) FROM product_aliases WHERE kb_alias_id IS NOT NULL')).rows[0].count)).toBe(210);
      expect(Number((await pool.query('SELECT count(*) FROM product_categories')).rows[0].count)).toBe(35);
      expect(Number((await pool.query('SELECT count(*) FROM product_category_links')).rows[0].count)).toBe(682);
      expect((await pool.query('SELECT products_count, aliases_count, categories_count FROM kb_package_install')).rows[0])
        .toEqual({ products_count: 682, aliases_count: 210, categories_count: 35 });
    });
  }, 45000);

  it('is idempotent for repeated imports', async () => {
    await withProductionKbImportTestDatabase('idempotent', async (pool, db) => {
      await importProductionKbPackage(db);
      const before = await pool.query(`
        select
          (select count(*)::int from products) as products,
          (select count(*)::int from product_aliases) as aliases,
          (select count(*)::int from product_categories) as categories,
          (select count(*)::int from product_category_links) as links,
          (select count(*)::int from kb_package_install) as installs
      `);
      await importProductionKbPackage(db);
      const after = await pool.query(`
        select
          (select count(*)::int from products) as products,
          (select count(*)::int from product_aliases) as aliases,
          (select count(*)::int from product_categories) as categories,
          (select count(*)::int from product_category_links) as links,
          (select count(*)::int from kb_package_install) as installs
      `);
      expect(after.rows[0]).toEqual(before.rows[0]);
    });
  }, 45000);

  it('rolls back the whole import on deterministic alias conflict', async () => {
    await withProductionKbImportTestDatabase('rollback', async (pool, db) => {
      const packageAlias = (await loadProductionKbPackage()).aliases[0]!;
      const conflictProduct = '90000000-0000-4000-8000-000000000001';
      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [conflictProduct, 'Conflict product']);
      await pool.query('INSERT INTO product_aliases (product_id,name,locale) VALUES ($1,$2,$3)', [conflictProduct, packageAlias.alias, packageAlias.language]);
      await expect(importProductionKbPackage(db)).rejects.toBeInstanceOf(ProductionKbImportError);
      expect(Number((await pool.query('SELECT count(*) FROM products WHERE kb_product_id IS NOT NULL')).rows[0].count)).toBe(0);
      expect(Number((await pool.query('SELECT count(*) FROM product_categories')).rows[0].count)).toBe(0);
    });
  }, 45000);

  it('keeps concurrent import attempts unique and complete', async () => {
    await withProductionKbImportTestDatabase('concurrent', async (pool, db) => {
      await Promise.all([importProductionKbPackage(db), importProductionKbPackage(db)]);
      expect(Number((await pool.query('SELECT count(*) FROM products WHERE kb_product_id IS NOT NULL')).rows[0].count)).toBe(682);
      expect(Number((await pool.query('SELECT count(*) FROM product_aliases WHERE kb_alias_id IS NOT NULL')).rows[0].count)).toBe(210);
      expect(Number((await pool.query('SELECT count(*) FROM kb_package_install')).rows[0].count)).toBe(1);
    });
  }, 45000);
});
