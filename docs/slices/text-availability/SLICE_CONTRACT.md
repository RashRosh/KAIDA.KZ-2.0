# Text availability updates — «нет в наличии» for existing offers — Slice Contract

**Status:** APPROVED, revision 3 (PO 2026-10-27), including D-A–D-D and the limitation on unrecognised pack wording
(§4.1 item 1). Implementation authorized by the PO on 2026-10-27 on a separate branch; merge and checkpoint tag need a
separate PO instruction. PO manual acceptance of the working scenario is still pending.

**Preview:** [preview.html](preview.html) with screenshots `1-mixed-before.png` … `8-reload-pending.png` (static,
synthetic, shipped seller CSS, mobile RU; not runtime proof). Accepted by the PO as the basis for implementation.

**Plan item:** `S-TEXT-AVAILABILITY` (`docs/product/EXECUTION_PLAN.md` §5.3), part of `S-AI-INPUT` / Feature Map `S17`
(text channel). Order and state are owned by the Execution Plan.

**Base:** `main` at `d084fedd038c43646f7cacad825b668b300b3703` (checkpoint `v0.0.82-buyer-readability`; text-input code
equals `v0.0.81-seller-ai-text-real-parser`).

**Source decision (PO 2026-10-22, acceptance of slice 2,
[handoff](../seller-ai-text-real-parser/PO_ACCEPTANCE_HANDOFF.md)):** «нет в наличии» is a proposed change; matching
existing cards are searched only in the explicitly selected trading point; the proposed action is shown and confirmed
through the existing change set / confirmation screen; several matches → the Seller chooses; no match → explain. Never
hide cards silently; never create a new-product draft from «нет в наличии».

## 1. User task

A Seller writes in the text list that a product is no longer available, reviews the proposed change to the existing
offer at the selected trading point, and explicitly confirms it.

## 2. What exists today (checked 2026-10-27)

| Fact | Where | Consequence |
| --- | --- | --- |
| Offer lifecycle has two statuses: `active` and `inactive`. Seller action «Выключить» (hint «Скрыть с витрины на время») creates a `deactivate_offer` change item; «Включить» (`activate_offer`) returns the card. Buyers see only `active` offers within the actuality window. Archive (`archived` stage) is an actuality stage, not a status; there is no deletion of offers. | `offers.table.ts`, `offer-lifecycle.ts`, S5 offer management, `offer-actuality` | «Нет в наличии» maps to the **existing «Выключить»** for the offer at the selected point. No new state, no deletion, expiry or archiving (§5.1). |
| `deactivate_offer` items carry `targetOfferId` + `expectedOfferRevision`. Confirm locks the change set, items and cards, re-checks ownership and point, refuses a changed revision (`OfferChangedError`), applies the deactivation guarded by the revision (revision + 1) and returns the final view when the set is already confirmed. | `confirm-seller-change-set.ts`, `offers.repository.ts` | Changes between review and confirmation and repeated confirmation are already covered; this slice adds no new guard. |
| A batch change set may hold several `deactivate_offer` items, all applied atomically; the confirm screen shows «Выключение предложения» with the point per item. | S12 batch, `create-batch-seller-change-set.ts`, `SellerConfirmChange.tsx` | Several confirmed statements become **one** change set and **one** confirmation. The confirm screen is reused unchanged. |
| The real parser's reducer already marks out-of-stock claims (`status: none` → `available: false`, variant by unit/pack when stated). The pipeline currently lists them under «Не распознано» with «Отметка «нет в наличии» — измените карточку вручную». | `c2-reducer.ts`, `c2-pipeline.ts`; slice 2 §6.3 | No model, prompt or reducer change is needed: the pipeline routes these items differently and applies its existing pack/unit guards to them (§4.1 item 1). |
| A text submission is tied to one point (`locationId`, part of the request identity) and keeps a 24-hour result record that rebuilds the review (recovery, replay). | slice 2 §6.4, §16 | Availability proposals live in the same record; no new table. |
| Saved C2 answers include mixed messages with out-of-stock statements («Есть курага, кабачки и лук. Перца нет в наличии», «Лука нет в наличии. Баранина — 3730…», «Моркови нет в наличии»). | `tests/fixtures/seller-text-real-parser/control28.json` | Deterministic replay evidence; no live model run is needed. |

