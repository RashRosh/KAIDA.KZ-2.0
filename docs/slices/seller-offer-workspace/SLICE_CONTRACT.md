# Seller Offer Workspace — Slice Contract

**Issue:** #27 — Seller Offer Workspace: marketplace cards and simplified manual seller input

**Status:** SUPERSEDED — decomposed on 2026-09-23 into three seller UI contracts (§13). Kept as history only.

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
- Cross-cutting system states (loading-skeleton shape, offline banner, tiered server-error severity) — formerly `GAP`/`UX-OBS-002`, now owned by `docs/DESIGN_SYSTEM.md` §7.1 (2026-09-22). Screens touched by this redesign (hub, offer cards, inline/modal create-edit, trading points, contacts, Change Set confirm) implement §7.1's loading/offline/error pattern as part of this slice's own UI, per `PROJECT_RULES.md` §18.2 — no separate Product Owner decision is needed for this.
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

**Historical approval 2026-09-22 — superseded.** Implementation proceeded and was rejected for merge. No further
implementation may use §§1–9 as current authority; see §§10–12 and the UI redesign gate in `EXECUTION_PLAN.md`.

## 10. Historical rejected pass — wireframe-driven deviation (2026-09-22)

This section records historical implementation evidence from the rejected `3b029d3` pass; it is not current implementation authority. At the time, the pass treated the wireframe as automatically cancelling STOP for conflicts. Section 11 and the revised `PROJECT_RULES.md` §18.1–§18.3 supersede that interpretation.

The seller-facing screens described above (Parts A/B) were implemented as written, but a direct visual comparison against the bundled wireframe artifact — opened via a locally-saved copy of its HTML, since the live `claude.ai/artifact/...` URL is blocked for headless/automated access by Cloudflare — showed the artifact's own seller screens (`2a`–`2i`, `3a`) go materially beyond this contract's presentation text. The rejected pass changed the following areas:

