# Buyer screens on the accepted mockup — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-29 (decisions a–e in §8; the self-made choices of the draft accepted as written).

**Stage:** first stage after stage 1 (PO decision 2026-09-29, `docs/product/EXECUTION_PLAN.md`).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1): `B01`
(result card, variants, loading / error) and `B02` (offer detail: full, fallback without contacts, media error). Screens
without a frame (search start, «Рядом», sign-in, the buyer app frame) are built from the mockup's own classes, as was
done for the seller. Mandatory UI rules: `PROJECT_RULES.md` §18.4. Mobile and Russian as for the seller (PO
2026-09-27): on a wide screen the same phone column is centred; Kazakh keys are kept, not proofread.

**Base:** `main` at `517ffe6` (`v0.0.36-actuality-reminders` + monetization plan).

## 1. User task

A buyer searches for a product or opens «Рядом», compares short offer cards (photo, freshness, name, pack, price,
point, distance), opens one, and from its page calls or writes to the seller, builds a route or saves the product —
on screens that look like the accepted mockup, with nothing the current app can do lost.

## 2. Scope and exact behavior

### App frame (no frame in the mockup)

- The buyer screens use the seller app's stylesheet and fonts (`kaida.css`, Roboto + Geologica) and the same phone
  column; the old site header, menu and page styles leave the buyer routes.
- Bottom navigation in the mockup's `.nav` style: `Поиск` (`/`), `Рядом` (`/nearby`), `Ещё` (`/more`).
- No language switch and no `Войти` on the top bars (§8 e). The search start shows the heading and the search field;
  results show the B01 search field (rounded, the query inside) as the top bar. The `Фильтры` button of B01 is not
  shown until the filters stage.