## 3. Closed contracts and boundaries

| Contract / rule | How this slice treats it |
| --- | --- |
| `PROJECT_RULES` §12 | Input → `SellerChangeSet` (`deactivate_offer` items) → explicit confirm → Offer. The parser and the matching code never write an Offer. |
| S5 offer management / batch S12 / confirm | Same action, revision guard and replay. Confirm screen: two display-only additions — a «Фасовка» line on `deactivate_offer` items (today the pack is shown only for card publication, so «Пельмени 500 г» and «Пельмени 1 кг» would look the same) and, when opened from a text review, a «К списку из текста» link on the done state. No change to confirm semantics. |
| [seller-ai-text-real-parser](../seller-ai-text-real-parser/SLICE_CONTRACT.md) (slice 2) | **Revision required (STOP item, §9 D-A):** §6.3 «Out-of-stock mentions → «Не распознано»» and AC 8 change: out-of-stock statements move to the new «Нет в наличии» section. Everything else (drafts, safeguards, idempotency, recovery, limits, logging) is unchanged. The E2E assertion `seller-text-real-parser.spec.ts` («нет в наличии» in `text-skipped-block`) is updated only because the approved revision changes that behaviour (`PROJECT_RULES` §18.5). |
| [seller-ai-text-input](../seller-ai-text-input/SLICE_CONTRACT.md) (slice 1) | Unchanged; the `fake` parser gains deterministic fixtures with out-of-stock statements for CI. |
| Offer actuality / actuality-words | Unchanged. A switched-off card is not reconfirmed; «Включить» stays the way back. |
| Operator removal | Unchanged. Switching off a removed card is allowed as today; switching on stays blocked. |
| Data residency, logging (slice 2 §6.5) | Unchanged. Stored availability entries hold the same kind of data as skipped entries (label, quote ≤ 500, offer IDs); logs get counts only. |

## 4. Scope

**One slice.** Mixed input needs no split: the reducer already separates new products from out-of-stock statements;
this slice only routes the latter to matching and a confirmable proposal. Drafts and availability have independent
paths and can be verified separately inside one review.

### 4.1 In scope

1. **Parse result:** out-of-stock statements become a separate list `unavailable` instead of `skipped`; real pipeline
   and `fake` parser both fill it. Each statement: label, source quote, and a **variant** with one of three states:
   - `none` — no pack or unit words in the statement;
   - `bound` — pack and/or unit stated and confirmed by the slice-2 safeguards (value given);
   - `uncertain` — pack or unit words are present but not recognised or not bound with confidence (the written words
     are kept for the warning).
   A statement never yields a draft (already true; kept and tested).

   *Can the current parser tell them apart?* Partly. For new-product lines the pipeline already raises the needed
   signals (pack mismatch against the quote, `unit_unrecognized`, `size_count_or_volume_ambiguous`, unbound unit), but
   out-of-stock claims skip that mapping, and the unit guard drops a `none` claim's unit without recording it.
   **Minimal solution, no model/prompt/reducer change:** run the same existing guards for out-of-stock claims and,
   in addition, look for pack/unit words with the existing size and unit patterns in the seller's own sentence that
   contains the quote. Any signal, any pack/unit word not taken into a confirmed value, or a quote not found in the
   text → `uncertain`; nothing found → `none`.
   **Limitation:** wording that the existing patterns do not recognise as a pack or unit («в больших банках»,
   «двойная пачка») counts as `none`. The pack line on the confirm screen (item 7) remains the Seller's check for it.
