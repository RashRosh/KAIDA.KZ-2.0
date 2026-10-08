import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

// S15C / D0: the search_events migration is additive — it adds one table and leaves the existing data alone.
const MIGRATIONS = join(process.cwd(), 'drizzle/migrations');
const SEARCH_EVENTS_MIGRATION = '0023_search_events';

async function createPreSearchEventsFolder() {
  const journal = JSON.parse(await readFile(join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
  const before = journal.entries.filter((entry) => entry.tag !== SEARCH_EVENTS_MIGRATION && entry.idx < 23);
  const folder = await mkdtemp(join(tmpdir(), 'kaida-search-events-pre-'));
  await mkdir(join(folder, 'meta'));
  for (const entry of before) await copyFile(join(MIGRATIONS, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: before }, null, 2));
  return folder;
}

describe('search_events migration upgrade path on PostgreSQL 18', () => {
  it('adds the table additively, keeps existing data, and enforces its constraints', async () => {
    await withMigrationTestDatabase({ name: 'kaida_search_events_upgrade_test' }, async (pool, rawDb) => {
      const folder = await createPreSearchEventsFolder();
      try {
        await migrate(rawDb, { migrationsFolder: folder });
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
      const productId = '10000000-0000-4000-8000-000000002301';
      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'Search events migration product']);
      expect((await pool.query("SELECT to_regclass('public.search_events') AS name")).rows[0].name).toBeNull();

      await migrate(rawDb, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query('SELECT name FROM products WHERE id=$1', [productId])).rows[0].name).toBe('Search events migration product');
      const columns = await pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'search_events' ORDER BY column_name");
      // search-typo-suggestions (0024) added the two nullable correction columns
      expect(columns.rows.map((row) => row.column_name)).toEqual(['corrected_query_normalized', 'corrected_result_count', 'entry', 'id', 'occurred_at', 'origin', 'query_normalized', 'resolution', 'resolved_product_id', 'result_count']);

      const insert = (entry: string, resolution: string, origin: string, text: string, count = 1, product: string | null = null) => pool.query(
        'INSERT INTO search_events (occurred_at, entry, query_normalized, resolved_product_id, resolution, result_count, origin) VALUES (now(), $1, $2, $5, $3, $6, $4)',
        [entry, text, resolution, origin, product, count],
      );
      await insert('submit', 'resolved', 'dev', 'баранина', 3, productId);
      await expect(insert('keystroke', 'resolved', 'dev', 'баранина')).rejects.toThrow();
      await expect(insert('submit', 'fuzzy', 'dev', 'баранина')).rejects.toThrow();
      await expect(insert('submit', 'resolved', 'production', 'баранина')).rejects.toThrow();
      await expect(insert('submit', 'resolved', 'dev', '')).rejects.toThrow();
      await expect(insert('submit', 'resolved', 'dev', 'x'.repeat(101))).rejects.toThrow();
      await expect(insert('submit', 'resolved', 'dev', 'баранина', -1)).rejects.toThrow();

      // the correction pair of 0024: set together, at least one Offer, a text different from the original
      const corrected = (text: string | null, count: number | null) => pool.query(
        "INSERT INTO search_events (occurred_at, entry, query_normalized, resolution, result_count, origin, corrected_query_normalized, corrected_result_count) VALUES (now(),'submit','малако','unresolved',0,'dev',$1,$2)",
        [text, count],
      );
      await corrected('молоко', 2);
      await expect(corrected('молоко', null)).rejects.toThrow();
      await expect(corrected(null, 2)).rejects.toThrow();
      await expect(corrected('молоко', 0)).rejects.toThrow();
      await expect(corrected('малако', 2)).rejects.toThrow();

      // removing a catalog Product keeps the event as unresolved demand instead of blocking or deleting it
      await pool.query('DELETE FROM products WHERE id=$1', [productId]);
      expect((await pool.query('SELECT resolved_product_id FROM search_events')).rows[0].resolved_product_id).toBeNull();
    });
  });
});
