# Seller offer editor: create/edit form and trading-point step — Slice Contract

**Status:** DRAFT — awaiting Product Owner approval; two decisions open (§8).

**Part 2 of 3** seller UI contracts (list in `docs/slices/seller-cabinet-overview/SLICE_CONTRACT.md`). Starts after
part 1 is merged.

**UX target:** accepted Pass 3, surfaces `S-06`, `S-07`, first-run of `S-04`; `UX_NAVIGATION_STATE_SPEC.md` §2 F2–F3.

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

A Seller adds a product with a price, or changes the price and comment of an existing offer, without leaving the
cabinet; a new Seller can start with the product and create the first trading point along the way without losing
what was typed.

## 2. Scope and exact behavior

### Form `S-06` — one form, two modes

- Opens from `Добавить товар` (overview, list, empty list) and from `Изменить` on a card.
- Mobile: bottom sheet or full-screen step; desktop: dialog over the list. Same state machine in both. Overlay rules
  `DESIGN_SYSTEM.md` §13.1.
- **Create mode:** product, price, unit, comment (optional), then `Далее`.
- **Edit mode:** product and trading point shown read-only (core `update_offer` changes only price, unit and comment);
  price shows the previous value next to the field; `Далее`.
- **States:** pristine, dirty, invalid product, invalid price, submitting, submit error. Field errors sit under the
  field with a summary at the top for screen readers. Invalid product maps from `PRODUCT_NOT_FOUND` /
  `PRODUCT_AMBIGUOUS`; invalid price from the existing price rule; no new validation rules.
- Closing a dirty form asks before discarding.
- Unit: see §8, decision 1.
- The comment translation hint shown in Pass 3 (`Покупатели увидят автоперевод…`) appears only after
  `seller-comment-translation` is merged; not in this slice.

### Trading-point step `S-07` (create mode only)

- A line at the top confirms the entered product and price are kept.
- **0 points:** create the first point here — name, address as typed, type (`Магазин`/`Рынок`). Uses the existing
  seller setup / location create. If no Seller exists yet, see §8, decision 2.
- **1 point:** that point shown as chosen, with `Добавить точку` as a secondary action; one tap `Продолжить`.
- **2+ points:** explicit choice required (#36 rule); nothing pre-selected.
- Not in this slice: address suggestions (stage 1a), paste map link (stage 1), map pin confirmation. They stay out
  until their own contracts, exactly as `EXECUTION_PLAN.md` dependencies say. No inactive placeholders for them.

### Submit and confirm

- `Далее` creates the ChangeSet through the existing endpoints and opens the confirmation page from part 1.
- Before confirm nothing is visible to buyers. After confirm the Seller lands on the list or overview they started
  from with the new or updated card and a success message (part 1 behavior).
- `Назад к правке` on the confirmation page returns to the form with the same values. The unconfirmed ChangeSet is
  left as it is today; a new submit creates a new one.

### Product-first first run (#35)

- `Добавить товар` on the first-run overview opens this form at once, without requiring Seller or point first.
- Entered values survive point creation, the Seller step and a language switch within one uninterrupted flow. No
  persisted draft (as in #35).

## 3. Explicit out of scope

- Changing product or trading point of an existing offer (not supported by core; new offer instead).
- Address directory, map link, map pin, geo in this flow (geo stays on the points screen, part 3).
- Seller comment translation (localization part 3); media; AI or batch input.
- New units stored as Russian words (forbidden by `FEATURE_MAP.md`), unless decision 1 picks the unit contract.
- Any change to ChangeSet, ownership, price invariant or Offer lifecycle.

## 4. Closed contracts used and revisions

- **S4/S5 SellerChangeSet:** create and update through existing endpoints; review and confirm kept. Unchanged.
- **Mandatory Offer Price:** reused as is.
- **#35 Seller entry:** product-first continuity kept; presentation revised to the Pass 3 form.
- **#36 / S3:** `0 / 1 / 2+` point rule and atomic first setup reused. Revised presentation only: with exactly one
  point, the point is shown as chosen and the Seller taps `Продолжить` (Pass 3 `S-07` one-selected), instead of being
  applied silently.
- **UX2 first-location setup:** revised — first point is created inside the product flow instead of a separate step.

## 5. Expected areas and risk flags

Form and point-step presentation, client orchestration of existing create/setup/location endpoints. No DB, no
migration, no new mutation endpoint — unless decision 1 selects the unit contract, which then brings its own
migration and API proof.

| Risk | Proof requirement |
|---|---|
| Data loss | Values survive point creation, Seller creation, language switch and `Назад к правке`. |
| Ownership | A foreign or deleted point id in the form is rejected as today. |
| Double submit | Repeated `Далее` or `Подтвердить` does not create two offers. |

## 6. Acceptance criteria

1. Create and edit use one form in two modes, as a sheet on mobile and a dialog on desktop.
2. Edit mode changes only price, unit and comment; product and point are read-only.
3. Every Pass 3 form state exists and errors are tied to fields with an accessible summary.
4. With 0 points the Seller creates one inside the flow; with 1 it is shown chosen; with 2+ an explicit choice is required.
5. A new Seller can start with the product and reaches confirmation without retyping anything.
6. After confirm the Seller is back in the cabinet and sees the canonical new or updated card.
7. No address suggestions, map link, map pin or translation hint appear in this slice.
8. Every changed surface works in `ru` and `kk`, all Kazakh strings native-verified, no clipping at 320 px.
9. Focus, keyboard, 44×44 px targets and §13.1 overlay rules hold.
10. Existing S3/S4/S5/S12/#35/#36/Mandatory-Price regression stays green.

## 7. Verification and manual acceptance

- E2E (mobile + desktop, `ru` + `kk`): create with 0, 1 and 2+ points; edit price; invalid product and price; dirty
  close; product-first new Seller; language switch mid-form; `Назад к правке`; double-click guard.
- Unit: only for non-trivial form state transitions.
- One full regression run and branch CI on the final executable head.

Manual scenario: new account, `Продавцу`, log in, `Добавить товар`, type product and price, `Далее`, create the first
point, `Продолжить`, confirm — the card appears. Add a second point in `Точки`, add another product — the point must
be chosen. Open a card, change the price, confirm — the card shows it. Repeat once in `ҚАЗ` on a phone width.

## 8. Open Product Owner decisions

1. **Unit.** Pass 3 shows chips `кг / шт / л / упак. / другое`. `FEATURE_MAP.md` requires canonical codes before
   that ships; core stores free text today.
   Recommendation: this slice keeps today's optional free-text unit field; a separate small contract
   `offer-price-unit` (codes, localized labels, legacy values, `Другое`) follows and switches the field to chips.
   Alternative: write that contract now and make it a prerequisite of this slice.
2. **Seller name at first run.** Core requires a Seller display name when the first point is created; Pass 3 `S-07`
   has no such field.
   Recommendation: when no Seller exists, the 0-points step also asks `Как вас называть покупателям`, one field
   above the point name. Alternative: take the point name as the Seller name — rejected by default because it
   silently invents data.
