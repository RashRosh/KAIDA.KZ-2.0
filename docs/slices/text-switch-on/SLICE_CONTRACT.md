# Text switch-on — a seller offers a product again and returns a switched-off card after confirmation — Slice Contract

**Status:** APPROVED, revision 2 with the two final clarifications (PO 2026-10-28).
Decisions D-1–D-5 and the narrow S5 change (§5.1) accepted; implementation authorized by the PO.
Commit, push and PR authorized; merge and checkpoint tag require a further PO instruction.

**Preview:** [preview.html](preview.html), screenshots `1-same-price.png` … `7-confirm.png` (static, synthetic, shipped
seller CSS, mobile RU; not runtime proof).

**Plan item:** `S-TEXT-SWITCH-ON` (`docs/product/EXECUTION_PLAN.md` §5.3); a follow-up of
[text-availability](../text-availability/SLICE_CONTRACT.md) («снова есть» not scheduled) and
[text-price-update](../text-price-update/SLICE_CONTRACT.md) §11. Order and state are owned by the Execution Plan.

**Base:** `main` at `743b795b` (checkpoint `v0.0.85-text-price-update` + closure handoff).

## 1. User task

A Seller switched a card off («Выключить» or «… нет» in a text list). Later the product is back and the Seller simply
lists it again («Сыр 2900 за упаковку 400 г.»). Today the review holds the line as «Есть выключенная карточка» with
«Открыть карточку» (S-TEXT-DUPLICATES case D): the Seller must go to the editor and the showcase, and a price change and
the switch-on are two separate steps. Goal: from the same review, the Seller returns the switched-off card to the
showcase **only at the selected point**, through the existing confirm screen, never at a price they have not seen.

## 2. What exists (checked in code 2026-10-28)

| Fact | Where |
| --- | --- |
| Held lines and their candidates at the selected point, status `live` / `off`, archived stage excluded; switched-off candidates never get a price proposal. | `match-duplicates.ts` (`checkDuplicates`, `priceEligible`) |
| `activate_offer` sets `status = active`, refreshes `last_confirmed_at`, bumps `revision`; price and comment are **not** changed (S5 §4, §16). The item stores the offer's current price for display. | `confirm-seller-change-set.ts`, `offers.repository.ts` (`applyOfferActivation`), S5 IMPLEMENTATION_CONTRACT |
| Both creators of `activate_offer` (showcase `create-offer-management-change-set`, batch `prepareItem`) store the offer's **current** price at the expected revision. | code |
| Confirm refuses: a changed revision (`OfferChangedError`), a card without a KZT price, a card under an operator removal (`CardRemovedByOperatorError`). | `confirm-seller-change-set.ts` |
| One change set holds **at most one** management item per offer, any combination (S12 §4). | `assertNoBatchOfferConflicts` |
| `update_offer` on a switched-off offer changes the price and keeps it switched off. | `applyOfferUpdateSnapshot` |
| Proposal pattern of the text slices: the client sends what it showed (offer id + revision), the server recomputes under the submission row lock, idempotency per exact set, 409 with nothing created when stale; no pre-selection after a refused or stale proposal. | `proposeTextPrices`, `proposeTextAvailability` |
| «… нет» on a card already switched off → «Выключено раньше», no action. | text-availability §4.1 |

## 3. Behaviour

### 3.1 When a return can be proposed for a card

For a held line and one of its candidates, «Вернуть на витрину» is offered only when **all** hold:

- the card is **switched off** at the selected point, not archived, not under an operator removal;
- the line's **unit is known and equal** to the card's price unit (a unit change is out of scope);
- the line's pack does not contradict the card's (equal, or unknown on one side — unknown only blocks pre-selection);
- the line has one price bound with confidence, **or no price** (D-2), or the Seller chose one price of a conflict.

An active card keeps the closed behaviour (S-TEXT-DUPLICATES view, S-TEXT-PRICE-UPDATE price proposal). A card under
an operator removal keeps its existing state and gets no proposal; the server refuses it.

### 3.2 Price on return (D-1, D-2)

| Case | The row shows | On confirmation (one atomic, revision-guarded step) |
| --- | --- | --- |
| Same price as the card | «Вернуть на витрину · 2 900 ₸ / упак.» | switched on; price and comment unchanged; actuality refreshed |
| Different price | «Вернуть на витрину · 1 100 ₸ → 1 200 ₸ / упак.» | switched on **with the new price** at the selected point only (D-1 A, §5.1) |
| No price in the text | «Вернуть на витрину · по цене карточки 2 900 ₸ / упак.» and «В тексте цена не указана» | switched on at the card's price, shown before confirmation (D-2) |

