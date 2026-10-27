# Text duplicates — a repeated list shows existing cards instead of creating duplicates — Slice Contract

**Status:** CLOSED (PO 2026-10-27). Approved as revision 3 (PO 2026-10-27, D-1–D-6 and the stated recognition
limits); PO acceptance 2026-10-27 (§13); merged through PR #198 (head `ed80dde3`); annotated checkpoint `v0.0.84-text-duplicates` on
the merge commit (merge SHA and merged-main CI: `docs/agents/CURRENT_STATE.md`). Production text input stays `off`.

**Preview:** [preview.html](preview.html), screenshots `1-repeat-list.png` … `6-after-reload.png` (static, synthetic,
shipped seller CSS, mobile RU; not runtime proof). Rev. 3 adds no screens (PO 2026-10-27): the «possibly merged» warning
uses the existing notice line of a row, and the conflict-with-card case combines screens 1 (held row) and 4 (choices).

**Plan item:** `S-TEXT-DUPLICATES` (`docs/product/EXECUTION_PLAN.md` §5.3), part of `S-AI-INPUT` / Feature Map `S17`
(text channel). Order and state are owned by the Execution Plan.

**Base:** `main` at `71441bdb` (checkpoint `v0.0.83-text-availability` at `04fcf939` plus its closure docs).

**Sources:** Issue #75 rule 14 («перед созданием нового Offer искать дубль у того же продавца / в той же Location; при
совпадении Product + ключевых SKU-признаков предлагать обновление, а не новый дубль»), rule 12 (brands, packs, SKU
attributes are separate Offers), rule 19 (one product over several messages: no duplicates);
`SELLER_AI_FIRST_DESIGN_BRIEF.md` §8.6 (no silent duplicates of published or manual drafts). PO 2026-10-27: the same
name is not proof of a duplicate; nothing is merged, overwritten or switched on automatically; every change of an
existing Offer goes through explicit confirmation; a price update through text is a separate slice (D-1).

## 1. User task

A Seller sends a product list for the selected point again and gets understandable proposals about the cards that
already exist there, without accidental duplicate cards on the showcase.

## 2. What happens today (checked 2026-10-27)

| Fact | Where | Consequence |
| --- | --- | --- |
| Every parsed line becomes a private draft for the selected point; nothing compares it with the point's cards. Publishing a draft creates a new card. | `apply-seller-text-input.ts` (`commitDrafts`), slices 1–2 | Repeating «Сметана 1200» yields a second «Сметана» once published. |
| Real parser: a repeated mention of the same product and variant inside one message is merged into one item, and a different price silently replaces the earlier one (`price_overwritten`, only in the reducer trace). The fake parser does not merge. | `c2-reducer.ts`, `c2-pipeline.ts`, `fake-seller-text-parser.ts` | Today one message can silently keep the later of two prices. |
| A draft without a price cannot be published (price is required by the confirm path and the `offers` checks). The draft API (`PUT /api/seller/drafts/{id}`) edits a private draft. | seller-showcase-editor, mandatory-offer-price | A draft can be held «not ready» by leaving its price empty; choosing a price edits only the draft. |
| Existing ways to change a card: the card editor (`edit=`) → existing confirm (price, comment, photos); «Включить» → `activate_offer` → confirm. Both keep the revision guard. | S5, seller-showcase-editor, offer-actuality | This slice only links to them; it changes no Offer. |

## 3. Matching: candidates, not proof

The S-TEXT-AVAILABILITY matching (`matchAvailability` rules: catalog link, or every word of the stated name equal to a
title word or its reviewed form; pack equal in base units; point-only; archived stage excluded) is **suitable to find
candidates** and is reused unchanged for that. It does **not** prove that a line and a card are the same product:

- every word of «Сметана» occurs in «Сметана Простоквашино», so a shorter name finds a longer one;
- a catalog link joins different brands and variants of one Product;
- brands and characteristics are not separate fields; they live only in the title.

So this slice never says «это тот же товар». After finding candidates it **compares the supported data** of the line
with each card and shows the differences:

| Data | Same when |
| --- | --- |
| Name | the same words both ways (equal or a reviewed form), so «Сметана» ≠ «Сметана Простоквашино» |
| Pack | both known and equal in base units, or both absent; a pack with an uncertainty notice is **unknown** |
| Price unit | equal; a unit with an uncertainty notice is **unknown** |
| Price | equal amount; a price absent from the line is **not stated** |

