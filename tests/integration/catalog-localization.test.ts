import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { resolveProduct } from '../../src/modules/catalog/application/resolve-product';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

describe.sequential('Catalog localization on PostgreSQL 18', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  const productIds: string[] = [];

  beforeAll(async () => { connection = await connectTestDatabase(); });
  afterAll(async () => {
    if (productIds.length > 0) {
      await connection.pool.query('DELETE FROM offers WHERE product_id = ANY($1::uuid[])', [productIds]);
      await connection.pool.query('DELETE FROM product_aliases WHERE product_id = ANY($1::uuid[])', [productIds]);
      await connection.pool.query('DELETE FROM product_localized_names WHERE product_id = ANY($1::uuid[])', [productIds]);
      await connection.pool.query('DELETE FROM products WHERE id = ANY($1::uuid[])', [productIds]);
    }
    await connection.pool.end();
  });

  it('resolves Russian and Kazakh catalog terms to one Product and localizes display only', async () => {
    await expect(resolveProduct(connection.db, 'қой еті')).resolves.toEqual({
      status: 'resolved',
      product: { id: seedIds.lambProduct, name: 'Баранина' },
    });

    const ru = await searchOffers('баранина', connection.db);
    const kk = await searchOffers('қой еті', connection.db, { locale: 'kk' });
    expect(kk.offers.map((offer) => offer.id)).toEqual(ru.offers.map((offer) => offer.id));
    expect(ru.offers[0]?.product).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
    expect(kk.offers[0]?.product).toEqual({ id: seedIds.lambProduct, name: 'Қой еті, жауырын', nameLocale: 'kk' });
  });

  it('falls back to the legacy Russian name and marks its language in kk', async () => {
    const productId = randomUUID();
    productIds.push(productId);
    await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'Тестовый продукт без перевода']);
    await connection.pool.query('INSERT INTO product_aliases (product_id,name,locale) VALUES ($1,$2,$3)', [productId, 'аудармасыз өнім', 'kk']);
    await connection.pool.query(
      `INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at)
       VALUES ($1,$2,$3,'100','KZT','active',$4)`,
      [productId, seedIds.seller, seedIds.location, new Date()],
    );

    const resolution = await resolveProduct(connection.db, 'аудармасыз өнім');
    expect(resolution).toEqual({ status: 'resolved', product: { id: productId, name: 'Тестовый продукт без перевода' } });
    const result = await searchOffers('аудармасыз өнім', connection.db, { locale: 'kk' });
    expect(result.offers[0]?.product).toEqual({ id: productId, name: 'Тестовый продукт без перевода', nameLocale: 'ru' });
  });

  it('rejects duplicate normalized names per locale and detects cross-language ambiguity', async () => {
    const first = randomUUID();
    const second = randomUUID();
    productIds.push(first, second);
    await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [first, 'CL First', second, 'CL Second']);
    await connection.pool.query("INSERT INTO product_localized_names (product_id,locale,name) VALUES ($1,'kk',$2)", [first, 'Ортақ атау']);
    await expect(connection.pool.query(
      "INSERT INTO product_localized_names (product_id,locale,name) VALUES ($1,'kk',$2)",
      [second, '  ортақ АТАУ  '],
    )).rejects.toMatchObject({ code: '23505' });

    await connection.pool.query("INSERT INTO product_aliases (product_id,name,locale) VALUES ($1,$2,'ru')", [second, 'Ортақ атау']);
    await expect(resolveProduct(connection.db, 'Ортақ атау')).resolves.toEqual({ status: 'ambiguous' });
  });
});
