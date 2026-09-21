# KAIDA.KZ 2.0 — UX Reference Index

## Status

`AUDITED / APPROVED` — Product Owner approved the Issue #37 UX corpus reconciliation. No blocking GAP was found for the next scheduled slice, Seller Entry (#35).

This file maps external UX reference material to KAIDA.KZ UI areas. It is **not** a product contract and does not override `docs/PROJECT_RULES.md`, closed Slice Contracts or `docs/DESIGN_SYSTEM.md`.

Reference corpus folder supplied by Product Owner:

https://drive.google.com/drive/folders/1y0IGHOKeGmOcgr7fMeO_ZITSDJyUozUa

(The link previously recorded here — `1Yb8ZWU5JnyzL4nj_7LS1SxRiW7tTEjk-` — resolves to an empty shortcut folder named `UX-UI`; the actual 26-file corpus lives at the link above, titled `UX-UI — гайдлайны e-commerce`. Corrected 2026-09-21 after a broken-link check.)

## How agents must use this index

For a UI/UX Slice Contract or implementation:

1. establish current repository state and closed contracts;
2. read `docs/DESIGN_SYSTEM.md`;
3. use this index to select only the references relevant to the user task;
4. compare reference guidance with KAIDA product semantics;
5. classify findings as `KEEP`, `ADAPT`, `REJECT`, or `GAP`;
6. never silently change a closed contract because a generic e-commerce guide recommends another pattern.

Definitions:

- `KEEP` — current KAIDA rule already fits;
- `ADAPT` — useful principle, adapted to KAIDA rather than copied literally;
- `REJECT` — unsuitable, irrelevant, or conflicting with product/closed contract;
- `GAP` — potentially useful rule absent from current product/Design System and requiring Product Owner decision before implementation.

The corpus is largely about conventional e-commerce. KAIDA.KZ is not a checkout marketplace: the central unit is a fresh local Offer, place/freshness matter heavily, and the buyer action is direct seller contact. Guidance about cart, checkout, payment or delivery is therefore not automatically applicable.

---

## Search / app search shell

Primary reference:

- `UXUI поисковой строки в интернет-магазине 177 гайдлайнов.md`
  https://drive.google.com/file/d/12VXVN9FLG4dAxLEXqwLT4Wqd9Nm404QU/view

Use for:

- visibility and stable placement of Search;
- field width, placeholder, icon treatment;
- interaction consistency and visual noise;
- mobile considerations;
- error/loading/feedback ideas when compatible with closed Search semantics.

Do not copy automatically:

- sticky Search/header recommendations;
- catalog adjacency assumptions;
- any behavior that changes explicit Search submit, accessibility, geo/privacy or current app-shell contracts.

**Follow-up spot-check (2026-09-21):** the reference explicitly names divergent multiple search boxes on one page as an anti-pattern (❌ re:Store example: "из одной строки поиска можно сделать аж три"). Current KAIDA implementation has two search inputs on `/` with different submit behavior (`HeaderSearch` full-page GET reload vs. `SearchForm` client-side fetch). This is a direct, named match to the documented anti-pattern, not an inference — see `GAP` below.

## Search sorting

Primary reference:

- `Проектируем сортировку листинга товаров в интернет-магазине 63 гайдлайна.md`
  https://drive.google.com/file/d/1s5uXSxMKMkmSFKuTtEsgaeJkDVqcIPtU/view

Use for:

- number and naming of sort options;
- compact inline vs dropdown presentation;
- discoverability and feedback;
- avoiding duplicate or competing sort modes.

KAIDA-specific contract direction is Issue #12: `Актуальнее`, `Ближе`, later price sorting; choosing `Ближе` itself triggers explicit browser geolocation. Generic popularity/rating/newness defaults must not replace KAIDA freshness semantics.

## Search filters

Primary reference:

- `Проектируем фильтры в листинге товаров интернет-магазина 155 гайдлайнов.md`
  https://drive.google.com/file/d/1Fyu6KRfQ8bQlY9hCxMGMhg2dOHsqvXs-/view

Use only when a filter slice is actually scheduled. The current product decision is to avoid a giant speculative filter drawer. True filters require supporting data and demonstrated usefulness.

