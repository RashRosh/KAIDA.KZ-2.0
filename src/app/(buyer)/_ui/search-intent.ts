import { searchWords } from '../../../modules/offers/title/offer-title';
import type { SearchIntent } from '../../../modules/search/contracts/search.contract';

// S15C / D0 (docs/slices/s15c-d0-search-demand-events §3.3–§3.4): the client side of recording intentional searches. Everything here
// lives in the memory of the page — nothing goes to the URL, `sessionStorage`, last-state, cookies or the server.

export const SUPPRESSION_WINDOW_MS = 60_000;
export const HANDOFF_TTL_MS = 15_000;
const MAX_SUPPRESSION_KEYS = 10;

// The suppression key: the normalized query (the same form the event keeps) + the selected Product, if any. The entry is not part of it.
export function intentKey(query: string, productId?: string): string {
  return `${searchWords(query).join(' ')}\0${productId ?? ''}`;
}

// A heuristic against accidental repeats (a double tap, Enter twice): not protection from a client that forges an intent.
export class IntentSuppression {
  private readonly recorded = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  // True while the window since the last SUCCESSFUL intent-carrying response for this key is still open.
  isSuppressed(key: string): boolean {
    const at = this.recorded.get(key);
    if (at === undefined) return false;
    if (this.now() - at < SUPPRESSION_WINDOW_MS) return true;
    this.recorded.delete(key);
    return false;
  }

  // Called after a successful response to a request that carried an intent; suppressed repeats never extend the window.
  markRecorded(key: string): void {
    this.recorded.delete(key);
    this.recorded.set(key, this.now());
    while (this.recorded.size > MAX_SUPPRESSION_KEYS) {
      const oldest = this.recorded.keys().next().value;
      if (oldest === undefined) break;
      this.recorded.delete(oldest);
    }
  }
}

// First Entry navigates with `router.push('/?q=…')`, which Search reads as a restoration of the address. The one-shot handoff tells
// Search that this particular arrival IS the deliberate search: it is consumed once, expires, must match the query, and is gone
// after a reload (module state) — so reload, Back and restoration never replay it.
type Handoff = { key: string; at: number };
let handoff: Handoff | null = null;

export function setFirstEntryHandoff(query: string, now: number = Date.now()): void {
  handoff = { key: intentKey(query), at: now };
}

export function consumeFirstEntryHandoff(addressQuery: string, now: number = Date.now()): SearchIntent | null {
  const current = handoff;
  handoff = null;
  if (current === null) return null;
  if (now - current.at > HANDOFF_TTL_MS) return null;
  return current.key === intentKey(addressQuery) ? 'submit' : null;
}

export function resetFirstEntryHandoff(): void {
  handoff = null;
}
