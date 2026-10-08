import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTypoCorrectionConfig } from '../../src/modules/search/typo/typo-config';
import { runCorrectionPass, unfinishedCorrectionPasses } from '../../src/modules/search/typo/typo-limiter';
import { buildVocabulary } from '../../src/modules/search/typo/typo-rules';
import { createVocabularyCache, rawWordsOf } from '../../src/modules/search/typo/typo-vocabulary';
import { parseLastSearchState, serializeLastSearchState } from '../../src/modules/search/last-search-state';

// search-typo-suggestions (contract rev 3 §3.7, §3.8, §3.11): the lifecycle of a correction pass, the dictionary cache, the
// configuration and the «search as typed» state of the last Search.

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

afterEach(() => { vi.useRealTimers(); });

describe('correction pass: budget, slots and late completion', () => {
  it('returns the value of work that finishes inside the budget and frees the slot', async () => {
    const outcome = await runCorrectionPass(async () => 7, 400, 3);
    expect(outcome).toEqual({ status: 'done', value: 7 });
    expect(unfinishedCorrectionPasses()).toBe(0);
  });

  it('times out after the budget but keeps the slot until the work has really ended, and discards the late value', async () => {
    const work = deferred<string>();
    const outcome = await runCorrectionPass(() => work.promise, 20, 3);
    expect(outcome).toEqual({ status: 'timeout' });
    // the response is gone, the work is not: the slot is still held
    expect(unfinishedCorrectionPasses()).toBe(1);
    work.resolve('late');
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(unfinishedCorrectionPasses()).toBe(0);
  });

  it('skips at once, with no waiting and no queue, when every slot is held; slots come back when the work ends', async () => {
    const stuck = [deferred<null>(), deferred<null>(), deferred<null>()];
    const first = stuck.map((item) => runCorrectionPass(() => item.promise, 10, 3));
    expect(await Promise.all(first)).toEqual([{ status: 'timeout' }, { status: 'timeout' }, { status: 'timeout' }]);
    expect(unfinishedCorrectionPasses()).toBe(3);
    const started = Date.now();
    const fourth = await runCorrectionPass(async () => 1, 400, 3);
    expect(fourth).toEqual({ status: 'skipped' });
    expect(Date.now() - started).toBeLessThan(50);
    stuck.forEach((item) => item.resolve(null));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(unfinishedCorrectionPasses()).toBe(0);
    expect(await runCorrectionPass(async () => 2, 400, 3)).toEqual({ status: 'done', value: 2 });
  });

  it('catches a failure, also a late one (no unhandled rejection), and frees the slot', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const late = deferred<string>();
    const outcome = await runCorrectionPass(() => late.promise, 10, 3);
    expect(outcome).toEqual({ status: 'timeout' });
    late.reject(new Error('late database failure'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(unfinishedCorrectionPasses()).toBe(0);
    expect(await runCorrectionPass(async () => { throw new Error('boom'); }, 400, 3)).toEqual({ status: 'failed' });
    expect(await runCorrectionPass(() => { throw new Error('sync boom'); }, 400, 3)).toEqual({ status: 'failed' });
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(unfinishedCorrectionPasses()).toBe(0);
  });
});

describe('vocabulary cache: one load at a time, refresh by time, retry after a failure', () => {
  const vocabulary = (words: string[]) => buildVocabulary(words, 100);

  it('shares one load between concurrent callers', async () => {
    const load = deferred<ReturnType<typeof vocabulary>>();
    const loader = vi.fn(() => load.promise);
    const cache = createVocabularyCache(loader);
    const calls = [cache.get(), cache.get(), cache.get()];
    expect(loader).toHaveBeenCalledTimes(1);
    load.resolve(vocabulary(['молоко']));
    const results = await Promise.all(calls);
    expect(results.every((item) => item?.known.has('молоко'))).toBe(true);
    expect(cache.loadCount()).toBe(1);
  });

  it('serves the old dictionary while one refresh runs after the ttl', async () => {
    let now = 0;
    const first = vocabulary(['молоко']);
    const second = deferred<ReturnType<typeof vocabulary>>();
    const loader = vi.fn()
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(() => second.promise);
    const cache = createVocabularyCache(loader, { ttlMs: 1000, clock: () => now });
    expect(await cache.get()).toBe(first);
    now = 1500;
    expect(await cache.get()).toBe(first); // stale, served at once
    expect(await cache.get()).toBe(first); // still one refresh only
    expect(loader).toHaveBeenCalledTimes(2);
    second.resolve(vocabulary(['творог']));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await cache.get())?.known.has('творог')).toBe(true);
  });

  it('does not retry a failed load before the retry interval and returns nothing meanwhile', async () => {
    let now = 0;
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loader = vi.fn().mockRejectedValueOnce(new Error('db')).mockResolvedValue(vocabulary(['молоко']));
    const cache = createVocabularyCache(loader, { retryAfterFailureMs: 30_000, clock: () => now });
    expect(await cache.get()).toBeNull();
    now = 10_000;
    expect(await cache.get()).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
    now = 31_000;
    expect((await cache.get())?.known.has('молоко')).toBe(true);
    expect(loader).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('splits text into lower-case words and keeps «ё» only as the display spelling', () => {
    expect(rawWordsOf('Ёлка, МЁД 3,2%')).toEqual(['ёлка', 'мёд', '3', '2']);
    const built = buildVocabulary(['ёлка', 'мёд'], 10);
    expect(built.known.has('елка')).toBe(true);
    expect(built.display.get('елка')).toBe('ёлка');
  });
});

describe('configuration: the kill switch and the bounds', () => {
  it('is on by default and off only with SEARCH_AUTO_CORRECTION=off', () => {
    expect(readTypoCorrectionConfig({}).enabled).toBe(true);
    expect(readTypoCorrectionConfig({ SEARCH_AUTO_CORRECTION: 'on' }).enabled).toBe(true);
    expect(readTypoCorrectionConfig({ SEARCH_AUTO_CORRECTION: 'off' }).enabled).toBe(false);
    expect(readTypoCorrectionConfig({ SEARCH_AUTO_CORRECTION: ' OFF ' }).enabled).toBe(false);
  });
  it('has a 400 ms budget and 3 slots by default and ignores out-of-range values', () => {
    expect(readTypoCorrectionConfig({})).toMatchObject({ budgetMs: 400, maxPasses: 3 });
    expect(readTypoCorrectionConfig({ SEARCH_CORRECTION_BUDGET_MS: '99999', SEARCH_CORRECTION_MAX_PASSES: '0' })).toMatchObject({ budgetMs: 400, maxPasses: 3 });
    expect(readTypoCorrectionConfig({ SEARCH_CORRECTION_BUDGET_MS: '150', SEARCH_CORRECTION_MAX_PASSES: '2' })).toMatchObject({ budgetMs: 150, maxPasses: 2 });
  });
});

describe('last search state v4: «search as typed»', () => {
  const base = { query: 'малако', sort: 'relevance' as const, direction: 'desc' as const };
  it('is written as v4 only while the mode is on; every other Search stays v2/v3', () => {
    expect(JSON.parse(serializeLastSearchState({ ...base, typed: true })!)).toMatchObject({ v: 4, query: 'малако', typed: true });
    expect(JSON.parse(serializeLastSearchState(base)!).v).toBe(2);
    expect(JSON.parse(serializeLastSearchState({ ...base, productId: '11111111-1111-4111-8111-111111111111' })!).v).toBe(3);
  });
  it('round-trips the flag and keeps the sort', () => {
    const raw = serializeLastSearchState({ query: 'малако', sort: 'price', direction: 'asc', typed: true })!;
    expect(parseLastSearchState(raw)).toEqual({ query: 'малако', sort: 'price', direction: 'asc', typed: true });
  });
  it('reads v1/v2/v3 values as before, without the flag', () => {
    expect(parseLastSearchState(JSON.stringify({ v: 2, query: 'молоко', sort: 'relevance' }))).toEqual({ query: 'молоко', sort: 'relevance', direction: 'desc' });
    expect(parseLastSearchState(JSON.stringify({ v: 4, query: 'молоко', sort: 'relevance', typed: false }))).toBeNull();
  });
});