- **Dark theme, scoped to `/seller/**` only.** New CSS custom-property overrides (`src/app/seller/seller-theme.module.css`) cascade through a wrapper in `src/app/seller/layout.tsx`. Buyer-facing pages are untouched. `--primary` (the existing violet accent) is unchanged; a new `--primary-accent` token was added for text/border legibility on dark surfaces (also added to `globals.css :root` as an alias to `--primary`, so it degrades safely if ever referenced in the light theme).
- **Route-based tabs instead of one stacked page.** `/seller` (hub, compact summary), `/seller/offers` (full searchable/filterable/location-grouped workspace — the wireframe's own `3a` caption literally says it "opережает Slice Contract по #27"), `/seller/points` (trading points), `/seller/contacts` (contacts, reached via a settings icon on the hub — the wireframe's own tab bar has no contacts tab). A third "Статистика" tab is rendered disabled/"скоро" — analytics is Tier 3 / Issue S33, still out of scope; this follows the same placeholder precedent as `WIREFRAME_BRIEF.md`'s Tier 4 items.
- **`BottomSheet` component** (`src/app/seller/_components/BottomSheet.tsx`), sibling to the existing `Modal.tsx`, used for offer create/edit, the change-set confirm step, and trading-point create/edit — matching the wireframe's "шторка" (bottom-sheet) interaction pattern for all in-workspace forms, in place of a centered dialog.
- **Offer Workspace grouping/filtering is presentation-only**, derived client-side from the existing `SellerOfferView[]` already fetched — no new endpoint. Groups by `location.id`; filter chips reuse the existing `price === null` "needs attention" signal (not a new freshness threshold, which stays out of scope per #31/#32) and `status === 'inactive'`.
- **Change-set price diff** (old price struck through → new) is best-effort and purely client-side: the offer being edited is already known to the caller before the change-set exists, so its price is threaded through as an optional prop for display only. A fresh deep-link reload of `/seller/change-sets/[id]` has no such client state and falls back to showing just the new price — a graceful degradation, not a new read field on the closed `SellerChangeSetItemView` contract.
- **Contacts screen rebuilt as per-channel toggles** (`role="switch"`) with a live "as the buyer sees it" preview and a no-channel warning banner, still the same `PUT /api/seller/contacts` endpoint and the same four fields (phone/WhatsApp/Telegram/Instagram — the wireframe shows three; Instagram is kept as a fourth row since the data model is unchanged).
- **Hub "Последние изменения"** shows one honest, uniform "обновлено {relative time}" phrasing rather than the wireframe's two different phrasings ("подтверждено"/"цена изменена"), since the current data (`lastConfirmedAt` only) cannot actually distinguish those two cases without a change-history log that doesn't exist — inventing the distinction would violate Design System §7's "truthful data" rule.

None of this reopens S1/S3/S4/S5/S8/S10/S12/#35/#36/Mandatory-Price — every mutation still goes through the exact same endpoints, and the `SellerChangeSet → SellerChangeItem → confirmation → Offer` architecture is unchanged. Full regression (287 unit / 143 integration / 95 E2E across both projects) stayed green after this pass.

## 11. Product Owner UX reset decision (2026-09-22)

После визуальной оценки Product Owner отклонил эту implementation как основу для merge: результат не достигает целевого UX bundled wireframes. Automated regression доказывает сохранность core contracts, но не заменяет UX acceptance.

Решение:

- `slice/seller-offer-workspace` / `3b029d3` не открывается как release PR, не сливается в `main` и не получает checkpoint tag; по решению Product Owner от 2026-09-23 ветка удаляется после переноса полезного — переносить оказалось нечего (см. §12);
- §10 описывает историческую попытку и не является принятым target implementation;
- следующая реализация начинается с navigation/state/action/data specification и статического либо fixture-driven prototype ключевых flows;
- presentation layer разрешено пересобрать с нуля поверх существующих domain modules, API, DB и closed core contracts;
- отдельные primitives/helpers из rejected branch могут быть перенесены только после review и не делают её page composition принятой (фактический результат review — см. §12);
- новый production pass начинается только после Product Owner UX acceptance прототипа и revised/decomposed Slice Contract;
- до redesign checkpoint действует feature freeze из `docs/product/EXECUTION_PLAN.md`.

Это решение заменяет историческую трактовку §10 о том, что wireframe автоматически отменяет STOP для business/data conflicts. Актуальная граница определена `PROJECT_RULES.md` §18.1–§18.3: authority принадлежит текущей цепочке UX-reset artifacts и визуально принятому прототипу; изменение проверенного core требует явной contract revision.

## 12. Результат review отклонённой ветки (2026-09-23)

§11 допускал перенос полезных изолированных primitives/helpers после отдельного review. Review выполнен. **Переносить нечего.**

Единственная находка, не зависящая от отклонённой композиции, — исправление перехвата фокуса в overlay: эффект, устанавливавший focus trap, зависел от колбэка `onClose`, родитель пересоздавал колбэк на каждое нажатие клавиши, и фокус уезжал на первый элемент после каждого введённого символа. Исправление — держать колбэк в ref, оставив в зависимостях эффекта только факт открытия.

Перенести его отдельным bugfix-slice невозможно: компоненты `src/app/_components/Modal.tsx` и `src/app/seller/_components/BottomSheet.tsx` на `main` отсутствуют — они созданы коммитами `4818261` и `f5c2dfb` самой отклонённой ветки. Патч применять не к чему.

Поэтому сохранено правило, а не код: `DESIGN_SYSTEM.md` §13.1 «Overlay focus management». Новая реализация overlay обязана ему следовать.

Ветка удаляется. История коммитов остаётся в Git и доступна по SHA, если понадобится посмотреть детали.

## 13. Decomposition by accepted Pass 3 (2026-09-23)

This contract is replaced by three compact seller UI contracts, implemented after all three localization contracts.
Exact order, including the `offer-price-unit` prerequisite between seller parts 1 and 2, is owned by
`EXECUTION_PLAN.md`:

1. `docs/slices/seller-cabinet-overview/SLICE_CONTRACT.md` — seller navigation, overview `S-04`, offers list `S-05`,
   confirmation page `S-10`, switch off/on;
2. `docs/slices/seller-offer-editor/SLICE_CONTRACT.md` — create/edit form `S-06`, trading-point step `S-07`;
3. `docs/slices/seller-points-contacts/SLICE_CONTRACT.md` — trading points `S-08`, contacts `S-09`.

Issue #27 direction "no separate confirmation page" is superseded by accepted `S-10`: the confirmation page stays
addressable (`/seller/change-sets/:id`), so S4/S5 confirmation semantics need no revision. Pass 3 elements that need
core not yet built — expired status and reconfirmation (#31), unit codes, address suggestions and map link
(stages 1/1a), comment translation hint — are excluded from these contracts and listed there explicitly.
