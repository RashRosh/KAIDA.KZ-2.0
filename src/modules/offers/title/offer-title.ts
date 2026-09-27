// seller-showcase-editor: the Seller's own product name and the word rule that finds it in search.

export const OFFER_TITLE_MIN_LENGTH = 2;
export const OFFER_TITLE_MAX_LENGTH = 80;
export const SEARCH_WORD_MIN_LENGTH = 2;

// One line, trimmed, inner whitespace collapsed.
export function normalizeOfferTitle(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

// Lower case, ё → е, everything that is not a letter or digit separates words.
export function searchWords(value: string): string[] {
  return value.toLocaleLowerCase('ru').replace(/ё/gu, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

// Stored next to the title; search matches a query word against the start of each of these words.
export function offerTitleSearchText(title: string): string {
  return searchWords(title).join(' ');
}

// Query words used for word matching: 1-letter words are ignored.
export function queryWords(query: string): string[] {
  return [...new Set(searchWords(query).filter((word) => word.length >= SEARCH_WORD_MIN_LENGTH))];
}

// Every query word starts some word of the title.
export function titleMatchesQuery(titleSearchText: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const titleWords = titleSearchText.split(' ');
  return words.every((word) => titleWords.some((titleWord) => titleWord.startsWith(word)));
}
