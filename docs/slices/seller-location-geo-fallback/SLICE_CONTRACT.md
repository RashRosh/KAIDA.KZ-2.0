# Seller Location geo fallback — proposed S8 revision

**Status:** `PROPOSED — BLOCKED ON CLOSED-CONTRACT REVISION APPROVAL`

**Base product checkpoint:** `v0.0.24-seller-entry`

**Checkpoint commit:** `28eae6d64fac92b71339b3ae2f5235040f75b447`

**Source:** UX follow-up spot-check, `docs/product/UX_REFERENCE_INDEX.md` (2026-09-21), finding #1 of the "Карта пути KAIDA" walkthrough artifact.

This document is not an approved Slice Contract yet. Section 0 is the `PROJECT_RULES.md` §4 STOP write-up required before any closed contract may be revised. Sections 1+ are a draft of what the Slice Contract would contain **if** the revision is approved. No implementation may start from this document until Product Owner approval changes its Status line.

## 0. STOP — closed-contract revision request

**Which contract blocks:** `docs/slices/S8-location-geo/IMPLEMENTATION_CONTRACT.md`:

- §11 "Browser geolocation contract" — geolocation may only be requested via one explicit `navigator.geolocation.getCurrentPosition()` call per Seller action; no `watchPosition`, no polling, no automatic refresh;
- §12 "Seller UI contract" — "No map, map preview, manual coordinate fields or address edit is added."

Current product behavior derived from this contract: a Location can only receive geo coordinates if the Seller is physically standing at the sales point with a device that grants browser geolocation permission. If permission is denied, unavailable, or the Seller is off-site, there is no alternative path to set the Location's coordinates.

**Why this can't proceed without a change:** the UX follow-up spot-check found two independent, unrelated sources converging on the same recommendation — that denied/unavailable geolocation must have a manual fallback, not a dead end:

1. `Проектируем экраны онбординга в мобильном приложении 100 гайдлайнов.md`, section "Запросы доступа" — names **Юла** (✅ example) explicitly: "Если пользователь решил не предоставлять доступ к геолокации, предоставьте ему альтернативные способы указания местоположения." Youla is a directly comparable local-classifieds marketplace with physical seller-side locations, not a generic online-store checkout.
2. `Проектируем интерфейс оформления заказа выбор адреса и времени доставки. 162 гайдлайна.md` — documents the same pattern independently for delivery-address geolocation: offered as an accelerator alongside manual entry, never the sole path, with graceful denial handling.

Both sources also independently document "explain what access is for, before the system prompt" (KAIDA already does this — `KEEP`) and "tell the user how to grant access later after a denial" (KAIDA does not currently do this).

**What is proposed:** add a manual fallback for setting a Location's geo point when browser geolocation is denied, unavailable, or the Seller is not on-site — without removing or weakening the existing explicit browser-only action, which stays the primary/recommended path (it produces more accurate coordinates for a physical sales point than manual placement).

**Chosen mechanism — paste, not an embedded map.** Checked `UX1D-buyer-offer-actionability/SLICE_CONTRACT.md` §22 first: it already closes MVP map-provider scope to "2ГИС через официальный deeplink, без Routing API, SDK, API key или server-side вызова 2ГИС API." An embedded interactive map picker (any provider) would need exactly the SDK/API-key integration that decision deliberately avoided — so it's not a neutral default here, it would reopen a second closed boundary on top of S8. Instead:

- one text field accepts either a raw coordinate pair (`43.238949, 76.889709`) or a link copied from a maps app/service (2ГИС, Google Maps, Yandex Maps — Seller uses whatever app they already have installed; KAIDA embeds nothing);
- KAIDA parses this client-side only (regex extraction of a coordinate pair from the pasted text/URL) — no network geocoding call, no maps SDK, no API key, no external service dependency at all;
- the parsed point is shown back to the Seller for explicit review/confirm before it is saved — satisfies the "auto geolocation без explicit intent" prohibition (Design System §15) the same way the browser action already does;
- unparseable input shows a clear format hint and does not silently save anything.