- Buyer «Ещё» (`/more`, built like the seller's AI-S19): `Войти` or the signed-in phone with `Выйти`, `Язык`
  (the same sheet as the seller's), `Я продавец — моя витрина` (→ `/seller`).
- Sign-in still appears where an action needs it: `В избранное`, entering the seller cabinet (as today).
- The search start has a quiet line «Продаёте на рынке? Откройте свою витрину →» (→ `/seller`).

### Language chosen once, at the first visit (buyer and seller)

- While the language cookie is not set, the first screen of any buyer or seller page is the choice «Русский /
  Қазақша» in the mockup's style, with the phone's language preselected; one tap saves it (the existing cookie) and
  continues to the page that was opened. Shown once per browser.
- Later changes only in «Ещё» → `Язык` (buyer and seller).
- Seller: `РУС / ҚАЗ` leaves the top bars of «Витрина», «Точки», «Ещё» (revises the PO decision of 2026-09-27 in
  `PROJECT_RULES.md` §18.1 / §18.4); the seller «Ещё» already has `Язык` and `Выйти`.

### Search start and results (`B01`)

- Start: the current heading and description, the search field, `Учитывать моё местоположение`, popular queries as
  mockup chips.
- Results: the caption «Рядом с вами · сначала актуальные» when the buyer shared location, otherwise «Сначала
  актуальные»; then the cards. Loading — B01 skeletons; an error keeps already shown cards and offers `Повторить`.
- **Result card (B01):** photo 112 px or the neutral fallback, the actuality plaque on the photo («Сегодня» … «6
  дней», mockup colours), name (2 lines), pack as its own line, price with unit, point name, «point type · distance»
  when known, the opening-hours line (PO decision, FEATURE_MAP п. 13), `Маршрут` and only the contacts that exist as
  official WhatsApp / Telegram icons and a phone icon, 44 × 44, with `aria-label`. The whole card opens the offer page;
  contacts and route stay separate buttons.
- Seller name, seller comment and `В избранное` move from the result card to the offer page (§8 c).

### «Рядом» (no frame)

- The same cards and caption; the current location request, privacy note, radius, empty state and errors keep their
  behavior and texts; «Найти конкретный товар» leads to search.

### Offer page (`B02`)

- Gallery up to 5 photos, 300 px, dots, back button over the photo; the actuality plaque; the neutral fallback when
  there is no photo; a photo that fails shows «Фото не загрузилось» + `Повторить` without hiding the data.
- Name, pack, large price with unit, the seller comment (and its translation when the translator is on), the point
  block (name, address, type, distance, opening hours, `Маршрут`, contact icons), the seller name, `В избранное`.
- An offer that is not available shows the current «Предложение недоступно» state in the new style.

### Sign-in

- The existing phone + code modal (S2, UX1A2) restyled with the mockup's sheet, field and button classes; flows,
  texts and return behavior unchanged.

## 3. Explicit out of scope

- Search filters and sorting (`B07`) — the next stage; reviews, rating, complaints (`B03`–`B06`); public video (M2).
- Any change to search matching, ranking, Nearby selection, contacts, route URLs, interests API, auth or photos.
- Desktop layouts; Kazakh proofreading; the operator screens.
- A list of saved products (interests) — there is none today.
- The promo banner above the search field (PO, 2026-09-29) — a future stage; the search start and results are laid out
  so that a banner block can be added above the search field without rearranging them.

## 4. Closed contracts revised

- `UX1B` marketplace offer cards: the result card no longer shows seller name, seller comment and the interest
  control; they are on the offer page (§8 c). Priorities of UX1B §2 are replaced by B01.
- `UX1A` / `UX1A1` app shell, `UX2A` header responsive: the site header and its menu leave buyer routes; the bottom
  navigation replaces them; the desktop header is replaced by the centred phone column.
- `UX1A2` auth modal, `seller-entry-contextual-auth`: same flows and texts, new visual classes; the header `Войти`
  and seller entry move to buyer «Ещё» (plus the line on the search start).
- `UX1C` / S11 Nearby, `UX1D` actionability, S10 contacts, S13 interests, `offer-photos`, `offer-actuality`: behavior
  unchanged, markup changes; E2E selectors are adapted where they assumed the old markup.
- `localization-foundation` (switch on every route, one tap, in the header) and `PROJECT_RULES.md` §18.4 «Язык»:
  replaced by the first-visit choice plus «Ещё» → `Язык` (§8 e); saving, cookie and «keeps route and input» are
  unchanged.
- `seller-showcase-editor`: `РУС / ҚАЗ` leaves the seller top bars.
- `pass3-tokens-visual-regression`: Pass 3 tokens are no longer the buyer target (`PROJECT_RULES.md` §18.1); its buyer
  checks are retired, not rewritten.

## 5. Risk flags

- Wide markup change on every buyer route: all buyer E2E are rerun and adapted without weakening what they check.
- Accessibility: whole-card link plus separate buttons (no nested interactive elements); icon-only contacts need
  names; §18.4 rules (44 px targets, focus, not colour alone).

## 6. Acceptance criteria

1. Every buyer route renders in the mockup's styles and fonts inside the phone column; no old header or menu remains.
2. Bottom navigation `Поиск / Рядом / Ещё` works and marks the current section; buyer «Ещё» has sign-in / sign-out,
   `Язык` and `Я продавец — моя витрина`; no top bar carries a language switch or `Войти`.
3. The result card matches B01 (photo or fallback with plaque, name, pack, price, point, type · distance, hours,
   route, only existing contacts as icons) and opens the offer page on tap.
4. Search start, results caption, loading skeletons and the error with `Повторить` behave as today.
5. «Рядом» keeps its location request, privacy text, empty and error states.
6. The offer page matches B02: gallery with fallback and photo error, plaque, price, comment, point block, seller
   name, `В избранное` (same API and texts), unavailable state.
7. Sign-in modal works as before in the new style; `В избранное` and the seller cabinet still ask to sign in; the
   seller entry («Ещё» and the line on the search start) leads to `/seller`.
10. Without a saved language the first page of any buyer or seller route is the language choice (phone language
    preselected); after one tap it never shows again and the opened page follows; seller top bars have no `РУС / ҚАЗ`.
8. Contact icons are 44 × 44 with `aria-label`; the card link and its buttons are separate focusable elements.
9. All buyer E2E flows (search, S7, S9 ranking, S10 contacts, S11 Nearby, S13 interests, offer photos, actuality,
   auth) pass on the new markup.

## 7. Verification and manual acceptance

- Unit: pure helpers only if added (caption choice, distance text).
- E2E: the flows above on mobile and desktop widths; a new `buyer-screens` spec for card → offer page → contact /
  route / interest and navigation.
- Full `pnpm verify`; branch CI.

**Manual acceptance (PO, phone):** in a fresh browser choose the language on the first screen; search «баранина» with
and without location, open a card, call / route / save, «Рядом», «Ещё»: sign in and out, change language, open the
seller cabinet; check the seller top bars have no language switch.

## 8. Product Owner decisions (2026-09-29)

a. Scope: the buyer screens on the mockup, no new functions; filters `B07` stay the next stage.
b. Screens without a frame are built from the mockup's classes, accepted live.
c. The result card follows B01; seller name, seller comment and `В избранное` move to the offer page (UX1B revised).
d. This stage goes first after stage 1, before the Seller Location geo fallback.
e. No permanent language switch and no `Войти` in the top bars, for the buyer and the seller: the language is chosen
   once at the first visit and later in «Ещё»; sign-in / sign-out live in «Ещё» and appear where an action needs them.
