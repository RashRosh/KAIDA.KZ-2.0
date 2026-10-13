# Actuality words and one-tap «Всё актуально» — Slice Contract

**Status:** APPROVED — Product Owner, 2026-10-13, with the decisions of §6 and §6.1 and the previews of §9. Implementation has not started and needs a separate PO instruction.

**Queue:** S-ACTUALITY-WORDS, first of three independent slices ordered by PO on 2026-10-13 (then S-CONTACT-DEFAULT, then B-READABILITY; one at a time, each with its own contract, PO acceptance and checkpoint). Order and state are owned by `docs/product/EXECUTION_PLAN.md`.

**Base:** `main` at `5cb570b331965c2ad0e1c1427fcd00b1bcf5aecc` (checkpoint `v0.0.77-offer-favourites`).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1): `S01` (task block), `S15` (card screen), `S16` («Актуальность», «Всё актуально»). The mockup has no frame for the one-tap button, the undo toast, the partial-success state or the per-row confirm; the previews in §9, approved by the PO on 2026-10-13, stand in for them. Mobile, Russian (`PROJECT_RULES.md` §18.5); every new key also gets a provisional Kazakh string.

## 1. User task

A Seller keeps the showcase true in as few seconds per day as possible. The action that confirms a card is named by what the Seller is actually saying — «Товар есть, цена та же». Everything that is due and still visible to buyers is confirmed in one tap from «Моя витрина», the tap can be undone for a few seconds, and cards that cannot be confirmed are reported, not hidden. The 2 / 7 / 14 mechanic stays as it is.

## 2. PO intent (2026-10-13, source of the decisions in §6)

- The confirm action is named «Товар есть, цена та же».
- «Всё актуально» is a one-tap action from the main seller screen.
- The 2 / 7 / 14 mechanic does not change.
- Success criterion: seconds per day a Seller spends confirming.

Confirming actuality is a Seller's statement, not proof that the goods are fresh or the price is current (`EXECUTION_PLAN.md` S-ACTUALITY-WORDS). Nothing below may present it as proof, and buyer wording («Продавец подтвердил: …») does not change.

## 3. Verified facts about today's behavior (code at the base commit)