A card never goes live at a price that was not shown as the resulting price on the row and on the confirm screen.

### 3.3 One line → one card; pre-selection (D-4)

- One card per line (single choice).
- **Pre-selected** only for exactly one candidate (switched off) whose name (both ways), pack and unit are **known and
  equal**; the price may be equal, different or absent (D-2: no price alone does not block pre-selection).
- Several candidates, an unknown or uncertain pack or unit, a name difference, a «possibly merged» line or a price
  chosen from a conflict → nothing pre-selected; the Seller chooses. Never pre-selected after a refused or stale
  proposal.

### 3.4 Conflicting prices, possibly merged lines

As text-price-update §3.3: two prices → the Seller picks the price first, then the card by hand; the merge warning and
the fragments stay; choosing a price confirms neither name nor card.

### 3.5 Mixed list: one card, one action (D-3)

One review can contain new products (drafts), price changes, «… нет» and returns. For **one card** within one review:

| Lines about the card | Result |
| --- | --- |
| One line, card switched off | Return (this slice) |
| One line, card on sale | Closed behaviour (price change or «Без изменений») |
| Two «offer» lines, the same price | One return item |
| Two «offer» lines, different prices | No proposal for that card until one is unselected (text-price-update §3.4 rule, extended to returns) |
| «… нет» **and** an «offer» line | **Contradiction for this card only:** no return, no switch-off and no price change for it from this review; both rows show «В списке для этой карточки и «нет», и предложение — уберите одну строку или измените карточку вручную»; the server refuses any proposal for this card (409, nothing created) |

Other cards and drafts are not blocked: the UI submits only admissible chosen cards; non-contradictory rows
are processed as usual (D-3 clarification). If a request nevertheless includes a forbidden card, the server
refuses the **whole request** (409, nothing created), without a partial proposal for its other cards.

### 3.6 Proposal, repetition, recovery, stale data

The held section has **one** action that creates **one** change set for the chosen rows: price updates of active cards
(`update_offer`, closed) and returns of switched-off cards (`activate_offer`, one item per card — S12 kept). The button
names what it does: «Обновить цены · N» (prices only, unchanged), «Вернуть на витрину · N» (returns only), «Применить
изменения · N» (both).

The text-price-update §3.5 conditions apply unchanged:

1. **Server decides admissibility:** the card is a current candidate of the line at the submission's point and passes
   §3.1 against current data; the price is the line's own (bound or chosen) or absent; no contradiction (§3.5); the
   client's checks are a convenience only.
2. **Same set → same proposal; a different set → its own.** A double tap, a second tab or a reload returns the pending
   proposal; after a successful confirmation repeating it applies nothing.
3. **Cancel keeps it pending; refused or stale → choose again,** with no pre-selection.

**Recovery across sections (PO clarification 2026-10-28).** A pending return can be restored only if its creation
was admissible: a review containing both an offer and «… нет» for that card never creates that return (§3.5).
The preview screen 6 therefore restores a return from a non-contradictory list. The defensive cross-section rule
below also applies to incompatible requests, including those sent outside the UI.

While a proposal from this review is **pending** for a
card (a return, a price change or a switch-off), that card gets **no other action from the same review** in any
section: its other rows show «Для этой карточки уже ждёт подтверждения: <действие>» with «Открыть подтверждение», and
the server refuses a second proposal for it (409, nothing created). After that proposal is applied, the card's rows show
the result from current data; after it is refused or becomes stale, the rows can be chosen again (no pre-selection).

**Stale data.** Shown → proposal: any change of a shown candidate (switched on elsewhere, re-priced, re-packed,
archived, removed by the operator, a new matching card) → 409, nothing created, fresh rows without choices. Proposal →
confirm: the existing revision guard refuses the whole confirmation; nothing is applied.

### 3.7 Confirmation

Existing confirm screen. For a return it shows **point, product, pack, unit, status «Выключено → На витрине» and the
resulting price** — «2 900 ₸» when unchanged, «1 100 ₸ → 1 200 ₸» when changed, «2 900 ₸ · по цене карточки» when the
text had no price — and «В других точках карточка не изменится» for a multi-point card. Only the selected point's offer
is switched on (and re-priced when the price differs). Confirming refreshes actuality.

## 4. Scope

**In scope:** §3 on held rows of a text review; the held-section proposal (route extended or added — an implementation
choice) with recovery and the cross-section rule; the contradiction rule; confirm-screen display additions; the narrow
S5 change of §5.1; one fake-parser fixture with a line without a price (test parser only: it otherwise always takes
the first number as the price); RU and KK strings (KK provisional).

