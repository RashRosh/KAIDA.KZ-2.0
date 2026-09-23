# Seller cabinet: navigation, overview and offers list — Slice Contract

**Status:** DRAFT — awaiting Product Owner approval.

**Part 1 of 3** seller UI contracts that replace the rejected Issue #27 contract
(`docs/slices/seller-offer-workspace/SLICE_CONTRACT.md` §13):

1. this contract — seller navigation, overview `S-04`, offers list `S-05`, confirmation page `S-10`, on/off actions;
2. `docs/slices/seller-offer-editor/SLICE_CONTRACT.md` — create/edit form `S-06` and trading-point step `S-07`;
3. `docs/slices/seller-points-contacts/SLICE_CONTRACT.md` — trading points `S-08` and contacts `S-09`.

Order: 1 → 2 → 3. All three start only after `localization-foundation` is merged: every string goes through its
string layer and ships in `ru` and `kk`.

**UX target:** accepted Pass 3 (`docs/product/WIREFRAME_PASS3_REVIEW.md` §13), surfaces `S-04`, `S-05`, `S-10`,
seller part of `S-11`, `S-12`; `docs/product/UX_NAVIGATION_STATE_SPEC.md` §2 F3, §3.3–3.4.

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

A Seller opens the cabinet, sees at a glance how many trading points and offers they have, finds any offer in the
list and switches it off or back on, without meeting technical words.

## 2. Scope and exact behavior

### Seller navigation (seller part of `S-11`)

- Destinations: `Обзор` `/seller`, `Предложения` `/seller/offers`, `Точки` `/seller/points`, `Контакты`
  `/seller/contacts`.
- Mobile: bottom navigation with `Обзор`, `Предложения`, `Точки` and `Ещё`; `Ещё` holds `Контакты` and `Выйти`.
  Desktop: permanent seller navigation with all four destinations plus logout (PO decision with Pass 3,
  `UX_NAVIGATION_STATE_SPEC.md` §11).
- No disabled or `скоро` destinations.
- Until parts 2 and 3 land, `Точки` and `Контакты` show today's trading-point and contacts components inside the new
  cabinet frame, unchanged in behavior.
- Anonymous access to any `/seller/**` route keeps today's login-required behavior (#35).

### Overview `S-04` — `/seller`

- **First run** (no Seller or no Offers): title, one short explanation, one primary action `Добавить товар`. Until
  part 2 it opens today's product-first flow (#35) unchanged.
- **Default:** counts of trading points, active offers and switched-off offers; up to three most recently confirmed
  offers; links `Все предложения` and `Добавить товар`. Counts come from the existing owned-offers and seller reads;
  no new endpoint unless the Controller finds the client-side count unworkable, in which case an additive read
  aggregate is allowed with targeted proof.
