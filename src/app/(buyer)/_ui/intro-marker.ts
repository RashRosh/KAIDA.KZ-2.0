// First Entry correction (stage 6B): the persistent marker «First Entry has been shown» — a first-party cookie of this
// browser/device, separate from the demo flag (`kaida_fe_demo_seen`, localStorage) and from the locale cookie. It
// carries no personal data and is not a credential. Cookies being disabled is outside the guarantee, as for the locale.
export const INTRO_SEEN_COOKIE = 'kaida_intro_seen';
const INTRO_SEEN_MAX_AGE_SECONDS = 31_536_000;

// Only the generic entry — `/` without a query and without the marker — shows First Entry. A deep link (`/?q=…`, any
// other route) keeps the visitor's intent and never goes through onboarding.
export function shouldShowFirstEntry({ hasQuery, introSeen }: { hasQuery: boolean; introSeen: boolean }): boolean {
  return !hasQuery && !introSeen;
}

// Written when First Entry is actually shown, so any way out of it (a search, «Рядом», «Ещё», «Поиск», the seller
// entry, closing the tab) counts as the intro having been seen.
export function writeIntroMarker(): void {
  try {
    document.cookie = `${INTRO_SEEN_COOKIE}=1; Path=/; Max-Age=${INTRO_SEEN_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    // No cookies: First Entry and searching by a typed query keep working.
  }
}
