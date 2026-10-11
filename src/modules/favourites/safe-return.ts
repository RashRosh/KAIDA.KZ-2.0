// A closed allowlist, never an arbitrary URL/history redirect. Preview return remains owned by its existing helper.
export function favouritesReturn(value: string | null): string | null {
  return value === '/favourites' ? '/favourites' : null;
}
