# Buyer readability — point, address and seller lines — Slice Contract

**Status:** DRAFT — for Product Owner review. Not approved; implementation not authorized (`PROJECT_RULES.md` §2, §3).
Needs the PO decisions of §8 and a separate PO instruction to implement.

**Queue:** B-READABILITY, item 9 of the PO-approved order of 2026-10-13. Order and state are owned by
`docs/product/EXECUTION_PLAN.md`.

**Base:** `main` at `1116404c5d2dcf4b5fc68833862af5165aab4b41` (checkpoint `v0.0.81-seller-ai-text-real-parser` at
`c70c2b77ff76670f9bdedb9f61c5e466555822c9`).

**Sources:** `REQUIREMENTS_REGISTER.md` B-READABILITY → UXA §5 (expert UX audit `kaida-ux-audit.md`, «Мелко: подписи
12 px серым (адрес, строка продавца «Ержан · Зелёный базар», сноски в форме)… Минимум 13–14 px и темнее») and UXD §4.5
(«Читаемость второстепенного текста на реальном телефоне; вывод «всё по 12 px» неверен, часть проверенного текста —
14 px»). Both are expert opinion from 390 px screenshots, not user research; UXA did not measure sizes in px (UXA §8).

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1): `B01`
(result card) and `B02` (offer page). This slice deliberately deviates from both frames in two text properties (§6).

## 1. User task

A buyer standing at a market with a phone in hand, often in bright light, reads on a result card and on the offer page
**where the offer is** — the point name, the address with distance, and who sells it — without squinting or bringing
the phone closer.

## 2. Verified facts about today's behavior (code at the base commit)

| Buyer text | Where | Today | Contrast |
| --- | --- | --- | --- |
| Point name | result card | mockup class `.c .c2`: 13 px / 18 px, `--ink2` `#615b64` | 6.6:1 on white |
| Address · distance | result card | `.c`: 13 px / 18 px, `--ink3` `#6e6871` | 5.4:1 on white |
| Address | offer page, point block | `.c`: 13 px, `--ink3` | 5.4:1 on white |
| Seller name | offer page, under the point block | `.c`: 13 px, `--ink3` | 5.1:1 on page background `#faf8fb` |
| «Недоступно», point name, seller name | Favourites, unavailable card | `.c .c2`: 13 px, `--ink2` | 6.6:1 |

- The accepted frames `B01` / `B02` draw these exact lines with `.c` (13 px, `--ink3`): today's screens match the mockup.
- None of these lines is 12 px; UXA's «12 px» is inaccurate (as UXD already noted). They already pass WCAG AA 4.5:1.
  The real gaps are a small size (13 px), the lightest grey of the palette, and a size fixed in px, so the lines do
  not grow when the buyer raises text size in the browser (the opening-hours line next to them, in `rem`, does).
- What is 12 px on buyer screens: bottom-navigation labels, the freshness plaque on the photo, badges and the
  photo-fallback text. They are not the lines UXA names and are out of scope (§4).
- The result card is one shared component used by Search, «Рядом» and Favourites; the offer page body is shared with
  the seller's buyer previews («Как видят покупатели» before and after publication).
- `.c` lives in `kaida.css`, the mechanical port of the mockup shared with every seller screen; it is not edited by
  hand (`PROJECT_RULES.md` §18.6).
- No existing test asserts the size or colour of these lines.

## 3. Scope

Only the five line kinds of §2, on the buyer surfaces that show them:

- **Result card** (Search results, «Рядом», available Favourites entries): point name; address · distance.
- **Offer page** (and the seller previews that render it): address in the point block; seller name line.
- **Favourites, unavailable card:** «Недоступно», point name, seller name — so a Favourites list does not mix two text
  treatments.

For these lines (values per decision D1, recommended):

1. size 14 px with a 20 px line, instead of 13 / 18;
2. colour `--ink2` (`#615b64`) for all of them, instead of `--ink3` where it is used;
3. the size follows the buyer's text-size setting (relative unit), as the opening-hours line already does (D3);
4. long addresses and names wrap by words; nothing is truncated or pushed off screen.

Content, order, wording, data and actions stay exactly as they are. The style is scoped to the buyer lines; seller
screens and the shared mockup stylesheet are untouched.

## 4. Explicit out of scope

- Seller screens, including the seller form footnotes UXA also names (`.fld .hint`, 13 px): a seller-side item, not
  B-READABILITY; it would revise seller contracts and mockup frames separately.
- The opening-hours status line and the week schedule (`card-opening-hours`: 13 px semibold, state colours, measured
  contrast) — unchanged.
- Product name, price and price basis (`card-price-packaging`), freshness plaque (`offer-actuality`), badges, contact
  and route buttons, bottom-navigation labels, the photo fallback.
- Other `.c` texts on buyer screens: results caption («Сначала актуальные»), «Ещё» hints and disclaimer, photo error,
  translation status, empty-state and error lines, preview strip.
- Any change to layout, card composition, photo size, information shown, strings, i18n keys, search, data or API.
- A general type-scale or palette revision, desktop layouts, Kazakh proofreading.
- The other UX audit items (B-HOME-APPETITE, B-RESULTS-META, B-NEARBY-DEADENDS, O-PRELAUNCH-COPY, …).

## 5. Expected modules and boundaries

- Buyer presentation layer only: the shared buyer result card, the shared offer-details body, the Favourites
  unavailable card, and a buyer-scoped style for the secondary line.