Comment and photos are not compared (text rarely carries them) and are never listed as differences; «Без изменений»
refers only to the data in this table.

## 4. Behaviour

### 4.1 Outcomes for a line of a repeated list

| # | Case | What the Seller sees | Draft |
| --- | --- | --- | --- |
| A | One candidate on sale; name, pack and unit the same; price the same | «Без изменений» and the card | none; «Это другой товар — создать черновик» |
| A′ | As A, but the line names no price | «Без изменений · цена в тексте не указана» — only because name, pack and unit were compared and match (D-3) | none; same action |
| B | One candidate on sale with a difference or an unknown (price, name, pack, unit) | «Карточка уже есть» and the list of differences, e.g. «Цена: в карточке 1 400 ₸, в тексте 1 500 ₸», «Фасовка в тексте не указана», «В карточке название длиннее: Сметана Простоквашино». When the price differs: «Изменить цену в карточке» (existing editor → existing confirm, D-1) | none; same action |
| C | Several candidates | «Похожие карточки в точке» — each with its differences and «Открыть»; nothing pre-chosen | none; same action |
| D | The candidate is switched off | «Есть выключенная карточка» with its differences and «Открыть карточку» (existing «Включить» and confirm) | none; same action |
| E | No candidate, or only cards with a different **known** pack | the usual draft; with a different pack a note «В точке уже есть: Пельмени · 500 г — другая фасовка» | created as today |

«Без изменений» appears only in A/A′. Nothing is merged, overwritten, re-priced or switched on.

### 4.2 Two prices for one product inside one message (D-4, revised)

- Two lines are treated as **the same line of this message** only when name (both ways), pack and unit are the same.
  Different names, brands, characteristics or packs stay separate lines even when they share a Product or a word.
- Same line, same price → one line. Same line, **different prices** → one draft whose price is **empty** and marked
  «Цена не выбрана · не готов к публикации», with both prices from the text as choices: «1 200 ₸» / «1 300 ₸». A choice
  saves that price into the private draft through the existing draft API; nothing else changes. Until then the draft
  cannot be published (existing price requirement). If that line also has candidates at the point, it is shown as in
  §4.1 and the price choice appears on the draft after «создать черновик».
- **Real parser:** the reducer has already merged such mentions and kept only the later price; the pipeline reads the
  earlier one from the reducer's own `price_overwritten` record (no reducer, prompt or model change) and applies the rule
  above.
- **Conflict and existing cards (prevention comes first).** The conflict rule never bypasses §4.1. The line is first
  checked against the point's cards with its stated data (both prices are «differences» of the line, not a resolved
  price):
  - **candidates found** → the line is shown under «Уже есть в точке» with the conflict («В тексте две цены: 1 400 ₸ и
    1 500 ₸») **and** the candidate cards with their differences; **no draft is created**. Only «Это другой товар —
    создать черновик» creates one, and that draft carries the empty price and the two choices as below;
  - **no candidates** → the proposed draft is created with an empty price and the two choices; it cannot be published
    until a price is chosen or entered (existing price requirement).

### 4.3 Possibly merged positions (D-6, accepted as a known limitation)

The real parser's reducer merges mentions by its own product key; if the model gave two different products (e.g. two
brands) the same product word, they arrive as one item, and their names cannot be restored. The code does not claim
otherwise:

- A line is **possibly merged** when the reducer's own record shows that it absorbed more than one mention: a
  `price_overwritten` record, or source mentions in separate places of the message. These are the only available
  signs: their absence does **not** prove that the parser kept different products apart, and the slice does not claim
  to detect every merge (PO 2026-10-27).
- Such a line is never shown as one confidently recognised product: it carries the warning **«Возможно, здесь несколько
  товаров. Проверьте название и цену.»**, shows the Seller's original fragments of the message, and its name is marked
  uncertain (the existing «Проверьте название» notice). It is never «Без изменений».
- Correction stays in the existing editor (draft) or through «Это другой товар — создать черновик» (held line); the
  Seller can create another draft for the second product by hand. Prevention (§4.1) and the conflict rule (§4.2) apply
  as usual.
- **Out of scope:** recognising brands or separate positions (reducer/prompt/model work). A price the model dropped
  entirely is not seen.

### 4.4 End-to-end example: an existing card repeated with two prices

