import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { calculateOfferCutoff } from '../../src/modules/offers/lifecycle/offer-lifecycle';
import { testDatabaseUrl } from './database';

const UPGRADE_DB = 'kaida_s1_upgrade_test';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000201';
const SELLER_ID = '20000000-0000-4000-8000-000000000201';
const LOCATION_ID = '30000000-0000-4000-8000-000000000201';
const OFFER_ID = '40000000-0000-4000-8000-000000000201';

async function applyMigrationFile(pool: Pool, relativePath: string) {
  const sql = await readFile(resolve(process.cwd(), relativePath), 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of statements) await client.query(statement);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

describe('S1 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades real S0-format data through 0001 without losing old fields', async () => {
    const guardedTestUrl = testDatabaseUrl();
    const testUrl = new URL(guardedTestUrl);
    const developmentUrl = new URL(process.env.DATABASE_URL!);
    if (decodeURIComponent(testUrl.pathname) !== '/kaida_test') throw new Error('Upgrade test must start from guarded kaida_test');
    if (decodeURIComponent(developmentUrl.pathname) === `/${UPGRADE_DB}`) throw new Error('Development database must never be the upgrade-test target');

    const admin = new Pool({ connectionString: guardedTestUrl, max: 1 });
    let target: Pool | undefined;

    try {
      const server = await admin.query<{ version: number }>("SELECT current_setting('server_version_num')::int AS version");
      const version = server.rows[0]?.version ?? 0;
      if (version < 180000 || version >= 190000) throw new Error('Upgrade migration test requires PostgreSQL 18');

      await admin.query(`DROP DATABASE IF EXISTS "${UPGRADE_DB}" WITH (FORCE)`);
      await admin.query(`CREATE DATABASE "${UPGRADE_DB}"`);

      const targetUrl = new URL(guardedTestUrl);
      targetUrl.pathname = `/${UPGRADE_DB}`;
      if (decodeURIComponent(targetUrl.pathname) !== `/${UPGRADE_DB}`) throw new Error('Unsafe upgrade database target');
      target = new Pool({ connectionString: targetUrl.toString(), max: 1 });

      await applyMigrationFile(target, 'drizzle/migrations/0000_s0_first_search.sql');

      await target.query('INSERT INTO products (id, name) VALUES ($1, $2)', [PRODUCT_ID, 'S0 migration fixture']);
      await target.query('INSERT INTO sellers (id, display_name) VALUES ($1, $2)', [SELLER_ID, 'S0 seller']);
      await target.query('INSERT INTO locations (id, name, address_text) VALUES ($1, $2, $3)', [LOCATION_ID, 'S0 location', 'S0 address']);
      await target.query(
        `INSERT INTO offers (
          id, product_id, seller_id, location_id, price_amount, price_currency, price_unit,
          seller_comment, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          OFFER_ID,
          PRODUCT_ID,
          SELLER_ID,
          LOCATION_ID,
          '1234.50',
          'KZT',
          'кг',
          'S0 comment',
          new Date('2026-08-01T10:00:00.000Z'),
          new Date('2026-08-02T11:00:00.000Z'),
        ],
      );

      const before = (await target.query('SELECT * FROM offers WHERE id = $1', [OFFER_ID])).rows[0];
      expect(before).not.toHaveProperty('status');
      expect(before).not.toHaveProperty('last_confirmed_at');

      const lowerBound = (await target.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now;
      await applyMigrationFile(target, 'drizzle/migrations/0001_s1_offer_lifecycle.sql');
      const upperBound = (await target.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now;

      const after = (await target.query('SELECT * FROM offers WHERE id = $1', [OFFER_ID])).rows[0];
      expect(after.id).toBe(before.id);
      expect(after.product_id).toBe(before.product_id);
      expect(after.seller_id).toBe(before.seller_id);
      expect(after.location_id).toBe(before.location_id);
      expect(after.price_amount).toBe(before.price_amount);
      expect(after.price_currency).toBe(before.price_currency);
      expect(after.price_unit).toBe(before.price_unit);
      expect(after.seller_comment).toBe(before.seller_comment);
      expect(after.created_at).toEqual(before.created_at);
      expect(after.updated_at).toEqual(before.updated_at);
      expect(after.status).toBe('active');
      expect(after.last_confirmed_at).toBeInstanceOf(Date);
      expect(after.last_confirmed_at.getTime()).toBeGreaterThanOrEqual(lowerBound.getTime());
      expect(after.last_confirmed_at.getTime()).toBeLessThanOrEqual(upperBound.getTime());

      const columns = await target.query<{ column_name: string; is_nullable: string; column_default: string | null }>(
        `SELECT column_name, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'offers'
           AND column_name IN ('status', 'last_confirmed_at')
         ORDER BY column_name`,
      );
      expect(columns.rows).toEqual([
        { column_name: 'last_confirmed_at', is_nullable: 'NO', column_default: null },
        { column_name: 'status', is_nullable: 'NO', column_default: null },
      ]);

      await expect(target.query('UPDATE offers SET status = $1 WHERE id = $2', ['broken', OFFER_ID]))
        .rejects.toMatchObject({ code: '23514' });

      const cutoff = calculateOfferCutoff(upperBound, 168);
      expect(after.last_confirmed_at.getTime()).toBeGreaterThan(cutoff.getTime());
    } finally {
      await target?.end();
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${UPGRADE_DB}" WITH (FORCE)`);
      } finally {
        await admin.end();
      }
    }
  });
});
