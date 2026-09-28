# Offer actuality 2 / 7 / 14 — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-28 (decisions in §8; the self-made choices of the draft accepted as written).

**Stage 1, item 5 (part a)** of `docs/product/EXECUTION_PLAN.md`; GitHub Issue #31. Part b — reminders — is
`docs/slices/actuality-reminders/SLICE_CONTRACT.md` (Issue #32).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1): `S01`
(task «Пора подтвердить актуальность», status «Нужно подтвердить»), `S15` (card: «Подтвердить актуальность», confirmed),
`S16` (mass actuality «Всё актуально», «Как работает актуальность»), `S17` (archive list and restore), `B01` / `B02`
(buyer badges «Сегодня» … «6 дней»). Word «актуальность», never «свежесть». Mobile, Russian (PO 2026-09-27). Buyer
screens keep their current style; only the badge is added.

**Base:** `main` at `f87ccb4` (`v0.0.34-operator-post-check`).

## 1. User task

A buyer sees how recently each offer was confirmed and gets fresh offers first; offers nobody confirmed for a week
disappear. A Seller sees which cards need confirming, confirms them in one tap («Всё актуально») or fixes them, and
finds long-unconfirmed cards in an archive to restore.

## 2. Scope and exact behavior

### Actuality of an offer

- Age = now − `last_confirmed_at` of the offer (one point). Stages by thresholds in hours, read from server settings
  with defaults: `ACTUALITY_AGEING_HOURS` = 48, `OFFER_VALIDITY_PERIOD_HOURS` = 168 (existing), `ACTUALITY_ARCHIVE_HOURS`
  = 336. Boundaries: age < 48 h — fresh; 48 h ≤ age < 168 h — ageing; age ≥ 168 h — hidden from buyers; age ≥ 336 h —
  archived (a derived state, nothing is deleted or moved in storage).
- Badge text = whole days of age (⌊age / 24 h⌋): 0 → «Сегодня», 1 → «Вчера», 2…6 → «2 дня» … «6 дней». There is no
  «7 дней» badge — the offer is already hidden.
- What resets actuality to now (existing SellerChangeSet flow, no direct writes): any confirmed publish or edit of the
  offer, switching it on, a reconfirmation (below), restoring from the archive.
- A switched-off card and a card removed by an operator are not in the task, the reminders or the archive: switching
  on or republishing already confirms them.

### Buyer

- Search, Nearby, the Offer page: a badge with the text above on every result (and on the Offer page).
- Order: fresh offers before ageing ones in Search and Nearby; inside each tier the current order stays (distance when
  the buyer shared location, otherwise newest confirmation, then id). Offers ≥ 168 h are not shown anywhere (as today).

### Seller — «Моя витрина» and the card

- Task block on top (`S01`): «Пора подтвердить актуальность · N карточек» (+ «· M уже скрыты с витрины» when some are
  ≥ 168 h) with `Проверить`. A card is in the task when its oldest active point is ≥ 24 h old (the moment of the first
  reminder, part b). No block when nothing is due.
- Card row status: ≥ 168 h — badge «Нужно подтвердить» and «Скрыто с витрины до подтверждения · N дней»; otherwise the
  existing statuses. The row also shows the age badge like the buyer sees it.
- Card screen (`S15`): age badge on the photo; `Подтвердить актуальность` · «Товар есть, цена та же» confirms every
  active point of the card at once; toast «Актуальность подтверждена», badge becomes «Сегодня».
- A card's age is its oldest active point.

### Seller — mass actuality (`S16`)

- `Проверить` opens «Актуальность · N»: the due cards with price and age, the hint «Проверьте, что товары есть и цены
  верны», a pencil per row that opens the ordinary editor, and `Всё актуально` — one tap confirms every listed card
  (one ChangeSet, applied at once, no review page: nothing but the confirmation time changes). A block «Как работает
  актуальность» explains 0–2 / 2–6 / 7 / 14 days.
- Inline switch-off and delete of `S16` are out of scope (switch-off stays on the card screen; delete is not built).

### Seller — archive (`S17`)

- Cards whose every active point is ≥ 336 h leave the main list; a chip «Архив · N» on «Моя витрина» opens the list
  «Архив · N» with «Не подтверждали с <date>» per card.
- `Проверить и восстановить` opens the ordinary editor with the card's values; publishing it (usual Confirm) brings the
  card back with «Сегодня». There is no automatic deletion and no «Исчезнет через N дней» (§3).

### Reconfirmation mechanics

- New ChangeSet item action `reconfirm_offer`: the offer's current snapshot, expected revision; confirmation sets
  `last_confirmed_at` to the confirmation time and bumps the revision, nothing else. A stale revision → the existing
  «Карточку уже изменили — обновите». A removed or switched-off offer is refused (409).

## 3. Explicit out of scope

- Reminders (part b), the notification inbox / bell (`S18`).
- Automatic deletion 30 days after archiving and «Исчезнет через …»; delete / archive by the Seller.
- Inline edit, switch-off and delete inside the mass actuality list.
- Buyer sort control «Сначала актуальнее» and other sort modes (Search Sorting, later).
- Buyer screen restyle; badge colours on buyer screens beyond a neutral / warning pair.

## 4. Closed contracts revised

- S1 `offer-lifecycle`: the 7-day technical default becomes the approved buyer visibility ceiling; 2-day ageing tier.
- S5 `offer-management`: new `reconfirm_offer` action next to `activate_offer`.
- S9 `search-ranking`, S11 Nearby: fresh tier before ageing tier.
- `seller-showcase-editor`: task block, «Нужно подтвердить», archive chip; statuses list grows.
- `operator-post-check`: removed cards are outside actuality.

## 5. Risk flags

- Time boundaries: all checks use one injected clock; tests at exactly 24 / 48 / 168 / 336 h ± 1 ms.
- One visibility and one tier rule shared by Search and Nearby (no per-screen copies).
- Mass confirm of many offers in one transaction: partial failure rolls back all; a stale offer is reported.

## 6. Acceptance criteria

1. Badges «Сегодня», «Вчера», «2 дня» … «6 дней» match ⌊age / 24 h⌋ on Search, Nearby and the Offer page.
2. A fresh offer is ranked before an ageing one in Search and Nearby, with and without buyer location.
3. An offer at 168 h is not shown to buyers; at 167 h 59 min it is.
4. «Моя витрина» shows the task block with the right counts; no block when nothing is ≥ 24 h.
5. `Подтвердить актуальность` and `Всё актуально` reset age to «Сегодня» for every active point, with no review page.
6. A card ≥ 168 h shows «Нужно подтвердить · Скрыто с витрины до подтверждения · N дней».
7. A card ≥ 336 h is only in «Архив»; restore through the editor brings it back on the showcase and to buyers.
8. Switched-off and operator-removed cards are never in the task or the archive; `reconfirm_offer` on them → 409.
9. Thresholds come from settings; changing them needs no data migration.

## 7. Verification and manual acceptance

- Unit: stage and badge by age at every boundary; tier ordering; card age = oldest active point.
- Integration: reconfirm (single, mass, stale, refused); visibility and tiers in Search / Nearby; archive derivation.
- E2E (mobile): seeded offers at 1 h, 30 h, 3 days, 8 days, 15 days → badges, order, hidden, task, archive; mass confirm;
  restore from archive.

**Manual acceptance (PO, phone):** the demo seller has cards of different ages (set in the database); check the buyer
badges and order, the task block, `Всё актуально`, the hidden card, the archive and a restore.

## 8. Product Owner decisions

- 2026-09-25 (`EXECUTION_PLAN.md` item 5): actuality and reminders are in stage 1; public launch needs them.
- Issue #31: thresholds 2 / 7 / 14 days, fresh before ageing, no buyer offer ≥ 7 days, archive is not deletion.
- 2026-09-28: the archive (14 days) is built in this item — list and restore, without automatic deletion.