Point «А» has «Пельмени · 500 г, 1 400 ₸» on sale. The Seller sends «Пельмени 1400 за упаковку 500 г. Пельмени 1500 за
упаковку 500 г.».

1. Same line within the message (name, pack, unit equal) with two prices → conflict 1 400 / 1 500.
2. Prevention first: the line has a candidate (Пельмени · 500 г) → it appears under «Уже есть в точке» as «Карточка уже
   есть», with «В тексте две цены: 1 400 ₸ и 1 500 ₸», the card (1 400 ₸, «На витрине») and «Изменить цену в карточке».
3. **No draft is created**; the offer count and the card's revision stay the same; nothing is shown as ready to publish.
4. Only «Это другой товар — создать черновик» creates one draft — with an empty price and the choices «1 400 ₸» /
   «1 500 ₸» — and a repeated tap or a reload returns that same draft.

### 4.5 Review, recovery and double taps

- A section **«Уже есть в точке · N»** between the new drafts and «Нет в наличии»: the Seller's quote, the candidate
  card(s) with status, the differences, and the actions of the case. The one-line summary counts these lines.
- **Stored in the submission record** (additive JSON, 24 h, as slices 1–2 and S-TEXT-AVAILABILITY): the held lines
  (parsed line, catalog resolution, variant) and, per held line, the draft created from it. Candidates, differences and
  statuses are recomputed from current data on every view, so after a reload the section shows the cards as they are now
  (e.g. a price changed meanwhile in the editor turns B into A).
- **«Это другой товар — создать черновик»:** `POST /api/seller/text-input/{inputId}/held/{index}/draft`, owner only.
  In one transaction it locks the submission row (`SELECT … FOR UPDATE`, as slice 2 §6.4 already does for its record),
  returns the recorded draft if it still exists, otherwise creates one draft exactly as today's draft creation would
  and records its id. A double tap or a second tab waits on the row lock and gets the same draft; the button is also
  disabled while the request runs. After a reload the row shows «Черновик создан · Открыть». If that draft was deleted
  later, the action is offered again and creates a new one.
- The price choice of §4.2 is idempotent by nature (it sets one value on one draft).

## 5. Scope

### 5.1 In scope

1. Candidate lookup for new-product lines with a selected point (reused matching) and the comparison of §3.
2. Outcomes A–E; holding A–D back from automatic draft creation (D-2); E note.
3. Same-line detection inside one message and the empty-price choice (§4.2) for both parsers; reading
   `price_overwritten` from the reducer record in the real pipeline.
4. The held-line draft endpoint with the lock and record of §4.5.
5. The «possibly merged» warning with the Seller's original fragments (§4.3), from the reducer's own record.
6. Review section, links to the existing editor / card screen, RU and KK strings (KK provisional).

### 5.2 Out of scope

- Any Offer change: price update through text (→ separate slice, D-1), switching on, merging, deleting, copying photos
  or comments.
- Reducer, prompt or model changes; recognising brands or separate positions; new matching rules (§4.3, D-6).
- Matching against drafts of earlier lists; other points; manual card entry.
- Voice, photo, video, Telegram; production enablement (stays `off`).

## 6. Closed contracts and boundaries

| Contract | Treatment |
| --- | --- |
| seller-ai-text-input, seller-ai-text-real-parser | **Revision (D-2, accepted):** a line with candidates at the point is not turned into a draft automatically; within one message two prices for the same line no longer resolve silently to the later one. Idempotency, recovery, limits, logging unchanged; tests asserting «N lines → N drafts» change only where this revision applies. |
| S-TEXT-AVAILABILITY | Matching reused unchanged; «Нет в наличии» unchanged. |
| `PROJECT_RULES` §12, S5, confirm | Untouched: no change set is created; price and status changes stay in the existing editor/confirm. |
| Drafts / mandatory price | Reused: an empty price keeps a draft unpublishable; the draft API saves the chosen price. |

## 7. Risk flags

| Flag | Present | Evidence |
| --- | --- | --- |
| DB migration | No (additive JSON in the submission result) | Old submissions load. |
| Public API | Yes, additive: one POST route, response fields | Integration per code; slice 1/2 tests changed only for D-2/D-4. |
| Auth / privacy | Yes: owner and point scope | Foreign seller / point / submission refused, nothing created. |
| Concurrency / atomicity | Yes: on-request draft creation | Two concurrent requests and a repeat after reload create one draft (row lock + record). |
| Data loss | Yes: a real new product could be held as «уже есть»; a price could be lost in a conflict; two products could be merged by the parser | Every held line keeps «создать черновик»; both conflicting prices are shown; a possibly merged line shows the warning and the original fragments; nothing dropped silently. |
| External service | No | Saved answers (replay); no live model. |