This is deliberately the leaner option: it reduces this proposal's own risk profile (no new external service, no SDK) instead of adding one, and it solves the actual problem from the Youla precedent — a Seller can do this from anywhere, not only standing at the sales point.

**Consequences:**

- S8 §11–12 must be revised to permit this second, manual coordinate-setting path;
- the "No map... is added" and "browser-only" framing in the closed contract becomes historically inaccurate the moment this ships — S8's own document would need a superseding note, not a silent rewrite of its historical acceptance criteria;
- new/changed API surface on `PUT /api/seller/locations/:id/geo` or an adjacent endpoint to accept a manually-set point through the same owner-scoped mutation pattern, reusing the exact same validation (`-90..90`/`-180..180`, pair-consistency) already proven by S8;
- privacy boundary from S8 §13 (no raw geo/lat/lng in public Search API) must be explicitly re-verified against this new write path — it is not automatically inherited, even though the mechanism itself adds no new external exposure.

**Which slices/modules are affected:** `S8-location-geo` (contract itself), `Locations` module (new use-case), Seller `/seller` UI (new control), possibly `Issue #36` Seller Trading Points card workspace (the natural UI location for this control now that Locations get their own cards) — this proposal is written to compose with #36, not replace it.

**Decision needed:** Product Owner reviews this section and either approves a revision (which then unblocks sections 1+ below into a real Slice Contract) or rejects/defers it, in which case S8 stays exactly as closed today and this file stays `PROPOSED — BLOCKED`.

---

## 1. User task (draft, contingent on approval)

A Seller who cannot or does not want to grant browser geolocation while physically at the sales point can still set that Location's coordinates through a manual alternative, without the explicit on-site browser action being removed as the primary path.

## 2. Scope (draft)

- existing explicit browser-only geolocation action (S8) remains unchanged and remains the recommended/primary path, always shown first/most prominent;
- a manual fallback (paste coordinates or a maps-service link into one text field, client-side parsed, explicit confirm) becomes available alongside it, not gated behind a prior denial — a Seller who already knows they're off-site shouldn't be forced through a doomed permission prompt first;
- the fallback requires an explicit Seller confirm action to save a point — no silent/automatic coordinate assignment from address text or from the pasted value without review;
- owner-scoped mutation, validation ranges (`-90..90` / `-180..180`), pair-consistency, and the public Search privacy boundary (no raw geo in buyer-facing API) carry over unchanged from S8.

## 3. Explicit out of scope (draft)