2. **Matching** (channel-independent application function in the seller-input module, called by the text channel;
   input = Seller, point, statements; output = candidates per statement). Candidates are the Seller's offers **at the
   submission's point only**, queried server-side by seller and location, archived-stage offers excluded (same set as
   «Товары точки»). An offer matches a statement when:
   - the statement resolves exactly to a catalog Product (existing `resolveProduct`) and the offer is linked to it; or
   - every word of the statement matches a word of the offer title exactly or as a reviewed word form (existing search
     word-forms dictionary). Prefix-only matches (`лук` → `Лукум`) do **not** count.

   **Pack and unit.** The product name decides *which product*; the variant decides *which offer*:
   - `bound` pack («пельменей по 1 кг нет», «сметаны 200 г нет»): only offers whose pack is equal in base units
     (1 кг = 1000 г, 0,5 л = 500 мл) are candidates. Offers of the same product with another pack or with no pack are
     listed as «Другая фасовка — не изменится», never selectable, and refused by the endpoint. If no offer has that
     pack, the statement is «not found» for that pack, with the other packs listed the same way.
   - `bound` unit without a pack («картошки на кг нет»): only offers with that price unit are candidates; others are
     listed as «Другая единица — не изменится».
   - `none` («пельменей нет»): every offer of that product at the point is a candidate; one → pre-ticked, several →
     none ticked (D-C).
   - `uncertain` («сметаны 0,4 кг и 1 кг нет» where the binding is ambiguous): every offer of that product is a
     candidate and **none is pre-ticked, even when there is only one**. A short warning shows the Seller's words:
     «Фасовку «{words}» не удалось сопоставить — отметьте сами».
3. **Outcome per statement.** The statements (label, quote, variant) are stored in the submission result when drafts
   are created; **candidates are computed from current data every time the review is shown** and again when a proposal
   is created (item 5). Outcomes:
   - exactly one matching offer, selectable, and variant `none` or `bound` → pre-ticked;
   - several matching offers (even when the others are already switched off or pending — e.g. on return after one pack
     was switched off), or variant `uncertain` → listed, none ticked (implementation clarification 2026-10-27: a
     remaining pack is never ticked for the Seller);
   - matching offers that are all already switched off → «Выключено раньше», no action;
   - no match → «Нет такой карточки в этой точке» with a link to «Товары точки».
4. **Review screen** (preview screens 1–8):
   - A one-line summary at the top: counts only («2 новых товара · 1 к выключению · 1 ждёт выбора»; after actions
     «Опубликовано 1 · выключено 2 · ждут решения 2»).
   - New-product drafts stay as today («Черновик»; published drafts leave the list and are counted «Опубликовано из
     этого списка: N»).
   - Section «Нет в наличии · N» between the drafts and «Не распознано». Each statement is headed by the Seller's quote;
     a note appears **only when needed** (choice required, pack warning, not found, changed). Each candidate row shows
     title with pack, price with unit and a **status badge**: «На витрине» (selectable), «Ждёт подтверждения» (in an
     unconfirmed proposal of this list), «Выключено по этому списку», «Выключено раньше». Only «На витрине» rows have a
     checkbox.
   - The confirmation rule is stated **once**, above the button: «Ничего не выключится до «Подтвердить» на следующем
     шаге.» Button «Выключить отмеченные · N», disabled at N = 0.
   - **After reload or return** the review is rebuilt from the submission record and current offers; ticks follow
     item 3. An unconfirmed proposal of this list is shown with «Выключение N карточек ждёт подтверждения» and
     «Открыть подтверждение».
5. **Proposal endpoint:** `POST /api/seller/text-input/{inputId}/availability`. Body: for each statement the Seller
   acted on, its index, the candidates **as shown** (offer ID + `revision`) and the ticked offer IDs. Owner only
   (unknown or foreign `inputId` → the existing 404). In **one transaction** the server recomputes each statement's
   candidates from current data and compares them with what was shown:
   - same offers, same revisions, ticked offers still selectable → creates **one** change set of `deactivate_offer`
     items through the existing batch creation service, with `expectedOfferRevision` = the revision the Seller saw;
     records the change-set id in the submission record (bookkeeping only, as slice 2 §16 does for published drafts);
     returns it; the client opens the existing confirm screen with `back` to the review;
   - any difference (a candidate edited, switched off or on, re-priced, re-packed, re-titled, reconfirmed, moved to
     the archived stage, or a new matching card added) → 409 `TEXT_AVAILABILITY_CHANGED` with the fresh candidates;
     **nothing is created**. The review replaces the statement, clears its ticks (no pre-tick, even for one
     candidate) and shows «Карточки изменились — отметьте заново».

   `revision` is the existing per-offer version: every offer write (update, switch-off/on, reconfirm and its undo)
   increments it. Changes that do not write the offer (time moving a card to the archived stage, a new card at the
   point) are caught by comparing the candidate set. Statuses «Ждёт подтверждения» / «Выключено по этому списку» are
   derived from the recorded change sets and current offers; nothing else is stored.

   **Exact guarantee (implementation clarification, PO instruction 2026-10-27: no stronger guarantee than needed).**
   No row is locked. The comparison is a consistency check at proposal time; when the proposal is created each chosen
   offer is re-read and must still have the revision the Seller saw, otherwise nothing is created (409). A card
   committed by another request after the comparison is not seen by it — locking existing rows would not prevent that
   either — and it cannot affect the chosen offers. Correct confirmation of the chosen offers rests on the existing
   confirm guard (`expectedOfferRevision`), which refuses any change made after the proposal.
