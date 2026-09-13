import { DrizzleQueryError } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { SellerAlreadyExistsError, setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

function databaseThatRejects(error: unknown): Database {
  return {
    transaction: () => Promise.reject(error),
  } as unknown as Database;
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await pool.end();
});

describe('S3 seller setup concurrency', () => {
  it('maps a Drizzle-wrapped owned-Seller unique violation to SELLER_ALREADY_EXISTS', async () => {
    const cause = Object.assign(
      new Error('duplicate key value violates unique constraint "sellers_owner_user_id_owned_unique"'),
      {
        code: '23505',
        constraint: 'sellers_owner_user_id_owned_unique',
      },
    );
    const wrapped = new DrizzleQueryError(
      'insert into "sellers" ("display_name","owner_user_id") values ($1,$2)',
      ['Wrapped seller', '50000000-0000-4000-8000-000000000452'],
      cause,
    );

    await expect(
      setupSeller(
        '50000000-0000-4000-8000-000000000452',
        {
          seller: { displayName: 'Wrapped seller' },
          location: { name: 'Wrapped point', type: 'shop', addressText: 'Wrapped address' },
        },
        { database: databaseThatRejects(wrapped) },
      ),
    ).rejects.toBeInstanceOf(SellerAlreadyExistsError);
  });

  it('does not map a Drizzle-wrapped unrelated unique violation to SELLER_ALREADY_EXISTS', async () => {
    const cause = Object.assign(
      new Error('duplicate key value violates unrelated unique constraint'),
      {
        code: '23505',
        constraint: 'users_phone_e164_unique',
      },
    );
    const wrapped = new DrizzleQueryError(
      'insert into "users" ("phone_e164") values ($1)',
      ['+77000000453'],
      cause,
    );

    await expect(
      setupSeller(
        '50000000-0000-4000-8000-000000000453',
        {
          seller: { displayName: 'Unrelated violation seller' },
          location: { name: 'Unrelated point', type: 'shop', addressText: 'Unrelated address' },
        },
        { database: databaseThatRejects(wrapped) },
      ),
    ).rejects.toBe(wrapped);
  });

  it('allows one success and maps the concurrent loser to SELLER_ALREADY_EXISTS', async () => {
    const userId = '50000000-0000-4000-8000-000000000451';
    const phone = '+77000000451';
    await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
    await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
    await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, new Date('2026-09-12T00:00:00Z')]);

    try {
      const results = await Promise.allSettled([
        setupSeller(userId, {
          seller: { displayName: 'Concurrent A' },
          location: { name: 'Point A', type: 'shop', addressText: 'Address A' },
        }, { database: db }),
        setupSeller(userId, {
          seller: { displayName: 'Concurrent B' },
          location: { name: 'Point B', type: 'market', addressText: 'Address B' },
        }, { database: db }),
      ]);

      const successes = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof setupSeller>>> => result.status === 'fulfilled');
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0]!.reason).toBeInstanceOf(SellerAlreadyExistsError);

      const sellerRows = await pool.query('SELECT id FROM sellers WHERE owner_user_id=$1', [userId]);
      expect(sellerRows.rowCount).toBe(1);
      const sellerId = sellerRows.rows[0]!.id;
      expect(Number((await pool.query('SELECT count(*) FROM locations WHERE seller_id=$1', [sellerId])).rows[0].count)).toBe(1);
      expect(Number((await pool.query('SELECT count(*) FROM locations l LEFT JOIN sellers s ON s.id=l.seller_id WHERE s.id IS NULL')).rows[0].count)).toBe(0);
    } finally {
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
      await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
    }
  });
});
