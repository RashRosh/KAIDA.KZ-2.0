# Point contacts and opening hours — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-26 (migration rule and first-point hours template approved as written).

**Stage 1, item 2** of `docs/product/EXECUTION_PLAN.md`.

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1):
`AI-S12A · Point · Contacts (first point)` / `· Contacts (copied)`, `AI-S13` (contact verification), `AI-B01`
(icon-only contacts, route-only card). Opening hours have no frame in the mockup; the buyer line format, colors and
icon rule below are Product Owner decisions (`FEATURE_MAP.md` «Seller AI-first model» п. 13) and stand in for the
frame. Mandatory UI rules: `PROJECT_RULES.md` §18.4.

**Base:** `main` after PR #53 (offer photos).

## 1. User task

A Seller gives each trading point its own verified phone and WhatsApp and its opening hours; a Buyer sees on every
result card whether the point is open now and can contact it only through verified channels.

## 2. Scope and exact behavior

### Contacts belong to the point

- Each Location has optional `phone` and `whatsapp` (E.164). Telegram and Instagram are **not** part of this slice
  (§8, D2/D4).
- A contact is shown to buyers only when it is **verified**. An entered but unverified contact is stored, visible to
  the Seller with `Не подтверждён · Подтвердить`, and never public.
- Verification: the Seller taps `Подтвердить`, gets a code for that number and enters it. Stage 1 uses the existing
  test delivery (the code is shown on screen, as at login — §8, D1). The Identity OTP boundary is reused through a new
  purpose `contact_verification`, so a real SMS provider later replaces delivery without touching points.
- No new code is needed when the number is already verified for this Seller: the login phone of the owner, or a
  number verified on another point of the same Seller.
- Changing a verified number makes it unverified again.
- A point may have no contacts at all; then the buyer card shows only `Маршрут` (`AI-B01`).

### New point gets the previous point's data

- Creating a point pre-fills phone, WhatsApp and opening hours from the Seller's most recently created point, with the
  label `Контакты как у точки «…» — можно изменить до сохранения`. Copied verified numbers stay verified.
- The first point starts with empty contacts and the default hours template (§ opening hours).
- Editing one point never changes another.

### Opening hours (mandatory)

- A point cannot be saved without opening hours.
- Model: a weekly schedule. Each weekday is one of:
  - `closed` (выходной);
  - `24h` (круглосуточно);
  - 1–3 intervals `HH:MM–HH:MM`. An interval may end after midnight (`18:00–02:00`: open until 02:00 of the next day).
    Several intervals express breaks (`09:00–13:00, 14:00–18:00`). Intervals of one day must not overlap.
- Editor: «Одинаково по будням» shortcut, then per-day overrides; quick choices `Выходной`, `Круглосуточно`, `+ перерыв`.
  The first point's template is Mon–Fri 09:00–18:00, Sat–Sun closed, visibly marked as a template to adjust.
- Time is the point's local time, `Asia/Almaty` (Kazakhstan runs one zone; the zone is stored per point for later
  regions).
- Holiday dates and one-off exceptions are out of scope.

### Buyer display of hours

- Every result card and the Offer page show one line built from the schedule by grouping equal days:
  `9.00–18.00 | ПТ 13.00–18.00 | С̶Б̶ В̶С̶` — the most common schedule first without a day label, then the days that
  differ, closed days struck through. Intervals of one day are joined with a comma; `24h` reads `Круглосуточно`.
- State now, by the point's local time:
  - **open** — green;
  - **closes within 60 minutes** — orange;
  - **closed** — red.
- State is never color alone (§18.4, PO decision: icon, no word): a distinct icon shape per state before the line, and
  an accessible name `Открыто до 18:00` / `Закрывается в 18:00` / `Закрыто, откроется в 9:00 ПН`.
- The state is recomputed on the device every minute; the server sends the schedule, not the state.
- Hours never change ranking, visibility or filters.

### Buyer visibility

- An Offer is buyer-visible when it is active, fresh, and its point has confirmed coordinates. **A public phone is no
  longer required** (`FEATURE_MAP.md` п. 8). This replaces the current rule «public phone + geo».

### Seller surfaces

- Point create/edit form (`/seller/points`): name, location (unchanged S3/S8 flow), **Контакты** (phone, WhatsApp with
  verification state), **Режим работы**.
- The separate `Контакты` section of the seller cabinet (`/seller/contacts`) is removed; its menu item disappears.

### Migration of existing data

- Seller-level phone and WhatsApp are copied to **every** point of that Seller.
- A copied number equal to the owner's login phone is marked verified; any other copied number is unverified and
  therefore hidden until the Seller confirms it.