6. **Mixed input:** new-product drafts and availability proposals come from one submission and appear on one review.
   They are independent: publishing a draft does not switch anything off; confirming availability does not publish
   drafts.
7. **Confirm screen, display only** (§3): a «Фасовка» line on `deactivate_offer` items and a «К списку из текста» link
   on the done state when opened from a text review. Confirm semantics unchanged.
8. RU and KK strings (KK provisional).

### 4.2 Out of scope

- «Снова есть» / switching on through text; price or other changes to existing offers through text (today a repeated
  product name creates a new draft); deleting, archiving or expiring offers; a new availability state or stock
  quantity.
- Changes to the model, prompt, demonstrations, reducer rules, inference service or production enablement (stays `off`).
- Statements about other points or «везде»; multi-point actions; matching drafts.
- Voice, photo, video, Telegram; any new channel abstraction beyond the one matching function.
- DB migrations; changes to confirm or change-set semantics, to the confirm screen beyond the two display additions of
  item 7, or to actuality.

## 5. Behaviour decisions

### 5.1 Confirmed action

The confirmed action is the existing **«Выключить»** for the offer at the selected point: the offer becomes
`inactive`, buyers stop seeing it, it stays on «Моя витрина» as «Выключено» and returns with «Включить». The same card
in other points is untouched. Nothing is deleted, archived or expired. This is the only lifecycle state that matches
«temporarily not available». The Seller's statement is never treated as permission by itself: the change happens only
on the existing confirm screen.

### 5.2 Wrong-offer protection

Point-only server query; exact or word-form matching only; several matches or an `uncertain` pack never pre-ticked;
another pack is never selectable; every candidate named with title, pack, price and status on the review and with
pack and point on the confirm screen; the endpoint accepts only current candidates that match what the Seller saw
(a forged or stale ID is refused).

### 5.3 Changes between showing, proposal and confirmation; repetition

- Shown → proposal: the endpoint recomputes candidates and compares IDs and revisions with what was shown, in one
  transaction (§4.1 item 5); any difference → nothing created, fresh result, new choice.
- Proposal → confirm: existing `expectedOfferRevision` guard; an edit, switch-off, reconfirmation or price change in
  between refuses the whole confirmation with the existing message, nothing is applied.
- Repeated confirm returns the confirmed result (existing). A second proposal for the same offers cannot apply twice:
  after the first confirm its revision guard refuses it. The button is disabled while the request is in flight.
- Replay of the same `requestId` returns the stored statements without re-parsing or creating anything; candidates
  are shown from current data, as on any review.

## 6. Affected modules and boundaries

- `seller-text-input`: parse-result type (`unavailable` with variant state), pipeline routing and existing pack/unit
  guards applied to out-of-stock claims, `fake` fixtures, submission result (additive JSON field: statements and
  proposal ids; rows without it read as empty), new route, review UI.
- `seller-input`: one matching/proposal application function (candidates from current data; shown-vs-current
  comparison and change-set creation in one transaction); reuses batch change-set creation; confirm semantics
  unchanged.
- Read-only reuse: `offers` (point offers), `catalog` (`resolveProduct`), `search` word-forms dictionary.
- UI: `SellerTextInputReview` and i18n (RU/KK); confirm screen display-only additions of §3. Showcase and buyer
  surfaces unchanged.

## 7. Risk flags

