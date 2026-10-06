import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBoundedWrite, unfinishedSearchEventWrites } from '../../src/modules/search-events/application/record-search-event';
import { readSearchEventsConfig } from '../../src/modules/search-events/config';
import { eventQueryOf } from '../../src/modules/search-events/event-query';
import {
  HANDOFF_TTL_MS,
  IntentSuppression,
  SUPPRESSION_WINDOW_MS,
  consumeFirstEntryHandoff,
  intentKey,
  resetFirstEntryHandoff,
  setFirstEntryHandoff,
} from '../../src/app/(buyer)/_ui/search-intent';

// S15C / D0 (docs/slices/s15c-d0-search-demand-events): configuration, the query filter, the bounded write and the client-side
// intent mechanics (suppression, one-shot handoff).

describe('search events configuration', () => {
  it('defaults to dev, 90 days, a 250 ms wait budget and 3 unfinished writes', () => {
    expect(readSearchEventsConfig({})).toEqual({ origin: 'dev', retentionDays: 90, writeBudgetMs: 250, maxPendingWrites: 3 });
  });
  it('is organic only by an explicit setting; synthetic and unknown values are never configurable', () => {
    expect(readSearchEventsConfig({ SEARCH_EVENTS_ORIGIN: 'organic' }).origin).toBe('organic');
    expect(readSearchEventsConfig({ SEARCH_EVENTS_ORIGIN: 'test' }).origin).toBe('test');
    expect(readSearchEventsConfig({ SEARCH_EVENTS_ORIGIN: 'synthetic' }).origin).toBe('dev');
    expect(readSearchEventsConfig({ SEARCH_EVENTS_ORIGIN: 'production' }).origin).toBe('dev');
    expect(readSearchEventsConfig({ SEARCH_EVENTS_ORIGIN: '' }).origin).toBe('dev');
  });
  it('takes valid numbers and falls back on garbage', () => {
    expect(readSearchEventsConfig({ SEARCH_EVENTS_RETENTION_DAYS: '30', SEARCH_EVENTS_WRITE_BUDGET_MS: '100', SEARCH_EVENTS_MAX_PENDING_WRITES: '5' }))
      .toEqual({ origin: 'dev', retentionDays: 30, writeBudgetMs: 100, maxPendingWrites: 5 });
    expect(readSearchEventsConfig({ SEARCH_EVENTS_RETENTION_DAYS: '0', SEARCH_EVENTS_WRITE_BUDGET_MS: 'x', SEARCH_EVENTS_MAX_PENDING_WRITES: '-1' }))
      .toEqual({ origin: 'dev', retentionDays: 90, writeBudgetMs: 250, maxPendingWrites: 3 });
  });
});

describe('the query an event may keep', () => {
  it('is the normalized text only', () => {
    expect(eventQueryOf('  Баранина, на КОСТИ!  ')).toBe('баранина на кости');
    expect(eventQueryOf('Ёлка')).toBe('елка');
    expect(eventQueryOf('мёд 500 г')).toBe('мед 500 г');
  });
  it('refuses empty, over-long and phone-like queries (a heuristic — it does not guarantee that no personal data remains)', () => {
    expect(eventQueryOf('!!! ???')).toBeNull();
    expect(eventQueryOf('а'.repeat(101))).toBeNull();
    expect(eventQueryOf('а'.repeat(100))).not.toBeNull();
    expect(eventQueryOf('87015550971')).toBeNull();
    expect(eventQueryOf('8 701 555 09 71')).toBeNull();
    expect(eventQueryOf('+7 (701) 555-09-71')).toBeNull();
    expect(eventQueryOf('Айгерим 8-701-555-09-71')).toBeNull();
    expect(eventQueryOf('картофель 12345')).not.toBeNull();
  });
});