- Not touched: `src/app/seller/kaida.css` (mechanical mockup port, §18.6), seller `_kaida` components, seller screens,
  the opening-hours component, server code, API, database, i18n catalogs.
- At implementation the approved deviation is recorded in «Известные расхождения с решениями PO» of
  `docs/product/mockup/seller-ai-first-rev1/README.md` (the channel §18.1 prescribes).

## 6. Closed contracts and boundaries affected

| Contract | Conflict | Consequence | Approval needed |
| --- | --- | --- | --- |
| `buyer-screens-mockup` (AC 3 «result card matches B01», AC 6 «offer page matches B02») and `PROJECT_RULES.md` §18.1 fidelity («нельзя отличить от кадра — шрифты») | B01 / B02 draw these lines 13 px `--ink3`; this slice makes them 14 px `--ink2` and scalable | Buyer card and offer page intentionally differ from the accepted frames in size and colour of these lines; composition, order and content stay identical; ~4 px taller card per line pair | PO decision **D2**: approve the deviation (recorded in the mockup README), or ask the designer for updated B01 / B02 frames first |
| `offer-favourites` (unavailable card) | Presentation only: same lines get the new treatment | No content, state, privacy or behavior change | Covered by D1 / D2 |
| `post-publication-buyer-preview`, `pre-publication-buyer-preview` | None: they render the buyer offer page, so the seller sees the new buyer lines — what these contracts promise | Their E2E keep passing; no revision | — |
| `card-opening-hours`, `card-price-packaging`, `offer-actuality`, `search-empty-states`, `PROJECT_RULES.md` §18.6 | None: not changed; `kaida.css` not edited | — | — |

No business, data, privacy or API contract is touched (`PROJECT_RULES.md` §18.2).

## 7. Risk flags

- DB migration — no. Public API — no. Auth/security/privacy — no. Concurrency/atomicity — no. Data loss — no.
  External service — no.
- Actual risk: visual regression on shared components — longer text wrapping at 320 px or with large text, an
  accidental change to seller screens through the shared stylesheet, or crowding the card's action row. Covered by
  AC 6–9.

## 8. Product Owner decisions needed

- **D1 — values.** Recommended: 14 px / 20 px line, colour `--ink2` (`#615b64`, 6.6:1 on white, 6.2:1 on the page
  background) for all lines of §3. Alternatives: 14 px with today's colours; or darker only (13 px, `--ink2`). The
  main text (`--ink`, 16 px+) stays stronger so the card keeps its hierarchy.
- **D2 — mockup deviation.** Recommended: approve the deviation from B01 / B02 for these lines, recorded in the mockup
  README; the PO checks it on a real phone during acceptance. Alternative: request updated frames from the designer
  first (blocks the slice until they arrive).
- **D3 — follow the text-size setting.** Recommended: yes — the lines grow with the buyer's browser/system text size
  (as the opening-hours line does). Alternative: fixed 14 px.

## 9. Acceptance criteria

1. On a result card (Search, «Рядом», available Favourites entry) the point name and the address · distance line are
   shown with the D1 size and colour; product name and price look as before.
2. On the offer page the address in the point block and the seller name line have the D1 size and colour; the point
   name, comment, price and buttons look as before.
3. On the Favourites unavailable card «Недоступно», point name and seller name have the D1 size and colour.
4. Text, order and data of all these lines are unchanged in RU and KK; no new or changed strings.
5. Every changed line keeps contrast ≥ 4.5:1 on its actual background; the opening-hours line and schedule are
   unchanged (size, weight, state colours, icons).
6. At 320 px and 360 px width, in RU and KK, with a long address and a long point name: lines wrap by words, nothing is
   cut or overlapping, no horizontal scroll; route and contact buttons stay 44 × 44 and in their row.
7. With text size raised to 200 % (D3): the changed lines grow, and AC 6 still holds.
8. Seller screens are visually unchanged (same size and colour of `.c` texts as before); the seller previews
   «Как видят покупатели» show the new buyer lines.
9. Other buyer secondary texts listed in §4 are unchanged; on a desktop-width window the centred phone column renders
   the same lines without breakage.
10. PO, on a real phone in normal use (outdoors if possible), reads point, address · distance and seller without
    bringing the phone closer, and confirms the card still reads name → price → where.

## 10. Verification plan (after approval)

- E2E (mobile RU, new spec): computed size and colour of the lines of AC 1–3; no horizontal overflow at 320 px in RU
  and KK with long data; growth and no overflow at 200 % root text size; one seller screen keeps its `.c` size and
  colour. No unit or integration tests: no logic, data or API changes.
- Existing buyer and preview E2E pass unchanged (they assert content and behavior, not these styles).
- Full `pnpm verify` and branch CI on the final head; diff audit that `kaida.css`, seller components, server code and
  i18n catalogs are untouched.
- Before/after screenshots (360 px, RU) of the result card, offer page and Favourites in the implementation PR.

## 11. Manual acceptance (PO, real phone, RU)

1. Search «баранина» (or any product with offers) and look at the result cards: point name and «address · distance»
   are larger and darker than before; name and price still lead.
2. Open a card: the address under the point and the seller line read easily; the opening hours look as before.
3. Open «Рядом» and Favourites (sign in if needed): the same lines look the same way.
4. Raise the phone's text size and repeat step 1: lines grow, nothing is cut off.
5. As a seller, open «Как видят покупатели» on a card: its offer page shows the same buyer lines; seller screens look as
   before.

Mobile + RU is the gate (`PROJECT_RULES.md` §18.5); KK and desktop are checked automatically for no breakage only.
