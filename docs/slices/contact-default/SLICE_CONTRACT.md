# Contact default — login number offered as the point's contact — Slice Contract

**Status:** DRAFT — not approved. Contract preparation only; implementation has not started and needs the PO's approval of this contract and a separate PO instruction. Every place where the PO intent is silent is an OPEN QUESTION FOR PO (§6) with a recommended answer; nothing there is decided.

**Queue:** S-CONTACT-DEFAULT, item 8 of the PO-approved order of 2026-10-13 (after S-ACTUALITY-WORDS, before B-READABILITY; one at a time). Order and state are owned by `docs/product/EXECUTION_PLAN.md`.

**Base:** `main` at `14785751a1e4b60308d93531b8e1a77875f953f5` (checkpoint `v0.0.78-actuality-words`).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1): `AI-S12A · Point · Contacts (first point)` / `(copied)`. The mockup has no frame for a prefilled login number or its notice; §9 draws them as DRAFT previews (a design gap, to be approved by the PO).

## 1. User task

A Seller who has just logged in with a phone number can offer that number to buyers as the point's contact without retyping it — and always sees, before saving, that buyers will see it.

## 2. PO intent (2026-10-13/14, source of the questions in §6)

- The Seller's login phone is offered as the default contact of a point, so the Seller does not retype it.
- Hard constraint (recorded in PR #179, and already in closed contract S10): the login phone must NEVER become a public contact silently. Only a Seller-visible prefill or an explicit opt-in the Seller can see.
- Whether the number needs verification is an open PO question (§6, Q4).
- Success criterion: fewer fields or taps in onboarding / adding a point (§6, Q9).

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

## 4. Scope (assumes the recommended answers of §6; changes with the PO's decisions)

1. **First-point prefill (Q1, Q2).** In the point form of a Seller's first point the «Телефон» field starts with the login number (read from the existing `GET /api/auth/me`; no new API). WhatsApp stays empty.
2. **Visible and reversible (Q3).** The prefilled field is a normal editable field. Directly under it a notice says the number is the login number and that buyers will see it after the point is saved; one button `Не показывать покупателям` (≥ 44 px) clears the field. Nothing is stored or published before the Seller presses «Сохранить» on that screen.
3. **No automatic verification step (Q4).** The login number remains verified as today; the badge «Подтверждён» shows next to it.
4. **Honest help text (Q5).** `pointDetails.contactsHelp` stops saying that every number needs a code.
5. **Existing points and later points (Q2, Q7).** Existing points are never changed. A later point keeps the current copy-from-latest behaviour and its label.
6. **Persist the proof (Q6).** Saving a point whose phone or WhatsApp equals the login number records that number in `seller_verified_phones`, so a future change of the login number cannot silently remove a public contact. No new column; existing rows unchanged.
7. **Strings.** RU and provisional KK for the new and the changed strings (§8). In every new or changed RU string no short preposition or conjunction may stay at the end of a line: non-breaking spaces (U+00A0) after such words, verified by a unit test over the new and changed RU keys and by a 320 px check, as in `actuality-words` §4.7.

## 5. Explicit out of scope

- Any change of what buyers see or how contacts are built (`tel:`, `wa.me`, icons); Telegram, Instagram; WhatsApp prefill (unless Q1 says otherwise).
- Retroactive change of existing points; background or "set for all points" actions; any automatic publishing of a number.
- Changing the login number (no such feature exists); real SMS; new OTP flows; changes to OTP limits.
- Contacts inside ChangeSet / publication confirmation (contacts stay on the point, not on the card).
- New analytics, events or tracking; seller statistics; notifications; voice or translation; paid services; public launch.
- B-READABILITY.

## 6. Open questions for PO (recommendations are not decisions)

Each question has the recommended answer from the point of view of the best Seller UX and the safest privacy default.

1. **Which fields are prefilled — phone only, or also WhatsApp?** Recommend: **phone only**. Reason: the login number is a call number; a Seller may not use WhatsApp on it, and a second public channel the Seller did not choose is the larger privacy surprise (the older UX2 contract prefilled both).
2. **For which points and when?** Recommend: **the first point (onboarding) only**; every later point keeps copy-from-latest; existing points are **never** changed retroactively. If the latest point deliberately has no phone, a new point stays empty (the Seller's choice is respected). Reason: one clear moment of offer, no re-asking, no silent change of live data.
3. **Opt-in mechanics: visible prefilled field, or an explicit «Показывать мой номер покупателям» choice; default on or off; link to the publication confirmation?** Recommend: **a visible prefilled, editable field plus a notice and a one-tap «Не показывать покупателям»; no separate switch.** Saving the point is the Seller's confirmation: the number, the notice and the badge are on the same screen, and the private «Как видят покупатели» preview already shows what buyers get. The publication confirmation (ChangeSet) carries no contacts today and should not start to (§3.2). Reason: zero extra taps, nothing hidden, and the Seller can undo it in one tap. **Stricter alternative if the PO prefers:** the field starts empty and a chip «Указать мой номер +7 701 000 00 01» fills it on one tap — one tap more, no possibility of saving a number the Seller never looked at. Needs the PO's choice between the two.
4. **Does the login number count as verified automatically, or need a fresh confirmation?** Recommend: **automatically verified, as today.** Reason: the Seller proved the number with the login code; a second code costs a step, an SMS later and contradicts the success criterion. (EXECUTION_PLAN already says the login number is not re-verified.)
5. **What does the buyer see, and what tells the Seller the number will be public?** Buyers see a call icon (`Позвонить`) that dials the number; the number is not printed as text (unchanged). The Seller sees under the field: «Это номер, с которого вы вошли. Покупатели увидят его после сохранения точки.» and the existing badge «Подтверждён». Recommend this wording and placement (§9). The help line is corrected (§4.4). Reason: the notice is where the decision is made.
6. **What happens when the login number changes later?** Recommend: **no silent change of public contacts.** A point's number is its own stored value, never a live reference to the login number; and saving a point with the login number records the proof (§4.6) so the contact does not vanish if a change path is ever added. A change-number feature, if ever built, needs its own contract and must ask the Seller what to do with each point. Reason: closes the latent drift of §3.3 without adding a feature.
7. **Interplay with «copy contacts from the latest point».** Recommend: **unchanged.** A copied login number is already visible in the form with the label «Контакты как у точки «…»»; no second notice. Out of scope here, noted for the PO: the server-side copy in `createOwnedLocation` publishes the copied contacts even if the form is abandoned after the point is created; it matches the closed contract and is not changed here, but it is the one place where a number reaches a new point without the Seller pressing «Сохранить» on it.
8. **Empty, error and KK states.** Recommend: if `GET /api/auth/me` fails or returns no number, the field is empty and there is **no error message** (the prefill is a convenience); after `Не показывать покупателям` the field is empty, the notice disappears and the existing line «Без контактов точка работает: покупатели строят маршрут.» shows; a Seller who types a different number is unaffected; an invalid number keeps the existing error. KK strings are provisional (`PROJECT_RULES.md` §18.5) and listed in §8.
9. **How is the success criterion measured?** Recommend: **PO acceptance with a stopwatch and a tap count, no tracking events.** Baseline today: first point — typing a number into «Телефон» (10 digits and `+7` handling); new design — 0 keystrokes and 0 extra taps for a Seller who keeps the login number. Record fields typed and taps for onboarding and for adding a second point, old build (port 3000 checkpoint) versus new.

## 7. Risk flags

| Risk | Proof requirement |
|---|---|
| Privacy: login number becomes public without the Seller seeing it | Prefill only in a visible field with notice; nothing stored before save; integration test that `users.phone_e164` is absent from buyer payloads unless typed/kept by the Seller; test that abandoning the form stores nothing; test that existing points are untouched. |
| Seller saves without reading | Notice is adjacent and not collapsible; preview «Как видят покупатели» unchanged; the PO may choose the stricter chip (Q3). |
| Verification meaning | The badge «Подтверждён» for the login number is correct (login OTP); help text corrected so no screen says a code is always needed. |
| Closed contracts | S10, point-contacts-hours, UX2 are extended, not weakened; their tests stay green. |
| Latent drift | §4.6 records the proof; migration-free; unit/integration test. |

## 8. Strings (draft, RU; KK provisional, to be written at implementation)

New: `pointDetails.loginDefaultNotice` «Это номер, с которого вы вошли. Покупатели увидят его после сохранения точки.»; `pointDetails.loginDefaultClear` «Не показывать покупателям».
Changed: `pointDetails.contactsHelp` «Покупатели смогут позвонить или написать. Номер входа и уже подтверждённые номера видны сразу после сохранения, остальные — после подтверждения кодом.»
Each has non-breaking spaces after short words (the previews use them). Existing keys not listed stay as they are.

## 9. Previews and design gaps (`PROJECT_RULES.md` §18.1)

The mockup has no frame for the prefilled login number, the notice or the clear button: a design gap, to be approved by the PO with this contract. Prepared in this folder as documentation only (static `preview.html` with the shipped seller CSS inlined, synthetic data, system font fallback, no production code, no new tokens or palette; the notice reuses the existing info banner, the button the existing secondary button at 44 px):

1. `1-first-point-prefilled-320.png`, `-390.png` — first-point form scrolled to «Контакты»: «Телефон» with the login number and «Подтверждён», the notice, `Не показывать покупателям`, empty WhatsApp.
2. `2-cleared-320.png`, `-390.png` — after the clear: empty fields, no notice, the existing line about working without contacts.

A static preview is not authorization and not runtime proof. The stricter chip alternative of Q3 is described, not drawn; it is drawn if the PO chooses it.

## 10. Acceptance criteria (draft)

1. In the first point's form «Телефон» starts with the login number and shows «Подтверждён»; WhatsApp is empty.
2. Directly under it the notice «Это номер, с которого вы вошли. Покупатели увидят его после сохранения точки.» and `Не показывать покупателям` (≥ 44 px) are visible; the button empties the field and removes the notice.
3. Before «Сохранить» nothing about the number is stored; leaving the form discards it; after save the buyer card shows `Позвонить` for the point, and clearing before save leaves the point without a phone.
4. `users.phone_e164` appears in no buyer payload except as a point's saved number; existing points are unchanged by this slice.
5. A second point still starts with the latest point's contacts and the existing label; no new notice appears there.
6. If the number cannot be read the form works with an empty field and no error.
7. Saving a point with the login number records it as verified for the Seller; changing nothing else.
8. Help text no longer claims every number needs a code; new and changed RU strings have no short preposition or conjunction before a regular space (unit test); 320 px check shows none at a line end; KK keys exist.
9. Tap targets ≥ 44 px; focus order, labels and keyboard use of the form are not weakened.
10. PO acceptance on a phone: tap count and stopwatch recorded for first point and for a second point, old versus new.

## 11. Verification plan (after approval)

- Unit: string rule over the new and changed RU keys; prefill decision (first point only, latest-point-without-phone stays empty).
- Integration: buyer payloads never contain the login number unless it is a saved point number; verified set after saving the login number; existing points untouched; point-contacts-hours and S10 tests stay green.
- E2E (mobile RU, 320 and 390): first-point form with prefill, clear, save and buyer `Позвонить`; `/api/auth/me` failure gives an empty field; second point shows only the copy label.
- Manual acceptance (PO, phone): onboarding a new Seller on a disposable database; count taps and seconds against the checkpoint build; check wording at 320 px.

## 12. Closed contracts affected

point-contacts-hours (extended: first-point prefill, honest help text, stored proof); S10 buyer contact actions (the rule "never copied or published automatically" is kept and made verifiable); UX2 seller onboarding (its login-number prefill is reinstated for phone only, in the point form); seller-card-point-link (the embedded editor shows the same prefill); S2 auth and auth-otp-* (unchanged). When this slice closes, revision notes go into these contracts per `PROJECT_RULES.md` §19.1.

## 13. Product Owner decisions

- 2026-10-13: slice scheduled as item 8; intent as in §2.
- 2026-10-14: contract preparation authorized (docs only). §6 is open; nothing in it is decided.
