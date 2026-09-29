# Seller: edit a trading point from the offer card — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-29, with the entry rule «everywhere the Seller sees a trading point
and may want to edit it» and a pencil label as the control (§2, §6).

**UX target:** the existing return flow `AI-S09 · Editor · Returned from point` (`S09b.dc.html`) and the point screens
`AI-S12A` / `AI-S12`. There is **no frame** for the entry from a card to an existing point — see §6.

**Base:** `main` (after PR #63, buyer screens).

## 1. User task

While editing an offer card, a Seller sees which trading point(s) the card belongs to, opens the point for editing
right from the card (name, address, contacts, opening hours), saves it and comes back to the same card with everything
already typed still in place.

## 2. Scope and exact behavior

- **Entry (PO decision 2026-09-29).** Everywhere the Seller sees a trading point of theirs and may want to edit it,
  the point carries a small **label with a pencil** (`Изменить`, icon `i-pencil`, hit area 44 × 44). Surfaces:
  the card editor in every mode (new card — selected point row and the point-choice sheet; «Изменить карточку»;
  «Изменить в точке»), the card screen list «В точках» (`AI-S15`), and the list «Изменить также в других точках».
  The «Точки» screen already edits points and is not touched. Where a point is shown to the Seller only inside a
  read-only summary (change-set confirmation), no label is added — the Seller leaves through the editor.
  The label never replaces the row's own tap action (selecting a point, opening a card).
- **Where the point opens.** As a screen **inside the editor**, not a route change, exactly like the existing
  `Новая точка` / `Цены по точкам` sub-screens of the card editor. The card form stays mounted underneath, so no typed
  value, photo, selected point or price override is lost.
- **Content.** The same point editor the seller already has on «Точки» (fields, validation, contact verification,
  opening hours, geolocation) — one shared component used in both places, not a second copy. Saving uses the existing
  point API; nothing changes in what a point stores.
- **Return.** `Сохранить` saves the point and returns to the card; the row shows the new name/address at once and a
  toast `Точка сохранена` appears. `Назад` with unsaved point changes asks the same discard question as the editor
  (`Закрыть без сохранения?`) — for the point only; the card form is not discarded.
- **The card's own unsaved changes are never saved or sent by opening the point.** The card is saved/sent only by its
  own buttons.
- **Effect on the card.** Editing a point changes the point everywhere (all its cards, on the showcase and for
  buyers); the screen says so (`Изменения точки действуют для всех её карточек`). Editing a point never creates a
  change-set for the card.
- **Not available while sending.** During `Отправляем…` the action is disabled with the rest of the form.
- Russian and Kazakh; §18.4 rules (44 × 44 targets, focus returns to the `Изменить точку` button on return,
  `role`/aria for the screen change).

## 3. Not in scope

- No new point fields, no change to verification/hours rules (point-contacts-hours contract), no change to the
  «Точки» screen itself.
- Creating a new point from the card stays as today (`Новая точка`).
- Deleting a point or switching a card to another point.
- Browser Back/route history for the sub-screen beyond what the existing sub-screens do.

## 4. Acceptance criteria

1. Both editor modes show `Изменить точку` on the card's point(s).
2. Tapping it opens the point editor over the card; typing in the card, then opening a point and coming back, keeps
   every field, photo and choice.
3. Saving a point returns to the card with updated name/address and the toast; `Назад` asks only when the point has
   unsaved changes.
4. The point saved from the card is identical to one saved on «Точки» (same validation, same API, same result).
5. Nothing is sent for the card, no change-set is created, by opening or saving the point.
6. Focus returns to the button; both languages fit from 320 px; no regressions on «Точки».

## 5. Verification

Unit/integration: the point editor component is used by both screens; point save API unchanged. E2E (mobile):
type into a card → open point → edit → save → card fields intact; discard question for point-only changes; the
same point edit from «Точки». `pnpm verify` green; manual acceptance on a phone.

## 6. Design gaps and permission requests (`PROJECT_RULES.md` §18.1)

1. **No frame** for the pencil label and for the point editor as a sub-screen of the card (title, back behaviour).
   The PO proposed the control himself: a label with a pencil. **Answer (PO, 2026-09-29):** build it from existing
   mockup pieces — the pencil icon and small-button style of the mockup, and the `AI-S12A` screen as the sub-screen;
   the designer may redraw later. Implementation is checked against the PO's phone acceptance.
2. **Which modes:** everywhere a point is shown and may be edited (§2). **Answer: yes.**
3. **Wording of the warning** that the point changes for all its cards (proposal above) — stands unless the PO
   changes it.
