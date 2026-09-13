import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './database';

const UPGRADE_DB = 'kaida_s2_upgrade_test';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000301';
const SELLER_ID = '20000000-0000-4000-8000-000000000301';
const LOCATION_ID = '30000000-0000-4000-8000-000000000301';
const OFFER_ID = '40000000-0000-4000-8000-000000000301';

async function applyMigrationFile(pool: Pool, relativePath: string) {
  const content = await readFile(resolve(process.cwd(), relativePath), 'utf8');
  const statements = content.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);
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

async function closeTargetPool(pool: Pool, admin: Pool, name: string) {
  const expectedRemovals = pool.totalCount;
  let removed = 0;
  let resolveRemoved: (() => void) | undefined;
  const removedPromise = expectedRemovals === 0
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveRemoved = resolve;
      });

  const onRemove = () => {
    removed += 1;
    if (removed === expectedRemovals) resolveRemoved?.();
  };

  if (expectedRemovals > 0) pool.on('remove', onRemove);
  try {
    await pool.end();
    await removedPromise;
  } finally {
    if (expectedRemovals > 0) pool.off('remove', onRemove);
  }

  const remaining = await admin.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = $1',
    [name],
  );
  if (remaining.rows[0]?.count !== '0') {
    throw new Error(
      `S2 migration test target still has active connections after pool shutdown: ${remaining.rows[0]?.count ?? 'unknown'}`,
    );
  }
}

describe('S2 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades a real S1 database through 0002 without touching S0/S1 business data', async () => {
    const guardedTestUrl = testDatabaseUrl();
    const testUrl = new URL(guardedTestUrl);
    const developmentUrl = new URL(process.env.DATABASE_URL!);
    if (decodeURIComponent(testUrl.pathname) !== '/kaida_test') throw new Error('S2 upgrade test must start from guarded kaida_test');
    if (decodeURIComponent(developmentUrl.pathname) === `/${UPGRADE_DB}`) throw new Error('Development database must never be S2 upgrade target');

    const admin = new Pool({ connectionString: guardedTestUrl, max: 1 });
    let target: Pool | undefined;
    try {
      const version = Number((await admin.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version);
      if (version < 180000 || version >= 190000) throw new Error('S2 migration test requires PostgreSQL 18');
      await admin.query(`DROP DATABASE IF EXISTS "${UPGRADE_DB}" WITH (FORCE)`);
      await admin.query(`CREATE DATABASE "${UPGRADE_DB}"`);
      const targetUrl = new URL(guardedTestUrl);
      targetUrl.pathname = `/${UPGRADE_DB}`;
      if (decodeURIComponent(targetUrl.pathname) !== `/${UPGRADE_DB}`) throw new Error('Unsafe S2 upgrade target');
      target = new Pool({ connectionString: targetUrl.toString(), max: 2 });

      await applyMigrationFile(target, 'drizzle/migrations/0000_s0_first_search.sql');
      await applyMigrationFile(target, 'drizzle/migrations/0001_s1_offer_lifecycle.sql');
      await target.query('INSERT INTO products (id, name) VALUES ($1,$2)', [PRODUCT_ID, 'S2 upgrade fixture']);
      await target.query('INSERT INTO sellers (id, display_name) VALUES ($1,$2)', [SELLER_ID, 'S2 seller']);
      await target.query('INSERT INTO locations (id, name, address_text) VALUES ($1,$2,$3)', [LOCATION_ID, 'S2 location', 'S2 address']);
      await target.query(
        `INSERT INTO offers (id, product_id, seller_id, location_id, price_amount, price_currency, price_unit, seller_comment, status, last_confirmed_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [OFFER_ID, PRODUCT_ID, SELLER_ID, LOCATION_ID, '777.00', 'KZT', 'кг', 'S1 preserved', 'active', new Date('2026-09-10T10:00:00Z'), new Date('2026-09-01T10:00:00Z'), new Date('2026-09-02T10:00:00Z')],
      );
      const before = (await target.query('SELECT * FROM offers WHERE id=$1', [OFFER_ID])).rows[0];

      await applyMigrationFile(target, 'drizzle/migrations/0002_s2_auth.sql');
      const after = (await target.query('SELECT * FROM offers WHERE id=$1', [OFFER_ID])).rows[0];
      expect(after).toEqual(before);

      const tables = (await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((row) => row.tablename);
      expect(tables).toEqual(['auth_otp_challenges', 'auth_sessions', 'locations', 'offers', 'products', 'sellers', 'users']);

      const userId = '50000000-0000-4000-8000-000000000301';
      await target.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, '+77000000301', new Date()]);
      await expect(target.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', ['50000000-0000-4000-8000-000000000302', '+77000000301', new Date()]))
        .rejects.toMatchObject({ code: '23505' });
      await expect(target.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', ['50000000-0000-4000-8000-000000000303', '87000000301', new Date()]))
        .rejects.toMatchObject({ code: '23514' });

      const c1 = '60000000-0000-4000-8000-000000000301';
      const c2 = '60000000-0000-4000-8000-000000000302';
      const created = new Date('2026-09-11T10:00:00Z');
      const expires = new Date('2026-09-11T10:05:00Z');
      await target.query('INSERT INTO auth_otp_challenges (id, phone_e164, otp_digest, created_at, expires_at) VALUES ($1,$2,$3,$4,$5)', [c1, '+77000000302', 'a'.repeat(64), created, expires]);
      await expect(target.query('INSERT INTO auth_otp_challenges (id, phone_e164, otp_digest, created_at, expires_at) VALUES ($1,$2,$3,$4,$5)', [c2, '+77000000302', 'b'.repeat(64), created, expires]))
        .rejects.toMatchObject({ code: '23505' });
      await expect(target.query('INSERT INTO auth_otp_challenges (id, phone_e164, otp_digest, created_at, expires_at) VALUES ($1,$2,$3,$4,$5)', ['60000000-0000-4000-8000-000000000303', '+77000000303', 'plain', created, expires]))
        .rejects.toMatchObject({ code: '23514' });
      await expect(target.query('INSERT INTO auth_sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1,$2,$3,$4,$5)', ['70000000-0000-4000-8000-000000000301', '99999999-9999-4999-8999-999999999999', 'c'.repeat(64), created, expires]))
        .rejects.toMatchObject({ code: '23503' });
    } finally {
      if (target) await closeTargetPool(target, admin, UPGRADE_DB);
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${UPGRADE_DB}"`);
      } finally {
        await admin.end();
      }
    }
  });
});
