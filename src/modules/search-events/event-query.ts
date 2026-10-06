import { searchWords } from '../offers/title/offer-title';

// S15C / D0: the only form of the query a search event may keep. The filters reduce the risk of storing personal data but do
// NOT guarantee its absence — free text can still contain names or other details; the table is internal and time-limited.
export const EVENT_QUERY_MAX_LENGTH = 100;
// A run of this many digits looks like a phone number; spaces, dashes, dots, plus signs and brackets between digits are ignored.
const DIGIT_RUN = /\d{6,}/u;
const SEPARATORS_BETWEEN_DIGITS = /(?<=\d)[\s\-.()+]+(?=\d)/gu;

export function normalizeEventQuery(query: string): string {
  return searchWords(query).join(' ');
}

// null → no event for this query (the Search itself is not affected).
export function eventQueryOf(query: string): string | null {
  const normalized = normalizeEventQuery(query);
  if (normalized.length === 0 || normalized.length > EVENT_QUERY_MAX_LENGTH) return null;
  if (DIGIT_RUN.test(query.replace(SEPARATORS_BETWEEN_DIGITS, ''))) return null;
  return normalized;
}
