# Text price update — a new price from the text list updates one existing card after confirmation — Slice Contract

**Status:** CLOSED (PO 2026-10-28). Approved as revision 2 (PO 2026-10-27, D-1–D-5) with the three implementation
conditions of §3.5 (recorded without a new approval round, as the PO asked); PO acceptance 2026-10-28 (§12); merged
through PR #199 (head `a40805a4`); annotated checkpoint `v0.0.85-text-price-update` on the merge commit (merge SHA and
merged-main CI: `docs/agents/CURRENT_STATE.md`). Production text input stays `off`.

**Preview:** [preview.html](preview.html), screenshots `1-clear-match.png` … `6-confirm.png` (static, synthetic, shipped
seller CSS, mobile RU; not runtime proof).

**Plan item:** `S-TEXT-PRICE-UPDATE` (`docs/product/EXECUTION_PLAN.md` §5.3), D-1 of
[text-duplicates](../text-duplicates/SLICE_CONTRACT.md). Order and state are owned by the Execution Plan.

**Base:** `main` at `64b7a587` (checkpoint `v0.0.84-text-duplicates`).

## 1. User task

A Seller writes a new price for a product that already has a card at the selected point, chooses which card the line
means, reviews the proposed price change and explicitly confirms it. Ambiguous matches, conflicting prices and stale
data never change a price on their own.

## 2. What exists (checked 2026-10-27)

| Fact | Where | Consequence |
| --- | --- | --- |
| A repeated line with a possible match is held under «Уже есть в точке» with its differences (name both ways, pack, unit, price); a price difference links to the card editor. Matching only finds candidates. | S-TEXT-DUPLICATES | Entry point and comparison reused; this slice adds a proposal to the held row. |
| Changing one point's price is the existing `update_offer` item: new price, unchanged comment and shared fields, `expectedOfferRevision`. A multi-point card: the edited point gets its own price (`priceOwn`), other points keep theirs. Preparation locks the card's offers (`lockCardOffers`); confirm applies under the revision guard atomically and refreshes the point's actuality. A no-op update (same price) is refused (`OfferUpdateNoChangesError`). | `create-batch-seller-change-set.ts`, `card-fields.ts`, `create-offer-management-change-set.ts`, `confirm-seller-change-set.ts` | No new Offer mutation, guard or state. Same-price input never reaches an update, so it never refreshes actuality (D-3). |
| Proposal pattern of S-TEXT-AVAILABILITY: the client sends what it showed (offer id + revision), the server recomputes and compares in one transaction, the change set expects the shown revisions; 409 with a fresh row otherwise. | `proposeTextAvailability` | Reused; this slice adds idempotency per held line (§3.5). |
| Conflicting prices inside a message and «possibly merged» parser items are already marked (empty price, both choices, warning with original fragments). | S-TEXT-DUPLICATES §4.2–§4.3 | Reused unchanged. |

## 3. Behaviour

### 3.1 When a price change can be proposed for a card

For a held line and one of its candidate cards, «новая цена» is offered only when **all** hold:

- the card is **on sale** (`active`) at the selected point;
- the line has exactly **one** price bound with confidence, or the Seller chose one price of a conflict (§3.3);
- the line's **unit is known and equal** to the card's price unit (a unit change is out of scope, D-4);
- the line's pack does not contradict the card's (equal, or unknown on one side — unknown only blocks pre-selection);
- the new price is valid and **differs** from the card's price (the same price is «Без изменений»: no proposal, no
  actuality refresh — D-3).

Otherwise the row keeps the S-TEXT-DUPLICATES view (differences, «Изменить цену в карточке»). A switched-off card never
gets a price proposal.

### 3.2 One line → one card; pre-selection (D-1)

- The Seller chooses **one** card per line (a single choice, like a radio button). One line can never change several
  cards; there is no «apply to all similar».
- **Pre-selected** only when the line has **exactly one** candidate and name (both ways), pack and unit are **known on
  both sides and equal**, and only the price differs. Unknown is never a match: a pack missing in the text, a pack or
  unit with an uncertainty notice, or a pack missing in the card → not pre-selected.
- Several candidates, any other difference, a «possibly merged» line or a price chosen from a conflict → nothing
  pre-selected.
- The row shows each offered card as «Пельмени · 500 г · 1 400 ₸ → 1 500 ₸ / упак.» with its status.

### 3.3 Conflicting prices and possibly merged lines

- Two prices for the line: the Seller first picks one («1 400 ₸» / «1 500 ₸»); this only sets the proposed price on the
  review. The card is then chosen by hand (no pre-selection).