- removing or weakening the existing explicit browser-only action;
- reverse/forward geocoding or automatic address-to-coordinate conversion (stays out per UX2 and S8 boundaries) — the Seller supplies the coordinate value themselves via a tool of their choosing, KAIDA never calls a geocoding service;
- any embedded interactive map/picker, any maps SDK, API key, or server-side call to a maps provider — stays out per the existing UX1D §22 MVP boundary, not only per S8;
- address autocomplete (separate future decision, already flagged in UX2);
- changing Location identity fields (name/type/address) — that's Issue #36's scope;
- Market/MarketPlace scheme (Issue #10).

## 4. Closed contracts used / touched (draft)

- **S8 Location Geo** — touched, as described in Section 0.
- **S3 Seller/Location** — unchanged; still owner-scoped, still no coordinates at setup time.
- **UX1D §22** — MVP map-provider boundary (2ГИС deeplink only, no SDK/API key/server-side call) is preserved, not touched — the chosen mechanism deliberately avoids needing any map provider at all.
- **Design System §15** — "auto geolocation без explicit intent" stays forbidden; the fallback still requires an explicit Seller confirm action, just not necessarily the browser geolocation API.

## 5. Risk flags (draft)

- **DB migration:** NO — same `latitude`/`longitude` columns, same constraints.
- **Public API:** YES — new/changed owner-scoped mutation path accepting a manually-supplied point.
- **Auth/security/privacy:** YES — must re-verify the public Search privacy boundary against the new write path explicitly, not assume it.
- **Concurrency/atomicity:** NO new risk beyond existing S8 pattern.
- **Data loss:** NO.
- **External service:** NO — client-side text/URL parsing only; no maps SDK, API key, or network call to any maps/geocoding provider.

## 6. Acceptance criteria (draft, contingent on approval)

1. The existing explicit browser-only geolocation action remains the primary, most visually prominent way to set a Location's geo point; the manual fallback is a secondary, clearly-labeled action, not equal-weight with it.
2. The manual fallback is available whenever the Seller wants it — not gated behind first attempting and failing the browser action; a Seller who already knows they're off-site can go straight to it.
3. A Seller can paste either a raw `lat, lng` pair or a link copied from a maps app/service (2ГИС, Google Maps, Yandex Maps) into one text field.
4. KAIDA parses the pasted value entirely client-side (no network request) and shows the Seller the resulting coordinate pair before saving anything.
5. The Seller must take an explicit confirm action after seeing the parsed value; nothing is saved from parsing alone.
6. Input that cannot be parsed shows a clear format hint (example coordinate pair, example accepted link shape) and saves nothing.
7. The confirmed manual point is validated by the exact same rules as the existing browser-supplied point (`-90..90` latitude, `-180..180` longitude, pair-consistency) and rejected the same way if invalid.
8. The manual point is persisted through an owner-scoped mutation using the same `id` + `sellerId` predicate pattern as the existing S8 geo update; foreign/nonexistent Location remains indistinguishable (`LOCATION_NOT_FOUND`-equivalent).
9. Once saved, a Location's geo state (`Местоположение сохранено`) looks and behaves identically to buyer/seller-facing code regardless of whether it was set via the browser action or the manual fallback — no second-class/visibly-different state.
10. Public `/api/search` continues to expose no raw `geo`/`latitude`/`longitude` for a Location whose point was set through the manual fallback — re-verified by direct test, not assumed inherited from S8.
11. No maps SDK, API key, iframe embed, or network call to any external maps/geocoding service is introduced anywhere in this flow.
12. UI has no horizontal overflow and keeps minimum `44x44px` touch targets on `320/360/390/768/1024/1440px`.

## 7. Automated verification plan (draft)

- **Unit:** parser for the paste field — valid `lat, lng` pairs (with/without spaces, with/without a trailing label), recognized link shapes from at least 2ГИС/Google Maps/Yandex Maps URL patterns, out-of-range values, malformed/unrecognized input, empty input.
- **Integration:** owner-scoped manual-point mutation — valid save, invalid/out-of-range rejection, foreign-owner rejection, same-pair idempotent re-save; direct `/api/search` assertion that no raw geo/lat/lng leaks for a manually-set Location (mirrors existing S8 privacy test, run again against this new write path).
- **E2E (mobile + desktop):** browser action still primary/first; manual fallback reachable without a prior denial; paste a valid link → parsed preview shown → confirm → saved state matches browser-set state visually; paste garbage → clear error, nothing saved.
- **Regression:** existing S8 E2E/integration/migration suites unchanged and passing.
- One full branch CI on the final executable SHA after targeted proof.

## 8. Manual acceptance scenario (draft)

1. As a Seller with an existing Location and no saved geo, open the Location's geo control and confirm the browser-only action is still the prominent primary option.
2. Confirm a secondary "enter manually" action is visible without first triggering/denying the browser prompt.
3. Copy a location link from a real maps app on your phone, paste it into the field, confirm a parsed coordinate pair is shown before saving.
4. Confirm and verify the saved state looks identical to a browser-set point (`Местоположение сохранено`, no raw coordinates shown as text).
5. Repeat with a raw pasted `lat, lng` pair instead of a link.
6. Paste unrelated text and confirm a clear, non-technical error appears and nothing saves.
7. Verify via existing buyer Search that no raw coordinates are exposed for this Location.
8. Check mobile and desktop layout for overflow and touch targets.
