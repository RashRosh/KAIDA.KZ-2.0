import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { getOwnedSeller } from '../../src/modules/sellers/application/get-owned-seller';
import { SellerAlreadyExistsError, setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanupUser(userId: string, phone: string) {
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function createUser(userId: string, phone: string) {
  await cleanupUser(userId, phone);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, new Date('2026-09-12T00:00:00Z')]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await pool.end();
});

describe('S3 seller setup on PostgreSQL 18', () => {
  it('creates owned Seller + first Location, reads locations array and creates no Offer', async () => {
    const userId = '50000000-0000-4000-8000-000000000401';
    const otherUserId = '50000000-0000-4000-8000-000000000402';
    const phone = '+77000000401';
    const otherPhone = '+77000000402';
    await createUser(userId, phone);
    await createUser(otherUserId, otherPhone);
    const offersBefore = Number((await pool.query('SELECT count(*) FROM offers')).rows[0].count);
    try {
      const created = await setupSeller(userId, {
        seller: { displayName: '  Seller 401  ' },
        location: { name: '  Point 401  ', type: 'shop', addressText: '  Address 401  ' },
      }, { database: db });

      expect(created.displayName).toBe('Seller 401');
      expect(created.locations).toHaveLength(1);
      expect(created.locations[0]).toMatchObject({ name: 'Point 401', type: 'shop', addressText: 'Address 401' });

      const sellerRow = (await pool.query('SELECT * FROM sellers WHERE id=$1', [created.id])).rows[0];
      expect(sellerRow.owner_user_id).toBe(userId);
      expect(sellerRow.display_name).toBe('Seller 401');

      const locationRow = (await pool.query('SELECT * FROM locations WHERE id=$1', [created.locations[0]!.id])).rows[0];
      expect(locationRow.seller_id).toBe(created.id);
      expect(locationRow.type).toBe('shop');
      expect(locationRow.name).toBe('Point 401');
      expect(locationRow.address_text).toBe('Address 401');

      expect(await getOwnedSeller(userId, { database: db })).toEqual(created);
      expect(await getOwnedSeller(otherUserId, { database: db })).toBeNull();
      expect(Number((await pool.query('SELECT count(*) FROM offers')).rows[0].count)).toBe(offersBefore);

      const seedOwned = await pool.query('SELECT owner_user_id FROM sellers WHERE id=$1', ['20000000-0000-4000-8000-000000000001']);
      expect(seedOwned.rows[0]?.owner_user_id).toBeNull();
    } finally {
      await cleanupUser(userId, phone);
      await cleanupUser(otherUserId, otherPhone);
    }
  });

  it('rejects repeat setup and keeps exactly one Seller and one first Location', async () => {
    const userId = '50000000-0000-4000-8000-000000000403';
    const phone = '+77000000403';
    await createUser(userId, phone);
    try {
      await setupSeller(userId, {
        seller: { displayName: 'Seller 403' },
        location: { name: 'Point 403', type: 'home', addressText: 'Address 403' },
      }, { database: db });

      await expect(setupSeller(userId, {
        seller: { displayName: 'Different seller' },
        location: { name: 'Different point', type: 'market', addressText: 'Different address' },
      }, { database: db })).rejects.toBeInstanceOf(SellerAlreadyExistsError);

      expect(Number((await pool.query('SELECT count(*) FROM sellers WHERE owner_user_id=$1', [userId])).rows[0].count)).toBe(1);
      expect(Number((await pool.query('SELECT count(*) FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId])).rows[0].count)).toBe(1);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('rolls back Seller when Location insert fails inside the real transaction', async () => {
    const userId = '50000000-0000-4000-8000-000000000404';
    const phone = '+77000000404';
    await createUser(userId, phone);
    try {
      await expect(setupSeller(userId, {
        seller: { displayName: 'Rollback seller' },
        location: { name: 'Rollback point', type: 'invalid' as 'shop', addressText: 'Rollback address' },
      }, { database: db })).rejects.toBeTruthy();

      expect(Number((await pool.query('SELECT count(*) FROM sellers WHERE owner_user_id=$1', [userId])).rows[0].count)).toBe(0);
      expect(Number((await pool.query('SELECT count(*) FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId])).rows[0].count)).toBe(0);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('enforces S3 database constraints directly', async () => {
    const userId = '50000000-0000-4000-8000-000000000405';
    const phone = '+77000000405';
    const sellerId = '20000000-0000-4000-8000-000000000405';
    const nullSellerA = '20000000-0000-4000-8000-000000000406';
    const nullSellerB = '20000000-0000-4000-8000-000000000407';
    await createUser(userId, phone);
    try {
      await expect(pool.query('INSERT INTO sellers (id, display_name, owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'Bad owner', '99999999-9999-4999-8999-999999999999']))
        .rejects.toMatchObject({ code: '23503' });

      await pool.query('INSERT INTO sellers (id, display_name, owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'Owned seller', userId]);
      await expect(pool.query('INSERT INTO sellers (id, display_name, owner_user_id) VALUES ($1,$2,$3)', ['20000000-0000-4000-8000-000000000408', 'Second owned', userId]))
        .rejects.toMatchObject({ code: '23505', constraint: 'sellers_owner_user_id_owned_unique' });

      await pool.query('INSERT INTO sellers (id, display_name, owner_user_id) VALUES ($1,$2,NULL),($3,$4,NULL)', [nullSellerA, 'Fixture A', nullSellerB, 'Fixture B']);
      expect(Number((await pool.query('SELECT count(*) FROM sellers WHERE id IN ($1,$2)', [nullSellerA, nullSellerB])).rows[0].count)).toBe(2);

      await expect(pool.query('INSERT INTO sellers (display_name) VALUES ($1)', ['   '])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO sellers (display_name) VALUES ($1)', ['x'.repeat(121)])).rejects.toMatchObject({ code: '23514' });

      const validLocation = ['30000000-0000-4000-8000-000000000405', sellerId, 'Point', 'Address', 'shop'];
      await pool.query('INSERT INTO locations (id, seller_id, name, address_text, type) VALUES ($1,$2,$3,$4,$5)', validLocation);

      await expect(pool.query('INSERT INTO locations (seller_id, name, address_text, type) VALUES ($1,$2,$3,$4)', ['99999999-9999-4999-8999-999999999999', 'Point', 'Address', 'shop']))
        .rejects.toMatchObject({ code: '23503' });
      await expect(pool.query('INSERT INTO locations (seller_id, name, address_text, type) VALUES ($1,$2,$3,$4)', [sellerId, '   ', 'Address', 'shop']))
        .rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO locations (seller_id, name, address_text, type) VALUES ($1,$2,$3,$4)', [sellerId, 'x'.repeat(121), 'Address', 'shop']))
        .rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO locations (seller_id, name, address_text, type) VALUES ($1,$2,$3,$4)', [sellerId, 'Point', '   ', 'shop']))
        .rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO locations (seller_id, name, address_text, type) VALUES ($1,$2,$3,$4)', [sellerId, 'Point', 'x'.repeat(501), 'shop']))
        .rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO locations (seller_id, name, address_text, type) VALUES ($1,$2,$3,$4)', [sellerId, 'Point', 'Address', 'warehouse']))
        .rejects.toMatchObject({ code: '23514' });
    } finally {
      await pool.query('DELETE FROM locations WHERE seller_id IN ($1,$2,$3)', [sellerId, nullSellerA, nullSellerB]);
      await pool.query('DELETE FROM sellers WHERE id IN ($1,$2,$3)', [sellerId, nullSellerA, nullSellerB]);
      await cleanupUser(userId, phone);
    }
  });
});