**Out of scope:** switching on at other points or all points; drafts or archived cards; unit, pack, title, comment or
photo changes; any switch-on without confirmation; changes to showcase «Включить» or batch activation; parser, reducer,
prompt or model changes; voice, photo, video; production enablement.

## 5. Closed contracts and boundaries

| Contract | Treatment |
| --- | --- |
| S-TEXT-DUPLICATES | Case D («Есть выключенная карточка») gains the return choice; comparison, hold, draft-on-request, conflict and merge rules unchanged. |
| S-TEXT-AVAILABILITY | «… нет» unchanged, except: a contradiction (§3.5) removes the switch-off for that card only; a card with a pending proposal from this review gets no switch-off from it (§3.6). |
| S-TEXT-PRICE-UPDATE | Unchanged for active cards; the same-card rule, the contradiction rule and the cross-section rule extend to returns; the held button is renamed only when returns are chosen. |
| S5 offer management | **Changed narrowly (D-1 A, §5.1).** |
| S12 batch | Unchanged: one management item per offer; a return with a new price is one composite `activate_offer` item. |
| Operator post-check | Unchanged: a removed card is not offered and is refused at confirm. |
| Offer actuality | Unchanged: a confirmed return refreshes actuality. |

### 5.1 Accepted change of S5 (D-1 A, PO 2026-10-28)

**What changes.** S5 §4 and §16 say that confirming `activate_offer` never changes price or comment. Now an
`activate_offer` item **may carry a new price**, applied together with `status = active` in **one** revision-guarded
update; the `update_offer` multi-point rule applies (the selected point gets its own price; other points unchanged).
The comment never changes.

**What stays.** Showcase «Включить» and batch activation keep their behaviour exactly: they store the current price,
and confirmation changes neither price nor comment. S12's one-item-per-offer rule stays — a return with a new price is
one composite item, never two independent items.

**Why it is narrow.** No new action, no new column, no migration: the item already stores a price. The rule at confirm:
«item price numerically equal to the offer's price at the expected revision → status only (old behaviour); different →
status and price» — for the existing creators the two are always equal (comparison must be numeric: stored forms such
as «1400.00» and «1400» differ).

**Consequences.** S5 text and tests amended (§16 «an activation item may set a new price, applied atomically»); confirm
must show the price for activations; the card lock and price rule of `update_offer` are reused. Risk: a wrong price goes
live together with the switch-on — mitigated by the explicit old → new display, the revision guard and an immediate
«Выключить» or editor fix.

## 6. Risk flags

| Flag | Present | Evidence |
| --- | --- | --- |
| DB migration | No (item price reused; bookkeeping JSON in the submission result) | Old submissions and change sets load. |
| Public API | Yes, additive: held proposal route extended or added | Integration per response code. |
| Auth / privacy | Yes: owner and point scope | Foreign seller / point / review refused, nothing created. |
| Concurrency / atomicity | Yes: double tap, two tabs, stale cards, other sections | One change set per set; 409 when stale or blocked by a pending proposal; revision guard at confirm; injected failure → no partial proposal. |
| Data loss / wrong data | Yes: a wrong card or price could go live (reversible: «Выключить», editor) | One card per line; strict pre-selection; resulting price always shown; contradiction and cross-section rules. |
| Closed-contract change | Yes: S5 §4/§16 (accepted) | §5.1; S5/S12/actuality activation regression. |
| External service | No | Fake/replay parser only. |

## 7. Acceptance criteria

1. One exact known match, same price → pre-selected «Вернуть на витрину · 2 900 ₸»; after confirmation the card is on
   sale at the selected point only, price and comment unchanged, actuality refreshed.
2. A different price shows «1 100 ₸ → 1 200 ₸» on the row and the confirm screen; one confirmation switches the card on
   with 1 200 ₸ atomically; other points unchanged.
3. No price in the text → the card's price is shown as the resulting price before confirmation; pre-selection follows
   D-4 (absence of a price alone does not block it).
4. Several candidates, an unknown or uncertain pack or unit, a name difference, a «possibly merged» line or a conflict
   price → nothing pre-selected; one card per line.
5. An active card keeps the closed behaviour; an archived card or one removed by the operator gets no return, and the
   server refuses it.
6. «… нет» and an offer line for the same card → no action for that card, both rows explain it, the server refuses it;
   other rows and drafts keep their actions.
7. While a proposal from this review is pending for a card, its other rows in any section offer no action and the server
   refuses a second proposal for it; after apply / refusal the rows follow §3.6.
8. A double tap, a second tab or a reload creates no additional change set; after confirmation repeating the request
   applies nothing.