**Follow-up spot-check (2026-09-21, second pass) — zero-result search recovery:** looked for a "no results" / empty-state recovery pattern (e.g. "expand radius", "show nearby anyway") in this reference. The only matching section is "Сброс фильтров" (§10), which is entirely about resetting already-applied filter chips — not applicable, since KAIDA's `SearchForm` has no filters to reset. No other indexed file in this corpus covers a plain query-search zero-result state. **Weak/no corpus evidence** — not classified `ADAPT`; recorded only as an unplaced observation worth revisiting once Search Sorting/filters (Issue #12) actually ships and there is a filter state to recover from.

## Catalog / navigation

Reference:

- `Проектируем каталог товаров в интернет-магазине 152 гайдлайна.md`
  https://drive.google.com/file/d/14AspnEvKfGKEGSnoa_WfCYLf4qdIpgft/view

Use selectively for hierarchy/navigation patterns. Do not turn KAIDA into a conventional store catalog or allow user queries to create Products.

---

## Offer / product cards

Primary reference:

- `Проектируем карточки товаров в листинге интернет-магазина 173 гайдлайна.md`
  https://drive.google.com/file/d/1kVyCAxU6YFLEOx3R9ydZBGz-XaAvBVrU/view

Use for:

- information density and hierarchy;
- removing unjustified empty areas;
- card interactivity and hover/focus feedback;
- price legibility;
- media composition ideas;
- grid/card consistency.

KAIDA adaptations:

- Offer, not generic Product, is the buyer-facing commercial unit;
- freshness and Location are first-class information;
- buyer action is contact/route, not add-to-cart;
- whole-card click behavior must coexist with explicit seller/contact actions and accessibility;
- temporary/demo visual media is permitted before M1 under the Design System boundary.

## Price / unit presentation

Reference:

- `Проектируем цену и скидки на странице товара в интернет-магазине 56 моментов, которые стоит учитывать.md`
  https://drive.google.com/file/d/1UKpOp1NSzw8dySMiwIRIeXJuVbaWJDg5/view

Use for:

- price prominence;
- thousands grouping;
- currency hierarchy;
- making clear what a price refers to for weight/package goods;
- avoiding duplicate/excess price information.

Closed KAIDA contract after `v0.0.23-mandatory-offer-price` wins:

- price amount mandatory for publishable Offer;
- server-owned KZT;
- `unit = null` is valid and means Offer/lot/package price with no `/unit` suffix.

Do not introduce discounts, old-price logic, club pricing or checkout semantics without a separate product decision/slice.

## Media / photos

Primary reference:

- `Фото на странице товара в интернет-магазине 136 гайдлайнов.md`
  https://drive.google.com/file/d/1ReKhvH0UpVwZthvp5A8du9ShkoW3z08a/view

Secondary:

- product-card reference above.

Approved KAIDA boundary:

- temporary/demo/placeholder media presentation is permitted during pre-MVP development, including before M1, when useful for truthful card/layout design;
- it must not be represented as real seller-uploaded Offer media;
- no seller media upload/storage/API/lifecycle semantics before M1;
- M1 still owns real Offer media end-to-end.

## Description / characteristics

Reference:

- `Проектируем характеристики и описание на странице товара в интернет-магазине 101 гайдлайн.md`
  https://drive.google.com/file/d/1BmwfhNzH62ySsEDGS7TRegGqikzEcwT0/view

Use only when a scheduled slice actually exposes richer Offer/Product descriptions. Do not invent attributes/schema from generic e-commerce guidance.

## Favorites / Interests visibility

Reference (newly indexed 2026-09-21, previously not mapped in this file):

- `Проектируем работу с Избранным в интернет-магазине 117 гайдлайнов.md`
  https://drive.google.com/file/d/1b6ycxXqcQGlvyjkCUIAvCeiweeDGCgwc/view

Use for:

- whether/how the save-for-later action is exposed to an unauthenticated visitor;
- non-blocking authentication nudges vs. hiding the affordance entirely;
- icon placement, hover/tap feedback, empty-state presentation.

The reference marks "add to favorites requires login" as ❌ and "visible icon + non-blocking sign-in prompt" as ✅.

