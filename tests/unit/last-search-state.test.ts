import { describe, expect, it } from 'vitest';
import {
  normalizeGeoDependentState,
  parseLastSearchState,
  serializeLastSearchState,
  type LastSearchState,
} from '../../src/modules/search/last-search-state';

// Stage 6C + Rev 3: the tab-scoped last Search state — the query, the sort criterion and its direction, defensively parsed.
const base: LastSearchState = { query: 'баранина', sort: 'actuality', direction: 'desc' };

describe('last Search state', () => {
  it('round-trips the query, the sort and the direction with a format version', () => {
    const raw = serializeLastSearchState({ query: 'баранина', sort: 'price', direction: 'desc' });
    expect(JSON.parse(raw ?? '')).toEqual({ v: 2, query: 'баранина', sort: 'price', direction: 'desc' });
    expect(parseLastSearchState(raw)).toEqual({ query: 'баранина', sort: 'price', direction: 'desc' });
  });

  it('never stores results, coordinates or a radius', () => {
    const raw = serializeLastSearchState({ ...base, sort: 'distance', direction: 'asc' }) ?? '';
    for (const forbidden of ['offers', 'latitude', 'longitude', 'buyerLocation', 'result', 'radius']) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it('does not create a state from an empty or blank query', () => {
    expect(serializeLastSearchState({ ...base, query: '' })).toBeNull();
    expect(serializeLastSearchState({ ...base, query: '   ' })).toBeNull();
  });

  it('treats a missing, foreign, damaged or wrongly shaped value as no last search', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '{}', '{"v":3,"query":"a","sort":"actuality","direction":"desc"}']) {
      expect(parseLastSearchState(raw)).toBeNull();
    }
    expect(parseLastSearchState('{"v":2,"query":"","sort":"actuality","direction":"desc"}')).toBeNull();
    expect(parseLastSearchState('{"v":2,"query":"a","sort":"cheaper","direction":"asc"}')).toBeNull();
    expect(parseLastSearchState('{"v":2,"query":"a","sort":"price","direction":"up"}')).toBeNull();
    expect(parseLastSearchState('{"v":2,"query":"a","sort":"price","direction":"asc","offers":[]}')).toBeNull();
  });

  it('degrades the Stage 5 / 6C value minimally: the query stays, the radius goes, the direction is the natural one', () => {
    expect(parseLastSearchState('{"v":1,"query":"баранина","sort":"actuality","radiusMeters":null}'))
      .toEqual({ query: 'баранина', sort: 'actuality', direction: 'desc' });
    expect(parseLastSearchState('{"v":1,"query":"баранина","sort":"actuality","radiusMeters":3000}'))
      .toEqual({ query: 'баранина', sort: 'actuality', direction: 'desc' });
    expect(parseLastSearchState('{"v":1,"query":"баранина","sort":"distance","radiusMeters":1000}'))
      .toEqual({ query: 'баранина', sort: 'distance', direction: 'asc' });
    expect(parseLastSearchState('{"v":1,"query":"","sort":"actuality","radiusMeters":null}')).toBeNull();
  });

  it('without coordinates a restored distance becomes the default relevance (S15B-4b)', () => {
    const relevance: LastSearchState = { ...base, sort: 'relevance', direction: 'desc' };
    expect(normalizeGeoDependentState({ ...base, sort: 'distance', direction: 'asc' }, false)).toEqual(relevance);
    expect(normalizeGeoDependentState({ ...base, sort: 'distance', direction: 'desc' }, false)).toEqual(relevance);
  });

  it('stores relevance without a direction and keeps an explicit actuality as actuality (S15B-4b)', () => {
    const raw = serializeLastSearchState({ query: 'баранина', sort: 'relevance', direction: 'desc' });
    expect(JSON.parse(raw ?? '')).toEqual({ v: 2, query: 'баранина', sort: 'relevance' });
    expect(parseLastSearchState(raw)).toEqual({ query: 'баранина', sort: 'relevance', direction: 'desc' });
    expect(parseLastSearchState(JSON.stringify({ v: 2, query: 'баранина', sort: 'actuality', direction: 'desc' }))).toEqual(base);
    // a relevance value with a direction, or a directional sort without one, is damaged
    expect(parseLastSearchState(JSON.stringify({ v: 2, query: 'x', sort: 'relevance', direction: 'asc' }))).toBeNull();
    expect(parseLastSearchState(JSON.stringify({ v: 2, query: 'x', sort: 'price' }))).toBeNull();
    const product = '10000000-0000-4000-8000-000000000001';
    expect(JSON.parse(serializeLastSearchState({ query: 'x', sort: 'relevance', direction: 'desc', productId: product }) ?? '')).toEqual({ v: 3, query: 'x', sort: 'relevance', productId: product });
  });

  it('actuality and price need no coordinates and keep their direction', () => {
    const older: LastSearchState = { ...base, direction: 'asc' };
    const dearer: LastSearchState = { query: 'мёд', sort: 'price', direction: 'desc' };
    expect(normalizeGeoDependentState(older, false)).toEqual(older);
    expect(normalizeGeoDependentState(dearer, false)).toEqual(dearer);
  });

  it('keeps a distance state when coordinates are present', () => {
    const geo: LastSearchState = { query: 'мёд', sort: 'distance', direction: 'desc' };
    expect(normalizeGeoDependentState(geo, true)).toEqual(geo);
  });
});

describe('S15B-3 selected Product in the last Search state', () => {
  const productId = '10000000-0000-4000-8000-000000000001';
  it('writes v:3 with the Product id, reads it back, and still writes v:2 without one', () => {
    const withProduct = serializeLastSearchState({ query: 'Баранина', sort: 'price', direction: 'asc', productId });
    expect(JSON.parse(withProduct!)).toEqual({ v: 3, query: 'Баранина', sort: 'price', direction: 'asc', productId });
    expect(parseLastSearchState(withProduct)).toEqual({ query: 'Баранина', sort: 'price', direction: 'asc', productId });
    expect(JSON.parse(serializeLastSearchState({ query: 'Баранина', sort: 'price', direction: 'asc' })!).v).toBe(2);
  });
  it('ignores a damaged Product id and keeps the Product through the geo normalization', () => {
    expect(parseLastSearchState(JSON.stringify({ v: 3, query: 'x', sort: 'price', direction: 'asc', productId: 'nope' }))).toBeNull();
    expect(normalizeGeoDependentState({ query: 'Баранина', sort: 'distance', direction: 'asc', productId }, false))
      .toEqual({ query: 'Баранина', sort: 'relevance', direction: 'desc', productId });
  });
});
