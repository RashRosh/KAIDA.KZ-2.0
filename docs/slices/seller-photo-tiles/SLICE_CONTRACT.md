# Seller photo tiles — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-29 (design/permission requests of §6 answered: 1–3 yes; point 4 below is
a proposal that stands unless the PO objects).

**UX target:** mockup version `1790661153-916a` (Product Owner edit of 2026-09-29, stored in
`docs/product/mockup/seller-ai-first-rev1/`; `PROJECT_RULES.md` §18.1): `AI-S09 · Editor · Media` (`S09.dc.html`),
`States2 · Media tile`, `Motion · «Перестановка фото»` and `«Микроменю ← → · тап по фото»`, and every editor frame
that draws photo tiles (`S09b`, `OFF1`, `S14`, `S17`, `P4`). Mandatory UI rules: `PROJECT_RULES.md` §18.4.

**Base:** `claude/buyer-screens` (PR #63), then `main` once it is merged.

## 1. User task

A Seller arranges the photos of an offer card directly on the photo tiles: makes a photo the cover, deletes it, and
changes the order by long press and drag or by tapping a tile and its two arrows — without a large menu.

## 2. Scope and exact behavior

Everything below is the photo row of the card editor (`PhotoField`), used wherever the editor shows offer photos.

### Tile controls (every ready tile)

- The cover tile shows the filled star `★` (unchanged) and `×` (delete, top right).
- Every other ready tile shows `☆` (make cover, top left) and `×` (delete, top right). Tapping `☆` moves the photo
  to the first place; the star moves to it (mockup animation: the old cover star fades out, the new one scales in).
- `×` removes the photo at once (as `Удалить` did in the old menu); the removal is announced (`aria-live`).
- Uploading and failed tiles carry no `☆` / `×`; they keep progress, or `Повторить` (§6.3 for the failed case that
  cannot be retried).
- Aria labels: `Сделать обложкой`, `Удалить фото`, `Обложка` (both languages).

### Tap → selected tile with micro-menu

- Tapping a tile (not `☆` / `×`) selects it: a 2 px primary ring and, under the tile, a small dark menu with two
  buttons `←` `→` («Переместить фото влево / вправо»), a pointer «tail» to the tile. Opens 200 ms spring
  (fade + scale 0.9 → 1).
- `←` / `→` swap the photo with its neighbour (200 ms spring); the menu travels with the photo so the next tap is
  under the same finger. At the row's edge the arrow is dimmed and disabled. Position 1 is the cover.
- Tapping elsewhere closes the menu (150 ms ease-in). The menu is a `role="toolbar"` labelled «Фото N из M: порядок»;
  it is reachable and operable by keyboard; the order change is announced.

### Long press → lift and drag

- Hold 300 ms (today 350 ms): the tile lifts — `scale(1.08)` and a shadow, 150 ms — with a short haptic where the
  device offers it. It then follows the finger 1:1 with no easing or delay; neighbours move aside with a 200 ms
  spring; on release it settles into the slot in 200 ms ease-out. Released outside the row, it returns along the same
  path. The cover star follows the first place.
- Moving before the hold completes is a scroll. Uploading and failed tiles cannot be lifted.
- `prefers-reduced-motion`: no lift/scale animation and no travelling; the order changes at once.

### Removed

- The large card-style menu under the row (`Сделать обложкой / Переместить / Удалить`) is removed; its three actions
  live on the tile (`☆`, `×`) and in the micro-menu (`← →`).

## 3. Not in scope

- Limits, upload, progress, retry, size/type rules, photo storage and the `photoIds` order semantics
  (offer-photos contract) — unchanged; the change is presentation and gesture only.
- No new endpoint, no migration. Order and cover keep the existing meaning: the first id is the cover.
- Photo replace (`Заменить`) was in the previous mockup and never existed in the product; it is not added.
- Buyer-facing photo views, complaints on photos, batch/AI photo pickers (`S05`, `P2`, `B05`).

## 4. Acceptance criteria

1. A tile of a ready photo has `☆`/`★` and `×` as in `States2 · Media tile · Cover / Reorder`; a screenshot at
   360 px is indistinguishable from `S09 · Editor · Media`.
2. `☆` makes the photo the cover; `×` deletes; both work by touch and keyboard, with announcements.
3. Tap opens the micro-menu; `←` / `→` reorder with the menu following; edge arrows are disabled.
4. Long press lifts the tile, it follows the finger, neighbours make room, release settles; a scroll started
   before 300 ms does not lift.
5. Uploading/failed tiles keep their controls only (`Повторить`); they cannot be lifted or moved.
6. Reduced motion respected; no horizontal scroll from 320 px; Russian and Kazakh texts fit.
7. The saved `photoIds` order after any of these gestures is exactly the visible order.

## 5. Verification

Unit: order helpers (move, cover, delete). E2E (mobile project): make cover, delete, tap + arrows at both edges,
keyboard operation of the toolbar, the order that reaches the change set. Drag by touch is verified by manual
acceptance on a phone (Playwright cannot reproduce the feel); the lift/drop states are covered by a pointer-event
E2E. `pnpm verify` green.

## 6. Design gaps and permission requests (`PROJECT_RULES.md` §18.1)

1. **Hit area.** The mockup draws `☆` / `×` 22 px with an invisible 8 px margin (≈ 38 px) and the `←` `→` buttons
   44 × 36 px; `PROJECT_RULES.md` §18.4 requires 44 × 44. **Request:** permission to enlarge only the invisible hit
   area to 44 × 44 (the visible look stays as drawn), or a design frame. **PO: yes (2026-09-29).**
2. **Row caption.** The mockup has no caption under the row. Today's texts (`Удерживайте фото…`, the counter
   `N из 5`, the empty hint) stay unless the designer redraws them. **Request:** confirm keeping them as they are.
   **PO: yes (2026-09-29).** The retryable-failure line of the mockup («Фото 4 не загрузилось. Остальные сохранены —
   нажмите, чтобы повторить.», `S09` · Media) is drawn and is used as is.
3. **Failed tile that cannot be retried** (wrong type, too large): the mockup shows only `Повторить`. Today such a tile
   is removed through the error line under the row. **Request:** confirm keeping that line (or a frame).
   **PO: yes (2026-09-29).**
4. **Cover star on a tile that is still uploading** and first in the row: as today, the star is shown at once
   (`★` for position 1 whatever the status); `☆` / `×` appear when the photo is ready.
5. **Hit area, as built:** the tile is 72 px wide, so two 44 px targets do not fit side by side. `☆` and `×` each take
   their half of the tile's top edge — 36 × 44 px inside the tile (the tile clips overflow); the drawn 22 px look is
   unchanged. `←` / `→` are 44 × 44. If the PO wants full 44 × 44 for `☆` / `×`, the tile must grow or the buttons
   must move — a design decision.
