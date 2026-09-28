# Operator post-check — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-27 (decisions a–d in §8; the self-made choices of the draft accepted as written).

**Stage 1, item 4** of `docs/product/EXECUTION_PLAN.md` (the first part of S16, moved forward).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (version `1790522338-9552`,
`PROJECT_RULES.md` §18.1): `M06` (post-check feed, remove with reason, removed card stays in the feed) and `OFF1`
(`AI-S01 · Showcase · AI off` row «Снято оператором», `AI-S15 · Card · Removed by operator`). Revision 1 §3.0–3.2 and
`FEATURE_MAP.md` «Seller AI-first model» п. 5. Mandatory UI rules: `PROJECT_RULES.md` §18.4. Mobile and Russian only,
as for the seller screens (PO, 2026-09-27).

**Base:** `main` at `81557c1` (after `v0.0.33-seller-showcase-editor` and PR #57).

## 1. User task

While AI moderation is off, cards go live right after the Seller confirms them. A KAIDA operator opens a feed of
recently published and changed cards, removes an unsuitable card from the showcase with a reason, and can return it.
The Seller sees «Снято оператором» with the reason in plain words, fixes the card and publishes it again.

## 2. Scope and exact behavior

### Operator access

- An operator is a user whose login phone is in the server setting `OPERATOR_PHONES` (comma-separated E.164). Login is
  the ordinary phone + code flow; there is no separate admin app and no role table.
- `/operator` and every `/api/operator/*` endpoint check the session against the setting on each request. Anyone else
  gets the same answer as for a missing page (404); the site shows no link to `/operator`.
- An operator may also be a Seller or a buyer; operator rights add nothing to those roles.

### Feed (`AI-M06 · Feed`)

- One feed of events, newest first: a **new card** (confirmed `create_offer` items of one ChangeSet and one card) and a
  **changed card** (confirmed `update_offer` items). Switching a card off / on is not an event.
- A row shows: cover (or the neutral fallback), title, pack, price with unit, point name (and `+ N точек` for a card
  in several points), the Seller's login phone masked as `+7 707 ··· 12`, relative time, and the event label:
  `новая`, `изменена` or `снова после снятия` (a Seller republished a removed card). Field-level labels like
  «изменена цена» are not in this slice.
- Tabs: `Новые с моего последнего просмотра · N` (default) and `Все`. The «last view» mark is per operator and moves
  to now when the operator leaves the feed or taps `Отметить всё просмотренным`; N counts events after the mark.
- 30 rows per page, `Показать ещё`. Loading, empty (`Новых карточек нет`) and error with `Повторить` states.
- Tap on a row opens the operator card screen: all photos, title, pack, price and unit per point, comment, points,
  masked Seller phone, and the action. This screen has no frame in the mockup; it is built from mockup classes.

### Remove and return (`AI-M06 · Remove`, `AI-M06 · Feed · Removed`)

- `Снять с витрины` opens the reason screen: one reason from the list (§8 d), an optional comment to the Seller
  (up to 300 characters), `Отмена` / `Снять с витрины`. Double tap does not remove twice.
- Removal applies to the **whole card** — every point where this product is listed (§8 b).
- A removed card at once disappears for buyers everywhere: search, Nearby, the buyer Offer page (answers as an
  unavailable offer), interest notifications (S13).
- The row stays in the feed with `Снята · <reason>`, `Снял оператор · <time>` and `Вернуть на витрину`. Return is
  immediate, no reason needed; the card is visible again if it is otherwise visible (switched on, fresh, point with
  coordinates).
- Every removal and return is kept in a service log (who, when, reason, comment); the Seller does not see who acted.

### Seller side (`OFF1`)

- «Моя витрина»: a removed card shows the status `Снято оператором` and the short reason line
  `<reason> · исправьте карточку` instead of `На витрине` / `Выключено`.
- The card screen (`AI-S15 · Card · Removed by operator`): `Снято оператором`, block «Почему» with the reason in plain
  words (§8 d), the operator comment if any, `Снято <date>`, the hint «Если это ошибка или товар можно показать иначе —
  исправьте карточку и опубликуйте снова» and the action `Исправить и опубликовать снова`. The point on/off switches
  are not shown for a removed card.
- `Исправить и опубликовать снова` opens the editor with the current values; publishing goes through the usual
  Confirm with the responsibility note. A confirmed ChangeSet for the card that was **created after the removal**
  clears it: the card is at once on the showcase for buyers (§8 c) and appears in the feed as `снова после снятия`.
- A ChangeSet for the card proposed **before** the removal cannot be confirmed afterwards: the Seller sees the existing
  conflict message («Карточку уже изменили — обновите») and reopens the editor.
- Switching a removed card on (`activate_offer`) is refused (HTTP 409); the UI does not offer it.

## 3. Explicit out of scope

- Seller notifications about removal (`AI-S18` inbox, push, the bell) — S18 is outside stage 1.
- Deleting a card (`Удалить` in the frame) — «Архив и удаление карточек» in `EXECUTION_PLAN.md`.
- Removing a single point of a card; removing or blocking a whole Seller (the rest of S16).
- Complaints, appeals, clusters, the queues of `AI-M01`–`M05`, AI moderation (S32).
- Field-level change labels and a before / after comparison (`AI-M02`).
- Desktop operator layout, Kazakh operator texts, an operator management screen.

## 4. Closed contracts revised

- `seller-showcase-editor`: new status `Снято оператором` (was out of scope there); `activate_offer` refused for a
  removed card; a ChangeSet proposed before a removal cannot be confirmed.
- S5 `offer-management` / S1 `offer-lifecycle`: buyer visibility gains the «not removed» condition.
- S7 search, S11 Nearby, S13 interests, `offer-photos` buyer Offer page: a removed card is not shown / not notified.
- S2 auth: `OPERATOR_PHONES` access check on top of the ordinary session.

## 5. Risk flags

- **Access control.** Operator endpoints must never answer to a non-operator; covered by integration tests per
  endpoint.
- **One visibility rule.** «Not removed» is added to the shared buyer visibility predicate, not per screen; tests
  check every buyer path.
- **Race with a pending edit.** Handled by the «created after the removal» rule above.
- **Migration** `0017`: removal log and per-operator last-view mark; no change to existing rows.

## 6. Acceptance criteria

1. A non-operator (guest, buyer, Seller) gets 404 on `/operator` and on every `/api/operator/*` endpoint.
2. An operator sees new and changed cards newest first with cover, title, pack, price, point, masked phone, time and
   event label; the «new since last view» count and tab work.
3. Removing a card with a reason and optional comment hides every point of it from search, Nearby, the Offer page and
   interest notifications at once.
4. The removed row stays in the feed with the reason and `Вернуть на витрину`; return makes the card visible again.
5. The Seller sees `Снято оператором` with the reason in plain words and the comment on the showcase and card screen;
   there is no on/off switch; `activate_offer` returns 409.
6. `Исправить и опубликовать снова` → editor → Confirm → the card is visible to buyers again and is in the feed as
   `снова после снятия`.
7. A ChangeSet proposed before the removal cannot be confirmed after it.
8. Removal and return are written to the service log with operator, time, reason and comment.
9. Double tap on `Снять с витрины` or `Вернуть на витрину` does not create two log entries.
10. Screens follow the mockup classes; 44 px targets and focus rules of §18.4 hold on the operator screens.

## 7. Verification and manual acceptance

- Unit: reason codes → Seller texts; phone masking; `OPERATOR_PHONES` parsing.
- Integration: access per endpoint; feed composition and «since last view»; removal / return and visibility on search,
  Nearby, Offer page, interests; republish clears removal; stale ChangeSet refused; activate refused; migration 0017.
- E2E (mobile): operator removes → buyer does not find the card → Seller sees the status and reason → fixes and
  publishes → buyer finds it → feed shows `снова после снятия`; operator return flow; non-operator gets 404.
- Full `pnpm verify` before PR; branch CI and merged-main CI.

**Manual acceptance (PO, phone):** log in as an operator, find the new card, remove it with «Фото не соответствует
товару» and a comment; as a buyer check it is gone; as the Seller open «Моя витрина», read the reason, fix and publish;
as a buyer find it again; as the operator see `снова после снятия`, remove and return another card.

## 8. Product Owner decisions (2026-09-27)

a. Operator access — a list of phones in the server setting; ordinary phone + code login.
b. Removal applies to the whole card in all its points.
c. «Исправить и опубликовать снова» publishes at once, without waiting for the operator (no pre-moderation in stage 1);
   the card rises in the feed as `снова после снятия`.
d. Reasons as in `M06`, with Seller texts:
   - `Товар нельзя размещать` → «Этот товар нельзя размещать на KAIDA.»
   - `Фото не соответствует товару` → «Фото не соответствует товару.»
   - `Контакты или реклама` (shortened by PO at manual acceptance 2026-09-27; M06 had «Контакты или реклама в фото или тексте») → «В фото или тексте есть контакты или реклама.»
   - `Другое` → «Карточка не подходит для витрины.» (the operator comment explains).
   Plus an optional operator comment shown to the Seller.
