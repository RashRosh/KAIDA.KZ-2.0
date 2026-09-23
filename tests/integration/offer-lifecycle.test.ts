import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { searchResponseSchema } from '../../src/modules/search/contracts/search.contract';
import { connectTestDatabase } from './database';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const PRODUCT_ID = '10000000-0000-4000-8000-000000000101';
const OFFER_ID = '40000000-0000-4000-8000-000000000101';
const PRODUCT_NAME = 'S1 lifecycle fixture';

describe('S1 Offer Lifecycle against PostgreSQL 18', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;

  beforeAll(async () => {
    connection = await connectTestDatabase();
    await connection.pool.query('DELETE FROM offers WHERE id = $1', [OFFER_ID]);
    await connection.pool.query('DELETE FROM products WHERE id = $1', [PRODUCT_ID]);
    await connection.pool.query('INSERT INTO products (id, name) VALUES ($1, $2)', [PRODUCT_ID, PRODUCT_NAME]);
    await connection.pool.query(
      `INSERT INTO offers (
        id, product_id, seller_id, location_id, price_amount, price_currency, price_unit_code,
        seller_comment, status, last_confirmed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        OFFER_ID,
        PRODUCT_ID,
        seedIds.seller,
        seedIds.location,
        '990.00',
        'KZT',
        'piece',
        'Lifecycle fixture',
        'active',
        new Date('2026-09-11T11:00:00.000Z'),
      ],
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.pool.query('DELETE FROM offers WHERE id = $1', [OFFER_ID]);
    await connection.pool.query('DELETE FROM products WHERE id = $1', [PRODUCT_ID]);
    await connection.pool.end();
  });

  async function setLifecycle(status: 'active' | 'inactive', lastConfirmedAt: Date) {
    await connection.pool.query(
      'UPDATE offers SET status = $1, last_confirmed_at = $2 WHERE id = $3',
      [status, lastConfirmedAt, OFFER_ID],
    );
  }

  async function searchFixture() {
    return searchOffers(PRODUCT_NAME, connection.db, {
      clock: () => NOW,
      validityPeriodHours: 168,
    });
  }

  it.each([
    ['active', '2026-09-11T11:00:00.000Z', true],
    ['active', '2026-09-04T12:00:00.001Z', true],
    ['active', '2026-09-04T12:00:00.000Z', false],
    ['active', '2026-09-04T11:59:59.999Z', false],
    ['inactive', '2026-09-11T11:00:00.000Z', false],
  ] as const)('%s at %s -> visible=%s', async (status, timestamp, visible) => {
    await setLifecycle(status, new Date(timestamp));
    const result = await searchFixture();
    expect(result.offers).toHaveLength(visible ? 1 : 0);
    if (visible) expect(result.offers[0]?.id).toBe(OFFER_ID);
  });

  it('keeps the S0 Search response contract and never exposes lifecycle fields', async () => {
    await setLifecycle('active', new Date('2026-09-04T12:00:00.001Z'));
    const result = await searchFixture();
    expect(searchResponseSchema.safeParse(result).success).toBe(true);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).not.toHaveProperty('status');
    expect(result.offers[0]).not.toHaveProperty('lastConfirmedAt');
  });

  it('returns an ordinary empty result for an expired Offer', async () => {
    await setLifecycle('active', new Date('2026-09-04T12:00:00.000Z'));
    await expect(searchFixture()).resolves.toEqual({ query: PRODUCT_NAME, offers: [] });
  });

  it('returns an ordinary empty result for an inactive Offer', async () => {
    await setLifecycle('inactive', new Date('2026-09-11T11:00:00.000Z'));
    await expect(searchFixture()).resolves.toEqual({ query: PRODUCT_NAME, offers: [] });
  });
});