- **Main screen «Моя витрина»:** the task block («Пора подтвердить актуальность» + count, optional «· N уже скрыты с витрины») shows while any live (not archived) card is due, i.e. its oldest active point is ≥ 24 h since last confirmation (`ACTUALITY_DUE_HOURS`, default 24). Its only action is `Проверить`; it also hosts the push toggle.
- **«Всё актуально» already exists on the review list.** `Проверить` opens «Актуальность · N» (`/seller?actuality=1`): due cards oldest first (including cards already hidden from buyers at ≥ 168 h; archived excluded), a pencil per row, the hint «Проверьте, что товары есть и цены верны.», and a footer button `Всё актуально` that confirms every listed card. Taps today for any number of due cards: 2.
- **Single card:** open the card (1 tap), then `Подтвердить актуальность` with the hint «Товар есть, цена та же» (a list row and a primary button on the card screen). 2 taps per card; whether the card screen closes after confirming was not verified.
- **What a confirmation does:** `POST /api/seller/actuality/confirm` with card ids creates one ChangeSet with a `reconfirm_offer` item per switched-on point of every chosen card and confirms it at once. Only `last_confirmed_at`, `updated_at` and `revision` change. Single-card and bulk use the same endpoint and action. The batch is all-or-nothing (409 for one removed, switched-off, price-less or stale card; confirmation re-checks each item's revision).
- **Thresholds (unchanged here):** due 24 h, ageing 48 h, hidden 168 h, archive 336 h; reminders at 24 h and 144 h, keyed by (Seller, card, moment, confirmation time); buyer badges «Сегодня» … «6 дней».
- **No analytics** of confirmation time or taps exists, and none is added (Q9).
- **Existing RU strings** (`src/i18n/messages.ts`): `actuality.confirm` «Подтвердить актуальность», `confirmHint` «Товар есть, цена та же», `allGood` «Всё актуально», `confirmed` «Актуальность подтверждена», `taskTitle`, `confirmDue` (card badge), `taskHidden.*`, `hiddenFor`, `hiddenShort`, `listHint`, `confirmError`. Two keys with the old action name are used nowhere in `src` or `tests` (`review.confirmRefresh`, `offerManage.confirmFreshness`). Reminder texts live in `src/modules/reminders/config/reminders.config.ts`.

## 4. Scope

1. **Rename (Q6).** The single-card action reads «Товар есть, цена та же» on the card screen (list row and primary button); the duplicate hint is removed. Block title «Пора подтвердить актуальность», the card badge «Подтвердите актуальность» and the single-card toast «Актуальность подтверждена» are unchanged.
2. **One tap on the main screen (Q1, Q4, Q5).** Inside the task block a primary full-width button `Всё актуально · N` (≥ 44 px) confirms every live due card (≥ 24 h) except cards already hidden from buyers (≥ 168 h) and archived ones; per card, all its points together; whole showcase. N is the number of cards the tap will confirm. `Проверить` becomes a secondary button and still opens the review list. No forced-look rule. When no card qualifies but hidden cards remain, the block shows `Проверить` only; when nothing is due, the block and the button are absent (as today). Hidden cards are confirmed only after a look at the review list.
3. **Same confirmation (Q2).** Every card confirmed by the one tap gets the same `reconfirm_offer` change as the single-card action; no origin marker is stored. Consequence: the bulk request is processed as one independent confirmation per card (each its own ChangeSet), which is what makes partial success (item 5) possible.
4. **Undo (Q3).** No confirmation dialog. After the tap a toast «Подтверждено: N карточек» (RU plural forms; KK provisional) with `Отменить` stays 8 seconds; undo restores the previous confirmation time of exactly those cards. Feasibility and rules in §7.
5. **Partial success (Q8).** Every card that can be confirmed is confirmed; the rest stay unchanged; the toast reads «Подтверждено N, не удалось M» with `Посмотреть`, which opens the review list. Server impact in §7.
6. **Review list (Q10).** Each row gets a one-tap confirm (1 tap instead of 2); the pencil stays; the footer button is the same counted `Всё актуально · N` as on the main screen (hidden cards excluded; a hidden card is confirmed by its own row). No inline edit, switch-off or delete in the list.
7. **Strings.** RU and provisional KK for everything new or changed; list in §7.1. In every new or changed RU string no short preposition or conjunction may stay at the end of a line: non-breaking spaces (U+00A0) after such words, verified by a unit test over the new and changed RU keys and by a 320 px check.
8. **Untouched (Q7).** Reminder texts, push title and moments; thresholds 24 / 48 / 168 / 336 h; buyer badges and ordering.

## 5. Explicit out of scope

- Any change to 2 / 7 / 14, the due moment, reminder moments or quiet hours, the archive, buyer visibility or ranking; buyer-facing wording.
- Inline edit, switch-off or delete in the review list; automatic or scheduled confirmation; confirming on a Seller's behalf; AI.
- New analytics, events or tracking (Q9); seller statistics (S-PERF).
- Notifications other than the existing reminders; real SMS; paid services.
- Strings on screens this slice does not touch (`actuality.how*`, `archive.*`): known short-preposition line-end cases there stay as they are.
- S-CONTACT-DEFAULT and B-READABILITY.

### 5.1 Closed contracts affected

- `offer-actuality` — §2 «Seller — card screen» (action name, hint removed), «Seller — mass actuality» (button on the main screen, counted label, per-row confirm, partial success, undo), §5 risk «partial failure rolls back all» (replaced by per-card outcomes), §6 criterion 5 (still no review page).
- `S5 offer-management` — a way to restore a previous confirmation time and the stored previous time on `reconfirm_offer` items (§7).
- `seller-cabinet-overview` — layout of the task block on «Моя витрина».
- `actuality-reminders` — no wording change (Q7); the reminder cycle behaviour after undo is verified in §7 and tested.
- `post-publication-buyer-preview` — only the action name in its e2e.
- Localization rule (`PROJECT_RULES.md` §18.5): new keys in both catalogs.

## 6. PO decisions (2026-10-13)

Basis: ideal-UX basis, decided by the controller on the PO's delegation; the PO approved the contract with these decisions. Question numbers are kept from the draft.

| # | Question | Decision |
|---|---|---|
| Q1 | What the one tap confirms | Every live due card (≥ 24 h) except cards already hidden from buyers (≥ 168 h) and archived ones; per card, all points together; whole showcase. Hidden cards only after a look at the list. |
| Q2 | Same event? | Same `reconfirm_offer` ChangeSet as the single-card action; no origin marker. |
| Q3 | Undo / confirmation | No dialog. Toast «Подтверждено: N карточек» with `Отменить` for 8 s; undo restores the previous confirmation time of exactly those cards. If infeasible: no undo, count on the button (feasible — §7). |
| Q4 | Trust | Button shows the count `Всё актуально · N`; hidden cards excluded (Q1); no forced-look rule. |
| Q5 | Placement | Primary full-width button (≥ 44 px) inside the «Пора подтвердить актуальность» block; `Проверить` secondary, still opens the review list. Agent draws previews; PO approves them before implementation. |
| Q6 | Strings | Card-screen action title «Товар есть, цена та же»; duplicate hint removed; block title and card badge unchanged; bulk toast as Q3 (RU + provisional KK). Unused old keys handled in §7.1. |
| Q7 | Reminders | Reminder texts and push title unchanged. |
| Q8 | Failure | Partial success: confirm every card that can be confirmed, keep the rest unchanged, «Подтверждено N, не удалось M» + `Посмотреть` → review list. Server impact in §7. Nothing due: block and button absent. |
| Q9 | Measurement | Manual stopwatch and tap count in PO acceptance on a seeded showcase; target: all due cards confirmed in 1 tap; no new events or tracking. |
| Q10 | Per-row confirm | Yes, one tap per row in the review list; no inline edit, switch-off or delete there. |

### 6.1 Decisions on the details (PO, 2026-10-13)

- **R1 — undo after partial success:** the partial toast has `Посмотреть` only; confirmed cards of a partial batch are not undoable from it. Decided: keep.
- **R2 — per-row confirm control:** icon-only check button (≥ 44 px, `aria-label` «Товар есть, цена та же: <name>») as drawn in preview 4. Decided.
- **R3 — toast action size:** the accepted mockup defines the toast action at 32 px height; `PROJECT_RULES.md` §18.4 requires ≥ 44 px. Toast actions are 44 px, as drawn in previews 2 and 3. Permitted by the PO.
- **R4 — toast duration:** the Motion page's plain toast is 4 s; only the toast with `Отменить` stays 8 s (decision Q3). Decided.
- **R5 — server grace:** the server accepts an undo for 12 s in total from the confirmation (the 8 s toast plus 4 s for latency). Decided.
- **R6 — feedback after undo:** a plain toast «Подтверждение отменено» (KK provisional). Decided.
- **R7 — string line-end pass:** short-preposition line ends exist today in strings of the touched surfaces (`actuality.taskHidden.*`, `hiddenFor`, `hiddenShort`, `listHint`, `confirmError`; e.g. «уже скрыты с / витрины» wraps at 320 px). They are fixed in this slice with non-breaking spaces (listed in §7.1); strings on untouched screens stay. Decided.

## 7. Technical consequences

### 7.1 Strings (RU; KK provisional)

- **Changed:** `actuality.confirm` → «Товар есть, цена та же» (KK: existing «Тауар бар, бағасы сол»). **Removed:** `actuality.confirmHint`, `review.confirmRefresh`, `offerManage.confirmFreshness` (RU and KK; the last two verified unused).
- **New:** `actuality.allGoodCount` «Всё актуально · {count}»; `actuality.bulkDone` plural forms «Подтверждено: {count} карточка / карточки / карточек»; `actuality.undo` «Отменить»; `actuality.bulkPartial` «Подтверждено {ok}, не{NBSP}удалось {failed}» ({NBSP} = U+00A0); `actuality.viewList` «Посмотреть»; `actuality.confirmItem` aria-label «Товар есть, цена та же: {name}»; `actuality.undone` «Подтверждение отменено» (R6).
- **Line-end pass (R7):** `actuality.taskHidden.one/few/many`, `hiddenFor`, `hiddenShort`, `listHint`, `confirmError` get U+00A0 after short prepositions and conjunctions.

### 7.2 Q3 undo — feasibility result: FEASIBLE, additive, no fallback needed

Read from `offers.repository.ts`, `confirm-seller-change-set.ts`, `seller-change-items.table.ts`, the reminders repository, the reports and favourites modules.

- **ChangeSet / revision semantics:** a confirmation bumps `revision` and sets `last_confirmed_at` through a ChangeSet item checked against `expectedOfferRevision`. Undo is a new ChangeSet action applied the same way (expected revision = the revision the confirmation produced); it never edits or deletes the original ChangeSet. If the offer changed after the confirmation (an edit, switch-off, another confirmation), that card is not undone and is reported.
- **Previous time:** the item does not store it today. An additive nullable column on `reconfirm_offer` items records the offer's previous `last_confirmed_at` at confirmation (additive migration; existing rows unchanged). Undo reads it from there.
- **Audit trail:** both the confirmation and the undo remain as confirmed ChangeSets; nothing is rewritten.
- **First backwards write:** every other write moves `last_confirmed_at` forward; undo moves it back. No contract states monotonicity, and the code only compares it with the clock (reminders, ranking tiers, badges). `offer-actuality` §2 gets an explicit sentence that undo may restore the previous time within the window.
- **Reminders:** sent-reminder records are keyed by (Seller, card, moment, confirmation time). Restoring the old time re-matches the earlier records, so a moment already reminded in that cycle is not sent again; no reminder of the new cycle can fire within seconds.
- **Buyer badges and order:** recomputed from the restored time. Guard: undo is refused for a card whose restored age would be ≥ 168 h at that moment (a card that crossed 168 h during the window stays confirmed), so undo can never hide a card from buyers.
- **Reports:** the report evidence token includes `revision`; undo bumps it like any confirmation (existing behaviour).
- **Cost:** migration, an extra action value in the `seller_change_items_action_allowed` check and type, an undo endpoint with per-card outcomes, integration tests. No change to the thresholds.

### 7.3 Q8 partial success — server impact

- Today the bulk request is one ChangeSet and the batch is all-or-nothing: one removed, switched-off, price-less or stale card throws and the whole request returns 409; confirmation re-checks every item's revision.
- New: the bulk request is processed per card (each card its own ChangeSet, as if confirmed one by one). The response is 200 with `confirmed` and `failed` card lists (a failure carries the same reason code as today); if nothing could be confirmed it stays 409 with the first reason, so the single-card path keeps today's errors.
- Tests that change: `tests/integration/offer-actuality.test.ts` (mass reconfirm gets subset and mixed-batch cases; the refusal cases — switched-off, removed, stale — are asserted per card in bulk and unchanged for one card); `tests/e2e/offer-actuality.spec.ts` (labels, one-tap, toast with undo, partial state, per-row confirm); `tests/e2e/actuality-reminders.spec.ts` and `tests/e2e/post-publication-buyer-preview.spec.ts` (action name). `tests/integration/actuality-reminders.test.ts` and `buyer-offer-reports.test.ts` call the single-card path and keep working. New: migration/constraint tests, undo tests, catalog-completeness and non-breaking-space tests.

## 8. Acceptance criteria

1. On the card screen the action reads «Товар есть, цена та же» (RU; KK string present) in the list row and the primary button; no duplicate hint; the old keys are gone.
2. With at least one live due card not hidden and not archived, «Моя витрина» shows `Всё актуально · N` as a primary full-width button inside the task block; one tap confirms exactly those N cards; `Проверить` stays secondary and opens the review list; with none, only `Проверить` (hidden cards left) or no block (nothing due).
3. Boundary tests: cards at 23 h 59 min, 24 h, 167 h 59 min, 168 h and 336 h; only ≥ 24 h and < 168 h are in the set; a hidden card is confirmed only from its own row.
4. Each confirmed card gets the same `reconfirm_offer` change as the single-card action; thresholds, reminder moments, badges and ordering are unchanged (existing tests stay green).
5. After the tap the toast «Подтверждено: N карточек» with `Отменить` stays 8 s; undo within 12 s of the confirmation (R5) restores exactly those cards' previous times, refuses cards changed since or that would become hidden, and leaves reminders without duplicates.
6. Partial success: confirmable cards are confirmed, the rest unchanged, «Подтверждено N, не удалось M» + `Посмотреть` opens the review list; a request where nothing can be confirmed returns the reason as today.
7. The review list has a one-tap confirm per row (1 tap), the pencil, and the counted footer button; no inline edit, switch-off or delete.
8. No new RU string, nor a changed string of §7.1, has a short preposition or conjunction before a regular space (unit test); 320 px check shows none at a line end; KK keys exist for every key.
9. Tap targets ≥ 44 × 44 px (the toast actions at 44 px per R3); focus order, `role=status` / `aria-live` and keyboard use of the toast are not weakened.
10. In PO acceptance on a seeded showcase all due cards are confirmed in 1 tap; the tap count and the stopwatch time for the old and the new path are recorded.

## 9. Previews and design gaps (`PROJECT_RULES.md` §18.1)

How previews were done before: for `offer-favourites` the contract carries a static documentation gallery (`preview.html` with the shipped seller CSS inlined and synthetic data) and PNG captures, with `PREVIEW_NOTES.md`; the PO approved those previews with the contract, and the note says a static preview is not authorization or runtime proof. The same method needs no production code.

**Prepared (documentation only, outside product routes):** `preview.html` (all frames, 320 px and 390 px) and PNGs in this folder:

1. `1-main-block-320.png`, `-390.png` — task block with `Всё актуально · 3` (4 cards due, 1 already hidden) and secondary `Проверить`.
2. `2-toast-undo-320.png`, `-390.png` — toast «Подтверждено: 3 карточки» with `Отменить`; only the hidden card remains due.
3. `3-partial-320.png`, `-390.png` — «Подтверждено 2, не удалось 1» with `Посмотреть`.
4. `4-review-list-320.png`, `-390.png` — review list with per-row confirm, pencil and counted footer button.

Limits: static HTML, synthetic data, system font fallback (Roboto / Geologica are not embedded), the toast actions drawn at 44 px (R3), the per-row control drawn icon-only (R2). The PO approved these previews on 2026-10-13, including R2, R3 and R4; no design gap remains open.

## 10. Verification plan (after approval)

- Unit: due set per Q1 at the boundaries; undo rules (revision changed, would become hidden, previous time); string rule (no short preposition or conjunction before a regular space in new or changed RU keys).
- Integration: bulk per-card outcomes (subset, mixed batch with stale / removed / switched-off / price-less cards); `reconfirm_offer` shape unchanged; undo (exact cards, refused cards, reminder keys, badges); migration upgrade preserving existing items.
- E2E (mobile RU, 320 and 390): main screen states, one tap, toast and undo, partial state, review list per-row confirm, renamed action; updated existing actuality specs.
- Manual acceptance (PO, phone): seeded showcase with several due cards and one hidden card; confirm everything in one tap, undo within 8 s, repeat; compare tap count and stopwatch time with the old path; check the wording at 320 px.

## 11. Product Owner decisions

- 2026-10-13: slice scheduled first of three; intent as in §2.
- 2026-10-13: decisions Q1–Q10 as in §6 (ideal-UX basis, decided by the controller on the PO's delegation).
- 2026-10-13: the PO approved this contract with the decisions of §6 and R1–R7 of §6.1 (R5 = 12 s), and approved the previews of §9. Implementation has not started and needs a separate PO instruction.