- Telegram and Instagram values stay in the database untouched but are no longer read or shown.
- Existing points get the template hours marked `needs review`; the Seller sees `Проверьте режим работы` on the point
  until saved once. Buyers see those hours meanwhile.

## 3. Explicit out of scope

- Telegram (bot-based connection — separate step before launch), Instagram.
- Real SMS delivery (one launch step for login and contacts together).
- Holidays, dates, seasonal schedules.
- Opening hours as a search filter or ranking factor.
- Restyling the rest of the points screen to AI-S12A beyond the contacts and hours blocks (stage 1 item 3).

## 4. Closed contracts revised

- **S10 buyer contact actions — revised.** Contacts move from Seller to Location; channels become phone and WhatsApp;
  only verified values are public; Telegram and Instagram actions disappear. The public shape stays additive:
  `seller.contacts` is replaced by `location.contacts?` with the same rules (missing field omitted, never `null`, no
  URLs from the Seller).
- **Buyer visibility (S1/UX1D predicate) — revised:** the public-phone condition is removed.
- **S2 Identity — extended:** OTP gains a purpose; login behavior unchanged.
- **#36 seller trading points workspace — extended** with contacts and hours; `/seller/contacts` removed.
- **S3/S8 location and geo:** unchanged.

## 5. Risk flags

| Risk | Proof requirement |
|---|---|
| Privacy / abuse | An unverified number never appears in Search, Nearby or the Offer page payload. |
| Verification bypass | A number is verified only by a correct code for that exact number and point owner; changing the number drops it. |
| OTP abuse | Same attempt and rate limits as login OTP. |
| Visibility change | Offers of points without a phone become visible; covered by tests and called out in manual acceptance. |
| Migration | Existing sellers keep exactly the verified subset; no Offer disappears except where the point lacks geo (unchanged). |
| Time logic | Overnight intervals, `24h`, closed days and the 60-minute window are unit-tested at boundaries. |

## 6. Acceptance criteria

1. A Seller adds a phone to a point, confirms it with the code, and buyers see the call action; before confirmation
   they do not.
2. The owner's login number and a number verified on another point need no new code.
3. A new point is pre-filled with the previous point's contacts and hours, labelled with the source; saving changes
   only the new point.
4. A point cannot be saved without hours; any weekly schedule (closed, 24h, breaks, past midnight) can be entered.
5. Every buyer card shows the grouped hours line with closed days struck through.
6. The state icon and accessible name are correct for open, closing within an hour, and closed, including across
   midnight; colors green / orange / red.
7. An Offer whose point has no contacts is visible with `Маршрут` only.
8. `/seller/contacts` is gone; Telegram and Instagram no longer appear anywhere.
9. Existing data migrates as §2 describes.
10. All new strings exist in `ru` and `kk`, no clipping at 320 px.
11. Regression of S1/S2/S3/S8/S9/#36/offer-photos stays green, with S10 tests updated to the revised contract.

## 7. Verification and manual acceptance

- Unit: schedule validation; grouping into the display line; open/closing/closed at boundaries and past midnight.
- Integration: contact verification (codes, reuse of verified numbers, re-verification on change), public projection
  of verified contacts only, visibility without phone, migration on a fixture of old data.
- E2E (mobile + desktop, `ru` + `kk`): add and verify a phone; copy to the second point; hours editor with a break and
  a closed day; buyer card line, icon and accessible name at a mocked clock; route-only card.

Manual scenario: on a phone create the first point, add a phone and confirm it with the code, set Mon–Fri 9–18 with a
13–14 break and Sunday closed. Create a second point — the phone and hours are already there; change the hours. As a
buyer, find a card of each point: the hours line and the colored icon match the current time; call works.

## 8. Product Owner decisions

1. **D1 — verification code:** test delivery now (code on screen); real SMS is one step before launch for login and
   contacts together (2026-09-26).
2. **D2 — Telegram:** not in this slice; added later with a KAIDA bot that proves the account (2026-09-26).
3. **D3 — opening hours:** any schedule the Seller has must be expressible (2026-09-26) → weekly model with closed,
   24h, up to 3 intervals per day, past midnight. Up to 3 intervals is a default, change it if needed.
4. **D4 — Instagram:** not a point channel — the brief, mockup and `FEATURE_MAP.md` п. 7 list phone / WhatsApp / Telegram only; confirmed again 2026-09-26.
5. Earlier: every entered contact is verified; contacts and hours are copied from the previous point; hours are
   mandatory; buyer line format, green / orange (≤ 1 h) / red, icon without a word (2026-09-25).

Open for approval: the migration rule for existing seller contacts (§2) and the first-point hours template.