- A «possibly merged» line keeps its warning «Возможно, здесь несколько товаров. Проверьте название и цену.» and the
  original fragments; choosing a price does **not** confirm the name or the card; the card choice stays manual.

### 3.4 Several lines pointing at one card

- A proposal contains **at most one** price for an offer. If two lines of the review choose the same card:
  - with the **same** price → one change item;
  - with **different** prices → no proposal: both rows show «Две строки предлагают разные цены для одной карточки —
    оставьте одну» until the Seller unselects one. The server refuses such a request (409, nothing created) even if the
    client did not catch it.

### 3.5 Proposal, repetition and recovery

- «Обновить цены · N» → `POST /api/seller/text-input/{inputId}/held/price` with, per held line acted on: its index,
  the candidates as shown (offer id + revision), the one chosen offer and the price. Owner only; foreign or expired
  reviews → the existing 404.
- **One transaction**, with the submission row locked (`SELECT … FOR UPDATE`, as S-TEXT-DUPLICATES does for drafts on
  request):
  1. a recorded proposal with **the same set of changes** (same lines, same chosen offers, same prices) is returned
     instead of creating another: while it is pending (change set `proposed`, every offer still at its expected
     revision) it is reopened; once confirmed, the confirmed change set is returned and **nothing is applied again**. A
     different selection is never answered with an older pending proposal;
  2. otherwise candidates are recomputed from current data and compared with what was shown (ids and revisions), and
     §3.1 and §3.4 are re-checked for the chosen offer (current price, status, unit);
  3. any difference → 409 with the fresh rows and the choices cleared; **nothing is created**;
  4. otherwise **one** change set of `update_offer` items (existing preparation, which locks the card's offers and
     expects the shown revisions) is created, and its id is recorded per line in the submission record.
  Any error rolls back the whole transaction: no partial change set, items or record.
- A double tap, a second tab or a reload therefore returns the same pending proposal; the button is also disabled while
  the request runs.

**Implementation conditions (PO 2026-10-27, recorded without a new approval round):**

1. **The server decides admissibility.** The chosen price must come from the held line itself (its one bound price, or
   one of its conflict choices); the chosen offer must be a current candidate of that line at the submission's point and
   pass §3.1 against current data (on sale, same known unit, price differs and is valid). The client's checks are a
   convenience only; anything else → refused, nothing created.
2. **Same set → same proposal; different set → its own proposal.** Idempotency is keyed by the exact set of
   (line, offer, price). A different choice for the same lines creates its own proposal; the older one is not reused
   and stays as it is (the existing revision guard refuses whichever is confirmed second for the same offer).
3. **Cancel, decline, success.** Leaving or cancelling the confirm screen keeps the proposal pending (it reopens with
   the same set). A proposal the confirm step refused, or that became stale, is no longer pending: the Seller can choose
   again and a new proposal is created. After a successful confirmation, repeating the same request returns the
   confirmed proposal and applies nothing.