9. A shown card changed before the action → 409, nothing created, no pre-selection; a card changed before «Подтвердить»
   → the whole confirmation refused, nothing applied.
10. Showcase «Включить», batch and actuality activations behave exactly as before (S5/S12 regression); foreign seller,
    point or review, or an expired review → refused, nothing created.

## 8. Decisions (PO 2026-10-28)

| ID | Question | State |
| --- | --- | --- |
| D-1 | Different price on return | **Accepted: A.** One composite activation applies the shown new price at the selected point; price and status change atomically with the revision guard; the narrow S5 change of §5.1 accepted. Showcase and batch activation unchanged; S12 kept. |
| D-2 | No price in the text | **Accepted:** offer the card's current price, shown before confirmation; absence of a price alone does not block pre-selection under D-4. |
| D-3 | «… нет» and an offer for one card | **Accepted with clarification:** the contradiction blocks only the affected card; other non-contradictory rows are processed; the server refuses a proposal for the conflicting card. |
| D-4 | Pre-selection | **Accepted:** only a single exact match of known name, pack and unit; a possibly merged line or a price conflict needs a manual choice. |
| D-5 | Design gap | **Accepted:** compact mobile [preview](preview.html) — same price, new price, no price, ambiguous choice, contradiction in a mixed list, pending recovery, confirm. |

## 9. Verification

- **Unit:** eligibility (status, archived, removed, unit, pack), pre-selection (incl. no price), §3.2 price cases,
  contradiction and cross-section tables, numeric price equality.
- **Integration (PostgreSQL, fake parser):** return at the same price; return at a new price on a multi-point card (only
  the selected point changes, atomic with the revision guard); no-price return; the UI submits only admissible chosen
  cards from a mixed list and their proposal succeeds; a request containing both a forbidden conflicting card and an
  admissible card is refused atomically (409, no change set or items created for either card); pending proposal blocks a switch-off or price proposal
  for the same card from the same review; idempotency (double tap, concurrent, reload, repeat after success); stale
  before proposal (409) and at confirm (refused, nothing applied); removed card refused; foreign/expired refused;
  showcase, batch and actuality activations unchanged.
- **E2E (mobile RU, fake parser):** the manual scenario; regression of text-input, availability, duplicates and
  price-update specs; branch CI. No live model.

## 10. Manual acceptance scenario (PO, local, mobile RU, fake parser)

1. «Точка А»: Сыр 400 г 2 900 ₸ (switched off), Творог 500 г 1 100 ₸ (switched off; the same card in «Точка Б» at
   1 100 ₸, switched off), Кефир 1 л 600 ₸ (switched off), Пельмени 500 г 1 400 ₸ (on sale), Сметана 400 г 1 200 ₸
   (switched off).
2. Send for «А»: «Сыр 2900 за упаковку 400 г. Творог 1200 за упаковку 500 г. Пельмени 1500 за упаковку 500 г. Сметана
   нет. Сметана 1300 за упаковку 400 г. Картошка 250 за кг.»
3. Expect: Сыр pre-selected «2 900 ₸»; Творог pre-selected «1 100 ₸ → 1 200 ₸»; Пельмени — the closed price proposal
   «1 400 ₸ → 1 500 ₸»; Сметана — the contradiction note on both rows, no action; Картошка — a draft. Button
   «Применить изменения · 3». Nothing changes before «Подтвердить».
4. Tap it twice quickly, go back, reload: one pending proposal, «Открыть подтверждение»; Сметана still blocked.
5. Confirm: point, product, pack, unit, «Выключено → На витрине» and the resulting price for each return;
   «В других точках карточка не изменится» on Творог. After «Подтвердить»: in «А» Сыр 2 900 ₸ and Творог 1 200 ₸ on
   sale, Пельмени 1 500 ₸; in «Б» Творог still switched off at 1 100 ₸; Сметана unchanged.
6. No price in the text: send `[fixture:switch-on-no-price]` (a test-parser fixture added by the implementation: the
   line «Кефир за упаковку 1 л» with no price — the test parser cannot produce a line without a number). Expect Кефир
   pre-selected «Вернуть на витрину · по цене карточки 600 ₸»; the confirm screen shows 600 ₸ as the resulting price.
7. Switch Сыр off again; new list «Сыр 3000 за упаковку 400 г.»; change Сыр in another tab before the action →
   «Карточки изменились — выберите заново», nothing created.

## 11. After this slice (not an approved queue)

Switching on at all points at once; returns for drafts of earlier lists; voice, photo and video reuse of the same
proposals (order not approved).
