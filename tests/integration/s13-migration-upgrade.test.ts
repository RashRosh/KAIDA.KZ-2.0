import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

const PRE_S13_MIGRATIONS = [
  '0000_s0_first_search.sql',
  '0001_s1_offer_lifecycle.sql',
  '0002_s2_auth.sql',
  '0003_s3_seller_location.sql',
  '0004_s4_seller_change_set.sql',
  '0005_s5_offer_management.sql',
  '0006_s6_product_aliases.sql',
  '0007_s8_location_coordinates.sql',
  '0008_s10_seller_contacts.sql',
] as const;

async function createPreS13MigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-s13-pre-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of PRE_S13_MIGRATIONS) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as {
    version: string;
    dialect: string;
    entries: unknown[];
  };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 9) }, null, 2));
  return folder;
}

async function migrateToPreS13(db: Parameters<typeof migrate>[0]) {
  const folder = await createPreS13MigrationsFolder();
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe('S13 migration upgrade path on PostgreSQL 18', () => {
  it('adds BuyerInterest additively while preserving existing User and Product data', async () => {
    await withMigrationTestDatabase({ name: 'kaida_s13_upgrade_test' }, async (pool, rawDb) => {
      await migrateToPreS13(rawDb);
      const userId = '50000000-0000-4000-8000-000000001351';
      const productId = '10000000-0000-4000-8000-000000001351';
      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, '+77000001351', new Date('2026-09-14T00:00:00Z')]);
      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'S13 migration product']);

      await migrate(rawDb, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query('SELECT phone_e164 FROM users WHERE id=$1', [userId])).rows[0].phone_e164).toBe('+77000001351');
      expect((await pool.query('SELECT name FROM products WHERE id=$1', [productId])).rows[0].name).toBe('S13 migration product');

      const constraints = await pool.query<{ constraint_name: string; constraint_type: string }>(`
        SELECT constraint_name,constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema='public'
          AND table_name='buyer_interests'
          AND constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY')
        ORDER BY constraint_name
      `);
      expect(constraints.rows).toEqual([
        { constraint_name: 'buyer_interests_product_id_products_id_fk', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'buyer_interests_user_id_users_id_fk', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'buyer_interests_user_product_pk', constraint_type: 'PRIMARY KEY' },
      ]);

      await pool.query('INSERT INTO buyer_interests (user_id,product_id) VALUES ($1,$2)', [userId, productId]);
      await expect(pool.query('INSERT INTO buyer_interests (user_id,product_id) VALUES ($1,$2)', [userId, productId]))
        .rejects.toMatchObject({ code: '23505', constraint: 'buyer_interests_user_product_pk' });
    });
  });
});
