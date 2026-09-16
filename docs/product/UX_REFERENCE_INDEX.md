# KAIDA.KZ 2.0 — UX Reference Index

## Status

`PRE-AUDIT` — initial index created for Issue #37.

This file maps external UX reference material to KAIDA.KZ UI areas. It is **not** a product contract and does not override `docs/PROJECT_RULES.md`, closed Slice Contracts or `docs/DESIGN_SYSTEM.md`.

Reference corpus folder supplied by Product Owner:

https://drive.google.com/drive/folders/1Yb8ZWU5JnyzL4nj_7LS1SxRiW7tTEjk-?usp=sharing

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
- `GAP` — potentially useful rule absent from current product/Design System; requires Product Owner decision before implementation.

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
- error/loading/feedback ideas when compatible with closed S0 semantics.

Do not copy automatically:

- sticky Search/header recommendations;
- catalog adjacency assumptions;
- any behavior that changes explicit Search submit, accessibility, geo/privacy or current app-shell contracts.

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
- photos are not required to be real seller media before M1.

## Price / unit presentation

Reference:

- `Проектируем цену и скидки на странице товара в интернет-магазине 56 моментов, которые стоит учитывать.md`
  https://drive.google.com/file/d/1UKpOp1NSzw8dySMiwIRIeXJuVbaWJDg5/view

Use for:

- price prominence;
- thousands grouping;
- currency hierarchy;
- explaining what price refers to for weight/package goods;
- avoiding duplicate/excess price information.

Closed KAIDA contract after `v0.0.23-mandatory-price` wins:

- price amount mandatory for publishable Offer;
- server-owned KZT;
- `unit = null` is valid and means Offer/lot/package price with no `/unit` suffix.

Do not introduce discounts, old-price logic, club pricing or checkout semantics without a separate product slice.

## Media / photos

Primary reference:

- `Фото на странице товара в интернет-магазине 136 гайдлайнов.md`
  https://drive.google.com/file/d/1ReKhvH0UpVwZthvp5A8du9ShkoW3z08a/view

Secondary:

- product-card reference above.

Explicit Product Owner override to reconcile in Issue #37:

- temporary/demo/placeholder media presentation is permitted during pre-MVP development, including before M1, when useful for truthful card/layout design;
- it must not be represented as real seller-uploaded Offer media;
- no seller media upload/storage/API/lifecycle semantics before M1;
- M1 still owns real Offer media end-to-end.

The UX audit must update `docs/DESIGN_SYSTEM.md` so the older absolute pre-M1 prohibition no longer conflicts with this decision.

## Description / characteristics

Reference:

- `Проектируем характеристики и описание на странице товара в интернет-магазине 101 гайдлайн.md`
  https://drive.google.com/file/d/1BmwfhNzH62ySsEDGS7TRegGqikzEcwT0/view

Use only when a scheduled slice actually exposes richer Offer/Product descriptions. Do not invent attributes/schema from generic e-commerce guidance.

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

Preserve S2 API/session/security semantics. Auth reference cannot add new auth methods or weaken current security boundaries by itself.

## Seller first-run / onboarding

Reference:

- `Проектируем экраны онбординга в мобильном приложении 100 гайдлайнов.md`
  https://drive.google.com/file/d/1rkLbdQM9m_OnhR10JnEyQDnkoLIaziwG/view

Use as heuristic for:

- minimizing first-run barriers;
- focusing on immediate user value;
- avoiding unnecessary steps;
- preserving user intent across setup.

Do not copy mobile app-tour mechanics literally into the web seller workspace. Current seller direction is defined by Issues #35, #36 and #27.

## Seller contacts / social / messengers

Reference:

- `Соц.сети и мессенджеры в eCommerce 52 гайдлайна.md`
  https://drive.google.com/file/d/1lO1FaAg956Lnh7DoPnhNxtVbwgEq_WbK/view

Use selectively for contact-action discoverability and messenger UX. KAIDA contacts remain structured Seller identifiers/handles where possible; do not copy generic social marketing, store/catalog duplication or advertising guidance into product contracts.

---

## Broad behavioral references

- `Когнитивные искажения в e-Commerce.md`
- `Когнитивные искажения в e-Commerce. Часть 2.md`

These may be consulted for a specific UX question, but they are not default requirements and must not justify dark patterns, fake urgency or manipulative presentation.

---

## Currently out of scope references

The folder also contains materials about cart, checkout, delivery time/address, card payment, order confirmation, newsletter subscription, app-install banners, cross-sell, comparison and similar conventional e-commerce flows.

Do **not** read or implement them by default because KAIDA currently has no cart/order/payment/delivery contract. They become relevant only if the corresponding capability is explicitly approved and scheduled.

---

## Audit record

Issue #37 owns the first systematic reconciliation. Until it is closed, this index is a navigation aid, not proof that every listed reference has been fully audited.

After Issue #37, update this section with the audit checkpoint/PR and keep the index focused on source selection. Do not turn it into a second Design System or a second roadmap.
