import { z } from 'zod';
import {
  NATURAL_SORT_DIRECTION,
  searchQuerySchema,
  searchSortDirectionSchema,
  searchSortModeSchema,
  type SearchSortDirection,
  type SearchSortMode,
} from './contracts/search.contract';

// Stage 6C + Rev 3 (slice contracts §3.3–§3.6): the last Search of the current browser tab, kept in the tab-scoped
// `sessionStorage` only so the bottom-navigation «Поиск» can reopen it. It holds the query and the current Search
// preferences — the sort criterion and its direction — never a result payload, never buyer coordinates, never anything
// on the server. A missing, foreign or damaged value simply means «no last search».
export const LAST_SEARCH_STORAGE_KEY = 'kaida:last-search';
const FORMAT_VERSION = 2;

export type LastSearchState = {
  query: string;
  sort: SearchSortMode;
  direction: SearchSortDirection;
};

const storedSchema = z.object({
  v: z.literal(FORMAT_VERSION),
  query: searchQuerySchema,
  sort: searchSortModeSchema,
  direction: searchSortDirectionSchema,
}).strict();

// Stage 5/6C values (`v: 1`: query, sort and a distance radius) degrade minimally: the query stays, the obsolete radius is
// discarded and the direction is the natural one of the stored sort. No migration framework.
const legacySchema = z.object({
  v: z.literal(1),
  query: searchQuerySchema,
  sort: z.enum(['actuality', 'distance']),
  radiusMeters: z.union([z.literal(1000), z.literal(3000), z.literal(5000), z.null()]),
}).strict();

export function parseLastSearchState(raw: string | null | undefined): LastSearchState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const current = storedSchema.safeParse(value);
    if (current.success) return { query: current.data.query, sort: current.data.sort, direction: current.data.direction };
    const legacy = legacySchema.safeParse(value);
    if (legacy.success) {
      return { query: legacy.data.query, sort: legacy.data.sort, direction: NATURAL_SORT_DIRECTION[legacy.data.sort] };
    }
    return null;
  } catch {
    return null;
  }
}

// Only a deliberate, valid query is a Search state: an empty or blank query never creates one.
export function serializeLastSearchState(state: LastSearchState): string | null {
  const query = searchQuerySchema.safeParse(state.query);
  if (!query.success) return null;
  return JSON.stringify({ v: FORMAT_VERSION, query: query.data, sort: state.sort, direction: state.direction });
}

// Without buyer coordinates a restored `distance` falls back to `actuality` with its natural direction (fresher first);
// `actuality` and `price` need no coordinates and keep their direction. The geolocation is never requested on restore.
export function normalizeGeoDependentState(state: LastSearchState, hasCoordinates: boolean): LastSearchState {
  if (hasCoordinates || state.sort !== 'distance') return state;
  return { query: state.query, sort: 'actuality', direction: NATURAL_SORT_DIRECTION.actuality };
}

// The raw stored value, for subscribers that only need to react to a change of it (the navigation link).
export function readLastSearchRaw(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_SEARCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readLastSearchState(): LastSearchState | null {
  return parseLastSearchState(readLastSearchRaw());
}

export function writeLastSearchState(state: LastSearchState): void {
  const serialized = serializeLastSearchState(state);
  if (serialized === null) return;
  try {
    window.sessionStorage.setItem(LAST_SEARCH_STORAGE_KEY, serialized);
  } catch {
    // No storage: «Поиск» opens the Search Home.
  }
}
