import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { resolveProduct } from '../../src/modules/catalog/application/resolve-product';
import { connectTestDatabase } from './database';

describe.sequential('S6 Catalog Product resolver on PostgreSQL 18', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  const productIds: string[] = [];
  const aliasIds: string[] = [];

  beforeAll(async () => { connection = await connectTestDatabase(); });
  afterEach(async () => {
    if (aliasIds.length > 0) {
      await connection.pool.query('DELETE FROM product_aliases WHERE id = ANY($1::uuid[])', [[...aliasIds]]);
      aliasIds.length = 0;
    }
    if (productIds.length > 0) {
      await connection.pool.query('DELETE FROM products WHERE id = ANY($1::uuid[])', [[...productIds]]);
      productIds.length = 0;
    }
  });
  afterAll(async () => { await connection.pool.end(); });

  async function insertProduct(name: string) {
    const id = randomUUID();
    await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [id, name]);
    productIds.push(id);
    return id;
  }

  async function insertAlias(productId: string, name: string) {
    const id = randomUUID();
    await connection.pool.query('INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3)', [id, productId, name]);
    aliasIds.push(id);
    return id;
  }

  it('resolves canonical Product by exact and case-folded normalized name', async () => {
    await expect(resolveProduct(connection.db, 'Баранина')).resolves.toEqual({
      status: 'resolved',
      product: { id: seedIds.lambProduct, name: 'Баранина' },
    });
    await expect(resolveProduct(connection.db, '   БАРАНИНА   ')).resolves.toEqual({
      status: 'resolved',
      product: { id: seedIds.lambProduct, name: 'Баранина' },
    });
  });

  it('resolves seed alias with case folding to the canonical Product', async () => {
    await expect(resolveProduct(connection.db, 'мясо барана')).resolves.toEqual({
      status: 'resolved',
      product: { id: seedIds.lambProduct, name: 'Баранина' },
    });
    await expect(resolveProduct(connection.db, '  МЯСО БАРАНА  ')).resolves.toEqual({
      status: 'resolved',
      product: { id: seedIds.lambProduct, name: 'Баранина' },
    });
  });

  it('uses NFC equivalence for canonical Product resolution', async () => {
    const productId = await insertProduct('Йогурт S6 NFC');
    await expect(resolveProduct(connection.db, 'И\u0306огурт S6 NFC')).resolves.toEqual({
      status: 'resolved',
      product: { id: productId, name: 'Йогурт S6 NFC' },
    });
  });

  it('returns not_found for an unknown term', async () => {
    await expect(resolveProduct(connection.db, 'S6 неизвестный товар')).resolves.toEqual({ status: 'not_found' });
  });

  it('classifies one shared alias across two Products as ambiguous', async () => {
    const a = await insertProduct('S6 Ambiguous A');
    const b = await insertProduct('S6 Ambiguous B');
    await insertAlias(a, 'S6 общий псевдоним');
    await insertAlias(b, 's6 ОБЩИЙ ПСЕВДОНИМ');
    await expect(resolveProduct(connection.db, 'S6 общий псевдоним')).resolves.toEqual({ status: 'ambiguous' });
  });

  it('classifies canonical/alias collision across different Products as ambiguous', async () => {
    await insertProduct('S6 Канонический конфликт');
    const other = await insertProduct('S6 Другой продукт');
    await insertAlias(other, '  s6 КАНОНИЧЕСКИЙ КОНФЛИКТ  ');
    await expect(resolveProduct(connection.db, 'S6 Канонический конфликт')).resolves.toEqual({ status: 'ambiguous' });
  });

  it('deduplicates canonical and alias candidates for the same Product before classification', async () => {
    const productId = await insertProduct('S6 Один Product');
    await insertAlias(productId, '  s6 ОДИН product  ');
    await expect(resolveProduct(connection.db, 'S6 один product')).resolves.toEqual({
      status: 'resolved',
      product: { id: productId, name: 'S6 Один Product' },
    });
  });

  it('does not add whitespace collapsing, е/ё mapping, punctuation stripping or transliteration', async () => {
    const productId = await insertProduct('S6 Nonfeatures');
    await insertAlias(productId, 's6 мясо барана');
    await insertAlias(productId, 's6 мёд');
    await insertAlias(productId, 's6 баранина');
    await insertAlias(productId, 's6 краб');

    for (const term of ['s6 мясо  барана', 's6 мед', 's6 баранина!', 's6 crab']) {
      await expect(resolveProduct(connection.db, term)).resolves.toEqual({ status: 'not_found' });
    }
  });

  it('enforces normalized canonical Product uniqueness', async () => {
    await insertProduct('S6 Canonical Unique');
    await expect(connection.pool.query(
      'INSERT INTO products (id,name) VALUES ($1,$2)',
      [randomUUID(), '   s6 CANONICAL UNIQUE   '],
    )).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects duplicate normalized alias for one Product but allows it for another Product', async () => {
    const a = await insertProduct('S6 Alias Owner A');
    const b = await insertProduct('S6 Alias Owner B');
    await insertAlias(a, 'S6 Duplicate Alias');

    await expect(connection.pool.query(
      'INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3)',
      [randomUUID(), a, '  s6 DUPLICATE ALIAS  '],
    )).rejects.toMatchObject({ code: '23505' });

    await expect(insertAlias(b, '  s6 DUPLICATE ALIAS  ')).resolves.toBeTypeOf('string');
  });

  it('enforces ProductAlias FK and nonblank name', async () => {
    await expect(connection.pool.query(
      'INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3)',
      [randomUUID(), '99999999-9999-4999-8999-999999999999', 'S6 orphan'],
    )).rejects.toMatchObject({ code: '23503' });

    await expect(connection.pool.query(
      'INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3)',
      [randomUUID(), seedIds.lambProduct, '   '],
    )).rejects.toMatchObject({ code: '23514' });
  });
});
