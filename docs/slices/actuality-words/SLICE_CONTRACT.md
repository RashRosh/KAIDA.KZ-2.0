# Actuality words and one-tap «Всё актуально» — Slice Contract

**Status:** DRAFT — not approved. Nothing here authorizes implementation. It becomes binding only after the Product Owner answers the open questions in §6 and approves the contract in writing.

**Queue:** S-ACTUALITY-WORDS, first of three independent slices ordered by PO on 2026-10-13 (then S-CONTACT-DEFAULT, then B-READABILITY; one at a time, each with its own contract, PO acceptance and checkpoint). Order and state are owned by `docs/product/EXECUTION_PLAN.md`.

**Base:** `main` at `5cb570b331965c2ad0e1c1427fcd00b1bcf5aecc` (checkpoint `v0.0.77-offer-favourites`).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1): `S01` (task block), `S15` (card screen), `S16` («Актуальность», «Всё актуально»). The mockup has no frame for a one-tap «Всё актуально» on the main seller screen — see §9 «Design gaps». Mobile, Russian (`PROJECT_RULES.md` §18.5); every new key also gets a provisional Kazakh string.

## 1. User task

A Seller keeps the showcase true in as few seconds per day as possible: the action that confirms a card is named by what the Seller is actually saying — «Товар есть, цена та же» — and everything due can be confirmed in one tap from the main seller screen, while the 2 / 7 / 14 mechanic stays as it is.

## 2. PO intent (2026-10-13, the only fixed inputs)

- The confirm action is named «Товар есть, цена та же».
- «Всё актуально» is a one-tap action from the main seller screen.
- The 2 / 7 / 14 mechanic does not change.
- Success criterion: seconds per day a Seller spends confirming.

Confirming actuality is a Seller's statement, not proof that the goods are fresh or the price is current (`EXECUTION_PLAN.md` S-ACTUALITY-WORDS). Nothing below may present it as proof.

## 3. Verified facts about today's behavior (code at the base commit)

- **Main screen «Моя витрина»:** the task block («Пора подтвердить актуальность» + count, optional «· N уже скрыты с витрины») shows while any live (not archived) card is due, i.e. its oldest active point is ≥ 24 h since last confirmation (`ACTUALITY_DUE_HOURS`, default 24). Its only action is `Проверить`; it also hosts the push toggle.
- **«Всё актуально» exists, but not on the main screen.** `Проверить` opens the list «Актуальность · N» (`/seller?actuality=1`): due cards (oldest first, including cards already hidden from buyers at ≥ 168 h; archived cards excluded), a pencil per row, the hint «Проверьте, что товары есть и цены верны.», and a footer button `Всё актуально` that confirms every listed card. Taps today for any N due cards: 2 (`Проверить`, `Всё актуально`).
- **Single card:** open the card (1 tap), then `Подтвердить актуальность` with the hint «Товар есть, цена та же» (two places on the card screen: a list row and a primary button). Taps: 2 per card, so 2N for N cards one by one. Whether the card screen stays open after confirming was not verified.
- **What a confirmation does:** one `POST /api/seller/actuality/confirm` with card ids creates one ChangeSet with a `reconfirm_offer` item for every switched-on point of every chosen card and confirms it at once (no review page). Only the confirmation time and revision change. The single-card and the bulk action use the same endpoint and the same ChangeSet action; nothing records which of the two was used. The batch is all-or-nothing: one removed, switched-off, price-less or stale card fails the whole request (409), and the Seller sees the generic «Не удалось подтвердить. Проверьте сеть и повторите.»
- **Thresholds (unchanged here):** due 24 h, ageing 48 h, hidden from buyers 168 h, archive 336 h; reminders at 24 h and 144 h; buyer badges «Сегодня» … «6 дней».
- **Current RU strings** (`src/i18n/messages.ts`, `actuality.*`): `confirm` «Подтвердить актуальность», `confirmHint` «Товар есть, цена та же», `confirmDue` «Подтвердите актуальность» (card badge), `confirmed` «Актуальность подтверждена», `allGood` «Всё актуально», `taskTitle` «Пора подтвердить актуальность», `listHint`, `check` «Проверить», `confirmError`. Two more keys with the old action name exist but are not used by any screen (`review.confirmRefresh`, `offerManage.confirmFreshness`). Push texts live in `src/modules/reminders/config/reminders.config.ts` («Подтвердите актуальность, …»).
- **No analytics** of confirmation time or taps exists; "seconds per day" has no instrument today.