| Flag | Present | Evidence required |
| --- | --- | --- |
| DB migration | No. The submission result gains an optional JSON field | Old submission rows without the field load and recover. |
| Public API | Yes, additive: one POST route; `unavailable`/`availability` fields in text-input responses | Integration tests per code; slice 1/2 API tests unchanged. |
| Auth / privacy | Yes: ownership and point scope | Foreign seller, foreign point, foreign `inputId`, forged `offerId` refused with nothing created. |
| Concurrency / atomicity | Yes: shown → proposal compared in one locked transaction; proposal → confirm by the existing revision guard | Each kind of change between showing and proposal (edit, switch-off, reconfirm, new matching card, archived stage) → 409, nothing created; revision conflict between proposal and confirm; repeated confirm; double proposal. |
| Data loss | Yes: a wrong card could be hidden from buyers. Reversible («Включить»), nothing deleted | Nothing changes before confirm; only ticked offers at the point change. |
| External service | No new dependency; parser unchanged | Replay of saved C2 answers; no live run. |

## 8. Acceptance criteria

1. A text with an out-of-stock statement for a card at the selected point shows that card under «Нет в наличии» as a
   proposed «Выключить»; no offer changes until confirmation.
2. «Выключить отмеченные» opens the existing confirm screen listing each card with its point; after «Подтвердить» those
   offers are «Выключено», disappear from buyer search and the offer page, and stay switched on in every other point.
3. Several matches are listed with none ticked; only the offers the Seller ticks are switched off.
4. No match gives the explanation naming the point and the product; nothing changes and no draft is created.
5. An offer that is already switched off is shown as «Выключено раньше» and cannot be proposed again.
6. An out-of-stock statement never creates a draft, with either parser.
7. Mixed input produces the usual drafts and the availability section on one review; drafts and availability are
   confirmed independently.
8. Offers of other points or other sellers are never candidates; the proposal endpoint refuses foreign inputs, other
   points and IDs that are not current candidates of the submission's statements, creating nothing.
9. If the candidates change between showing and «Выключить отмеченные» (a candidate edited, switched off or on,
   reconfirmed, moved to the archived stage, or a new matching card added), no proposal is created; the review shows
   the fresh candidates with no ticks and «Карточки изменились — отметьте заново». If the offer changes between
   proposal and confirmation, the confirmation is refused with nothing applied. Repeating a confirmation or a proposal
   never applies a change twice.
10. On the review — first view, return from confirmation, reload or recovery within 24 hours — every draft and every
    found card shows its current status («Черновик», published count, «На витрине», «Ждёт подтверждения»,
    «Выключено по этому списку», «Выключено раньше»), the summary matches them, and an unconfirmed proposal is offered
    again; replay of the same `requestId` creates nothing.
11. Existing behaviour is intact: `off`, `fake` and `real` text-to-drafts, manual entry, «Включить», actuality.
12. A recognised pack or unit limits the proposal to offers with exactly that pack or unit; another pack of the same
    product is shown as «Другая фасовка — не изменится», cannot be ticked and is refused by the server. A phrase without
    a pack lists every pack, pre-ticking only a single match. A pack or unit that is written but not recognised or not
    bound with confidence lists every pack with **no** pre-tick, even for a single match, and a warning quoting the
    Seller's words. The confirm screen shows the pack of every card being switched off.

## 9. Decisions for PO

| ID | Question | Recommendation |
| --- | --- | --- |
| D-A | Revision of slice 2 §6.3 / AC 8 (out-of-stock moves from «Не распознано» to «Нет в наличии») | **Approved** (PO 2026-10-27), limited to this new behaviour. |
| D-B | Confirmed action = existing «Выключить» (reversible, per point) | **Approved** (PO 2026-10-27). |
| D-C | Single match pre-ticked; several matches need a choice; more than one may be ticked | **Approved** (PO 2026-10-27). |
| D-D | Design gap: no mockup frame for «Нет в наличии» | **Closed**: agent-made [preview.html](preview.html) screens 1–8 accepted by the PO as the implementation basis (2026-10-27). |

## 10. Verification