describe('the bounded, best-effort write', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  it('reports written and releases its slot', async () => {
    expect(await runBoundedWrite(async () => undefined, 100, 3)).toBe('written');
    expect(unfinishedSearchEventWrites()).toBe(0);
  });

  it('turns a failure into a quiet «failed» with one log line that carries no details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await runBoundedWrite(async () => { throw new Error('secret query text'); }, 100, 3)).toBe('failed');
    expect(await runBoundedWrite(() => { throw new Error('secret query text'); }, 100, 3)).toBe('failed');
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.every((call) => call.length === 1 && call[0] === 'Search event failed')).toBe(true);
    expect(unfinishedSearchEventWrites()).toBe(0);
  });

  it('stops waiting at the budget, keeps the slot until the write settles, and a late success or failure is harmless', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const slow = deferred();
      const startedAt = Date.now();
      expect(await runBoundedWrite(() => slow.promise, 40, 3)).toBe('pending');
      expect(Date.now() - startedAt).toBeLessThan(500);
      // the race did not cancel the write: its slot is still held
      expect(unfinishedSearchEventWrites()).toBe(1);
      slow.reject(new Error('late failure'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unfinishedSearchEventWrites()).toBe(0);
      expect(log).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();

      const late = deferred();
      expect(await runBoundedWrite(() => late.promise, 20, 3)).toBe('pending');
      late.resolve();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unfinishedSearchEventWrites()).toBe(0);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('skips a new event while the cap of unfinished writes is reached, and accepts one again after they settle', async () => {
    const first = deferred();
    const second = deferred();
    expect(await runBoundedWrite(() => first.promise, 10, 2)).toBe('pending');
    expect(await runBoundedWrite(() => second.promise, 10, 2)).toBe('pending');
    expect(unfinishedSearchEventWrites()).toBe(2);
    const started = vi.fn(async () => undefined);
    expect(await runBoundedWrite(started, 10, 2)).toBe('skipped');
    expect(started).not.toHaveBeenCalled();
    first.resolve();
    second.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(unfinishedSearchEventWrites()).toBe(0);
    expect(await runBoundedWrite(async () => undefined, 10, 2)).toBe('written');
  });
});

describe('the repeat-suppression key and window (tab memory)', () => {
  it('keys on the normalized query and the selected Product, not on the entry', () => {
    expect(intentKey('Баранина!')).toBe(intentKey('  баранина '));
    expect(intentKey('Баранина', 'p1')).not.toBe(intentKey('Баранина'));
    expect(intentKey('Баранина', 'p1')).not.toBe(intentKey('Баранина', 'p2'));
    expect(intentKey('Баранина')).not.toBe(intentKey('Говядина'));
  });

  it('suppresses a repeat for 60 s after the last recorded response; the window is not extended by suppressed repeats', () => {
    let now = 1_000_000;
    const suppression = new IntentSuppression(() => now);
    const key = intentKey('Баранина');
    expect(suppression.isSuppressed(key)).toBe(false);
    suppression.markRecorded(key);
    now += SUPPRESSION_WINDOW_MS - 1;
    expect(suppression.isSuppressed(key)).toBe(true);
    // checking (a suppressed repeat) does not extend the window
    now += 2;
    expect(suppression.isSuppressed(key)).toBe(false);
    expect(suppression.isSuppressed(intentKey('Говядина'))).toBe(false);
  });

  it('is bounded to a few keys', () => {
    let now = 0;
    const suppression = new IntentSuppression(() => now);
    for (let i = 0; i < 12; i++) { suppression.markRecorded(intentKey(`запрос ${i}`)); now += 1; }
    expect(suppression.isSuppressed(intentKey('запрос 0'))).toBe(false);
    expect(suppression.isSuppressed(intentKey('запрос 11'))).toBe(true);
  });
});

describe('the one-shot First Entry handoff', () => {
  afterEach(() => { resetFirstEntryHandoff(); });

  it('is consumed once', () => {
    setFirstEntryHandoff('Баранина', 1000);
    expect(consumeFirstEntryHandoff('Баранина', 2000)).toBe('submit');
    expect(consumeFirstEntryHandoff('Баранина', 2001)).toBeNull();
  });
  it('expires', () => {
    setFirstEntryHandoff('Баранина', 1000);
    expect(consumeFirstEntryHandoff('Баранина', 1000 + HANDOFF_TTL_MS + 1)).toBeNull();
    setFirstEntryHandoff('Баранина', 1000);
    expect(consumeFirstEntryHandoff('Баранина', 1000 + HANDOFF_TTL_MS)).toBe('submit');
  });
  it('needs the same normalized query, and a mismatch spends it too', () => {
    setFirstEntryHandoff('Баранина', 1000);
    expect(consumeFirstEntryHandoff('Говядина', 1500)).toBeNull();
    expect(consumeFirstEntryHandoff('Баранина', 1600)).toBeNull();
    setFirstEntryHandoff('Баранина, на кости', 1000);
    expect(consumeFirstEntryHandoff('баранина на кости', 1100)).toBe('submit');
  });
  it('is gone without a handoff (reload, Back, restoration have none)', () => {
    expect(consumeFirstEntryHandoff('Баранина', 1000)).toBeNull();
  });
});
