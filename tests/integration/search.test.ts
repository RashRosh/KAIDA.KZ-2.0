import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds, seedDatabase } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { searchResponseSchema } from '../../src/modules/search/contracts/search.contract';
import { connectTestDatabase } from './database';

describe('S0 Search regression against PostgreSQL 18 after UX1D', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  beforeAll(async () => { connection = await connectTestDatabase(); });
  afterAll(async () => { await connection?.pool.end(); });

  it('finds the exact lamb offer and its Product / Seller / Location', async () => {
    const result = await searchOffers('баранина', connection.db);
    expect(result).toEqual({
      query: 'баранина',
      offers: [{
        id: seedIds.lambOffer,
        product: { id: seedIds.lambProduct, name: 'Баранина' },
        seller: {
          id: seedIds.seller,
          displayName: 'Асыл Ет, тестовый продавец',
          contacts: { phoneE164: '+77000000001' },
        },
        location: { id: seedIds.location, name: 'Тестовая мясная точка', addressText: 'Алматы, Зелёный базар, тестовый павильон 12' },
        price: { amount: '4200.00', currency: 'KZT', unit: 'кг' },
        sellerComment: 'Свежий привоз.',
      }],
    });
    expect(searchResponseSchema.safeParse(result).success).toBe(true);
  });

  it.each(['БАРАНИНА', 'Баранина', '  баранина  '])('handles case and surrounding spaces: %s', async (query) => {
    const result = await searchOffers(query, connection.db);
    expect(result.query).toBe(query.trim());
    expect(result.offers.map((offer) => offer.product.id)).toEqual([seedIds.lambProduct]);
  });

  it.each(['единорог', 'баран', 'баранина свежая', '%', '_', "' OR TRUE --"] )('returns no offers for an unmatched exact name: %s', async (query) => {
    expect((await searchOffers(query, connection.db)).offers).toEqual([]);
  });

  it('returns nullable price for beef', async () => {
    const { offers } = await searchOffers('говядина', connection.db);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ id: seedIds.beefOffer, product: { name: 'Говядина' }, price: null });
  });

  it('keeps seed values and record counts stable on repeat with the same controlled seed time', async () => {
    const seeded = await connection.pool.query<{ last_confirmed_at: Date }>(
      'SELECT last_confirmed_at FROM offers WHERE id = $1',
      [seedIds.lambOffer],
    );
    const seedNow = seeded.rows[0]!.last_confirmed_at;
    const before = await connection.pool.query('SELECT * FROM offers ORDER BY id');
    await seedDatabase(connection.db, seedNow);
    const after = await connection.pool.query('SELECT * FROM offers ORDER BY id');
    expect(after.rows).toEqual(before.rows);
    const counts = await connection.pool.query('SELECT (SELECT count(*)::int FROM products) AS products, (SELECT count(*)::int FROM sellers) AS sellers, (SELECT count(*)::int FROM locations) AS locations, (SELECT count(*)::int FROM offers) AS offers');
    expect(counts.rows[0]).toEqual({ products: 2, sellers: 1, locations: 1, offers: 2 });
  });

  it.each([
    ['-1', 'KZT'], ['NaN', 'KZT'], ['Infinity', 'KZT'], ['100', null], ['100', '   '],
  ])('rejects invalid stored price %s / %s', async (amount, currency) => {
    const client = await connection.pool.connect();
    try {
      await client.query('BEGIN');
      await expect(client.query(
        `INSERT INTO offers (
          product_id, seller_id, location_id, price_amount, price_currency, status, last_confirmed_at
        ) VALUES ($1,$2,$3,$4,$5,'active',$6)`,
        [seedIds.lambProduct, seedIds.seller, seedIds.location, amount, currency, new Date('2026-09-11T12:00:00.000Z')],
      )).rejects.toMatchObject({ code: '23514' });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('rejects an offer pointing at a nonexistent product', async () => {
    await expect(connection.pool.query(
      `INSERT INTO offers (product_id, seller_id, location_id, status, last_confirmed_at)
       VALUES ($1,$2,$3,'active',$4)`,
      ['10000000-0000-4000-8000-000000000099', seedIds.seller, seedIds.location, new Date('2026-09-11T12:00:00.000Z')],
    )).rejects.toMatchObject({ code: '23503' });
  });

  it.each([['Баранина', '23505'], ['   ', '23514']])('enforces the product name constraint: %s', async (name, code) => {
    await expect(connection.pool.query('INSERT INTO products (name) VALUES ($1)', [name])).rejects.toMatchObject({ code });
  });

  it('accepts zero price and a null seller comment', async () => {
    const client = await connection.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO offers (
          product_id, seller_id, location_id, price_amount, price_currency, seller_comment, status, last_confirmed_at
        ) VALUES ($1,$2,$3,0,'KZT',NULL,'active',$4) RETURNING price_amount, seller_comment`,
        [seedIds.lambProduct, seedIds.seller, seedIds.location, new Date('2026-09-11T12:00:00.000Z')],
      );
      expect(result.rows[0]).toEqual({ price_amount: '0', seller_comment: null });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
