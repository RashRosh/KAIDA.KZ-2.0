import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import type { Database } from '../../src/db/client';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { searchOffersWithCorrection } from '../../src/modules/search/application/search-with-correction';
import { unfinishedCorrectionPasses } from '../../src/modules/search/typo/typo-limiter';
import { recordSearchEvent } from '../../src/modules/search-events/application/record-search-event';
import { readSearchEventsConfig } from '../../src/modules/search-events/config';
import { connectTestDatabase } from './database';

// search-typo-suggestions (docs/slices/search-typo-suggestions, contract rev 3 §3.2, §3.8, §4): the original Search first and
// unchanged; the correction only for a Search that found nothing and recognised no product, once, and only when the corrected
// text returns Offers; one D0 event with the original outcome and separate corrected fields.

describe('Search typo correction (search-typo-suggestions)', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  const titles = ['Молоко фермерское', 'Молоко свежее', 'Творог домашний', 'Малина свежая'];
  const offerIds = new Map(titles.map((title) => [title, randomUUID()]));
  const idOf = (title: string) => offerIds.get(title)!;
  const ids = (response: { offers: { id: string }[] }) => response.offers.map((offer) => offer.id);
  const config = { enabled: true, budgetMs: 400, maxPasses: 3 };
  const run = (query: string, settings: Partial<{ correct: boolean; config: typeof config }> = {}, options: Parameters<typeof searchOffers>[2] = {}, db?: Database) =>
    searchOffersWithCorrection(query, db ?? connection.db, options, { correct: true, config, ...settings });
  const createdProducts: string[] = [];
  const knownProduct = { id: randomUUID(), name: 'Креветкины' };

  beforeAll(async () => {
    connection = await connectTestDatabase();
    for (const [title, id] of offerIds) {
      await connection.pool.query(
        `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $1, '5000.00', 'KZT', 'kg', 'active', now())`,
        [id, seedIds.seller, seedIds.location, title, offerTitleSearchText(title)],
      );
    }
    // a catalog Product without any Offer: its name is a public word, but its Search is a known product with no Offers
    await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [knownProduct.id, knownProduct.name]);
    createdProducts.push(knownProduct.id);
  });
  afterAll(async () => {
    await connection?.pool.query('DELETE FROM offers WHERE id = ANY($1)', [[...offerIds.values()]]);
    await connection?.pool.query('DELETE FROM products WHERE id = ANY($1)', [createdProducts]);
    await connection?.pool.query("DELETE FROM search_events WHERE query_normalized LIKE 'typoevt%'");
    await connection?.pool.end();
  });

  it('corrects a mistyped query that found nothing and returns the Offers of the corrected text; the query stays the original', async () => {
    const original = await searchOffers('малако', connection.db);
    expect(original.offers).toEqual([]);
    const outcome = await run('малако');
    expect(outcome.response.query).toBe('малако');
    expect(outcome.response.correction).toEqual({ from: 'малако', to: 'молоко' });
    expect(ids(outcome.response)).toEqual(expect.arrayContaining([idOf('Молоко фермерское'), idOf('Молоко свежее')]));
    expect(outcome.correction).toMatchObject({ from: 'малако', to: 'молоко' });
    // the original intent is kept for D0: unresolved
    expect(outcome.resolution).toBe('unresolved');
  });

  it('keeps the known words of a several-word query and corrects the unknown one', async () => {
    const outcome = await run('малако свежее');
    expect(outcome.response.correction).toEqual({ from: 'малако свежее', to: 'молоко свежее' });
    expect(ids(outcome.response)).toEqual([idOf('Молоко свежее')]);
  });

  it('keeps the effective result identical to an ordinary Search for the corrected text (same order)', async () => {
    const corrected = await run('малако');
    const ordinary = await searchOffers('молоко', connection.db);
    expect(ids(corrected.response)).toEqual(ids(ordinary));
  });

  it('does nothing without the correct flag or with the kill switch off, and never corrects a query that returns Offers', async () => {
    const plain = await run('малако', { correct: false });
    expect(plain.response.offers).toEqual([]);
    expect(plain.response.correction).toBeUndefined();
    const off = await run('малако', { config: { ...config, enabled: false } });
    expect(off.response.offers).toEqual([]);
    expect(off.response.correction).toBeUndefined();
    const found = await run('творог');
    expect(found.response.correction).toBeUndefined();
    expect(ids(found.response)).toContain(idOf('Творог домашний'));
  });

  it('leaves «машина» alone although «малина» has an Offer (the blocking negative case)', async () => {
    const outcome = await run('машина');
    expect(outcome.response.offers).toEqual([]);
    expect(outcome.response.correction).toBeUndefined();
  });

  it('does not correct when there is a tie, nothing close, or the corrected text has no Offers', async () => {
    for (const query of ['единорог', 'молоко бетон']) {
      const outcome = await run(query);
      expect(outcome.response.correction, query).toBeUndefined();
    }
    // «креветкины» is a catalog Product without Offers: the corrected text would only land on a known product — never substituted
    const lands = await run('креветкиныы');
    expect(lands.response.correction).toBeUndefined();
    expect(lands.response.offers).toEqual([]);
  });

  it('does not correct a Search by a selected Product', async () => {
    const outcome = await run('малако', {}, { productId: knownProduct.id });
    expect(outcome.resolution).toBe('selected');
    expect(outcome.response.correction).toBeUndefined();
  });

  it('answers within the budget when the correction work hangs, holds the slot until the work ends, and discards the late result', async () => {
    const gate: { release?: () => void } = {};
    const hung = new Promise<never>((_, reject) => { gate.release = () => reject(new Error('released')); });
    // everything of the original Search runs on the real database; only the correction work (a transaction) never returns
    const proxy = new Proxy(connection.db, {
      get(target, property, receiver) {
        if (property === 'transaction') return () => hung;
        return Reflect.get(target, property, receiver);
      },
    }) as Database;
    const started = Date.now();
    const outcome = await run('малако', { config: { ...config, budgetMs: 80 } }, {}, proxy);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(outcome.response.offers).toEqual([]);
    expect(outcome.response.correction).toBeUndefined();
    expect(unfinishedCorrectionPasses()).toBe(1);
    gate.release?.();
    for (let index = 0; index < 50 && unfinishedCorrectionPasses() > 0; index += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(unfinishedCorrectionPasses()).toBe(0);
  });

  describe('D0 accounting: one event, the original outcome plus separate corrected fields', () => {
    const eventConfig = { ...readSearchEventsConfig({}), origin: 'test' as const };
    const rowsFor = async (text: string) => (await connection.pool.query('SELECT * FROM search_events WHERE query_normalized = $1', [text])).rows;

    it('writes the corrected text and its count next to the unresolved original with 0 Offers', async () => {
      const status = await recordSearchEvent(
        { entry: 'submit', query: 'typoevt малако', resolvedProductId: null, resolution: 'unresolved', resultCount: 0, corrected: { query: 'typoevt молоко', resultCount: 2 } },
        { database: connection.db, config: eventConfig },
      );
      expect(status).toBe('written');
      const rows = await rowsFor('typoevt малако');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ entry: 'submit', resolution: 'unresolved', result_count: 0, resolved_product_id: null, corrected_query_normalized: 'typoevt молоко', corrected_result_count: 2 });
    });

    it('leaves the corrected fields empty for an ordinary search and ignores a corrected text equal to the original or without Offers', async () => {
      await recordSearchEvent({ entry: 'chip', query: 'typoevt ордин', resolvedProductId: null, resolution: 'unresolved', resultCount: 0 }, { database: connection.db, config: eventConfig });
      await recordSearchEvent({ entry: 'submit', query: 'typoevt равно', resolvedProductId: null, resolution: 'unresolved', resultCount: 0, corrected: { query: 'typoevt равно', resultCount: 3 } }, { database: connection.db, config: eventConfig });
      await recordSearchEvent({ entry: 'submit', query: 'typoevt пусто', resolvedProductId: null, resolution: 'unresolved', resultCount: 0, corrected: { query: 'typoevt пустое', resultCount: 0 } }, { database: connection.db, config: eventConfig });
      for (const text of ['typoevt ордин', 'typoevt равно', 'typoevt пусто']) {
        const rows = await rowsFor(text);
        expect(rows, text).toHaveLength(1);
        expect(rows[0].corrected_query_normalized, text).toBeNull();
        expect(rows[0].corrected_result_count, text).toBeNull();
      }
    });

    it('is protected by the CHECK: the pair is set together, with at least one Offer and a text that differs from the original', async () => {
      const insert = (corrected: string | null, count: number | null, original = 'typoevt чек') => connection.pool.query(
        "INSERT INTO search_events (occurred_at, entry, query_normalized, resolution, result_count, origin, corrected_query_normalized, corrected_result_count) VALUES (now(),'submit',$1,'unresolved',0,'test',$2,$3)",
        [original, corrected, count],
      );
      await expect(insert('typoevt чек2', null)).rejects.toThrow();
      await expect(insert(null, 2)).rejects.toThrow();
      await expect(insert('typoevt чек2', 0)).rejects.toThrow();
      await expect(insert('typoevt чек', 2)).rejects.toThrow();
      await expect(insert('', 2)).rejects.toThrow();
      await insert('typoevt чек3', 1, 'typoevt чек4');
    });
  });
});