## 8. Acceptance criteria

1. A repeated line whose card is on sale with the same name, pack, unit and price creates no draft and shows
   «Без изменений» with the card.
2. A line without a price shows «Без изменений · цена в тексте не указана» only when name, pack and unit match; otherwise
   «Карточка уже есть» with the differences.
3. A difference in price, name, pack or unit shows «Карточка уже есть» and each difference; for a price difference the
   link opens the existing editor, and no Offer changes without its confirmation.
4. Several candidates are listed with their differences; nothing is pre-chosen and no draft is created.
5. A switched-off candidate is shown as such with a link to the card; nothing is switched on.
6. A different known pack, or a name with other words (e.g. another brand), is never treated as «без изменений»; with
   no candidate the line becomes a draft as today.
7. Two prices for the same line in one message: with no candidate at the point, one draft with an empty price, both
   prices as choices and «не готов к публикации» (choosing saves only the draft); **with a candidate**, the conflict and
   the card(s) are shown under «Уже есть в точке» and no draft exists until «Это другой товар — создать черновик»
   (§4.4: the offer count and the card's revision are unchanged). Different names or packs stay separate lines.
8. «Это другой товар — создать черновик» creates exactly one draft under a double tap, two tabs or a reload.
9. After a reload the section, statuses and «Черновик создан» are restored from the record and current cards.
10. Only this Seller's cards at the selected point are candidates; foreign requests create nothing; no Offer is created,
    changed or switched on by this slice.
11. Lines without candidates, «Нет в наличии», `off`/`fake`/`real` modes, manual entry and publishing are unchanged.
12. A line the parser may have merged shows «Возможно, здесь несколько товаров. Проверьте название и цену.» with the
    original fragments, is never «Без изменений» and stays correctable in the existing editor.

## 9. Decisions

| ID | Question | State / recommendation |
| --- | --- | --- |
| D-1 | Price update through text | **Accepted (PO 2026-10-27):** separate slice; here the price difference and a link to the existing editor. |
| D-2 | No automatic draft for a possible match | **Accepted (PO 2026-10-27)** with the explicit «Это другой товар — создать черновик». |
| D-3 | Missing price | **Clarified (PO 2026-10-27):** missing price only means no price change is proposed; «Без изменений» only after name, pack and unit are compared and match; otherwise «Карточка уже есть» with differences (§4.1 A′/B). |
| D-4 | Two prices in one message | **Replaced (PO 2026-10-27):** show both, the Seller chooses; until then «не готов к публикации»; no gluing by Product or name (§4.2). |
| D-5 | Design gap «Уже есть в точке» | Agent-made preview (screens 1–6) for PO review before implementation. |
| D-6 | The reducer can merge different products named by one product word | **Accepted (PO 2026-10-27)** as a known limitation with the warning of §4.3; recognising brands and separate positions stays out of scope. |

## 10. Verification

- **Unit:** comparison table (§3) incl. one-way word inclusion, uncertain pack/unit as unknown, absent price; outcomes
  A–E; same-line detection (names both ways, pack, unit) and the conflict rule with and without candidates;
  `price_overwritten` and multi-mention records read from the reducer on saved C2 answers → «possibly merged».
- **Integration (PostgreSQL, fake and replay):** each outcome; held lines stored and recovered; concurrent and repeated
  draft requests create one draft; deleted draft → new one on request; price choice edits only the draft; foreign
  requests refused; offer count and every offer revision unchanged; old submissions load.
- **E2E (mobile RU, fake parser):** repeated list with A, B (price), D and E; conflict choice → draft becomes ready →
  publish works; the §4.4 example (existing card repeated with two prices → no draft, offer count and revision
  unchanged, one draft only on request); double tap on «создать черновик»; reload restores the section.
- **Regression:** existing `seller-text-*` and availability specs; `pnpm verify`; branch CI. No live model.

## 11. Manual acceptance scenario (PO, local, mobile RU, fake parser)

1. Point «А» has: Сметана Простоквашино 400 г 1 200 ₸, Пельмени 500 г 1 400 ₸, Сыр 400 г (switched off).
2. Send for «А» (fake-parser syntax): «Сметана Простоквашино 1200 за упаковку 400 г. Сметана домашняя 1500 за упаковку
   400 г. Пельмени 1500 за упаковку 500 г. Пельмени 2600 за упаковку 1 кг. Сыр 2900 за упаковку 400 г. Картошка 250 за кг.
   Картошка 300 за кг.»
3. Expect: Сметана Простоквашино «Без изменений»; Сметана домашняя — a new draft (another product); Пельмени 500 г
   «Карточка уже есть», «Цена: в карточке 1 400 ₸, в тексте 1 500 ₸» with «Изменить цену в карточке»; Пельмени 1 кг —
   a draft with «другая фасовка»; Сыр «Есть выключенная карточка»; Картошка — one draft «Цена не выбрана» with «250 ₸» /
   «300 ₸». The showcase is unchanged.
4. Choose «300 ₸» on Картошка: the draft becomes ready; publish it as usual.
5. Tap «Это другой товар — создать черновик» on Сметана Простоквашино twice quickly, then reload: one new draft,
   the row shows «Черновик создан».
6. New list for «А»: «Пельмени 1400 за упаковку 500 г. Пельмени 1500 за упаковку 500 г.» Expect (§4.4): under «Уже есть в
   точке» the conflict «1 400 ₸ и 1 500 ₸» and the card Пельмени · 500 г; no new draft and the showcase unchanged.
7. «Изменить цену в карточке» on Пельмени opens the card editor; change and confirm there; back on the review the row
   reflects the new card price.

## 12. After this slice (not an approved queue)

Price update through text (D-1 slice): one-tap «Обновить цену» and «Включить» proposals through the existing confirm;
reducer/prompt work on brands (D-6); matching against drafts of earlier lists.

## 13. Closure

- **PO acceptance (2026-10-27):** the PO reported «я принял». Nothing else is attributed to the PO.
- **ChatGPT browser check (reported by the PO; not PO acceptance, not an agent check):** ChatGPT used the acceptance
  stand in a browser and left 6 test drafts and 3 list reviews in the stand database (titles «Сметана домашняя» ×2,
  «Пельмени» ×2, «Горчица», «Сметана Простоквашино»). At closure the stand still had the 3 scenario cards unchanged
  (revision 1, statuses as seeded) and 0 change sets: no Offer was created or changed.
- **Agent checks (not PO acceptance):** browser run of the path on the stand over plain http
  ([ACCEPTANCE.md](ACCEPTANCE.md)); it found the repeated conflict notice, fixed in `115a3e57`.
- **Stand = final code:** the stand ran a production build made at 19:28 from `115a3e57` (committed 19:27); the later
  commit `ed80dde3` changed only `ACCEPTANCE.md` and `CURRENT_STATE.md`.
- **Automated:** PR #198 at `ed80dde3` — KAIDA verify 40521577717 (push) and 40521638072 (PR), CodeQL, Dependency
  review green; locally all text-input E2E specs 17/17 (one worker), integration 69/69 on a fresh test DB, unit green
  (one `typo-rules` failure in one full local run, not reproduced alone or in a second full run; search code untouched).
- **Diff audit:** new files in `seller-input` (matching/comparison) and `seller-text-input` (one line per product,
  held lines, draft on request), the review UI, i18n, one held-draft route, the fake parser pack regex. Confirm, change
  sets, the offers repository, the DB schema and the reducer, prompt and model files are unchanged; no call creates or
  changes an Offer. Additive JSON in the submission result only.
- **Known limitation of the fake parser (documented, not fixed here, not a real-parser claim):** the test parser takes
  the **first number** of a phrase as the price, so writing the pack before the price («Сметана домашняя 400 г 1500»)
  yields price 400 and no pack; the acceptance texts put the price first («… 1500 за упаковку 400 г»). This is a
  limitation of the deterministic CI/stand parser only; the real parser's behaviour is governed by slice 2 and is not
  inferred from it.
- **Not verified:** the «possibly merged» warning with a live model (replay of saved answers only); Kazakh strings
  (provisional); phone browsers other than the stand runs.
- **Follow-ups (not an approved queue):** `S-TEXT-PRICE-UPDATE` (D-1) — contract preparation requested by the PO
  2026-10-27; reducer/prompt work on brands and positions (D-6); matching against drafts of earlier lists.