- **Recovery:** the review is rebuilt from the record and current data. A pending proposal shows «Изменение цены ждёт
  подтверждения» and «Открыть подтверждение» (the same change set). After a successful confirmation the row shows the
  result from current data (the card's price now equals the text → «Без изменений · цена обновлена»). A proposal that
  can no longer be confirmed (the card changed) is shown as such and the line can be chosen again.

### 3.6 Confirmation (D-2, D-3)

- Existing confirm screen and semantics. Display additions for price items: **point, product, pack, unit and
  «старая → новая цена»**, plus «В других точках цена не изменится» for a multi-point card.
- Stale data at confirm: the existing `expectedOfferRevision` guard refuses the whole confirmation if the card changed
  (price, status, anything that bumps its revision) since the proposal; nothing is applied (atomic).
- Confirming refreshes the point's actuality (existing `update_offer` behaviour, D-3).

## 4. Scope

### 4.1 In scope

1. Eligibility (§3.1), one-card choice and pre-selection (§3.2), conflict and merge handling (§3.3), same-card rule
   (§3.4) on held rows.
2. The price proposal endpoint with the row lock, idempotency per line, shown → proposal check and rollback (§3.5).
3. Recovery states on the review (§3.5) and confirm-screen display additions (§3.6).
4. RU and KK strings (KK provisional).

### 4.2 Out of scope

- One line changing several cards; changing other points or the card's common price; switching on; unit, pack, title,
  comment or photo changes from text.
- Price changes for lines without candidates, for drafts, or without a held row.
- Any automatic price change; parser, reducer, prompt or model changes; voice, photo, video; production enablement.

## 5. Closed contracts and boundaries

| Contract | Treatment |
| --- | --- |
| S-TEXT-DUPLICATES | Held rows gain the price choice and proposal; hold, comparison, draft-on-request, conflict and merge rules unchanged. |
| S-TEXT-AVAILABILITY | Proposal pattern reused; «Нет в наличии» unchanged. |
| S5 / seller-showcase-editor / confirm | `update_offer`, `priceOwn`, card locks, revision guard and atomic confirm reused unchanged; display-only additions. |
| Offer actuality | Unchanged: a confirmed price update refreshes actuality; a same-price line creates no update and refreshes nothing. |

## 6. Risk flags

| Flag | Present | Evidence |
| --- | --- | --- |
| DB migration | No (additive JSON bookkeeping in the submission result) | Old submissions load. |
| Public API | Yes, additive: one POST route | Integration per response code. |
| Auth / privacy | Yes: owner and point scope | Foreign seller / point / review refused, nothing created. |
| Concurrency / atomicity | Yes: double tap, two tabs, stale cards | Concurrent requests → one change set; each stale case → 409 with nothing created; injected failure → no partial proposal; revision conflict at confirm. |
| Data loss / wrong data | Yes: a price could land on the wrong card (reversible in the editor) | One card per line; pre-selection only on full known equality; old → new with point, pack and unit on confirm; other points untouched. |
| External service | No | Fake/replay parser only. |

## 7. Acceptance criteria

1. A held line with one candidate whose name, pack and unit are known and equal and whose price differs shows the card
   pre-selected with «1 400 ₸ → 1 500 ₸»; nothing changes before «Подтвердить».
2. A missing or uncertain pack or unit, a name difference, several candidates or a «possibly merged» line → nothing
   pre-selected; the Seller selects exactly one card per line, never several.
3. A different unit, an uncertain price, a switched-off card or the same price → no price proposal; the same price does
   not refresh actuality.
4. Two prices in a line: a price is chosen first, the card is then chosen by hand; the merge warning and fragments stay.
5. Two lines choosing one card: the same price → one change item; different prices → no proposal until one is
   unselected, and the server refuses it with nothing created.
6. The confirm screen shows point, product, pack, unit and old → new price (and «В других точках цена не изменится» for a
   multi-point card); after confirmation only that offer at the selected point has the new price.
7. A double tap, a second tab or a reload creates no additional change set; the pending proposal reopens with «Открыть
   подтверждение»; after confirmation the row shows the applied price.
8. A card re-priced, switched off, moved to the archived stage or a new matching card between showing and «Обновить
   цены» → 409, nothing created, fresh rows without choices; an injected failure leaves no partial change set.
9. A card changed between proposal and confirmation → the confirmation is refused and nothing is applied.
10. Foreign seller, point or review, or an expired review → refused, nothing created; lines without candidates, drafts,
    «Нет в наличии», manual editing and publishing are unchanged.

## 8. Decisions

| ID | Question | State |
| --- | --- | --- |
| D-1 | Pre-selection | **Accepted with clarification (PO 2026-10-27):** only one candidate with name, pack and unit known and equal, only the price differs; unknown is not a match; a pack missing in the text → not pre-selected. |
| D-2 | Scope of a change | **Accepted:** the selected point only; the confirm screen shows point, product, pack, unit, old → new price. |
| D-3 | Actuality | **Accepted:** a confirmed price update refreshes actuality (existing); repeating the same price does not. |
| D-4 | Unit change | **Accepted:** out of scope. |
| D-5 | Design gap | Agent-made compact preview (screens 1–6) for PO review. |

## 9. Verification

- **Unit:** eligibility and pre-selection tables (known/unknown pack and unit, name both ways, one vs several
  candidates, merged, conflict); same-card rule; price comparison with decimals.
- **Integration (PostgreSQL, fake parser):** proposal → confirm updates only the chosen offer at the point (a multi-point
  card keeps its other price); concurrent and repeated requests → one change set; pending proposal reopened; each stale
  case → 409 with nothing created; injected failure after the first item → rollback; revision conflict at confirm;
  same-card conflict refused; same price → no proposal and `last_confirmed_at` unchanged; foreign/expired refused.
- **E2E (mobile RU, fake parser):** clear match → confirm (point, pack, unit, old → new) → row updated, buyer price
  updated; several candidates → choose one; conflict → choose price → choose card; change in a second tab before
  «Обновить цены» → fresh row; leave the confirm screen, reload → «Открыть подтверждение».
- **Regression:** text-input, availability and duplicates specs; `pnpm verify`; branch CI. No live model.

## 10. Manual acceptance scenario (PO, local, mobile RU, fake parser)

1. «Точка А»: Пельмени 500 г 1 400 ₸ (also in «Точка Б» at 1 400 ₸), Сметана Простоквашино 400 г 1 200 ₸, Сметана
   Домашняя 400 г 1 300 ₸, Сыр 400 г (switched off).
2. Send for «А»: «Пельмени 1500 за упаковку 500 г. Сметана 1400 за упаковку 400 г. Сыр 3000 за упаковку 400 г.
   Картошка 250 за кг.»
3. Expect: Пельмени «1 400 ₸ → 1 500 ₸» pre-selected; Сметана — two candidates, none selected; Сыр — no price change
   (switched off); Картошка — a draft as before.
4. Choose «Сметана Домашняя», tap «Обновить цены · 2» twice quickly, leave the confirm screen, reload the review:
   «Изменение цены ждёт подтверждения» and «Открыть подтверждение» (one proposal).
5. Open it: point, product, pack, unit and old → new prices; «В других точках цена не изменится» on Пельмени →
   «Подтвердить». In «А» the prices are new, in «Б» Пельмени is still 1 400 ₸; the rows show the applied prices.
6. New list «Пельмени 1600 за упаковку 500 г.»; before «Обновить цены» change that card's price in another tab →
   «Карточки изменились — выберите заново», nothing created.

## 11. After this slice (not an approved queue)

Switching on from text; unit or pack changes from text; common price for all points; voice, photo and video reuse of the
same proposals (order not approved).

## 12. Closure

- **PO acceptance (2026-10-28):** the PO accepted the slice on the basis of the ChatGPT browser check, in the PO's
  words: «я тебе верю». No check of their own is attributed to the PO.
- **ChatGPT browser check (reported by the PO; not PO acceptance, not an agent check):** ChatGPT used the acceptance
  stand in a browser. Its remark — after a confirm refused by a price changed in another tab (review
  `248bd91a-6736-4dcc-a23e-e7258671f8ee`, proposal 1 550 → 1 600, price changed to 1 570) and «Отмена», the card was
  pre-selected again — was fixed in `a40805a4` and, per the PO, re-checked by ChatGPT on the fixed stand. ChatGPT left one
  unconfirmed proposal `7fb93927-b729-46bf-8870-2a0b0d9bf8e0` in the stand database; it was not applied and was dropped
  with the database.
- **Agent checks (not PO acceptance):** browser walk of the 6-step scenario on the stand over plain http
  ([ACCEPTANCE.md](ACCEPTANCE.md); the «other tab» of step 6 simulated by a DB write); it found the radio drawn as a thin
  bar, fixed in `5ec01e62`. After `a40805a4` the agent opened the PO's review `248bd91a…` on the fixed stand: nothing
  selected, «Карточки изменились — выберите заново» shown, «Обновить цены · 0» disabled.
- **Stand = final code:** the stand ran a production build made at 01:36 on 2026-10-28 from the working tree whose
  source equals `a40805a4` (committed 01:43 with the same source edits plus `ACCEPTANCE.md` and `CURRENT_STATE.md`; no
  source change after the build).
- **Automated:** PR #199 at `a40805a4` — KAIDA verify 40580574325 (PR) green; KAIDA verify 40580564699 (push) green on
  attempt 2 (attempt 1 failed only `search-typo-correction.spec.ts:100`, the known O-CI-FLAKE-TYPO; the same test passed in
  the PR run on the same SHA; search code untouched); CodeQL and Dependency review green. Locally: unit 725/725,
  integration 422/422 on a fresh test DB (incl. price update 10/10), price/duplicates/availability mobile E2E 8/8 with one
  worker. The stale regression assertion fails without the fix.
- **Diff audit:** price eligibility and pre-selection in `seller-input` matching; `createPriceUpdateChangeSet` (existing
  `update_offer` items through `prepareItem`); the held-price route and `proposeTextPrices` in `seller-text-input`; review
  UI, confirm-screen price rows, i18n. Confirm semantics, the revision guard, the offers repository, the DB schema
  (additive JSON in the submission result only, no migration) and the reducer, prompt, parser and model files are
  unchanged.
- **Known limitations:** the fake test parser takes the first number as the price (write the price before the pack;
  test parser only). A refused or stale proposal is never pre-selected again; the Seller chooses by hand.
- **Not verified:** a live model (fake parser and replay only); Kazakh strings (provisional); phone browsers other than
  the stand runs; a real second-tab edit in the agent walk (simulated by a DB write; the PO's remark came from a real one).
