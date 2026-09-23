# Localization foundation — Slice Contract

**Status:** PROPOSED — contract review before production implementation.

**Part 1 of 3** localization contracts (gate step 6, `EXECUTION_PLAN.md`):

1. this contract — locale selection, persistence, string layer, font coverage, API locale;
2. `docs/slices/catalog-localization/SLICE_CONTRACT.md` — Product names/aliases in `ru`/`kk`, bilingual Search;
3. `docs/slices/seller-comment-translation/SLICE_CONTRACT.md` — machine translation of the Seller's Offer comment.

Order: 1 → 2 → 3. Parts 2 and 3 depend on the locale selection and API locale defined here.

**UX target:** accepted Pass 3 (`docs/product/WIREFRAME_PASS3_REVIEW.md` §13), surface `S-11` shell and `S-12` system
states; `docs/product/UX_NAVIGATION_STATE_SPEC.md`.

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

Guest, Buyer or Seller picks Russian or Kazakh once and keeps that language on this device across pages, reload
and login, without losing what they were doing.

## 2. Scope and exact behavior

### Locale selection and persistence

- Supported locales: `ru`, `kk`. Mobile shows `РУ / ҚАЗ`, one tap switches immediately; desktop shows
  `Русский / Қазақша`. Screen readers get full language names and `aria-pressed`. No flags.
- Choice is stored in a first-party cookie holding only `ru` or `kk`. It is readable during server render, is not an
  auth credential, carries no personal data and is independent from the session cookie: login and logout neither
  read nor reset it.
- Locale is not part of the URL. Existing routes and links stay valid.
- First visit without a stored choice: the page request's browser language decides (`kk` or `ru`), otherwise `ru`.
  An explicit choice always wins. An unknown cookie value is ignored and the same rule applies.
- Switching keeps the route, `?q=`, expanded/local UI state that the surface already keeps, and unfinished form
  input. It does not re-run geolocation or resubmit anything.
- `html lang` matches the active locale.

### String layer

- One shared localization layer owns every KAIDA-owned user-facing string: visible text, placeholders, ARIA copy,
  page metadata, validation and error text. Components do not hardcode visible strings.
- Each key exists in both locales. An automated check fails the build when a key is missing or empty in either locale.
- Kazakh strings are prepared and checked by an LLM review pass (Product Owner decision, 2026-09-23). The Pass 3
  prototype dictionary is the starting source. Text provenance is recorded next to the strings, so a later native
  review can find what an LLM approved.
- This slice moves into the layer and translates only what it owns: the shell (`S-11`: header, switch, buyer/seller
  navigation, «Ещё»), shared system states (`S-12`: loading, offline, server error, «Повторить») and page metadata.
  Every other surface is translated by the UI slice that rebuilds it to Pass 3. A UI slice is not complete while its
  surface works in one language only (`FEATURE_MAP.md`).

### Visibility of the switch during transition

- The switch is shipped behind a configuration flag, off by default in production, so a user never switches to
  Kazakh and lands on screens that are still Russian-only.
- Automated proof runs with the flag on. The Product Owner turns the flag on in production once the F1–F3 surfaces
  are covered in both locales; this is a release decision, not part of this slice.
- With the flag off, behavior is the current Russian UI; `html lang="ru"`.

### API locale

- Read endpoints that return display text accept an explicit `locale` query parameter (`ru` | `kk`). Without it, or
  with an unsupported value, they answer in `ru`, exactly as today.
- APIs do not read `Accept-Language` or the locale cookie. A browser's own language headers never change an API
  response by themselves.
- Errors keep their stable `code`. The UI shows localized text chosen by `code`, never the server's `message`.
  The server `message` stays Russian for legacy clients.
- Locale affects display fields only. It never changes identities, mutations, eligibility or ranking.

### Font coverage

- The primary UI font ships the glyphs for all Kazakh letters (`ә ғ қ ң ө ұ ү һ і`, upper and lower case); today's
  `latin` + `cyrillic` subset lacks most of them. Font family choice (Roboto in `DESIGN_SYSTEM.md` §2.2 vs Inter in
  the Pass 3 prototype) belongs to the UI slices and Design System; this slice only guarantees coverage of the
  family in use.

## 3. Explicit out of scope

- Catalog names, aliases and Search (part 2); Seller comment translation (part 3).
- Translating surfaces other than `S-11`, `S-12` and metadata; each UI slice owns its own surface.
- Translating Seller-authored names, addresses or custom units: these are always shown as written (Product Owner
  decision, 2026-09-23; see part 3).
- Locale in URL, per-account language stored on the server, languages other than `ru`/`kk`.
- Changing auth/session, Offer lifecycle, ChangeSet confirmation, ownership, geo privacy.

## 4. Closed contracts used and revisions

- **S2 Auth:** the preference survives login/logout; session cookie and login semantics unchanged.
- **Public API (S0/S7/S9/S10 read endpoints):** additive optional `locale` parameter; default output unchanged.
- **UX1A/UX2A shell:** presentation of the shell is replaced by Pass 3 `S-11` only where this slice touches it.
- No closed contract is revised.

## 5. Expected areas and risk flags

Shared app shell, root layout/font setup, a shared i18n resource layer, API request parsing for `locale`, client
error rendering. Internal names and file layout are chosen during implementation.

| Risk | Proof requirement |
|---|---|
| Public API | Requests without `locale` return byte-identical payload semantics to today; a `kk` browser language header alone changes nothing. |
| Auth / privacy | Cookie holds only `ru`/`kk`; login/logout do not touch it; it grants nothing. |
| UX regression | With the flag off, the current Russian UI is unchanged. |

## 6. Acceptance criteria

1. With the flag on, Guest, Buyer and Seller switch language in one action on mobile and desktop.
2. The choice survives reload, navigation, login and logout on the same device.
3. First visit follows browser language `kk`/`ru`, otherwise `ru`; an explicit choice overrides it; a corrupt cookie falls back safely.
4. Switching keeps route, `?q=` and unfinished form input.
5. `html lang` matches the active locale.
6. Shell, system states and metadata exist in both locales; the missing-key check fails on a removed or empty key.
7. Kazakh letters render in the primary UI font, not a fallback font.
8. API without `locale` answers as today; with `locale=kk` only display fields change; `Accept-Language` is ignored.
9. The UI shows error text by `code` in the active locale.
10. With the flag off, production behavior equals today.

## 7. Verification and manual acceptance

- Unit: locale resolution order (cookie → browser language → `ru`), invalid cookie, key-parity check.
- Integration: API with/without `locale`, with a `kk` `Accept-Language` header and no parameter.
- E2E (flag on): one-tap switch on mobile width, desktop switch, persistence through reload and auth, `?q=` and form
  input kept, `html lang`, keyboard and screen-reader names of the switch, no clipping of Kazakh shell text at 320 px.
- E2E (flag off): existing suite passes unchanged.
- One full regression run and branch CI on the final executable head.

Manual scenario: enable the flag, open Search as a guest in `ru`, type a query, switch to `ҚАЗ` — the query stays,
shell and system texts are Kazakh, `html lang="kk"`. Log in as a Seller, log out, reload — still Kazakh. Turn the flag
off and confirm the site looks as it does today.
