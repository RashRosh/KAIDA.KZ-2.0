import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

// S15B-2: the Search response carries the catalog Product the query resolved to (existing exact resolver), else null.

describe('Search resolvedProduct (S15B-2)', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  beforeAll(async () => { connection = await connectTestDatabase(); });
  afterAll(async () => { await connection?.pool.end(); });

  const lamb = { id: seedIds.lambProduct, name: 'Баранина' };

  it.each([
    ['exact canonical name', 'Баранина'],
    ['exact localized name', 'Қой еті, жауырын'],
    ['exact alias', 'мясо барана'],
  ])('resolves %s', async (_label, query) => {
    const response = await searchOffers(query, connection.db);
    expect(response.resolvedProduct).toEqual(lamb);
  });

  it('is null for an unknown term and for an ambiguous term, with the existing empty result', async () => {
    const [a, b, aliasA, aliasB] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    try {
      await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [a, 'S15B2 Product A', b, 'S15B2 Product B']);
      await connection.pool.query('INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3),($4,$5,$6)', [aliasA, a, 'S15B2 спорный', aliasB, b, 'S15B2 спорный']);
      expect(await searchOffers('S15B2 точно неизвестно', connection.db)).toEqual({ query: 'S15B2 точно неизвестно', resolvedProduct: null, offers: [] });
      expect(await searchOffers('S15B2 спорный', connection.db)).toEqual({ query: 'S15B2 спорный', resolvedProduct: null, offers: [] });
    } finally {
      await connection.pool.query('DELETE FROM product_aliases WHERE id IN ($1,$2)', [aliasA, aliasB]);
      await connection.pool.query('DELETE FROM products WHERE id IN ($1,$2)', [a, b]);
    }
  });

  it('keeps a known Product without Offers resolved and the Offers of a known Product unchanged', async () => {
    const product = randomUUID();
    try {
      await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [product, 'S15B2 Товар без предложений']);
      expect(await searchOffers('S15B2 Товар без предложений', connection.db)).toEqual({
        query: 'S15B2 Товар без предложений', resolvedProduct: { id: product, name: 'S15B2 Товар без предложений' }, offers: [],
      });
      const withOffers = await searchOffers('Баранина', connection.db);
      expect(withOffers.offers.map((offer) => offer.id)).toContain(seedIds.lambOffer);
    } finally {
      await connection.pool.query('DELETE FROM products WHERE id = $1', [product]);
    }
  });
});
