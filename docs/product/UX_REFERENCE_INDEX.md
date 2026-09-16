# KAIDA.KZ 2.0 — UX Reference Index

**Status:** `PRE-AUDIT / Issue #37`.

Этот файл — **routing/index к внешнему UX corpus**, а не product contract, roadmap или второй Design System.

Product Owner corpus:

https://drive.google.com/drive/folders/1Yb8ZWU5JnyzL4nj_7LS1SxRiW7tTEjk-?usp=sharing

## How to use

Для UI/UX Slice Contract или implementation:

1. установить current repository state и relevant closed contracts;
2. прочитать `docs/DESIGN_SYSTEM.md`;
3. выбрать из этого index только материалы по текущей user task;
4. классифицировать guidance: `KEEP / ADAPT / REJECT / GAP`;
5. GAP/contract change вернуть Product Owner до implementation.

Definitions:

- `KEEP` — KAIDA уже следует полезному правилу;
- `ADAPT` — принцип полезен после адаптации к KAIDA;
- `REJECT` — generic guidance не подходит продуктовой модели/contract;
- `GAP` — полезное отсутствующее правило, требующее решения.

KAIDA.KZ не является checkout marketplace: центральна свежая local Offer, Location/freshness важны, buyer action — прямой contact/route. Cart/checkout/payment/delivery guidance поэтому не применяется автоматически.

## Search shell

Reference:

- `UXUI поисковой строки в интернет-магазине 177 гайдлайнов.md`
- https://drive.google.com/file/d/12VXVN9FLG4dAxLEXqwLT4Wqd9Nm404QU/view

Use for stable placement, field ergonomics, visual noise, mobile behavior, loading/error ideas.

Do not copy automatically sticky header, catalog assumptions или behavior, меняющий closed Search/privacy/accessibility contracts.

## Search sorting

Reference:

- `Проектируем сортировку листинга товаров в интернет-магазине 63 гайдлайна.md`
- https://drive.google.com/file/d/1s5uXSxMKMkmSFKuTtEsgaeJkDVqcIPtU/view

Use for compact option presentation, naming, discoverability and avoiding duplicate sorting controls.

KAIDA direction is tracked by Issue #12: freshness, proximity, later price sorting; `Ближе` itself is the intended explicit geo action. Generic popularity/rating defaults do not replace freshness semantics.

## Search filters

Reference:

- `Проектируем фильтры в листинге товаров интернет-магазина 155 гайдлайнов.md`
- https://drive.google.com/file/d/1Fyu6KRfQ8bQlY9hCxMGMhg2dOHsqvXs-/view

Read only when a filter slice is scheduled. Do not build a speculative giant filter drawer.

## Catalog / navigation

Reference:

- `Проектируем каталог товаров в интернет-магазине 152 гайдлайна.md`
- https://drive.google.com/file/d/14AspnEvKfGKEGSnoa_WfCYLf4qdIpgft/view

Use selectively for navigation hierarchy. Do not turn KAIDA into a conventional store catalog and do not let search queries create Products.

## Offer / product cards

Reference:

- `Проектируем карточки товаров в листинге интернет-магазина 173 гайдлайна.md`
- https://drive.google.com/file/d/1kVyCAxU6YFLEOx3R9ydZBGz-XaAvBVrU/view

Use for information density, card hierarchy, interaction feedback, media composition and price legibility.

KAIDA adaptation:

- buyer-facing unit = Offer, not generic Product;
- freshness/Location are first-class;
- action = contact/route, not add-to-cart;
- Product Owner permits temporary/demo/placeholder media before M1 only under the boundary already recorded in `DESIGN_SYSTEM.md`;
- real seller Offer media remains M1.

## Price / unit

Reference:

- `Проектируем цену и скидки на странице товара в интернет-магазине 56 моментов, которые стоит учитывать.md`
- https://drive.google.com/file/d/1UKpOp1NSzw8dySMiwIRIeXJuVbaWJDg5/view

Use for prominence, grouping, currency and explaining weight/package semantics.

Closed KAIDA rule wins: publishable Offer has mandatory amount, KZT server-owned, `unit = null` means Offer/lot/package price without `/unit` suffix. Do not invent discounts/old-price/club pricing.

## Media / photos

Reference:

- `Фото на странице товара в интернет-магазине 136 гайдлайнов.md`
- https://drive.google.com/file/d/1ReKhvH0UpVwZthvp5A8du9ShkoW3z08a/view

Current approved boundary is already reflected in Design System v1.1:

- temporary/demo/placeholder media may be used pre-MVP for truthful layout design;
- it is not seller-uploaded media;
- no upload/storage/API/lifecycle semantics before M1;
- M1 owns real Offer media end-to-end.

## Description / characteristics

Reference:

- `Проектируем характеристики и описание на странице товара в интернет-магазине 101 гайдлайн.md`
- https://drive.google.com/file/d/1BmwfhNzH62ySsEDGS7TRegGqikzEcwT0/view

Read only when a scheduled slice exposes richer Offer/Product descriptions. Generic attributes do not create schema requirements automatically.

## Reviews / rating

Reference:

- `Проектируем рейтинг и отзывы на странице товара в интернет-магазине 146 гайдлайнов.md`
- https://drive.google.com/file/d/1cS7USDXrLYsApD3nNelqXc92tGdDtPW-/view

Reviews/rating are deferred real capabilities. No fake stars/score before data + moderation contract.

## Phone / OTP auth

Reference:

- `Проектируем процесс авторизации по номеру телефона 130 гайдлайнов.md`
- https://drive.google.com/file/d/1qr_073Me3dKbvnO5agTXLozJUEmA5hmf/view

Use for reducing friction, phone input/autofill, OTP expectation, modal focus/background-scroll and mobile ergonomics.

Preserve S2 security/session/API semantics. New auth methods require separate product work.

## Seller first-run / onboarding

Reference:

- `Проектируем экраны онбординга в мобильном приложении 100 гайдлайнов.md`
- https://drive.google.com/file/d/1rkLbdQM9m_OnhR10JnEyQDnkoLIaziwG/view

Use as heuristic for minimizing barriers, preserving intent and getting to useful action quickly. Do not copy mobile tour mechanics literally. Current seller requirements are Issues #35, #36, #27.

## Seller contacts / messengers

Reference:

- `Соц.сети и мессенджеры в eCommerce 52 гайдлайна.md`
- https://drive.google.com/file/d/1lO1FaAg956Lnh7DoPnhNxtVbwgEq_WbK/view

Use for action discoverability. KAIDA stores structured Seller identifiers/handles where possible; generic social-marketing guidance does not redefine product contracts.

## Broad behavioral references

- `Когнитивные искажения в e-Commerce.md`
- `Когнитивные искажения в e-Commerce. Часть 2.md`

Consult only for a specific UX question. Они не оправдывают dark patterns, fake urgency или manipulative presentation.

## Out of current scope by default

Cart, checkout, delivery, payment, order confirmation, newsletter subscription, app-install banners, conventional cross-sell/comparison and similar e-commerce flows не читаются/не внедряются по умолчанию.

Они становятся relevant только после explicit product decision и scheduled capability.

## Audit record

Issue #37 владеет первой системной сверкой corpus с KAIDA.

До закрытия #37 этот файл является index, а не доказательством, что весь corpus проаудирован.

После audit здесь фиксируется только краткий audit checkpoint/PR и mapping sources. Полные visual rules остаются в `DESIGN_SYSTEM.md`, product requirements — в Issues/Slice Contracts, execution order — в `EXECUTION_PLAN.md`.