## 4. Scope (what is fixed by PO intent; the rest waits for §6)

1. Rename the single-card confirm action to «Товар есть, цена та же» wherever the Seller meets the action (card screen list row and primary button; exact places and the fate of the now-duplicate hint are Q6).
2. Make «Всё актуально» available as one tap from «Моя витрина» (placement, scope and safeguards are Q1–Q5; the existing list screen may stay as the way to review).
3. Keep thresholds, stages, buyer badges, reminder moments and the archive exactly as they are.
4. Provide RU and provisional KK strings for everything new or changed.

**UI copy rule (PO):** in every new or changed RU string no short preposition or conjunction may stay at the end of a line; use non-breaking spaces (U+00A0) after such words. Verified by a unit test over new or changed RU keys and by a 320 px mobile check.

## 5. Explicit out of scope

- Any change to 2 / 7 / 14, the 24 h due moment, reminder moments or quiet hours, the archive, buyer visibility or ranking.
- Buyer-facing wording and badges («Продавец подтвердил: …»).
- Inline edit, switch-off or delete inside the mass list; automatic or scheduled confirmation; confirming on a Seller's behalf; AI.
- Analytics or tracking beyond what Q9 explicitly allows; seller statistics (S-PERF).
- Notifications other than the existing reminders; real SMS; paid services.
- S-CONTACT-DEFAULT and B-READABILITY (separate slices).

## 5.1 Closed contracts affected

- `offer-actuality` — §2 «Seller — card screen» (action name and hint), «Seller — mass actuality» (where `Всё актуально` lives, what it confirms), §6 criterion 5.
- `actuality-reminders` — texts «Подтвердите актуальность, …» and the link target `/seller?actuality=1` (only if Q7 changes them).
- `seller-cabinet-overview` — the main-screen layout that hosts the task block.
- `post-publication-buyer-preview` — its e2e references the card-screen action name.
- Localization rule (`PROJECT_RULES.md` §18.5): new keys in both catalogs.
- Tests that assert the current strings: `tests/e2e/offer-actuality.spec.ts`, `tests/e2e/actuality-reminders.spec.ts`, `tests/e2e/post-publication-buyer-preview.spec.ts`, `tests/integration/offer-actuality.test.ts`.

## 6. Open questions for PO (not decided here)

| # | Question | Facts / options |
|---|---|---|
| Q1 | **What exactly does the one-tap «Всё актуально» confirm?** | Today the list (and its button) covers every live due card (≥ 24 h), including cards already hidden from buyers. Options: (a) the same set; (b) due cards except those already hidden at ≥ 168 h, which need a look; (c) all active cards, due or not. Also: per card (all points together, as today) or per point; whole showcase or only cards the Seller is looking at. |
| Q2 | **Same event?** Must the one-tap action write exactly the same `reconfirm_offer` ChangeSet as the single-card action? | Today they are identical and indistinguishable. Distinguishing them (origin marker) would need a data change and is only useful for Q9. |
| Q3 | **Undo / confirmation.** Is there a confirmation step, an undo, or neither? | Today: applied at once, toast «Актуальность подтверждена». Options: none; toast with «Отменить» for a few seconds (what does undo restore — the previous confirmation time?); a confirm step showing the count (costs a tap against the success criterion). |
| Q4 | **Trust.** How does one tap avoid becoming mindless bulk confirmation that weakens trust in «актуально»? | Ideas to choose from or reject: show count and oldest age on the button; exclude cards hidden ≥ 168 h or archived from one tap (Q1b); require a look (the list) after N consecutive bulk confirmations with no edit; keep the buyer wording as a Seller's statement. The contract will not add a rule the PO has not chosen. |
| Q5 | **Placement and design.** Where exactly on «Моя витрина» is the one-tap button (inside the task block next to `Проверить`, replacing it, elsewhere), and may the agent draw it? | No mockup frame exists (§9). Tap target ≥ 44 × 44 px (`PROJECT_RULES.md` §18.4). Should `Проверить` (review list) remain? |
| Q6 | **Strings.** Final RU for every place that names the action; fate of the duplicated hint. | Candidates: card-screen row and primary button (title today «Подтвердить актуальность», hint «Товар есть, цена та же»); toast «Актуальность подтверждена»; card badge «Подтвердите актуальность»; task title «Пора подтвердить актуальность»; the unused old keys. KK strings are provisional (`PROJECT_RULES.md` §18.5); proposed KK for the action: «Тауар бар, бағасы сол» (existing hint). |
| Q7 | **Which closed wording changes?** | `offer-actuality` (card screen, list), and possibly the reminder texts (PO-decided 2026-09-25) and the push title. Reminder texts stay unchanged unless the PO says otherwise. |
| Q8 | **Empty and error states.** | Nothing due: the block and the one-tap button are absent (as today). Failure: the batch is all-or-nothing; what does the Seller see when one card is stale, removed, switched off or price-less — a retry, a list of cards that blocked it, or skipping them and confirming the rest? |
| Q9 | **How is "seconds per day" measured?** | Today nothing measures it. Options: manual stopwatch in PO acceptance on a seeded showcase (no code); or a new event with timing (needs a privacy/retention decision and is outside this draft unless PO allows). |
| Q10 | **Single-card path.** Is renaming enough, or should a one-tap confirm also exist per row on the showcase list? | PO intent is silent; today it is 2 taps per card. |

