export function normalizeAddressSearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[.,%_/\\()\[\]{}:;"'`«»–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function addressSearchText(values: Array<string | undefined | null>): string {
  return [...new Set(values.map((value) => value ? normalizeAddressSearch(value) : '').filter(Boolean))].join(' ');
}
