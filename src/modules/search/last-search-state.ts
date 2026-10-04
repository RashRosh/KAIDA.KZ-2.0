import { z } from 'zod';
import { searchQuerySchema } from './contracts/search.contract';
import type { SearchSortMode } from './config/search-ranking-policy.config';

// Stage 6C (slice contract §3.3–§3.5): the last Search of the current browser tab, kept in the tab-scoped
// `sessionStorage` only so the bottom-navigation «Поиск» can reopen it. It holds the query and the Search preferences of
// the currently released contract (stage 5: sort mode and distance radius) — never a result payload, never buyer
// coordinates, never anything on the server. A missing, foreign or damaged value simply means «no last search».
export const LAST_SEARCH_STORAGE_KEY = 'kaida:last-search';
const FORMAT_VERSION = 1;

export type LastSearchState = {
  query: string;
  sort: SearchSortMode;
  radiusMeters: 1000 | 3000 | 5000 | null;
};

const storedSchema = z.object({
  v: z.literal(FORMAT_VERSION),
  query: searchQuerySchema,
  sort: z.enum(['actuality', 'distance']),
  radiusMeters: z.union([z.literal(1000), z.literal(3000), z.literal(5000), z.null()]),
}).strict();

export function parseLastSearchState(raw: string | null | undefined): LastSearchState | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { query: parsed.data.query, sort: parsed.data.sort, radiusMeters: parsed.data.radiusMeters };
  } catch {
    return null;
  }
}

// Only a deliberate, valid query is a Search state: an empty or blank query never creates one.
export function serializeLastSearchState(state: LastSearchState): string | null {
  const query = searchQuerySchema.safeParse(state.query);
  if (!query.success) return null;
  return JSON.stringify({ v: FORMAT_VERSION, query: query.data, sort: state.sort, radiusMeters: state.radiusMeters });
}

// Without buyer coordinates every geo-dependent value falls back: `distance` → `actuality`, any finite radius → «Любое»
// (also when the stored sort is already `actuality`). Temporary compatibility with the released stage 5 state.
export function normalizeGeoDependentState(state: LastSearchState, hasCoordinates: boolean): LastSearchState {
  if (hasCoordinates) return state;
  return { query: state.query, sort: 'actuality', radiusMeters: null };
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
