import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

// S15B-4b: the relevance order (default), the unchanged explicit sorts and the legacy direction-only request on real data.
// Fixtures: the seed Offer «Баранина» (linked to the Product, confirmed 2 h ago), plus fresher free-title cards.

describe('Search relevance order (S15B-4b)', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  const onBone = randomUUID();
  const diminutive = randomUUID();
  const aliasFree = randomUUID();
  let lambConfirmedAt: Date;
  const ids = (response: { offers: { id: string }[] }) => response.offers.map((offer) => offer.id);

  async function insertFree(id: string, title: string, minutesAgo: number) {
    await connection.pool.query(
      `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
       VALUES ($1, NULL, $2, $3, $4, lower($4), $1, '5000.00', 'KZT', 'kg', 'active', now() - ($5 || ' minutes')::interval)`,
      [id, seedIds.seller, seedIds.location, title, String(minutesAgo)],
    );
  }

  beforeAll(async () => {
    connection = await connectTestDatabase();
    const lamb = await connection.pool.query('SELECT last_confirmed_at FROM offers WHERE id = $1', [seedIds.lambOffer]);
    lambConfirmedAt = lamb.rows[0].last_confirmed_at;
    await connection.pool.query("UPDATE offers SET last_confirmed_at = now() - interval '120 minutes' WHERE id = $1", [seedIds.lambOffer]);
    await insertFree(onBone, 'Баранина на кости', 30);
    await insertFree(diminutive, 'Баранина500г', 5);
    await insertFree(aliasFree, 'Мясо барана домашнее', 10);
  });
  afterAll(async () => {
    await connection?.pool.query('DELETE FROM offers WHERE id = ANY($1)', [[onBone, diminutive, aliasFree]]);
    await connection?.pool.query('UPDATE offers SET last_confirmed_at = $2 WHERE id = $1', [seedIds.lambOffer, lambConfirmedAt]);
    await connection?.pool.end();
  });

  it('with no sort orders by level: the Product card, whole-word titles, then prefix-only titles', async () => {
    const response = await searchOffers('Баранина', connection.db);
    // lamb: level 1 (older), «Баранина на кости»: level 2, «Баранина500г»: level 3 (the freshest)
    expect(ids(response)).toEqual([seedIds.lambOffer, onBone, diminutive]);
    expect(await searchOffers('Баранина', connection.db, { sort: 'relevance' })).toEqual(response);
  });

  it('an explicit actuality is unchanged: fresher first, regardless of the level', async () => {
    expect(ids(await searchOffers('Баранина', connection.db, { sort: 'actuality' }))).toEqual([diminutive, onBone, seedIds.lambOffer]);
    expect(ids(await searchOffers('Баранина', connection.db, { sort: 'actuality', direction: 'asc' }))).toEqual([seedIds.lambOffer, onBone, diminutive]);
  });

  it('a direction alone keeps its legacy meaning: actuality in that direction', async () => {
    const legacy = await searchOffers('Баранина', connection.db, { direction: 'asc' });
    expect(ids(legacy)).toEqual([seedIds.lambOffer, onBone, diminutive]);
    expect(legacy).toEqual(await searchOffers('Баранина', connection.db, { sort: 'actuality', direction: 'asc' }));
    expect(ids(await searchOffers('Баранина', connection.db, { direction: 'desc' }))).toEqual([diminutive, onBone, seedIds.lambOffer]);
  });

  it('keeps the candidate set of every order identical (eligibility is unchanged)', async () => {
    const sorted = (response: { offers: { id: string }[] }) => ids(response).sort();
    const relevance = sorted(await searchOffers('Баранина', connection.db));
    expect(sorted(await searchOffers('Баранина', connection.db, { sort: 'actuality' }))).toEqual(relevance);
    expect(sorted(await searchOffers('Баранина', connection.db, { sort: 'price' }))).toEqual(relevance);
  });

  it('an alias hit is the Product: its linked card is level 1 although the title lacks the words', async () => {
    const response = await searchOffers('мясо барана', connection.db);
    expect(response.resolvedProduct).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
    // lamb (linked) first, then the whole-word free title
    expect(ids(response)[0]).toBe(seedIds.lambOffer);
    expect(ids(response)).toContain(aliasFree);
  });

  it('a selected Product that the text does not agree with gets no level 1: the exact free title goes first', async () => {
    const response = await searchOffers('баранина на кости', connection.db, { productId: seedIds.lambProduct });
    expect(ids(response)).toEqual(expect.arrayContaining([onBone, seedIds.lambOffer]));
    expect(ids(response).indexOf(onBone)).toBeLessThan(ids(response).indexOf(seedIds.lambOffer));
    // the selection never narrows the set: it is the union of 4a
    expect(new Set(ids(response)).size).toBe(ids(response).length);
  });

  it('a selected Product the text is (the same Product as the resolver) keeps level 1', async () => {
    const response = await searchOffers('Баранина', connection.db, { productId: seedIds.lambProduct });
    expect(ids(response)).toEqual([seedIds.lambOffer, onBone, diminutive]);
  });

  it('a relevance order with a direction is not a valid programmatic request', async () => {
    await expect(searchOffers('Баранина', connection.db, { sort: 'relevance', direction: 'asc' })).rejects.toThrow();
  });
});
