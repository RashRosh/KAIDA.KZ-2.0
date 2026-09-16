import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

const NOW = new Date('2026-09-13T06:30:00.000Z');

describe.sequential('S6 Search through Catalog aliases on PostgreSQL 18', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  beforeAll(async () => { connection = await connectTestDatabase(); });
  afterAll(async () => { await connection.pool.end(); });

  it('returns the same canonical Offer through alias and canonical Product name', async () => {
    const canonical = await searchOffers('Баранина', connection.db);
    const alias = await searchOffers('мясо барана', connection.db);
    expect(alias.query).toBe('мясо барана');
    expect(alias.offers).toEqual(canonical.offers);
    expect(alias.offers[0]).toMatchObject({
      id: seedIds.lambOffer,
      product: { id: seedIds.lambProduct, name: 'Баранина' },
    });
  });

  it('keeps unknown and ambiguous buyer terms as an empty successful result', async () => {
    const productA = randomUUID();
    const productB = randomUUID();
    const aliasA = randomUUID();
    const aliasB = randomUUID();
    try {
      await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [productA, 'S6 Search A', productB, 'S6 Search B']);
      await connection.pool.query('INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3),($4,$5,$6)', [aliasA, productA, 'S6 спорный поиск', aliasB, productB, 'S6 спорный поиск']);

      expect((await searchOffers('S6 точно неизвестно', connection.db)).offers).toEqual([]);
      const ambiguous = await searchOffers('S6 спорный поиск', connection.db);
      expect(ambiguous).toEqual({ query: 'S6 спорный поиск', offers: [] });
    } finally {
      await connection.pool.query('DELETE FROM product_aliases WHERE id IN ($1,$2)', [aliasA, aliasB]);
      await connection.pool.query('DELETE FROM products WHERE id IN ($1,$2)', [productA, productB]);
    }
  });

  it('preserves S1 lifecycle filtering and existing Offer ordering through alias search', async () => {
    const freshId = '48000000-0000-4000-8000-000000000001';
    const inactiveId = '48000000-0000-4000-8000-000000000002';
    const expiredId = '48000000-0000-4000-8000-000000000003';
    try {
      await connection.pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at)
        VALUES ($1,$2,$3,$4,1000,'KZT','active',$5),($6,$2,$3,$4,1000,'KZT','inactive',$5),($7,$2,$3,$4,1000,'KZT','active',$8)`, [
        freshId, seedIds.lambProduct, seedIds.seller, seedIds.location, NOW,
        inactiveId, expiredId, new Date('2026-09-05T06:29:59.000Z'),
      ]);

      const options = { clock: () => NOW, validityPeriodHours: 168 };
      const canonical = await searchOffers('Баранина', connection.db, options);
      const alias = await searchOffers('мясо барана', connection.db, options);
      expect(alias.offers.map((offer) => offer.id)).toEqual(canonical.offers.map((offer) => offer.id));
      expect(alias.offers.map((offer) => offer.id)).toEqual([seedIds.lambOffer, freshId]);
      expect(alias.offers.some((offer) => offer.id === inactiveId || offer.id === expiredId)).toBe(false);
    } finally {
      await connection.pool.query('DELETE FROM offers WHERE id IN ($1,$2,$3)', [freshId, inactiveId, expiredId]);
    }
  });

  it.each(['%', '_', "' OR TRUE --"] )('keeps resolver lookup parameterized for %s', async (query) => {
    await expect(searchOffers(query, connection.db)).resolves.toEqual({ query, offers: [] });
  });
});
