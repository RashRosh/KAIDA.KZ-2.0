import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { applySellerTextInput } from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import { TextInputUnavailableError } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const userId = '11111111-aaaa-4aaa-8aaa-111111111101';
const phone = '+77000009101';

async function cleanup() {
  await pool.query('DELETE FROM offer_drafts WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
});

afterAll(async () => {
  await pool.end();
});

describe('seller text input apply', () => {
  it('rejects when mode is off', async () => {
    await cleanup();
    await pool.query('INSERT INTO users (id, phone_e164) VALUES ($1, $2)', [userId, phone]);
    await setupSeller(userId, {
      seller: { displayName: 'Text seller' },
      location: { name: 'Point', type: 'shop', addressText: 'Almaty' },
    }, { database: db });
    await expect(applySellerTextInput(userId, 'Баранина 4500 кг', { database: db, env: { SELLER_TEXT_INPUT: 'off' } }))
      .rejects.toBeInstanceOf(TextInputUnavailableError);
  });

  it('creates catalog-linked draft for exact match', async () => {
    await cleanup();
    await pool.query('INSERT INTO users (id, phone_e164) VALUES ($1, $2)', [userId, phone]);
    await setupSeller(userId, {
      seller: { displayName: 'Text seller' },
      location: { name: 'Point', type: 'shop', addressText: 'Almaty' },
    }, { database: db });
    const locationId = (await pool.query('SELECT id FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1) LIMIT 1', [userId])).rows[0]?.id as string;

    const result = await applySellerTextInput(userId, '[fixture:e2e-catalog]', {
      database: db,
      env: { SELLER_TEXT_INPUT: 'fake' },
    });
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.payload.productId).toBe(seedIds.lambProduct);
    expect(result.drafts[0]?.payload.points[0]?.locationId).toBe(locationId);
    expect(result.skipped).toHaveLength(0);

    const offers = await pool.query('SELECT count(*)::int AS count FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
    expect(offers.rows[0].count).toBe(0);
  });

  it('creates free-title draft with pack', async () => {
    await cleanup();
    await pool.query('INSERT INTO users (id, phone_e164) VALUES ($1, $2)', [userId, phone]);
    await setupSeller(userId, {
      seller: { displayName: 'Text seller' },
      location: { name: 'Point', type: 'shop', addressText: 'Almaty' },
    }, { database: db });

    const result = await applySellerTextInput(userId, '[fixture:e2e-free-title]', {
      database: db,
      env: { SELLER_TEXT_INPUT: 'fake' },
    });
    expect(result.drafts[0]?.payload.productId).toBeNull();
    expect(result.drafts[0]?.payload.unit).toEqual({ code: 'package' });
    expect(result.drafts[0]?.payload.pack).toEqual({ amount: '500', unit: 'g' });
  });
});
