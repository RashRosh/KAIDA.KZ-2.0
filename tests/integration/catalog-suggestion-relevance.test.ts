import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedDatabase, seedIds } from '../../src/db/seed';
import { suggestCatalogProducts } from '../../src/modules/catalog/application/suggest-products';
import { importProductionKbPackage } from '../../src/modules/catalog/kb-import/production-kb-importer';
import { withMigrationTestDatabase } from './migration-test-database';

// S15B-1: catalog suggestions on Production KB v1 (installed by the existing importer in an isolated database).

describe('Catalog suggestion relevance on Production KB v1', () => {
  it('ranks by relevance, keeps eligibility, and reaches every Product by its full name', async () => {
    await withMigrationTestDatabase({ name: 'kaida_s15b1_suggestions_test', maxConnections: 8 }, async (pool, migrationDb) => {
      await migrate(migrationDb, { migrationsFolder: './drizzle/migrations' });
      const db = migrationDb as Database;
      await seedDatabase(db, new Date('2026-10-05T00:00:00Z'));
      expect(await importProductionKbPackage(db)).toMatchObject({ products: 682, aliases: 210, categories: 35 });

      const names = async (query: string, locale: 'ru' | 'kk' = 'ru') => (await suggestCatalogProducts(db, query, locale)).map((s) => s.name);

      // The reported gap: the adopted seed Product «Баранина» is reachable and first.
      const lamb = await suggestCatalogProducts(db, 'баран', 'ru');
      expect(lamb[0]).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
      expect((await suggestCatalogProducts(db, 'бар', 'ru')).map((s) => s.id)).toContain(seedIds.lambProduct);

      // Strong beats weak: the whole name comes before its variants.
      expect((await names('Баранина'))[0]).toBe('Баранина');
      expect((await names('говядина'))[0]).toBe('Говядина');

      // At most five, deterministic, one per Product.
      const many = await suggestCatalogProducts(db, 'мя', 'ru');
      expect(many.length).toBeLessThanOrEqual(5);
      expect(new Set(many.map((s) => s.id)).size).toBe(many.length);
      expect(await suggestCatalogProducts(db, 'мя', 'ru')).toEqual(many);

      // Eligibility unchanged: one letter and non-prefix substrings find nothing; aliases and KK names still take part.
      expect(await names('б')).toEqual([]);
      expect(await names('аранина')).toEqual([]);
      expect(await names('мясо барана')).toContain('Баранина');
      expect((await suggestCatalogProducts(db, 'қой', 'kk')).map((s) => s.id)).toContain(seedIds.lambProduct);

      // No regression for the runtime-loop Product.
      const honey = (await pool.query<{ id: string }>("SELECT id FROM products WHERE name = 'Мёд горный'")).rows[0]!.id;
      expect(await suggestCatalogProducts(db, 'мёд гор', 'ru')).toEqual([{ id: honey, name: 'Мёд горный' }]);

      // Generic reachability: every Product is in the top five when its full canonical name is typed.
      const all = (await pool.query<{ id: string; name: string }>('SELECT id, name FROM products ORDER BY name')).rows;
      expect(all).toHaveLength(682);
      const missed: string[] = [];
      for (const product of all) {
        const found = await suggestCatalogProducts(db, product.name, 'ru');
        if (!found.some((s) => s.id === product.id)) missed.push(product.name);
      }
      expect(missed).toEqual([]);
    });
  }, 120000);
});
