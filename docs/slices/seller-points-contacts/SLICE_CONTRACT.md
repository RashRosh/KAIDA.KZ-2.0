# Seller trading points and contacts — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-23. Implementation remains gated by the order below and
`PROJECT_RULES.md`.

**Part 3 of 3** seller UI contracts (list in `docs/slices/seller-cabinet-overview/SLICE_CONTRACT.md`). Starts after
part 2 is merged.

**UX target:** accepted Pass 3, surfaces `S-08`, `S-09`; `UX_NAVIGATION_STATE_SPEC.md` §3.3.

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

A Seller sees all trading points, fixes a name or address, adds a point, and decides which ways buyers can reach
them.

## 2. Scope and exact behavior

### Trading points `S-08` — `/seller/points`

- One card per owned point: name, address as written, type, `координаты указаны` / `без координат`, number of offers
  on the point (counted from the owned-offers read). `Добавить точку` below the list.
- Mobile: list, tapping a card opens its edit form (sheet or full-screen step). Desktop: list and detail side by
  side; the detail shows the selected point, nothing is edited without explicit selection.
- Edit changes name, address and type through the existing update endpoint; it never touches coordinates (#36).
- The existing `Я на точке` geolocation action (S8/#36) stays in the point detail as a secondary action with today's
  permission and privacy behavior. Pass 3 does not draw it, but it is a closed capability and the only way to set
  coordinates until geo fallback (stage 1).
- Not in this slice: address suggestions, map link, map pin (stages 1 and 1a).
- Loading, empty, error per `DESIGN_SYSTEM.md` §7.1.

### Contacts `S-09` — `/seller/contacts`

- One line explains that buyers see only enabled channels.
- One row per existing channel with a switch and its value: `Телефон`, `WhatsApp`, `Telegram`, `Instagram`. Pass 3
  draws three; Instagram stays because it is part of the closed S10 contact model.
- All channels off: warning `Покупатели не смогут с вами связаться` with the consequence in one sentence; saving is
  still allowed (S10 does not require a contact).
- `Сохранить` through the existing contacts endpoint; field validation messages by error `code`.
- The rejected branch's live "as the buyer sees it" preview is not part of Pass 3 and is not added.

## 3. Explicit out of scope

- New contact channels, per-point contacts, contact verification.
- Location geo semantics, deleting points, address directory, map link.
- Offer, ChangeSet or overview behavior (parts 1 and 2).

## 4. Closed contracts used and revisions

- **#36 Trading points:** identity fields, `0 / 1 / 2+` rule, ownership. Presentation revised to Pass 3; behavior
  unchanged.
- **S8 Location geo:** `Я на точке` behavior and coordinate privacy unchanged.
- **S10 Seller contacts / UX1D buyer eligibility:** data model and buyer visibility unchanged.

## 5. Expected areas and risk flags

Points and contacts presentation only. No DB, migration or API change.

| Risk | Proof requirement |
|---|---|
| Privacy | Raw coordinates never shown; only the present/absent label. |
| Data loss | Unsaved point or contact edits prompt before discard; switching language keeps them. |
| Regression | After all channels are switched off, UX1D buyer eligibility hides the Seller's Offers from Search and Nearby; restoring the required phone makes eligible Offers visible again. |

## 6. Acceptance criteria

1. Points list shows name, address, type, coordinates label and offer count for each owned point.
2. Desktop shows list and detail side by side; mobile opens a form per point.
3. Editing name, address or type never changes coordinates; `Я на точке` still works.
4. Adding a point works from this screen and the new point is offered in the part 2 point step.
5. Contacts show four channels with switches; all-off shows the honest warning and can still be saved.
6. After switching all channels off, the Seller's Offers are absent from Search and Nearby under closed UX1D
   eligibility; restoring the required phone makes otherwise eligible Offers visible again.
7. Every changed surface works in `ru` and `kk`, Kazakh native-verified, no clipping at 320 px; seller-written names
   and addresses are shown as written.
8. Loading, error, focus, keyboard and 44×44 px targets per `DESIGN_SYSTEM.md` §7.1 and §13.
9. Existing S8/S10/#36 regression stays green.

## 7. Verification and manual acceptance

- E2E (mobile + desktop, `ru` + `kk`): list, edit, add, `Я на точке` with granted and denied permission, contacts
  on/off, all-off warning, buyer eligibility after all-off and after restoring the required phone.
- One full regression run and branch CI on the final executable head.

Manual scenario: open `Точки`, rename a point, check coordinates did not change, add a second point. Open
`Контакты`, switch everything off, read the warning, save; confirm the Offer is absent from buyer Search and Nearby.
Switch the phone back on and confirm the otherwise eligible Offer is visible again. Repeat in `ҚАЗ` on a phone width.