KAIDA adaptation — does **not** require touching the closed S13 Interests API/DB contract (`docs/slices/S13-interests/SLICE_CONTRACT.md` keeps anonymous requests at `401`, no anonymous read/write): the button can be rendered to a guest at the UI layer and, on click while anonymous, open the existing Auth modal with a `buyer-interest` caller intent — the same contextual-auth pattern already approved for `Продавцу` in Seller Entry (#35), not a new auth mechanism. This is a presentation-layer `ADAPT`, not a business-contract `GAP`.

## Reviews / rating

Reference:

- `Проектируем рейтинг и отзывы на странице товара в интернет-магазине 146 гайдлайнов.md`
  https://drive.google.com/file/d/1cS7USDXrLYsApD3nNelqXc92tGdDtPW-/view

Reviews/Rating are a planned KAIDA capability, not current data. Do not render fake stars or ratings. Existing KAIDA decisions about review media and moderation belong to their future contracts.

---

## Phone / OTP authentication

Primary reference:

- `Проектируем процесс авторизации по номеру телефона 130 гайдлайнов.md`
  https://drive.google.com/file/d/1qr_073Me3dKbvnO5agTXLozJUEmA5hmf/view

Use for:

- reducing auth friction and visual noise;
- phone autofill/input formatting;
- expectation setting for OTP;
- modal focus/background-scroll behavior;
- mobile usability and field ergonomics.

Preserve S2 API/session/security semantics. Auth reference cannot add new auth methods or weaken current security/anti-abuse boundaries by itself.

**Follow-up spot-check (2026-09-21, second pass):** checked against `AuthModal.tsx` directly — no matches for resend, timer or consent text anywhere in the file. Reference §13 "Повторный запрос кода" gives named ✅/❌ patterns: resend must exist, with a short (≤~1 min) countdown timer, correctly re-enabling after expiry, confirming the resend happened, and reusing the same code rather than issuing a second different one. Classified `GAP`, but implementing it depends on a prerequisite that `S2-auth/FEATURE_SPEC.md` explicitly lists as out of scope: "OTP resend throttling" / "resend policy" / "delivery failure/retry policy" (§ out-of-scope list, also repeated under pre-launch hardening: "resend policy", "delivery failure/retry policy"). A naive resend button could technically re-call the existing `/api/auth/otp/request` endpoint today with no new API, but would ship with no throttling — same category of accepted pre-launch gap as the already-disclosed visible test OTP code, not a silent regression. Needs an explicit scoped decision (ship naive resend now vs. wait for a real resend/throttling slice), not a default UI tweak.

Reference §6 "Согласие с политиками" (consent text near the submit button, no checkbox needed, short, links open in a new tab) is separately `GAP`-behind-a-`GAP`: checked the app tree, there is no Privacy/Terms page to link to yet (`src/app/**/{privacy,terms,policy}*` — none found). This pattern cannot be adopted even at the presentation layer until such a page exists; not actionable now.

## Seller first-run / onboarding

Reference:

- `Проектируем экраны онбординга в мобильном приложении 100 гайдлайнов.md`
  https://drive.google.com/file/d/1rkLbdQM9m_OnhR10JnEyQDnkoLIaziwG/view

Use as heuristic for:

- minimizing first-run barriers;
- focusing on immediate user value;
- avoiding unnecessary steps;
- preserving user intent across setup.

Do not copy mobile app-tour/carousel mechanics literally into the web seller workspace. Current seller direction is defined by Issues #35, #36 and #27.

**Seller Location geo — follow-up spot-check (2026-09-21):** the same reference's "Запросы доступа" section (permission-request patterns) is directly relevant to S8 Location Geo, not just generic onboarding:

- request access with context/explanation before the system prompt (KAIDA already does this via the "на месте" helper text — `KEEP`);
- named ✅ example **Юла** ("Если пользователь решил не предоставлять доступ к геолокации, предоставьте ему альтернативные способы указания местоположения") — Youla is a directly comparable local-classifieds marketplace with physical seller locations, not a generic e-commerce checkout;
- named ✅ example Wildberries for "отработка события отказа" (explain how to grant access later after a denial).

Independently, `Проектируем интерфейс оформления заказа выбор адреса и времени доставки. 162 гайдлайна.md` (otherwise out of scope per this index's cart/checkout exclusion below) documents the same pattern for delivery-address geolocation: geolocation is offered as a time-saving accelerator alongside manual entry, requested only at the relevant step, and denial is handled gracefully rather than blocking the task.

Current KAIDA S8/UX2 implementation requires the seller to be physically at the sales point with no manual/map fallback if geolocation is denied or unavailable. Two independent sources — one a directly comparable competitor — converge on the same alternative-entry recommendation. This is classified `ADAPT` on UX merits, but implementing it is a revision of the closed S8 contract (`docs/slices/S8-location-geo/IMPLEMENTATION_CONTRACT.md` §11–12: browser-only explicit action, no map, no manual coordinates) and requires the `PROJECT_RULES.md` §4 STOP-before-revising-closed-contract procedure and explicit Product Owner sign-off before any Slice Contract adopts it.

## Seller contacts / social / messengers

Reference:

- `Соц.сети и мессенджеры в eCommerce 52 гайдлайна.md`
  https://drive.google.com/file/d/1lO1FaAg956Lnh7DoPnhNxtVbwgEq_WbK/view

Use selectively for contact-action discoverability and messenger UX. KAIDA contacts remain structured Seller identifiers/handles where possible; do not copy generic social marketing, store/catalog duplication or advertising guidance into product contracts.

---

## Broad behavioral references

- `Когнитивные искажения в e-Commerce.md`
- `Когнитивные искажения в e-Commerce. Часть 2.md`

Consult only for a concrete UX question. They do not justify dark patterns, fake urgency or manipulative presentation.

## Currently out of scope references

The folder also contains materials about cart, checkout, delivery time/address, card payment, order confirmation, newsletter subscription, app-install banners, cross-sell, comparison and similar conventional e-commerce flows.

Do **not** read or implement them by default because KAIDA currently has no cart/order/payment/delivery contract. They become relevant only if the corresponding capability is explicitly approved and scheduled.

---

## Issue #37 audit conclusions

The first systematic audit compared the currently relevant KAIDA rules with the reference corpus. Conclusions are intentionally compact so this file remains an index, not a second Design System.

### KEEP

- Search stays obvious, consistently placed and visually low-noise; existing explicit submit/accessibility semantics remain.
- Sorting should expose a small number of understandable, non-competing choices; the current KAIDA direction of freshness/proximity/price is compatible with the reference guidance.
- Offer cards should be dense but not overloaded, avoid unjustified empty areas and keep price easy to scan.
- Price remains prominent, grouped/readable and clearly associated with its unit semantics.
- Auth modal should be low-friction, mobile-friendly, visually quiet and prevent accidental background interaction.
- Seller first-run should minimize barriers and lead quickly to a useful task rather than explaining internal architecture.
- Current responsive/accessibility baseline remains: readable fields, visible focus/labels, adequate touch targets and no accidental horizontal overflow.

### ADAPT

- Generic `whole card clickable` guidance is adapted: card interaction must coexist with explicit contact/route/edit actions and keyboard/accessibility semantics.
- Generic `every product must have a photo` guidance becomes truthful temporary/neutral media presentation before M1; real seller media still requires M1.
- Generic phone-auth ergonomics such as browser phone autofill, readable formatting and concise OTP expectation text may be used as presentation improvements without changing S2 security/API semantics.
- Generic onboarding/app-tour guidance becomes an immediate seller workspace with obvious next tasks; no mandatory tutorial carousel.
- Generic e-commerce sorting defaults become KAIDA-specific `Актуальнее` / `Ближе` / price semantics and remain subordinate to the Freshness Policy.
- Messenger guidance is limited to discoverable supported Seller contact actions, not social-commerce duplication.

### REJECT

- Automatic sticky Search/header or catalog adjacency as universal requirements.
- Popularity/rating/newness as generic default sorting for KAIDA.
- Speculative large filter drawers without supporting data/use case.
- Cart, checkout, delivery, payment, add-to-cart and conventional order-flow patterns in the current product.
- Discount/old-price/club-price presentation without a corresponding KAIDA contract.
- Fake ratings/reviews or other unavailable data.
- Treating real product photos as mandatory before M1 or implying demo media is seller-provided.
- Copying social storefronts, influencer/marketing mechanics or duplicated product catalogs into KAIDA product UI.
- Treating generic UX advice such as `no CAPTCHA` or alternate login methods as permission to weaken future security/anti-abuse requirements.

### GAP

No additional Product Owner decision from this audit is required to prepare the next scheduled slice, **Seller Entry / contextual auth (#35)**.

`UX-OBS-001` in `docs/UX_BACKLOG.md` remains a non-blocking observation about controlled choice vs free input. It should be evaluated only when a relevant seller form Slice Contract makes the decision concrete.

## Follow-up spot-check (2026-09-21)

Ad-hoc spot-check, not a full Issue-driven re-audit like #37. Triggered by a code-based UX walkthrough artifact ("Карта пути KAIDA", П1/П2) prepared ahead of the Issue #36 (Seller Trading Points) Slice Contract, then cross-checked against this corpus at the Product Owner's explicit request rather than accepted as the agent's own unverified opinion. The walkthrough had 6 findings; one (false choice on seller workspace landing) was already covered by the Issue #36 direction itself and is not repeated here. All other 5 were run against this corpus in two passes (2026-09-21).

| # | Finding | Classification | Touches closed contract? |
|---|---|---|---|
| 1 | Mandatory on-site-only geolocation for Location setup, no manual/map fallback | `ADAPT` — two independent sources, incl. a directly comparable competitor (Youla) | **YES — S8.** `IMPLEMENTATION_CONTRACT.md` §11–12 fixes browser-only explicit action, no map, no manual coordinates as closed behavior. STOP procedure required; see `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` (proposal, blocked on Product Owner approval). |
| 2 | Double SellerChangeSet confirmation for trivial seller edits (no quick "confirm as-is") | Not classified — corpus has no e-commerce-seller-confirmation-flow material; the closest general content (cognitive-bias status-quo/consistency sections) doesn't address this question either way | N/A — architectural tradeoff already documented in `docs/DESIGN_SYSTEM.md` §9 (ChangeSet cannot be bypassed); any quick-confirm affordance would sit inside that boundary, not revise it |
| 3 | Buyer interest ("heart") button invisible to guests | `ADAPT` — named ❌/✅ pattern in Favorites reference | **NO.** Checked `S13-interests/SLICE_CONTRACT.md` §9 directly: "Exact visual placement is implementation detail." Anonymous API access stays `401`/no read-write either way — pure presentation-layer fix. |
| 4 | Two search inputs on `/` with different submit behavior (GET reload vs. client fetch) | Direct match to a named anti-pattern in the Search reference (❌ re:Store example) | **NO.** Checked `UX2A-header-responsive/SLICE_CONTRACT.md`: its closed acceptance criteria fix the header submit's *visual pattern* (icon-only square arrow, 44×44px target) only — not the reload-vs-fetch submission mechanism. Currently an **unplaced observation** per `EXECUTION_PLAN.md`'s own UNPLACED GAP rule: not in COMMITTED, INSERTION CANDIDATES or Feature Map. |
| 5 | Search "учитывать моё местоположение" geo toggle resets every page load | Weak/no evidence — the one relevant match (`Проектируем сортировку`, "Память сортировки") is explicitly flagged by its own author as "спорный момент" (debatable), not a recommended pattern | Not evaluated further; insufficient corpus support to classify as `ADAPT` or `REJECT` |

Only finding 1 requires the `PROJECT_RULES.md` §4 STOP procedure before any Slice Contract can adopt it — findings 3 and 4 are implementation-level and don't need Product Owner contract-revision sign-off, only ordinary scheduling. Nothing here was adopted into an open Slice Contract by this spot-check alone; recorded as advisory evidence per this file's own `KEEP/ADAPT/REJECT/GAP` rule, not a parallel roadmap. Findings 1 and 3 also got draft Slice Contracts prepared under `docs/slices/` (see below) — both require explicit approval before implementation, per `docs/product/EXECUTION_PLAN.md`'s "не начинать implementation до approval".

## Follow-up spot-check (2026-09-22)

Source: bundled wireframe artifact commissioned per `docs/product/WIREFRAME_BRIEF.md` — the "second pass" that
brief was written to prepare for. 42 screens, identifiers `1a`–`5e` continuing the first-pass
`KAIDA Wireframes.dc.html` numbering, self-reported as "Мобильный набор по брифу закрыт: 42 экрана, Tier 0–4…
Осталась desktop-раскладка под UX1A/UX2A." Link: https://claude.ai/artifact/5KhjaPcLntxAY4Mk2BC9zF

**Status changed later the same day (2026-09-22):** the table below was originally written under the
`KEEP/ADAPT/REJECT/GAP` discipline used for third-party advisory material. The Product Owner has since judged the
current shipped UX unsatisfactory and elevated this specific artifact to the **authoritative current UX target**
for the presentation layer — see `PROJECT_RULES.md` §18.1. It is no longer filtered through KEEP/ADAPT/REJECT/GAP
to decide *whether* a screen applies; it applies directly, and existing implemented screens are brought into line
with it through each area's ordinary Slice Contract. Closed **business/data** contracts (auth, ownership,
persistence, pricing, ChangeSet architecture) are not reopened by this decision. The table below is kept as a
historical record of the original per-finding read; the "touches closed/blocked contract" column is what still
matters going forward — a `YES` there means new business mechanics, not just presentation, and still needs an
explicit Product Owner answer before implementation per §18.1, not a silent adoption.

| # | Finding | Classification | Touches closed/blocked contract? |
|---|---|---|---|
| 1 | `1a`–`1i`, `2a`–`2i`, `3a`–`3c`/`3e`–`3g` (buyer search/nearby/card/interests, seller cabinet/trading points/Change Set/Offer Workspace/freshness/`Для вас`/Мои интересы) match already-closed S0–S13/#35/#36 behavior, no new business rule | `KEEP` — reference material for the redesign pass, not new scope | NO |
| 2 | `4e` ("1b · Ссылка на карту"): paste a 2ГИС/Google/Yandex Maps link → client-parsed coordinate preview → explicit confirm; unparseable input → "попросим прийти на точку" | Independently converges with the already-drafted mechanism in `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` (paste-and-parse, no embedded map/SDK) | **YES — S8, blocked.** Added as a third convergent source in that draft's Section 0. Still requires explicit Product Owner approval before its Status changes from `PROPOSED — BLOCKED`. |
| 3 | `4a`–`4c`: loading skeleton matching card shape, offline banner + stale-cache "Обновить", three-tier server-error severity (full-screen / local block / toast), explicit "ввод продавца не теряется никогда" | `GAP` — no Slice Contract or `docs/DESIGN_SYSTEM.md` section currently owns cross-cutting system states (checked: only an `--error` color token and two duplicate-submit lines exist today) | NO closed contract touched; recorded as `UX-OBS-002` in `docs/UX_BACKLOG.md`. |
| 4 | `1j`/`1k`/`3a`/`3b`/`3c` fully wireframe Issue #27 (NEXT, Slice Contract not yet approved) and Issues #31/#32 (COMMITTED after #27) | `ADAPT` — good advisory input for those Slice Contracts once each is actually opened, in `EXECUTION_PLAN.md` order | NO — but the artifact must not be read as a finished contract for #27; do not skip the Slice Contract step. |
| 5 | `5a`–`5d` (Notifications, Tariff, Promotion+Payment, Analytics drill-down) fully wireframe S23/S25–S29/S33; `1c`/`4f` deepen freeform/voice/AI-draft review (S17–S19) | Advisory only — **not actionable now** | These capabilities are `После MVP` / `LATER, dependency-gated` per `FEATURE_MAP.md` and `EXECUTION_PLAN.md`. A complete-looking deck is not a scheduling decision; treating it as one would violate `PROJECT_RULES.md` §20 ("не писать весь MVP одним заходом"). |
| 6 | OTP resend button with visible countdown (`0:28`–`0:42`) on `2i` | Concrete UI evidence supporting the existing `GAP` already recorded in the Phone/OTP section above (2026-09-21) | NO — "OTP resend + timer" stays an unscheduled insertion candidate pending explicit Product Owner scheduling; no contract to touch yet. |
| 7 | `5e` Tier 4 stubs (Market scheme, Reviews/rating, Offer video) rendered only as labeled empty slots | `KEEP` — matches current `INSERTION CANDIDATES` treatment in `EXECUTION_PLAN.md` exactly | NO |

Nothing here was adopted into an open Slice Contract by this spot-check alone. `docs/product/WIREFRAME_BRIEF.md`
updated to record this pass's tier coverage.

**2026-09-22, later same day — Product Owner elevation to authoritative UX target (`PROJECT_RULES.md` §18.1):**
this reclassifies rows 1, 4 and 7 above from advisory `KEEP`/`ADAPT` to directly-adopted target UI — no further
KEEP/ADAPT gate needed to use them as the design for their respective screens. Row 3 (`UX-OBS-002`, cross-cutting
loading/offline/error states) and row 2 (S8 paste-and-parse geo fallback, already Product-Owner-approved per
`docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` but awaiting `EXECUTION_PLAN.md` scheduling) remain
the two items in this table that introduce genuinely new business mechanics rather than pure presentation — both
still require an explicit Product Owner answer before any implementation adopts them, per §18.1's carve-out. Row 5
(Tier 3, После MVP) is unaffected: a complete-looking screen still isn't a scheduling decision on its own.

## Audit lifecycle

Issue #37 and PR #40 contain the maintenance evidence for the original audit. Live gate status and current execution order belong to `docs/product/EXECUTION_PLAN.md`, not this index.
