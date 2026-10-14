# Contact default — login number offered as the point's contact — Slice Contract

**Status:** CLOSED (PO 2026-10-14). Approved by the Product Owner on 2026-10-14 with the ten decisions of §6 and the previews of §9; manual acceptance PASS at `14a3a124bfd7394a4fd1a313277f39ac758b2f8b`; merged as `9dff3f42ca52ec024d27191c0ce43309607a22f4`; annotated checkpoint `v0.0.79-contact-default`.

**Queue:** S-CONTACT-DEFAULT, item 8 of the PO-approved order of 2026-10-13 (after S-ACTUALITY-WORDS, before B-READABILITY; one at a time). Order and state are owned by `docs/product/EXECUTION_PLAN.md`.

**Base:** `main` at `14785751a1e4b60308d93531b8e1a77875f953f5` (checkpoint `v0.0.78-actuality-words`).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1): `AI-S12A · Point · Contacts (first point)` / `(copied)`. The mockup has no frame for the login-number chip, the WhatsApp chip or their notices; §9 draws them as DRAFT previews (a design gap, to be approved by the PO).

## 1. User task

A Seller who has just logged in with a phone number can put that number on a point with one tap instead of retyping it, and always sees what buyers will be able to do with it. Nothing is filled, stored or published until the Seller taps a chip and presses «Сохранить».

## 2. PO intent (2026-10-13/14, source of the questions in §6)