- **Unit:** matching (catalog link, word form, prefix-only refused, archived excluded, inactive flagged, other point
  absent); pack/unit rule (bound pack equal in base units only, 0,5 кг = 500 г, other pack listed not selectable,
  `none` → all packs); variant state on the saved C2 answers and synthetic cases: no pack words → `none`, confirmed
  pack → `bound`, pack mismatch / ambiguous size / unrecognised or unbound unit / quote not found / pack words left
  unused in the sentence → `uncertain`; pre-tick rule (single + `none`/`bound` only); status derivation (draft,
  published, live, pending, switched off by this list, switched off before); pipeline routing: every out-of-stock
  statement lands in `unavailable`, none in drafts or `skipped`, drafts otherwise identical to today.
- **Integration (PostgreSQL, replay and fake):** two points and a second seller seeded; candidates only from the
  submission's point; endpoint refusals (foreign, other point, forged ID, already inactive) create nothing; **shown →
  proposal**: price edit, switch-off, reconfirm, title/pack edit, new matching card and archived stage each → 409 with
  fresh candidates and nothing created; unchanged → change set with the shown revisions; confirm → `inactive` for
  ticked offers only; revision conflict at confirm; repeated confirm and double proposal; old submission rows; offer
  and draft counts.
- **E2E (production build, mobile RU, fake parser):** clear match → confirm (pack line visible) → «Выключено» on the
  showcase and absent from buyer search; general phrase with two packs; bound pack leaves the other pack on;
  uncertain pack with one match is not pre-ticked and shows the warning; no match; candidate changed in a second tab
  before «Выключить отмеченные» → fresh list, no ticks, nothing created; mixed input with a draft published
  separately; return from confirm and reload show the same statuses and summary; unconfirmed proposal offered again
  after reload.
- **Regression:** existing `seller-text-*`, offer-management, batch and actuality specs; `pnpm verify`; branch CI.
- **Not required:** live model, latency or memory measurement (parser unchanged).

## 11. Manual acceptance scenario (PO, local, mobile RU, fake parser)

1. Seller with point «А»: Сметана, Пельмени 0,5 кг, Пельмени 1 кг; point «Б»: Сметана.
2. «Написать списком» for «А»: «Картошка 250 за кг. Сметаны нет. Пельменей нет. Чеснока нет.»
3. Expect: draft «Картошка»; «Нет в наличии»: Сметана (ticked), Пельмени with two options (none ticked), Чеснок
   «нет карточки»; the showcase is unchanged.
4. Tick «Пельмени 0,5 кг», «Выключить отмеченные», check the confirm screen, «Подтвердить».
5. Showcase: Сметана and Пельмени 0,5 кг in «А» «Выключено»; Пельмени 1 кг and Сметана in «Б» unchanged; Картошка is
   still a draft. Buyer search for «сметана» shows only point «Б».
6. Reopen the review and reload it: summary «опубликовано 0, выключено 2»; the two rows show «Выключено по этому
   списку», Пельмени 1 кг is still selectable. «Включить» returns Сметана in «А».
7. New list for «А»: «Пельменей по 1 кг нет. Сметаны 200 г нет.» → only Пельмени 1 кг proposed; Пельмени 500 г shown as
   other pack, not selectable; Сметана 200 г «нет в этой фасовке», nothing proposed.
8. New list for «Б»: «Сметаны 0,4 кг и 1 кг нет.» → Сметана · 400 г listed **without** a tick, with the pack warning.
9. In «А», with Пельмени 1 кг ticked, change its price in another tab, then press «Выключить отмеченные» → «Карточки
   изменились — отметьте заново», no tick, nothing created.
10. Make a proposal, leave the confirm screen, reload the review: «Ждёт подтверждения» and «Открыть подтверждение».
    Change that card's price in another tab, then confirm: refused, nothing switched off.

## 12. After this slice (not an approved queue)

Remaining maintenance gaps for the same goal, each a separate PO decision: switching on through text («снова есть»);
duplicates from repeated text input — a product that already has a card at the point becomes a new draft and, once
published, a second card (recorded as `S-TEXT-DUPLICATES`, EXECUTION_PLAN §5.3, open for discussion); price changes
of existing offers through text. Voice, photo and video (S18–S20) are expected to
reuse the parse result and this matching function; their order is not approved.
