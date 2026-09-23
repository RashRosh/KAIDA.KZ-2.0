import { apiLocale, type Locale } from './config';

export function localeFromApiRequest(request: Request): Locale {
  return apiLocale(new URL(request.url).searchParams.get('locale'));
}

export function hasUnsupportedQuery(searchParams: URLSearchParams, allowed: readonly string[]): boolean {
  const allowedSet = new Set([...allowed, 'locale']);
  return [...searchParams.keys()].some((key) => !allowedSet.has(key));
}
