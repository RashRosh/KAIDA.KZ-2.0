import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { geoSearchRequestSchema } from '../../src/modules/search/contracts/buyer-location.contract';
import { connectTestDatabase } from './database';

// S15B-3 / S15B-4a: a selected catalog Product is a signal that joins the candidate set, never a filter.

describe('Search with a selected Product (S15B-3, S15B-4a)', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  const freeOffer = randomUUID();
  beforeAll(async () => {
    connection = await connectTestDatabase();
    await connection.pool.query(
      `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
       VALUES ($1, NULL, $2, $3, 'Баранина свободная', 'баранина свободная', $1, '5000.00', 'KZT', 'kg', 'active', now())`,
      [freeOffer, seedIds.seller, seedIds.location],
    );
  });
  afterAll(async () => {
    await connection?.pool.query('DELETE FROM offers WHERE id = $1', [freeOffer]);
    await connection?.pool.end();
  });

  const ids = (response: { offers: { id: string }[] }) => response.offers.map((offer) => offer.id);

  it('gives the selected Product and the typed text the same candidate set, free titles included', async () => {
    const text = await searchOffers('Баранина', connection.db);
    const selected = await searchOffers('Баранина', connection.db, { productId: seedIds.lambProduct });
    expect(selected.resolvedProduct).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
    expect(ids(selected)).toEqual(expect.arrayContaining([seedIds.lambOffer, freeOffer]));
    expect(selected).toEqual(text);
  });

  it('adds the selected Product to the text sources without duplicates (union)', async () => {
    const response = await searchOffers('говядина', connection.db, { productId: seedIds.lambProduct });
    expect(response.query).toBe('говядина');
    expect(ids(response)).toEqual(expect.arrayContaining([seedIds.lambOffer, seedIds.beefOffer]));
    expect(new Set(ids(response)).size).toBe(ids(response).length);

    const different = await searchOffers('Баранина', connection.db, { productId: seedIds.beefProduct });
    expect(ids(different)).toEqual(expect.arrayContaining([seedIds.lambOffer, freeOffer, seedIds.beefOffer]));
    expect(new Set(ids(different)).size).toBe(ids(different).length);
  });

  it('lets a valid but unknown Product id fall through to the ordinary text search', async () => {
    const text = await searchOffers('Баранина', connection.db);
    const unknown = await searchOffers('Баранина', connection.db, { productId: randomUUID() });
    expect(unknown).toEqual(text);
    expect(ids(unknown)).toEqual(expect.arrayContaining([seedIds.lambOffer, freeOffer]));
  });

  it('is known-zero only when the whole candidate set is empty', async () => {
    const product = randomUUID();
    try {
      await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [product, 'Баранина пустая']);
      // no linked Offers and nothing in the titles → the whole candidate set is empty
      const empty = await searchOffers('Баранина пустая', connection.db, { productId: product });
      expect(empty).toEqual({ query: 'Баранина пустая', resolvedProduct: { id: product, name: 'Баранина пустая' }, offers: [] });
      // no linked Offers but free titles of the text → an ordinary result, not known-zero
      const withFree = await searchOffers('Баранина', connection.db, { productId: product });
      expect(withFree.resolvedProduct).toEqual({ id: product, name: 'Баранина пустая' });
      expect(ids(withFree)).toEqual(expect.arrayContaining([seedIds.lambOffer, freeOffer]));
    } finally {
      await connection.pool.query('DELETE FROM products WHERE id = $1', [product]);
    }
  });

  it('leaves an unresolved query to the text search and never invents a Product', async () => {
    const response = await searchOffers('свободная', connection.db);
    expect(response.resolvedProduct).toBeNull();
    expect(ids(response)).toEqual([freeOffer]);
  });

  it('keeps sort, direction and the public Offer shape of the text path', async () => {
    const byProduct = await searchOffers('Баранина', connection.db, { productId: seedIds.lambProduct, sort: 'price', direction: 'desc' });
    const text = await searchOffers('Баранина', connection.db, { sort: 'price', direction: 'desc' });
    expect(byProduct).toEqual(text);
  });

  it('accepts productId in the strict POST schema and rejects a non-uuid', () => {
    const base = { q: 'Баранина', buyerLocation: { latitude: 43.2, longitude: 76.9 } };
    expect(geoSearchRequestSchema.safeParse({ ...base, productId: seedIds.lambProduct }).success).toBe(true);
    expect(geoSearchRequestSchema.safeParse({ ...base, productId: 'not-a-uuid' }).success).toBe(false);
    expect(geoSearchRequestSchema.safeParse({ ...base, product: seedIds.lambProduct }).success).toBe(false);
    expect(geoSearchRequestSchema.safeParse(base).success).toBe(true);
  });
});
