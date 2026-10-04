// Stage 6B: one deterministic place that defines where an E2E browser starts. Ordinary buyer/search/seller specs start as a
// returning visitor — the language chosen (Russian) and First Entry already shown — so the generic `/` is the Search.
// First Entry specs start from `firstVisitState` (no intro marker) and prove the onboarding behavior themselves.
const cookieBase = { domain: '127.0.0.1', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const };

const localeCookie = { name: 'kaida_locale', value: 'ru', ...cookieBase };
const introSeenCookie = { name: 'kaida_intro_seen', value: '1', ...cookieBase };

export const returningVisitorState = { cookies: [localeCookie, introSeenCookie], origins: [] };
export const firstVisitState = { cookies: [localeCookie], origins: [] };
export const emptyBrowserState = { cookies: [], origins: [] };
