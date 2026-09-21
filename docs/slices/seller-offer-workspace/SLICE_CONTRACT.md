# Seller Offer Workspace — Slice Contract

**Issue:** #27 — Seller Offer Workspace: marketplace cards and simplified manual seller input

**Status:** DRAFT — AWAITING PRODUCT OWNER / CONTROLLER APPROVAL

**Base main:** `239656d` (docs-only maintenance on top of checkpoint below)

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility` / `f7e4b08c06f97dd8878666f726a5aadd93240d48`

## 1. User task

Seller manages trading points, offers, contacts and pending changes from one consistent card-based workspace on `/seller`, instead of a linear technical form/list that exposes `SellerChangeSet` mechanics and forces full-page navigation away for every add/edit.

## 2. Scope

Per Issue #27, the Product Owner scope decision recorded 2026-09-22 in `docs/product/EXECUTION_PLAN.md` and `docs/product/WIREFRAME_BRIEF.md` (Tier 1), and the later same-day elevation of the bundled wireframe artifact to authoritative UX target (`PROJECT_RULES.md` §18.1), this slice has two parts. The wireframe's `2a`–`2i` / `3a`–`3c` / `3e`–`3g` screens (per `WIREFRAME_BRIEF.md` Tier 1/2) are the target UI for part A/B below — implementation follows them directly rather than treating them as one advisory input among several.

### A. New: Offer Workspace grid (Issue #27 core ask)

- `/seller` presents a hub overview (trading points count, active offers count, items needing attention) instead of jumping straight into a form.
- Offers render as marketplace-style product cards in a responsive grid: product name, mandatory price+unit, Location, freshness status, sourced from the existing `SellerOfferView` read projection.
- An explicit "add" card opens create-offer inline/modal on the same workspace — no full-page navigation away for create.
- Clicking an existing Offer card opens inline/modal edit with current values pre-filled.
- One primary action completes each add/edit/deactivate/reactivate step; the Seller stays on the workspace afterward instead of being redirected to a separate review route.
- Deactivate/reactivate reuses existing S5 lifecycle actions; no hard-delete affordance.
- Location selection during create/edit reuses the closed #36 rule: single owned Location auto-selected and shown; 2+ Locations require an explicit choice; foreign/nonexistent Location is rejected exactly as today.
- The confirmation step becomes reachable inline/modal from the workspace but stays a real, visible confirmation (explicit summary of the pending change) — it does not collapse into a blind one-click "confirm all" and does not bypass `SellerChangeSet → SellerChangeItem → confirmation → Offer`.
- Applies consistently to both single-offer and S12 batch create/update surfaces.
- Product-first entry before the Seller/Location prerequisite exists continues to behave per closed #35: entered values survive through prerequisite completion and the Seller returns to this workspace afterward.

### B. Redesign of already-implemented Tier 1 screens (presentation only, no new business logic)

- Trading points list (`SellerTradingPoints.tsx`, closed #36) — visual/composition alignment with the new card language; data, validation and API unchanged.
- Explicit Location choice at 2+ Locations (already implemented per #36) — same visual alignment; selection semantics unchanged.
- Contacts screen (`SellerContactSettings.tsx`, closed S10) — visual redesign to the card-based composition; structured contact fields/semantics unchanged.
- Change Set confirmation, single (`/seller/change-sets/[id]`) and batch (`/seller/batch`) — becomes an inline/modal-capable review-and-confirm surface reachable without leaving the workspace; the confirm action itself remains unchanged per closed S4/S12 (see UX_REFERENCE_INDEX 2026-09-21 finding #2: a quick-confirm affordance sits inside the existing boundary, it is not a revision of it).

## 3. Explicit out of scope

- Multiple-Location CRUD/geo semantics — closed #36/S8, not reopened here; no manual coordinate entry or map fallback (that remains the separate blocked `seller-location-geo-fallback` proposal).
- Freshness thresholds, degradation or reminders (Issues #31/#32, later in the committed queue).
- Offer media (M1), Search/Sorting, Discovery/`Для вас`, analytics, Catalog/Product taxonomy changes.
- Removing or bypassing the SellerChangeSet architecture; any direct Offer write.
- Hard deletion of Offer/history; only existing deactivate/reactivate lifecycle actions.
- New auth/session/roles semantics.
- Cross-cutting system states (loading-skeleton shape, offline banner, tiered server-error severity) — recorded as `GAP`/`UX-OBS-002` in `UX_REFERENCE_INDEX.md`, owned by no contract yet; this slice reuses existing minimal loading/error patterns and does not introduce that full system without a separate Product Owner decision.
- DB schema/migration changes — Offer/ChangeSet persistence model is unchanged, only presentation/read composition.
- Contacts data model or new channels beyond existing structured Seller contacts (S10).
- Mandatory price rule changes — the closed invariant is reused as-is.
- OTP resend/timer (unscheduled insertion candidate, unrelated to this slice).

## 4. Closed contracts used (not revised)

- **S1 Offer lifecycle:** freshness/active-inactive state is read, not redefined.
- **S3 Seller/Location ownership:** server-side ownership resolution unchanged.
- **S4/S5/S12 SellerChangeSet:** create/update/batch architecture, all-or-nothing confirmation, ownership re-checks at proposal and confirm.
- **S8 Location geo:** read-only display in cards; no new fallback introduced here.
- **S10 Seller contacts / UX1D buyer eligibility:** structured contacts unchanged; no per-location contacts; buyer visibility rules untouched.
- **Mandatory Offer Price:** required valid `amount`, server-owned `KZT`, optional `unit` — reused unchanged.
- **#35 Seller Entry:** product-first draft continuity and first-run landing actions preserved.
- **#36 Seller Trading Points Workspace:** card pattern, identity fields, and the `0 / 1 / 2+` offer-assignable Location resolution rule.
- **Design System §§4–9, 13, 16:** tokens, card composition, accessibility baseline, formatting rules, seller UI vocabulary rule (no raw `SellerChangeSet`/`ChangeItem` jargon exposed to the Seller).

## 5. Expected modules / architectural areas

- `/seller` hub composition, replacing or extending the current linear `SellerSetup.tsx` orchestration once the Seller has data.
- New Offer grid/card presentation consuming the existing `/api/seller/offers` read projection; no new read fields expected beyond current `SellerOfferView` — a genuine display gap is a STOP point to flag, not something to silently add.
- Inline/modal create+edit surface reusing the existing create/update ChangeSet endpoints (e.g. `/api/seller/offers/[id]/change-sets` and the existing single-create endpoint), replacing the current `router.push` full navigation with an in-workspace review/confirm step.
- Location-selection UI reused/aligned from #36 inside the new create/edit surface.
- Trading points card list and contacts screen: visual/composition alignment only, same API/data.
- Single (`/seller/change-sets/[id]`) and batch (`/seller/batch`) confirm surfaces made reachable inline/modal from the workspace, same confirm API/semantics.
- Targeted integration/E2E for the new stay-on-workspace flow, plus existing regression coverage for #35/#36/S4/S5/S12/mandatory-price.

Not expected: new DB tables/migrations, new mutation endpoints, changes to Search/Nearby/Discovery, Identity or Location/geo application logic.

## 6. Risk flags

| Risk | Status | Contract consequence |
|---|---|---|
| DB migration | **NO** | Presentation-only; reuses existing persisted data and read APIs. |
| Public API | **BOUNDED** | Existing create/update/confirm endpoints are reused as-is. A new read aggregate for hub counts is plausible; if implementation needs one, it is additive-only (no existing contract narrowed) and gets targeted proof. No new mutation endpoint is expected. |
| Auth / security / privacy | **NO new risk** | Existing S3/#36 ownership checks are reused untouched; no new read/write surface bypasses them. |
| Concurrency / atomicity | **YES, bounded** | Existing ChangeSet all-or-nothing/stale-revision protection must keep working when edits are initiated inline/modal instead of via full navigation; presentation change must not allow two conflicting concurrent edits to the same Offer to both apply. |
| Data loss | **YES, bounded** | In-progress inline/modal form state and the #35 product-first draft must not be lost when switching between add/edit cards within the workspace or through prerequisite completion. |
| External service | **NO** | None introduced. |

## 7. Acceptance criteria

1. Authenticated Seller with ≥1 owned Location sees `/seller` as a workspace: a hub overview plus Offers rendered as a responsive grid of marketplace-style cards (name, price+unit, Location, freshness) — not a linear form or technical list/table.
2. An explicit "add" card opens create-offer inline/modal on the same workspace; on successful confirm the Seller remains on the workspace and sees the new card without a full-page navigation to a separate review route.
3. Clicking an existing Offer card opens inline/modal edit with current values pre-filled; edit, deactivate and reactivate each complete through one primary action and leave the Seller on the workspace afterward.
4. Deactivate/reactivate uses existing S5 lifecycle semantics; no hard-delete action exists in the UI, and Offer identity/history is preserved exactly as before.
5. With exactly one owned Location, creation implicitly uses and shows it; with 2+ Locations, creation/edit requires an explicit choice reusing #36's resolution rule; a foreign/nonexistent Location is rejected the same way as today.
6. The confirm step for any proposed change remains a real, visible confirmation (explicit summary of what changes) reachable inline/modal from the workspace; the Seller cannot commit a change without seeing it, and `SellerChangeSet → SellerChangeItem → confirmation → Offer` is unchanged end to end for both single and batch flows.
7. Product-first entry before the Seller/Location prerequisite exists (per #35) continues to preserve entered values through prerequisite completion and returns the Seller to this workspace afterward.
8. Trading points list and Seller contacts screens visually align with the new card/workspace language; their data, validation and API contracts are unchanged from #36/S10.
9. No production behavior change to freshness thresholds, mandatory-price validation, buyer-facing Search/Nearby/Offer presentation, or Location geo semantics.
10. Workspace, cards and inline/modal surfaces follow the Design System: system tokens, no page-level horizontal overflow at `320/360/390/768/1024/1440px`, visible focus/labels/status, minimum `44×44px` targets, no fake ratings/urgency/ecommerce mechanics.
11. Anonymous access and foreign-ownership access to workspace data remain rejected exactly as under existing S3/#36/S4-S5-S12 checks; no new read/write surface bypasses ownership.
12. Existing automated regression for S1/S3/S4/S5/S8/S10/S12/#35/#36/Mandatory-Price stays green; no closed contract is silently narrowed by the presentation change.

## 8. Automated verification plan

### Integration

No new integration tests expected beyond existing coverage, unless implementation introduces a genuine new read aggregate for hub counts — in that case, one targeted integration test for that projection only.

### E2E — primary targeted proof (mobile + desktop)

- Seller with 2+ offers across a Seller with 1 Location and a Seller with 2+ Locations: add an offer via the add-card, complete inline/modal create, stay on the workspace, see the new card reflect the confirmed state;
- edit an existing offer via its card, see the visible change summary at confirm, stay on the workspace after confirming;
- deactivate then reactivate an offer via its card; confirm no hard-delete affordance exists;
- 2+ Location explicit choice enforced during create/edit; foreign Location rejected;
- product-first flow before the #35 prerequisite still preserves entered values through prerequisite completion and returns to this workspace;
- representative widths, keyboard/focus order, no horizontal overflow.

### Regression

Full existing S1/S3/S4/S5/S8/S10/S12/#35/#36/Mandatory-Price suites stay green on the same branch CI as the final executable SHA. No repeated exact-SHA runs unless nondeterminism appears.

### Unit

Only for genuinely new non-trivial pure logic (e.g. card grid add/edit/close state transitions). No unit coverage for simple rendering/wiring already proven by integration/E2E.

### Migration / external service

Not applicable — no schema change, no external service introduced.

After targeted verification: one full regression run and branch CI on the final executable SHA.

## 9. Manual acceptance scenario

1. Log in as a Seller with 2 Locations and 2+ existing Offers, land on `/seller`, see the hub plus the offer grid.
2. Tap the add-card, create a new Offer with an explicit Location choice, confirm, and land back on the workspace seeing the new card.
3. Tap an existing card, change its price, go through the visible confirm step, and see the updated card without leaving `/seller`.
4. Deactivate one Offer from its card and confirm it now reads as inactive, still present in the workspace as history — not deleted.
5. Open Trading Points and Contacts from the same workspace and confirm they read/behave exactly as before, just visually aligned.
6. Start "Добавить товар" as a brand-new Seller before creating a Location, verify entered values survive through the required Location setup and return, then confirm normally.
7. Repeat the core add/edit/confirm loop at mobile width and confirm no horizontal scroll, visible focus and adequate touch targets.

## Review gate

Controller/Product Owner approval is required before implementation. No production code, migration, tests, CI, manual acceptance, merge, tag or further Issue #27 work belongs to this contract-only pass.
