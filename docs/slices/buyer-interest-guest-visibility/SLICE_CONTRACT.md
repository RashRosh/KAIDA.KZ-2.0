# Buyer interest ("heart") visibility for guests

**Status:** `APPROVED — IMPLEMENTED AND MERGED`

**Approved:** 2026-09-21, Product Owner (RashRosh). Implemented in `33dc208` and merged to `main` in `1313f3f`, re-verified in full ahead of merge (lint, typecheck, unit 287/287, integration 143/143, build, e2e 95/95). Three manual-acceptance fixes surfaced while exercising this slice's adjacent surfaces (header identity indicator, Auth modal phone live-formatting, Nearby redundant intro block) were folded into the same checkpoint via `fix/manual-acceptance-header-nearby-otp` — see `docs/product/EXECUTION_PLAN.md`'s checkpoint entry for the closing tag. This status line previously read `DRAFT — PENDING PRODUCT OWNER / CONTROLLER REVIEW`, which lagged the actual merge; corrected here to match repository state ahead of checkpoint tagging.

**Base product checkpoint:** `v0.0.24-seller-entry`

**Checkpoint commit:** `28eae6d64fac92b71339b3ae2f5235040f75b447`

**Source:** UX follow-up spot-check, `docs/product/UX_REFERENCE_INDEX.md` (2026-09-21), finding #3 of the "Карта пути KAIDA" walkthrough artifact.

No closed-contract STOP is required for this slice. Verified directly against `docs/slices/S13-interests/SLICE_CONTRACT.md` §9: "Exact visual placement is implementation detail." Anonymous API access stays `401`/no read-write either way — this is a presentation-layer change only.

## 1. User task

An anonymous (not logged in) buyer sees the same interest ("heart") control on Offer cards as an authenticated buyer, and clicking it while anonymous opens the existing Auth modal with a clear reason, instead of the control being invisible.

## 2. Scope

- `SearchForm` (and any other surface using the same `interestsState`, e.g. Nearby) renders an `interest` control on `OfferCard` for the `anonymous` state too, not only for `ready`;
- clicking the control while anonymous opens the existing shared Auth modal instead of calling the Interests API; the specific `productId` the buyer clicked travels with the Auth intent;
- after a successful Auth started this way, the originally-clicked offer's interest is applied automatically (one real `PUT` to the Interests API for that `productId`) — the buyer never has to click the heart a second time to complete the action they already expressed; this mirrors the already-closed Seller Entry (#35) principle of preserving intent across an auth/prerequisite interruption, and matches the standard save/wishlist-after-login pattern used industry-wide (Pinterest, Instagram, Avito, Airbnb);
- the buyer returns to the same result list with real interest state loaded for all visible offers (no forced page navigation away from Search/Nearby);
- cancelling the Auth modal from this entry point leaves the buyer exactly where they were, with no Interest API call made;
- visual state for the anonymous control is a clear, inactive default (not a false "already saved" state) — no client-side optimistic toggle before authentication exists.

## 3. Explicit out of scope

- anonymous/local (e.g. `localStorage`-backed) interest storage before login — S13's closed API stays authenticated-only; this slice does not add an unauthenticated persistence layer;
- merging anonymous-session interest picks into the account after login — there is no anonymous interest state to merge, by the point above;
- changing S13 API/DB contract in any way;
- changing Search API/DTO;
- Reviews/Rating or any other card-surface capability.

## 4. Closed contracts used

- **S13 Interests:** API/DB semantics, anonymous `401`, ownership isolation — all unchanged. §9 explicitly leaves visual placement/visibility as implementation detail.
- **UX1A.2 Auth modal:** existing shared modal-over-current-page pattern, close/Escape/backdrop semantics, focus return — reused, not redefined.
- **Seller Entry (#35):** precedent for a caller-specific Auth intent that returns the buyer to a useful post-auth state rather than a generic redirect. This slice needs the same *kind* of mechanism but the current `authIntent` state lives inside `AppHeader`, scoped to the seller-entry trigger only — it is not currently reachable from `SearchForm`/`OfferCard`. Extending that shared orchestration so a non-header component can request an Auth intent is in scope for this slice (presentation/state-wiring only, not a change to S2 Auth API or session semantics).

## 5. Risk flags

- **DB migration:** NO.
- **Public API:** NO — no new/changed endpoint; Interests API is only ever called after real authentication, same as today.
- **Auth/security/privacy:** LOW — reuses existing Auth modal and S2 session semantics unchanged; only the trigger surface widens.
- **Concurrency/atomicity:** NO.
- **Data loss:** NO.
- **External service:** NO.

## 6. Expected modules / boundaries

- shared auth-state/modal orchestration (currently `AppHeader`-scoped `authIntent`) — extended so a caller outside the header can request the modal with a `buyer-interest` intent carrying the target `productId`, and a return-to-current-results behavior with automatic completion of that one interest, analogous to how Seller Entry (#35) added a `seller` intent;
- `SearchForm` interest-list wiring — passes a real (non-`undefined`) `interest` control to `OfferCard` for the `anonymous` state, with `onToggle` requesting the Auth intent (with that offer's `productId`) instead of calling the Interests API;
- `OfferCard` — no change to its own closed accessibility/interaction contract, only receives a differently-behaving `interest` prop;
- targeted E2E covering the anonymous-heart-click → Auth → return-to-results path, plus regression on existing S13 and Seller Entry E2E.

Not expected: changes to `NearbyFeed`'s own data-loading logic beyond wiring the same `interest` prop pattern if it already mirrors `SearchForm`'s approach.

## 7. Acceptance criteria

1. An anonymous buyer sees the same interest control (heart icon) on Offer cards as an authenticated buyer — not a missing/blank space.
2. Clicking the control while anonymous opens the existing shared Auth modal; no request to the Interests API is made.
3. The Auth modal opened this way has copy/context making clear why it appeared (saving interest requires an account), consistent with existing modal presentation rules.
4. Successful phone/OTP auth started from this entry point automatically applies the interest for the specific offer whose control was clicked (one real API write, no second click required), then returns the buyer to the same Search/Nearby result list with real interest state loaded for all visible offers, without a full page reload losing the current query/results.
5. Cancelling (X/Escape/backdrop) the Auth modal from this entry point leaves the anonymous buyer on the same results, with no Interest API call and no false "saved" state shown.
6. The anonymous-state control never shows a false "active"/saved appearance before real authentication.
7. Existing authenticated behavior (toggle add/remove interest) is unchanged.
8. Existing S13 API `401`/ownership-isolation semantics are unchanged and re-verified by regression.
9. No horizontal overflow or touch-target regression on `320/360/390/768/1024/1440px`.

## 8. Automated verification plan

- **E2E (mobile + desktop):** anonymous buyer sees interest control → clicks it → Auth modal opens with no API call → cancels → state unchanged; repeat and complete Auth → returns to same results with real interest state loaded.
- **Regression:** existing S13 Interests E2E/integration, existing Seller Entry (#35) E2E for the header-triggered intent (to confirm the shared orchestration extension didn't regress the seller path).
- One full branch CI on the final executable SHA after targeted proof.

## 9. Manual acceptance scenario

1. As an anonymous visitor, search for a product and confirm the heart icon is visible on result cards.
2. Click it; confirm the Auth modal opens with a clear explanation and no network call to Interests fires.
3. Close the modal; confirm the results and heart state are unchanged.
4. Click the heart again, complete phone/OTP login; confirm you land back on the same results with the originally-clicked offer already marked as an active interest, with no second click needed.
5. Repeat on mobile and desktop, checking layout and touch targets.