- The Seller's login phone is offered as the default contact of a point, so the Seller does not retype it.
- Hard constraint (recorded in PR #179, and already in closed contract S10): the login phone must NEVER become a public contact silently. Only a Seller-visible, explicit action.
- Whether the number needs verification is an open PO question (§6, Q4).
- Success criterion: fewer fields or taps in onboarding / adding a point (§6, Q9).
- **PO review of the first draft (2026-10-14):** no prefill; the login number is offered as a one-tap chip under «Телефон»; WhatsApp is never prefilled and has its own chip «Тот же номер, что в «Телефоне»»; the notice wording is fixed (§6 Q5); no separate clear button.

## 3. Verified facts about today's behavior (code and contracts at the base commit)

### 3.1 Where a phone reaches a buyer (a)

- **Only one public path exists:** `locations.phone_e164` / `locations.whatsapp_phone_e164` → `projectPointPublicContacts` (`src/modules/locations/details/point-public-contacts.ts`) → `location.contacts?` in the buyer offer. A point number is emitted only if it is in the Seller's verified set. Callers: Search (`search.repository.ts` → `projectBuyerOffer`), Nearby (`discovery.repository.ts`) and the Seller's own private preview (`seller-input/application/card-preview.ts`, buyer presentation with inert actions). Offer page, search results, nearby and favourites show this one projection; favourites and reports read no phone column.
- **`users.phone_e164` is never selected into a buyer payload.** Its readers are: identity (login), `GET /api/auth/me` (returns only the caller's own number; the Seller's «Ещё» screen shows it), `findVerifiedPhones` / `findVerifiedPhonesBySellers` (build a set used only as a gate for point numbers), and the operator console (`moderation.repository.ts`, shown masked through `maskPhone`, operator only). A login number can reach a buyer only if the Seller has typed it into a point's phone or WhatsApp field.
- Buyer contact actions: `buildContactActions` builds `tel:` and `wa.me` links from the projected numbers; the buyer UI draws icons (`ContactIcons`), not the number as text.
- Report payloads exclude reporter phone (`offer-reports.ts` privacy projection). `sellers.contact_phone_e164` (legacy seller-level column) is read only by the operator query as a fallback; no seller or buyer screen writes it.
- Not verified by code: nothing outside the files above was found; an exhaustive runtime audit of every API response was not performed.

### 3.2 Seller flows that set point contacts today (b)

Fields: phone and WhatsApp only (Telegram and Instagram were removed by point-contacts-hours; the data is kept in the DB, never read). All paths go through `PUT /api/seller/locations/:id/details`.

| Flow | What is prefilled | Verification |
|---|---|---|
| **Onboarding / first point** (`SellerTradingPoints`, no Seller yet: `POST /api/seller/setup`, then details `PUT`) | Nothing: no earlier point exists, the form starts empty (the template hours are prefilled). The UX2 onboarding contract (2026-09) says the login number prefills phone and WhatsApp as an editable convenience; **the current code does not do that** (the AI-first revision superseded UX2's seller-level contacts). | The login number typed by hand counts as verified at once (see below). |
| **Adding a point** (`beginAdd`) | The latest created point's phone, WhatsApp and hours, with the banner «Контакты и режим работы как у точки «…» — можно изменить до сохранения»; if the latest point has no phone the field is empty. **Server side too:** `createOwnedLocation` copies the same fields when the point is created through `POST /api/seller/locations`, before the details `PUT` — so contacts exist on the new point even if the form never saves them. | Same rule as below. |
| **Editing a point** | The point's saved values with badges «Подтверждён» / «Ждёт подтверждения». | Same. |
| **Publication confirmation** (`SellerConfirmChange`, ChangeSet) | Contacts do **not** appear there at all: a ChangeSet carries offer items only. The Seller sees buyer-facing contacts only in the private preview «Как видят покупатели» (inert actions). | — |
| **Card editor «Добавить точку»** (`seller-card-point-link`) | The same point editor, embedded; same behaviour as «Adding a point». | — |

Verification (`findVerifiedPhones`): a number is verified if it is in `seller_verified_phones` (a code was confirmed for that exact number) **or equals the owner's current `users.phone_e164`** (derived live, nothing stored). A changed number is unverified unless already proved. A code is requested only for a number already on one of the Seller's points (`PointContactNotOnPointError`), one OTP per number (`contact_verification_challenges`, same code, TTL and test delivery as login).

**Consequence not visible in the UI today:** if the Seller types the login number into «Телефон» or «WhatsApp» and saves, it is public immediately with the badge «Подтверждён» — while the field help says «Номер виден покупателям только после подтверждения кодом», which is not true for the login number.

### 3.3 Changing the login number (c)

There is no way to change it: no endpoint, UI or repository function updates `users.phone_e164` (it is only inserted at first login; the «Изменить номер» button in the login modal restarts the login with another number, i.e. another User). So nothing drifts today. **Latent drift:** a point's phone is a stored copy, but the login number's verification is derived live; if a change path is ever added, a public point contact equal to the old login number would silently become unverified and disappear from buyers, and a stored contact would never follow the new number. Covered by Q6.

### 3.4 Closed contracts and tests that constrain this (d)

- **point-contacts-hours (APPROVED, closed)** §2: contacts belong to the point; verified-only public; login number and numbers verified on another point need no new code; new point copies the latest point's contacts and hours with a label; first point starts with empty contacts. S-CONTACT-DEFAULT is an explicit extension of this slice (EXECUTION_PLAN row).
- **S10 buyer contact actions (closed, revised by point-contacts-hours)**: "Identity login phone is never copied or published automatically as a Seller contact"; public shape additive, missing field omitted, KAIDA builds `tel:` / `wa.me`, no Seller URLs.
- **UX2 seller onboarding (closed):** login number prefills phone and WhatsApp as an editable convenience, not published without explicit save, clear button on non-empty inputs, contacts via the owner contacts resource. Superseded in part by point-contacts-hours; the "not published automatically" rule survives and this contract keeps it.
- **S2 auth / auth-otp-protection / auth-otp-source-protection:** the login number is proved by the login OTP; limits per phone and per source; test delivery shows the code. This slice adds no OTP request.
- **seller-card-point-link:** the same point editor inside the card; no new point fields, no change to verification or hours rules. **pre-publication-buyer-preview:** contacts are drawn inert in the private preview.
- **Localization (`PROJECT_RULES.md` §18.4, §18.5):** RU mandatory, KK provisional, mobile first; every new string in `ru` and `kk`.
- **Tests asserting today's behavior:** `tests/integration/point-contacts-hours.test.ts` (new number unverified until code; login phone needs no code; changed number drops verification; a new point copies contacts; buyers see only verified numbers; migration copies seller phones and marks only the login phone verified), `tests/integration/s10-search-contact-projection.test.ts`, `tests/integration/s10-migration-upgrade.test.ts`, `tests/e2e/s10-contact-actions.spec.ts` (verify by code, reach the buyer card), `tests/e2e/seller-trading-points-workspace.spec.ts`, `tests/e2e/seller-card-point-link.spec.ts`, `tests/e2e/seller-setup.spec.ts`, `tests/e2e/pre-publication-buyer-preview.spec.ts`. None changes unless the answers in §6 require it (§7).
- Not verified: whether any e2e asserts the exact text of `pointDetails.contactsHelp` (a grep for the key found only the component); to be checked when the change is implemented.

## 4. Scope (per the PO decisions of §6)

1. **No prefill (Q2, Q3).** No field is ever prefilled; «Телефон» and «WhatsApp» show what the point holds, and an empty field stays empty.
2. **Chip for the login number (Q3).** When the login number is known (read from the existing `GET /api/auth/me`; no new API) and «Телефон» is empty, a chip «Указать мой номер +7 701 000 00 01» sits under the field; one tap fills the field. Target ≥ 44 px. The existing clear control of the field is the way back; no separate «Не показывать покупателям» button.
3. **Chip for WhatsApp (Q1, PO 2026-10-14).** WhatsApp is never prefilled. Under «WhatsApp», only while «Телефон» holds a number and «WhatsApp» is empty, a chip «Тот же номер, что в «Телефоне»» fills it with that number on one tap. Not shown while «Телефон» is empty. Target ≥ 44 px.
4. **Nothing before «Сохранить».** Neither chip stores or publishes anything; the values are a form draft until the Seller presses «Сохранить» on that screen; leaving the form discards them.
5. **Notice (Q5).** While a field holds the login number (typed or chipped) a notice sits under it: for «Телефон» «Это номер, с которого вы вошли. Покупатели смогут позвонить на этот номер.»; for «WhatsApp» «Покупатели смогут написать на этот номер.» Buyers see the call and WhatsApp icons, not the number as text; the wording says only what buyers can do. The notice is not shown for any other number.
6. **Verification unchanged (Q4).** The login number stays verified as today («Подтверждён»); a number copied by the WhatsApp chip is verified exactly when the same number is (it is the same number).
7. **Any point form (Q2, Q10).** The chips show on any point form — first point, later points, editing an existing point — by the same rules: the login-number chip whenever «Телефон» is empty and the login number is known; the WhatsApp chip whenever «Телефон» holds a number and «WhatsApp» is empty. A Seller who skipped contacts at onboarding can add them later with one tap. Existing points are never changed unless the Seller taps a chip and presses «Сохранить». Copy-from-latest on a later point is unchanged; a copied non-empty field simply shows no chip.
8. **Persist the proof (Q6).** Saving a point whose phone or WhatsApp equals the login number records that number in `seller_verified_phones`, so a future change of the login number cannot silently remove a public contact. No new column; existing rows unchanged.
9. **Honest help text.** `pointDetails.contactsHelp` stops saying that every number needs a code.
10. **Strings (§8).** RU and provisional KK. In every new or changed RU string no short preposition or conjunction may stay at the end of a line: non-breaking spaces (U+00A0) after such words, verified by a unit test over the new and changed RU keys and by a 320 px check, as in `actuality-words` §4.7.

## 5. Explicit out of scope

- Any prefill of a field; any change of what buyers see or how contacts are built (`tel:`, `wa.me`, icons); Telegram, Instagram.
- Retroactive change of existing points; background or "set for all points" actions; any automatic publishing of a number.
- Changing the login number (no such feature exists); real SMS; new OTP flows; changes to OTP limits.
- Contacts inside ChangeSet / publication confirmation (contacts stay on the point, not on the card).
- New analytics, events or tracking; seller statistics; notifications; voice or translation; paid services; public launch.
- B-READABILITY.

## 6. PO decisions (2026-10-14)

All ten are decided by the Product Owner; numbering is kept from the draft.

1. **Which fields are prefilled?** Nothing is prefilled. WhatsApp is never prefilled; under «WhatsApp», only when «Телефон» holds a number, a chip «Тот же номер, что в «Телефоне»» fills it on one tap; not shown when the phone is empty.
2. **For which points and when?** No field is ever prefilled; the chips are the only way a number enters the form without typing. Existing points are never changed unless the Seller taps a chip and presses «Сохранить».
3. **Opt-in mechanics.** NO prefill. «Телефон» starts empty. When the login number is known, a chip «Указать мой номер +7 701 000 00 01» sits under the field; one tap fills it. Nothing is stored or published before «Сохранить». The button «Не показывать покупателям» is removed (the existing clear control is enough). The publication confirmation (ChangeSet) carries no contacts today and does not start to (§3.2); the private «Как видят покупатели» preview already shows what buyers get.
4. **Verification.** The login number counts as verified automatically, as today (the Seller proved it with the login code; no second code).
5. **What the buyer sees, and the notice (exact wording).** When a field holds the login number, the notice reads «Это номер, с которого вы вошли. Покупатели смогут позвонить на этот номер.» for «Телефон» and «Покупатели смогут написать на этот номер.» for «WhatsApp» (non-breaking spaces after short words). The buyer sees the call and WhatsApp icons, not the number as text; the wording must be accurate.
6. **Login number changes later.** No silent change of public contacts. A point's number is its own stored value, never a live reference to the login number; saving a point with the login number records the proof in `seller_verified_phones` (§4.8). A change-number feature, if ever built, needs its own contract.
7. **Copy from the latest point.** Unchanged. A copied login number is already visible in the form with the label «Контакты как у точки «…»». The server-side copy in `createOwnedLocation`, which publishes copied contacts even if the form is abandoned after the point is created, stays as a known limitation (it matches the closed contract; not changed here).
8. **Empty, error and KK states.** If `GET /api/auth/me` fails or has no number, no chip and no error. The chip disappears once the field holds a number and returns when the field is cleared; a different typed number is unaffected and gets no notice; an invalid number keeps the existing error; KK strings are provisional (`PROJECT_RULES.md` §18.5) and listed in §8.
9. **Measurement.** PO acceptance with a stopwatch and a tap count, no tracking events. Baseline today: typing 10 digits and «+7» handling into «Телефон» (and again into «WhatsApp»); new design: one tap each. Record fields typed and taps for onboarding and for adding a second point, old build (port 3000 checkpoint) versus new.
10. **Where the chips show.** On ANY point form (first point, later points, editing an existing point) whenever «Телефон» is empty and the login number is known; the WhatsApp chip whenever «Телефон» holds a number and «WhatsApp» is empty. Reason: a Seller who skipped contacts at onboarding must be able to add them later with one tap. A chip stores and publishes nothing before «Сохранить». Copy-from-latest on a later point is unchanged; a copied non-empty field simply shows no chip.

## 7. Risk flags

| Risk | Proof requirement |
|---|---|
| Privacy: login number becomes public without the Seller acting | No prefill; a number enters the form only by the Seller's tap or typing; test that opening the form and leaving stores nothing; integration test that `users.phone_e164` is absent from buyer payloads unless saved as a point number; existing points untouched. |
| Notice inaccurate | Wording is fixed by the PO (Q5) and says only «позвонить» / «написать»; buyers see icons, never the number as text (unchanged, asserted by the existing contact tests). |
| Chip on an existing point | A chip on an existing point with an empty field is an explicit tap; nothing is stored before «Сохранить»; leaving the form discards it; a point with a non-empty field shows no chip, so a saved number is never replaced by a chip. |
| Chip taps the wrong field | Each chip sits directly under its own field, is labelled with the number or the source field, ≥ 44 px; the WhatsApp chip is hidden while «Телефон» is empty. |
| Verification meaning | «Подтверждён» for the login number is correct (login OTP); the help text is corrected so no screen says a code is always needed. |
| Closed contracts | S10, point-contacts-hours, UX2 are extended, not weakened; their tests stay green. |
| Latent drift | §4.8 records the proof; migration-free; integration test. |

## 8. Strings (draft, RU; KK provisional, to be written at implementation)

New: `pointDetails.useLoginNumber` «Указать мой номер {phone}»; `pointDetails.sameAsPhone` «Тот же номер, что в «Телефоне»»; `pointDetails.loginNoticePhone` «Это номер, с которого вы вошли. Покупатели смогут позвонить на этот номер.»; `pointDetails.loginNoticeWhatsapp` «Покупатели смогут написать на этот номер.»
Changed: `pointDetails.contactsHelp` «Покупатели смогут позвонить или написать. Номер входа и уже подтверждённые номера видны сразу после сохранения, остальные — после подтверждения кодом.»
Each has non-breaking spaces after short words (the previews use them). Existing keys not listed stay as they are.

## 9. Previews and design gaps (`PROJECT_RULES.md` §18.1)

The mockup has no frame for the chips or the notices; the PO approved the previews below with the contract on 2026-10-14, so no design gap remains open. They were redrawn after the PO review of 2026-10-14 (the first previews, with a prefilled field and a clear button, were removed). Documentation only: static `preview.html` with the shipped seller CSS inlined, synthetic data, system font fallback, no production code, no new tokens or palette; the chips reuse the existing secondary button at 44 px, the notices the existing info banner:

1. `1-first-point-empty-320.png`, `-390.png` — first-point form scrolled to «Контакты»: «Телефон» empty, chip «Указать мой номер +7 701 000 00 01»; no WhatsApp chip (phone empty).
2. `2-after-phone-chip-320.png`, `-390.png` — after the tap: the number in «Телефон» with «Подтверждён» and the notice «…позвонить на этот номер.»; the WhatsApp chip «Тот же номер, что в «Телефоне»» is visible.
3. `3-after-whatsapp-chip-320.png`, `-390.png` — after the second tap: both fields filled, each with its notice.

The chip on later points and in the edit form of an existing point is the same element as drawn here, under the same rules (§4.7). A static preview is not authorization and not runtime proof.

## 10. Acceptance criteria (draft)

1. In a point form «Телефон» and «WhatsApp» show what the point holds and are never prefilled; with the login number known, a chip «Указать мой номер +7 701 000 00 01» (≥ 44 px) sits under «Телефон»; without it (request failed or no number) there is no chip and no error.
2. One tap on the chip fills «Телефон», shows «Подтверждён» and the notice «Это номер, с которого вы вошли. Покупатели смогут позвонить на этот номер.»; clearing the field with its existing control removes the notice and brings the chip back.
3. «Тот же номер, что в «Телефоне»» (≥ 44 px) shows under «WhatsApp» only while «Телефон» holds a number and «WhatsApp» is empty; one tap fills it; when that number is the login number the notice «Покупатели смогут написать на этот номер.» shows.
4. Before «Сохранить» nothing is stored; leaving the form discards it; after save the buyer card shows `Позвонить` (and `WhatsApp` when filled) and no number as text.
5. `users.phone_e164` appears in no buyer payload except as a point's saved number; existing points are unchanged by this slice.
6. A second point still starts with the latest point's contacts and the existing label: with an empty phone it shows the login-number chip; a copied non-empty phone shows none. Editing an existing point with an empty phone shows the chip too (one tap, nothing stored before «Сохранить»); with a non-empty phone it shows none.
7. Saving a point with the login number records it as verified for the Seller; nothing else changes.
8. The help text no longer claims every number needs a code; new and changed RU strings have no short preposition or conjunction before a regular space (unit test); the 320 px check shows none at a line end; KK keys exist.
9. Tap targets ≥ 44 px; focus order, labels and keyboard use of the form are not weakened.
10. PO acceptance on a phone: tap count and stopwatch recorded for first point and for a second point, old versus new.

## 11. Verification plan (after approval)

- Unit: string rule over the new and changed RU keys; chip visibility rules (login number known or not, phone empty or not, WhatsApp empty or not; any point form).
- Integration: buyer payloads never contain the login number unless it is a saved point number; verified set after saving the login number; existing points untouched; point-contacts-hours and S10 tests stay green.
- E2E (mobile RU, 320 and 390): chip → field → notice → WhatsApp chip → save → buyer `Позвонить` / `WhatsApp`; `/api/auth/me` failure gives no chip and no error; clearing brings the chip back; a second point with an empty phone shows the chip, one with a copied phone shows only the copy label; an existing point with an empty phone shows the chip and saves the number after one tap and «Сохранить».
- Manual acceptance (PO, phone): onboarding a new Seller on a disposable database; count taps and seconds against the checkpoint build; check wording at 320 px.

## 12. Closed contracts affected

point-contacts-hours (extended: chips on point forms, honest help text, stored proof); S10 buyer contact actions (the rule "never copied or published automatically" is kept and made verifiable: the number enters the form only by the Seller's tap); UX2 seller onboarding (its prefill of the login number is **not** reinstated: a one-tap chip replaces it); seller-card-point-link (the embedded editor shows the same chips); S2 auth and auth-otp-* (unchanged). When this slice closes, revision notes go into these contracts per `PROJECT_RULES.md` §19.1.

## 13. Product Owner decisions

- 2026-10-13: slice scheduled as item 8; intent as in §2.
- 2026-10-14: contract preparation authorized (docs only).
- 2026-10-14 (review of the first draft): Q1 — WhatsApp never prefilled, own chip; Q3 — no prefill, chip «Указать мой номер …», no clear button of our own; Q5 — notice wording fixed; Q8 — no chip and no error when the number is unknown.
- 2026-10-14 (re-review): the PO APPROVED this contract and the previews of §9. Added decisions: Q2 — no field is ever prefilled, existing points change only by a chip tap and «Сохранить»; Q10 — chips on any point form (replaces the draft recommendation of first point only); Q4, Q6, Q7, Q9 accepted as drafted. Implementation has not started and needs a separate PO instruction.

## 14. Closure (PO 2026-10-14)

- **Acceptance:** manual acceptance PASS at `14a3a124bfd7394a4fd1a313277f39ac758b2f8b` (PR #184), as given by the PO; no timing figures were provided and none are recorded. The accepted tree `e049afe5d9ed21ab86585519a5d7dc54d4dc5be2` is identical to the merged tree.
- **Merge:** PR #184 merged with a merge commit `9dff3f42ca52ec024d27191c0ce43309607a22f4`. Scope audited against this contract: no migration; nothing buyers see, contact building, verification rules, OTP flows or limits changed; the only existing-test edits are two cleanup lines that also delete `seller_verified_phones` rows (`s7-real-seller-search` integration, `seller-card-point-link` e2e).
- **Decisions Q1–Q10:** as approved in §6 and §13; implemented as written (chips on any point form, no prefill, fixed notices, proof recorded when a point holds the login number).
- **Checkpoint:** annotated tag `v0.0.79-contact-default` on the merge commit.
- **CI:** contract PR #183 merged `57a35870f89fedb6372ffdf875cb808a2d4aecd4`, main KAIDA verify 38536333848 and CodeQL 38536333832. Accepted head — verify 38542587718 and 38542612684, Analyze 38542612440, dependency review 38542612639, CodeQL check 115781221678 (unit 538, integration 336, e2e 290 passed with 58 expected skips). Merged main — KAIDA verify 38547306819, CodeQL 38547306967.
- **Known, unscheduled limitations (no code change):** the KK strings are provisional and have not been reviewed by a human; the WhatsApp chip copies the «Телефон» text as typed, and an invalid value is rejected by the server on save.
- **Port 3000:** serves this checkpoint against the isolated snapshot; there is no migration in this slice, the snapshot schema is untouched.