- **Not in this slice:** the `Требует внимания` block, the `ждут подтверждения` count and `Подтвердить актуальность`.
  They need an expired state that core does not have (Offer status is only `active`/`inactive`). They arrive with
  Seller Freshness Policy (Issue #31), not before.
- Loading and error follow `DESIGN_SYSTEM.md` §7.1; error has `Повторить`.

### Offers list `S-05` — `/seller/offers`

- One card per owned Offer: product name, price with unit, trading point name, status label, buyer visibility line,
  last-confirmed time as a localized phrase.
- Status comes from core only: `Активно` or `Выключено`. Status is shown by text, not only colour.
- Filters: `Все`, `Активные`, `Выключены`, each with its count; filter kept in the URL query so Back and reload keep it.
- One primary action per card by status: active → `Изменить`; switched off → `Включить`. The secondary menu
  `Другие действия` holds the rest: `Выключить` for active offers.
- `Изменить` and `Добавить товар` open today's create/update flow until part 2 replaces it.
- Batch change (S12, `/seller/batch`) is not in the Pass 3 target but is a closed flow: it stays reachable from
  `Другие действия` on the list header and keeps its behavior, shown inside the cabinet frame.
- Empty: explanation plus `Добавить товар`. Loading and error per §7.1.

### Confirmation page `S-10` — `/seller/change-sets/:id`

- Stays an addressable page (accepted `S-10`, `UX_NAVIGATION_STATE_SPEC.md` §3.4). This slice rebuilds its
  presentation for every change type already supported: create, update, switch off, switch on, batch.
- **Pending:** plain title, one line of explanation, the change in seller words (what, where, price, comment; for
  update — old value next to the new one when the old value is known on the client), primary `Подтвердить`,
  secondary `Назад к правке` or `Отмена`. Desktop: summary plus a sticky confirmation panel.
- **Confirming:** button busy, no double submit.
- **Confirmed:** the page replaces itself (not a new history entry) with the list or overview that started the change;
  the card shows the canonical server state and a short success message. Browser Back does not return to an
  actionable review.
- **Failed:** message by error `code` and `Повторить`; nothing applied.
- **Conflict** (`OFFER_CHANGED`, `BATCH_OFFER_CONFLICT`): says the offer was changed elsewhere and nothing was
  applied, shows the current value re-read from the owned-offers read next to the seller's value, actions
  `Обновить` and `Отмена`.
- Deep link to a confirmed ChangeSet shows a read-only confirmed result with a link back to the list.
- Words `ChangeSet`, `ChangeItem`, `proposed`, Offer IDs never appear in the UI.

### Visual base

- Pass 3 frames use a palette and font (Inter, gold background tint, purple action) that differ from
  `DESIGN_SYSTEM.md` §2. Before UI code, this branch updates `DESIGN_SYSTEM.md` §2 to the accepted prototype tokens
  and records the font family; the Kazakh glyph coverage guaranteed by `localization-foundation` must hold for it.
  Token change applies app-wide, so buyer pages must not visibly break (they are rebuilt later, not here).
- Overlay rules from `DESIGN_SYSTEM.md` §13.1 apply to the `Ещё` menu and `Другие действия` menu.

## 3. Explicit out of scope

- Create/edit form and trading-point step (part 2); trading points and contacts redesign (part 3).
- Expired status, freshness thresholds, reconfirmation, reminders (Issues #31, #32).
- Buyer shell and buyer screens `S-01`–`S-03`; they need their own contracts.
- Batch flow redesign; seller analytics; media; any new Offer action or hard delete.
- Any change to ChangeSet creation, confirmation, atomicity, ownership or API semantics.

## 4. Closed contracts used and revisions

- **S4/S5/S12 SellerChangeSet:** every on/off and batch change still goes through ChangeSet review and confirm;
  addressable review page kept. Unchanged.
- **S1 Offer lifecycle:** only `active`/`inactive` shown. Unchanged.
- **#35 Seller entry:** anonymous handling and product-first start unchanged.
- **#36 Trading points, S10 contacts:** reused as they are.
- **UX2/UX2A seller presentation:** revised — the single stacked `/seller` page becomes the cabinet with four
  destinations. Presentation-only revision allowed by `PROJECT_RULES.md` §18.1.
- **S-10 after confirm:** revised presentation — the page now returns to the list/overview instead of staying on a
  confirmed page. Confirm semantics unchanged.

## 5. Expected areas and risk flags

Seller layout and navigation, new routes `/seller/offers`, `/seller/points`, `/seller/contacts`, overview and list
presentation, review page presentation, `DESIGN_SYSTEM.md` §2. No DB, no migration, no new mutation endpoint.

| Risk | Proof requirement |
|---|---|
| Concurrency | Conflict path proven end to end: second device changes the offer, confirm returns conflict, nothing applied, list shows server value. |
| Ownership | Foreign ChangeSet and foreign Offer stay rejected on the new routes exactly as today. |
| History | After confirm, Back does not reach an actionable review; reload of the list shows canonical state. |
| UX regression | Buyer pages still render without clipping after the token change. |

## 6. Acceptance criteria

1. Seller navigation matches Pass 3 on mobile (three items + `Ещё`) and desktop (four items), with no disabled items.
2. First-run overview shows one primary action; default overview shows real counts and recent offers, no invented numbers.
3. Offers list shows only `Активно`/`Выключено`, one primary action per card, filters with counts kept in the URL.
4. Switching an offer off or on goes through the confirmation page and returns to the list with the new canonical state.
5. Conflict and failure on confirm apply nothing, explain it in seller words and offer a safe next step.
6. Back after a confirmed change never shows an actionable review; a confirmed deep link is read-only.
7. Batch flow stays reachable and works as before.
8. No technical words or IDs appear in any seller screen.
9. Every changed surface works in `ru` and `kk`, all Kazakh strings native-verified, no clipping at 320 px.
10. Loading, offline and error follow `DESIGN_SYSTEM.md` §7.1; keyboard, focus and 44×44 px targets per §13.
11. Existing S1/S3/S4/S5/S10/S12/#35/#36/Mandatory-Price regression stays green.

## 7. Verification and manual acceptance

- E2E (mobile + desktop, `ru` + `kk`): navigation, first-run and default overview, list filters and reload, switch
  off/on through review, conflict from a second session, Back after confirm, batch still reachable.
- Integration: only if an additive overview read aggregate is introduced.
- Existing E2E suite updated only where it asserted the old stacked `/seller` layout; behavior assertions kept.
- One full regression run and branch CI on the final executable head.

Manual scenario: log in as a Seller with two points and several offers. Overview shows real counts. Open
`Предложения`, filter `Активные`, switch one off, confirm — the list shows it as `Выключено`, Back does not reopen the
review. Switch it on again. Change the same offer from a second browser while the review is open — confirm shows the
conflict and applies nothing. Repeat in `ҚАЗ` on a phone width.
