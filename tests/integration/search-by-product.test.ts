import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { geoSearchRequestSchema } from '../../src/modules/search/contracts/buyer-location.contract';
import { connectTestDatabase } from './database';

// S15B-3: Search by a selected catalog Product runs on that Product.id only — no text fallback.

describe('Search by selected Product (S15B-3)', () => {
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

  it('returns only the Offers linked to the selected Product, never the free-title ones', async () => {
    const text = await searchOffers('Баранина', connection.db);
    expect(text.offers.map((offer) => offer.id)).toEqual(expect.arrayContaining([seedIds.lambOffer, freeOffer]));

    const byProduct = await searchOffers('Баранина', connection.db, { productId: seedIds.lambProduct });
    expect(byProduct.resolvedProduct).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
    expect(byProduct.offers.map((offer) => offer.id)).toEqual([seedIds.lambOffer]);
  });

  it('does not use q to choose Offers when a Product is given', async () => {
    const byProduct = await searchOffers('говядина', connection.db, { productId: seedIds.lambProduct });
    expect(byProduct.query).toBe('говядина');
    expect(byProduct.offers.map((offer) => offer.id)).toEqual([seedIds.lambOffer]);
  });

  it('answers an unknown Product id with an ordinary empty result and no text fallback', async () => {
    const unknown = await searchOffers('Баранина', connection.db, { productId: randomUUID() });
    expect(unknown).toEqual({ query: 'Баранина', resolvedProduct: null, offers: [] });
  });

  it('keeps a known Product without Offers resolved (known-zero) and never falls back to the text', async () => {
    const product = randomUUID();
    try {
      await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [product, 'Баранина пустая']);
      const response = await searchOffers('Баранина', connection.db, { productId: product });
      expect(response).toEqual({ query: 'Баранина', resolvedProduct: { id: product, name: 'Баранина пустая' }, offers: [] });
    } finally {
      await connection.pool.query('DELETE FROM products WHERE id = $1', [product]);
    }
  });

  it('keeps the same Product-path sort, direction and public Offer shape as the text path', async () => {
    const byProduct = await searchOffers('Баранина', connection.db, { productId: seedIds.lambProduct, sort: 'price', direction: 'desc' });
    const text = await searchOffers('Баранина', connection.db, { sort: 'price', direction: 'desc' });
    expect(byProduct.offers).toEqual(text.offers.filter((offer) => offer.id === seedIds.lambOffer));
  });

  it('accepts productId in the strict POST schema and rejects a non-uuid', () => {
    const base = { q: 'Баранина', buyerLocation: { latitude: 43.2, longitude: 76.9 } };
    expect(geoSearchRequestSchema.safeParse({ ...base, productId: seedIds.lambProduct }).success).toBe(true);
    expect(geoSearchRequestSchema.safeParse({ ...base, productId: 'not-a-uuid' }).success).toBe(false);
    expect(geoSearchRequestSchema.safeParse({ ...base, product: seedIds.lambProduct }).success).toBe(false);
    expect(geoSearchRequestSchema.safeParse(base).success).toBe(true);
  });
});