## 7. Risk flags

- **Trust in «актуально»:** the one-tap makes confirming cheap; Q4 decides the safeguards. Buyer badges and ranking read the same timestamp.
- **All-or-nothing batch:** one bad card blocks everything unless Q8 says otherwise.
- **Shared strings:** the action name is also in reminders, tests and two unused keys; partial renaming would leave mixed wording.
- **Reminders cycle:** confirming resets the cycle for the confirmed cards (existing behaviour, unchanged).
- **Design gap:** no frame for the main-screen action; not implemented without PO answer (`PROJECT_RULES.md` §18.1).

## 8. Acceptance criteria (draft — final after §6 answers)

1. In the places fixed by Q6 the single-card action reads «Товар есть, цена та же» (RU) and has a KK string; no other screen still names it «Подтвердить актуальность» unless Q6 keeps it.
2. With at least one due card, «Моя витрина» offers `Всё актуально` as one tap (no intermediate screen); with none, it does not.
3. The set confirmed by one tap is exactly the set chosen in Q1; boundary tests at 23 h 59 min / 24 h / 167 h 59 min / 168 h / 335 h 59 min / 336 h for the chosen set.
4. The one-tap action and the single-card action produce the ChangeSet semantics chosen in Q2; stale, removed, switched-off and price-less cards behave as chosen in Q8.
5. Undo or confirmation behaves as chosen in Q3; the safeguard chosen in Q4 is present and tested.
6. Thresholds 24 / 48 / 168 / 336 h, reminder moments, buyer badges and ordering are unchanged (existing tests stay green).
7. Every new or changed RU string has no short preposition or conjunction before a line break (non-breaking spaces; unit test plus 320 px check); KK keys exist in the catalog.
8. The measure chosen in Q9 meets the PO's target on the seeded acceptance showcase.
9. Tap targets ≥ 44 × 44 px; keyboard focus and `aria-live` of the toast are not weakened (`PROJECT_RULES.md` §18.4).

## 9. Design gaps and previews (`PROJECT_RULES.md` §18.1)

- **Gap:** no mockup frame for a one-tap «Всё актуально» on the main seller screen, nor for its undo/confirmation and failure states. Request to PO: "нужен кадр дизайнера" or permission for the agent to propose it (Q5). Until answered that part is not implemented.
- **Previews:** actual-component previews, if the PO wants them before approval (as for recent UI contracts), are not prepared in this draft: they require production components and a PO answer to Q5. No production code is changed by this draft.

## 10. Verification plan (after approval)

- Unit: due set per Q1 at the boundaries; string rule (no short preposition or conjunction before a regular space in new or changed RU keys).
- Integration: bulk confirm for the chosen set (all points of a card, mixed ages, stale / removed / switched-off / price-less per Q8); ChangeSet shape per Q2; thresholds untouched.
- E2E (mobile RU): main screen with seeded cards of different ages → one-tap, toast / undo, empty state, error state; renamed action on the card screen; updated existing actuality specs.
- Manual acceptance (PO, phone): seeded showcase with several due cards; count taps and time with a stopwatch for the old and new path; verify buyer badges after the confirmation; check wording at 320 px.

## 11. Product Owner decisions

- 2026-10-13: slice scheduled first of three; intent as in §2. No contract decision has been taken yet.
