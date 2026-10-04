import { describe, expect, it } from 'vitest';
import {
  normalizeGeoDependentState,
  parseLastSearchState,
  serializeLastSearchState,
  type LastSearchState,
} from '../../src/modules/search/last-search-state';

// Stage 6C: the tab-scoped last Search state — only the query and the released stage 5 preferences, defensively parsed.
const base: LastSearchState = { query: 'баранина', sort: 'actuality', radiusMeters: null };

describe('last Search state', () => {
  it('round-trips the query and the released preferences with a format version', () => {
    const raw = serializeLastSearchState({ query: 'баранина', sort: 'distance', radiusMeters: 3000 });
    expect(JSON.parse(raw ?? '')).toEqual({ v: 1, query: 'баранина', sort: 'distance', radiusMeters: 3000 });
    expect(parseLastSearchState(raw)).toEqual({ query: 'баранина', sort: 'distance', radiusMeters: 3000 });
  });

  it('never stores results, coordinates or anything beyond the reconstruction data', () => {
    const raw = serializeLastSearchState(base) ?? '';
    for (const forbidden of ['offers', 'latitude', 'longitude', 'buyerLocation', 'result']) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it('does not create a state from an empty or blank query', () => {
    expect(serializeLastSearchState({ ...base, query: '' })).toBeNull();
    expect(serializeLastSearchState({ ...base, query: '   ' })).toBeNull();
  });

  it('treats a missing, foreign, damaged or wrongly shaped value as no last search', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '{}', '{"v":2,"query":"a","sort":"actuality","radiusMeters":null}']) {
      expect(parseLastSearchState(raw)).toBeNull();
    }
    expect(parseLastSearchState('{"v":1,"query":"","sort":"actuality","radiusMeters":null}')).toBeNull();
    expect(parseLastSearchState('{"v":1,"query":"a","sort":"cheaper","radiusMeters":null}')).toBeNull();
    expect(parseLastSearchState('{"v":1,"query":"a","sort":"actuality","radiusMeters":2000}')).toBeNull();
    expect(parseLastSearchState('{"v":1,"query":"a","sort":"actuality","radiusMeters":null,"offers":[]}')).toBeNull();
  });

  it('normalizes every geo-dependent value when there are no coordinates', () => {
    expect(normalizeGeoDependentState({ ...base, sort: 'distance' }, false)).toEqual(base);
    expect(normalizeGeoDependentState({ ...base, radiusMeters: 5000 }, false)).toEqual(base);
    expect(normalizeGeoDependentState({ ...base, sort: 'distance', radiusMeters: 1000 }, false)).toEqual(base);
  });

  it('keeps the stored values when coordinates are present', () => {
    const geo: LastSearchState = { query: 'мёд', sort: 'distance', radiusMeters: 3000 };
    expect(normalizeGeoDependentState(geo, true)).toEqual(geo);
  });
});
