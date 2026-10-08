import { randomBytes, randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedIds } from '../../src/db/seed';
import * as schema from '../../src/db/schema';
import type { Database } from '../../src/db/client';
import { purgeSearchEvents } from '../../src/modules/search-events/application/purge-search-events';
import { recordSearchEvent, unfinishedSearchEventWrites } from '../../src/modules/search-events/application/record-search-event';
import { readSearchEventsConfig } from '../../src/modules/search-events/config';
import { searchOffersDetailed } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase, testDatabaseUrl } from './database';

// S15C / D0 (docs/slices/s15c-d0-search-demand-events): recording on real data — fields, outcomes, failure behavior and retention.

const config = { ...readSearchEventsConfig({}), origin: 'test' as const, writeBudgetMs: 250 };
const HOUR = 3_600_000;

describe('Search events (S15C / D0)', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  // Letters only: a run of six or more digits in the query text trips D0's phone-number filter and no event is recorded (Issue #125).
  const marker = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const products: string[] = [];
  const query = (suffix: string) => `evt${marker} ${suffix}`;
  const events = async (text: string) => (await connection.pool.query(
    'SELECT * FROM search_events WHERE query_normalized = $1 ORDER BY occurred_at', [text],
  )).rows;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const settled = async () => { for (let i = 0; i < 100 && unfinishedSearchEventWrites() > 0; i++) await wait(20); };

  beforeAll(async () => { connection = await connectTestDatabase(); });
  afterEach(async () => { vi.restoreAllMocks(); await settled(); });
  afterAll(async () => {
    await connection?.pool.query("DELETE FROM search_events WHERE query_normalized LIKE $1 OR origin = 'synthetic'", [`evt${marker}%`]);
    for (const id of products) {
      await connection?.pool.query('DELETE FROM product_aliases WHERE product_id = $1', [id]);
      await connection?.pool.query('DELETE FROM products WHERE id = $1', [id]);
    }
    await connection?.pool.end();
  });

  describe('the recorded fields', () => {
    it('keeps only the minimal fields: hour-truncated time, entry, normalized text, Product, resolution, count, origin', async () => {
      const text = query('fields');
      const now = new Date('2026-10-07T10:47:31.123Z');
      expect(await recordSearchEvent({ entry: 'submit', query: `  ${text.toUpperCase()}!  `, resolvedProductId: seedIds.lambProduct, resolution: 'resolved', resultCount: 7 }, { database: connection.db, config, now: () => now })).toBe('written');
      const [row] = await events(text);
      expect(row).toMatchObject({ entry: 'submit', query_normalized: text, resolved_product_id: seedIds.lambProduct, resolution: 'resolved', result_count: 7, origin: 'test' });
      expect(new Date(row.occurred_at).toISOString()).toBe('2026-10-07T10:00:00.000Z');
      // no identifier, no location, no raw spelling: the table has exactly these columns
      const columns = await connection.pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'search_events' ORDER BY column_name");
      expect(columns.rows.map((column) => column.column_name)).toEqual(['corrected_query_normalized', 'corrected_result_count', 'entry', 'id', 'occurred_at', 'origin', 'query_normalized', 'resolution', 'resolved_product_id', 'result_count']);
    });

    it('ignores queries the filter refuses and writes nothing', async () => {
      expect(await recordSearchEvent({ entry: 'submit', query: '+7 (701) 555-09-71', resolvedProductId: null, resolution: 'unresolved', resultCount: 0 }, { database: connection.db, config })).toBe('ignored');
      expect(await recordSearchEvent({ entry: 'submit', query: 'x'.repeat(101), resolvedProductId: null, resolution: 'unresolved', resultCount: 0 }, { database: connection.db, config })).toBe('ignored');
      expect((await connection.pool.query("SELECT count(*)::int AS n FROM search_events WHERE query_normalized LIKE '%701%555%' OR length(query_normalized) > 100")).rows[0].n).toBe(0);
    });

    it('lets the database refuse an unknown origin, entry or resolution (the organic / non-organic separation is a constraint)', async () => {
      const insert = (origin: string, entry = 'submit', resolution = 'resolved') => connection.pool.query(
        'INSERT INTO search_events (occurred_at, entry, query_normalized, resolution, result_count, origin) VALUES (now(), $1, $2, $3, 1, $4)',
        [entry, query('constraint'), resolution, origin],
      );
      await expect(insert('production')).rejects.toThrow();
      await expect(insert('organic', 'keystroke')).rejects.toThrow();
      await expect(insert('organic', 'submit', 'fuzzy')).rejects.toThrow();
    });
  });

  describe('the outcome of a Search', () => {
    const outcome = (text: string, productId?: string) => searchOffersDetailed(text, connection.db, { productId });

    it('a selected Product wins: `selected`, the Product of the response, the returned count', async () => {
      const result = await outcome('Баранина', seedIds.lambProduct);
      expect(result.resolution).toBe('selected');
      expect(result.response.resolvedProduct?.id).toBe(seedIds.lambProduct);
      expect(result.response.offers.length).toBeGreaterThan(0);
    });

    it('an exact name is `resolved`; unknown text is `unresolved`; a stale selected id is ignored', async () => {
      expect((await outcome('Баранина')).resolution).toBe('resolved');
      const unknown = await outcome(query('unknown'));
      expect(unknown.resolution).toBe('unresolved');
      expect(unknown.response.resolvedProduct).toBeNull();
      const stale = await outcome('Баранина', randomUUID());
      expect(stale.resolution).toBe('resolved');
      expect(stale.response.resolvedProduct?.id).toBe(seedIds.lambProduct);
      const staleUnknown = await outcome(query('stale'), randomUUID());
      expect(staleUnknown.resolution).toBe('unresolved');
    });

    it('a name that resolves to two Products is `ambiguous` and has no Product', async () => {
      const alias = query('twin');
      const first = randomUUID();
      const second = randomUUID();
      products.push(first, second);
      await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [first, `Evt A ${marker}`, second, `Evt B ${marker}`]);
      await connection.pool.query('INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$5),($3,$4,$5)', [randomUUID(), first, randomUUID(), second, alias]);
      const result = await outcome(alias);
      expect(result.resolution).toBe('ambiguous');
      expect(result.response.resolvedProduct).toBeNull();
    });

    it('known-zero (a Product, no Offers) and unresolved-zero are told apart by the recorded fields', async () => {
      const product = randomUUID();
      products.push(product);
      const name = query('empty product');
      await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [product, name]);
      const known = await outcome(name, product);
      const unknown = await outcome(query('nothing'));
      for (const [label, result] of [['known', known], ['unknown', unknown]] as const) {
        await recordSearchEvent({
          entry: 'suggestion',
          query: `${label} ${name}`,
          resolvedProductId: result.response.resolvedProduct?.id ?? null,
          resolution: result.resolution,
          resultCount: result.response.offers.length,
        }, { database: connection.db, config });
      }
      const [knownRow] = await events(`known ${name}`);
      const [unknownRow] = await events(`unknown ${name}`);
      expect(knownRow).toMatchObject({ resolved_product_id: product, resolution: 'selected', result_count: 0 });
      expect(unknownRow).toMatchObject({ resolved_product_id: null, resolution: 'unresolved', result_count: 0 });
    });

    it('a selected Product that the text contradicts still reports the Product of the response (no «conflict» state)', async () => {
      const result = await outcome('Говядина', seedIds.lambProduct);
      expect(result.resolution).toBe('selected');
      expect(result.response.resolvedProduct?.id).toBe(seedIds.lambProduct);
    });
  });

  describe('a failing, hanging or blocked write never changes the Search', () => {
    const input = (suffix: string) => ({ entry: 'submit' as const, query: query(suffix), resolvedProductId: null, resolution: 'unresolved' as const, resultCount: 0 });

    it('a failing write is a quiet «failed»: nothing thrown, one log line without the query', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const broken = { transaction: async () => { throw new Error('boom'); } } as unknown as Database;
      expect(await recordSearchEvent(input('failing'), { database: broken, config })).toBe('failed');
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]).toEqual(['Search event failed']);
    });

    it('a missing database is the same quiet failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const saved = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      try {
        expect(await recordSearchEvent(input('nodb'), { config })).toBe('failed');
      } finally {
        process.env.DATABASE_URL = saved;
      }
    });

    it('a hanging write is left after the wait budget; the slot is held until it settles', async () => {
      let release!: () => void;
      const hang = new Promise<void>((resolve) => { release = resolve; });
      const hanging = { transaction: () => hang } as unknown as Database;
      const startedAt = Date.now();
      expect(await recordSearchEvent(input('hanging'), { database: hanging, config: { ...config, writeBudgetMs: 60 } })).toBe('pending');
      expect(Date.now() - startedAt).toBeLessThan(600);
      expect(unfinishedSearchEventWrites()).toBe(1);
      release();
      await settled();
      expect(unfinishedSearchEventWrites()).toBe(0);
    });

    it('an exhausted pool does not hold the Search: the wait budget returns, and the late write lands once a connection is free', async () => {
      const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
      const database = drizzle({ client: pool, schema }) as unknown as Database;
      const text = query('exhausted');
      const held = await pool.connect();
      try {
        const startedAt = Date.now();
        expect(await recordSearchEvent({ ...input('exhausted'), query: text }, { database, config: { ...config, writeBudgetMs: 80 } })).toBe('pending');
        expect(Date.now() - startedAt).toBeLessThan(800);
        expect(unfinishedSearchEventWrites()).toBe(1);
      } finally {
        held.release();
      }
      await settled();
      expect(unfinishedSearchEventWrites()).toBe(0);
      expect(await events(text)).toHaveLength(1);
      await pool.end();
    });

    it('a blocked table ends in a statement/lock timeout: the wait budget returns, no event, no hanging transaction, one log line', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const text = query('locked');
      const blocker = await connection.pool.connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query('LOCK TABLE search_events IN ACCESS EXCLUSIVE MODE');
        const startedAt = Date.now();
        expect(await recordSearchEvent({ ...input('locked'), query: text }, { database: connection.db, config: { ...config, writeBudgetMs: 100 } })).toBe('pending');
        expect(Date.now() - startedAt).toBeLessThan(800);
        await settled();
        expect(unfinishedSearchEventWrites()).toBe(0);
        expect(log).toHaveBeenCalledWith('Search event failed');
        expect(log.mock.calls.every((call) => call.length === 1)).toBe(true);
      } finally {
        await blocker.query('ROLLBACK');
        blocker.release();
      }
      expect(await events(text)).toHaveLength(0);
      // the pool is clean: nothing is left idle in a transaction
      const leaked = await connection.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle in transaction'");
      expect(leaked.rows[0].n).toBe(0);
    });

    it('past the cap of unfinished writes an event is skipped, not queued', async () => {
      let release!: () => void;
      const hang = new Promise<void>((resolve) => { release = resolve; });
      const hanging = { transaction: () => hang } as unknown as Database;
      const capped = { ...config, writeBudgetMs: 30, maxPendingWrites: 1 };
      expect(await recordSearchEvent(input('cap one'), { database: hanging, config: capped })).toBe('pending');
      expect(await recordSearchEvent(input('cap two'), { database: connection.db, config: capped })).toBe('skipped');
      release();
      await settled();
      expect(await events(query('cap two'))).toHaveLength(0);
    });
  });

  describe('retention', () => {
    const synthetic = async (daysAgo: number, text: string) => connection.pool.query(
      "INSERT INTO search_events (occurred_at, entry, query_normalized, resolution, result_count, origin) VALUES (now() - ($1 || ' days')::interval, 'submit', $2, 'unresolved', 0, 'synthetic')",
      [String(daysAgo), text],
    );

    it('the purge removes events older than the period, reports the count and the oldest age, and a dry run changes nothing', async () => {
      await connection.pool.query("DELETE FROM search_events WHERE origin = 'synthetic'");
      await synthetic(120, query('old one'));
      await synthetic(95, query('old two'));
      await synthetic(10, query('recent'));
      const dry = await purgeSearchEvents(connection.db, { retentionDays: 90, dryRun: true });
      expect(dry.deleted).toBeGreaterThanOrEqual(2);
      expect((await connection.pool.query("SELECT count(*)::int AS n FROM search_events WHERE origin = 'synthetic'")).rows[0].n).toBe(3);

      const real = await purgeSearchEvents(connection.db, { retentionDays: 90 });
      expect(real.deleted).toBeGreaterThanOrEqual(2);
      expect((await connection.pool.query("SELECT count(*)::int AS n FROM search_events WHERE origin = 'synthetic'")).rows[0].n).toBe(1);
      expect(real.oldestRemainingDays).not.toBeNull();
      // idempotent
      expect((await purgeSearchEvents(connection.db, { retentionDays: 90 })).deleted).toBe(0);
    });

    it('a purge with a smaller period removes more; the synthetic origin is only ever written by the tests', async () => {
      await synthetic(40, query('forty'));
      const result = await purgeSearchEvents(connection.db, { retentionDays: 30 });
      expect(result.deleted).toBeGreaterThanOrEqual(1);
      expect(await events(query('forty'))).toHaveLength(0);
      // the application writer never produces `synthetic`
      expect(readSearchEventsConfig({ SEARCH_EVENTS_ORIGIN: 'synthetic' }).origin).toBe('dev');
    });
  });

  it('writes the hour of the clock it is given (UTC hour start)', async () => {
    const text = query('hour');
    const now = new Date(Date.UTC(2026, 9, 7, 23, 59, 59));
    await recordSearchEvent({ entry: 'chip', query: text, resolvedProductId: null, resolution: 'unresolved', resultCount: 0 }, { database: connection.db, config, now: () => now });
    const [row] = await events(text);
    expect(new Date(row.occurred_at).getTime()).toBe(Math.floor(now.getTime() / HOUR) * HOUR);
    expect(row.entry).toBe('chip');
  });
});
