# KAIDA.KZ 2.0

KAIDA.KZ помогает покупателю понять, **где сейчас купить нужный товар**, увидеть актуальные предложения поблизости и связаться с продавцом напрямую.

Это не интернет-магазин с корзиной и checkout. Центральная сущность продукта — **Offer**: текущее подтверждённое предложение конкретного продавца в конкретной точке продажи.

Базовый продуктовый цикл:

`Seller Input → SellerChangeSet → Offer → Search / Discovery → Buyer Action`

П1 = покупатель.  
П2 = продавец.

## Что уже работает

Последний verified product checkpoint: **`v0.0.23-mandatory-offer-price`**.

Закрыты и считаются product contracts:

- S0–S13;
- UX1A, UX1A.1, UX1A.2, UX1B, UX1C, UX1D;
- UX2, UX2A;
- Mandatory Offer Price.

Фактически уже существуют:

- анонимный Search по реальным seller Offers;
- lifecycle Offer и исключение просроченных предложений;
- phone/OTP test auth и persistent session;
- Seller и Location;
- SellerChangeSet / SellerChangeItem для создания и изменения Offers;
- Product catalog + aliases;
- geo Location и transient buyer location;
- детерминированный Search ranking;
- buyer actions: телефон, мессенджеры, маршрут;
- Nearby;
- batch manual Seller ChangeSet;
- explicit Buyer interests;
- responsive app shell и базовый seller flow;
- обязательная цена для publishable Offer.

Цена для publishable Offer сейчас обязательна: `price.amount >= 0`, `0` допустим, currency server-owned `KZT`, `unit = null` означает цену за Offer/лот/упаковку без `/unit` в buyer presentation.

## Что делаем сейчас

Текущая очередь **не берётся из README**. Канонический источник — [`docs/product/EXECUTION_PLAN.md`](docs/product/EXECUTION_PLAN.md).

На текущем checkpoint следующий обязательный gate — **Issue #37: UX reference audit and Design System reconciliation**. Он включает сначала нормализацию живых проектных документов, затем сверку Design System с утверждённым UX-reference corpus.

После закрытия #37 ближайший committed contour:

`Seller Entry (#35) → Trading Points (#36) → Seller Offer Workspace (#27) → Freshness Policy (#31) → Freshness Reminder (#32) → Nearby correction (#34) → Search Sorting (#12) → M1 Offer media`

Если очередь меняется, обновляется `EXECUTION_PLAN.md`; README остаётся обзором продукта, а не вторым roadmap.

## Ключевые продуктовые правила

### Offer и актуальность

Offer — не карточка товара «вообще», а утверждение продавца о том, что товар доступен сейчас в конкретной Location.

Свежесть — часть ценности KAIDA.KZ. Текущий closed lifecycle уже использует `last_confirmed_at`. Новая утверждённая policy `2 / 7 / 14` и proactive seller reminder зафиксированы в Issues #31 и #32 и будут реализовываться отдельными slices.

### Seller Input

Offer нельзя менять напрямую из seller-input канала.

Инвариант:

`Seller Input → SellerChangeSet → SellerChangeItem → confirmation/apply → Offer`

В будущем текст, голос, фото, видео, web UI и Telegram должны использовать одну бизнес-логику. AI только предлагает Change Set; Seller подтверждает изменения.

### Location

Location — физическая точка продажи. Рынок не является центром архитектуры.

Для больших рынков отдельно зафиксирована future-capability внутренней навигации: `Market → MarketPlace → Seller Location`, Issue #10. Она не должна превращать generic Location в набор nullable `market/row/stall/x/y` полей.

### Buyer action

KAIDA.KZ ведёт покупателя к продавцу, а не в checkout:

- звонок;
- WhatsApp / Telegram / Instagram, если доступны;
- маршрут до Location.

Корзина, заказ, оплата и доставка не добавляются без отдельного product slice.

## Архитектура

MVP — **modular monolith**. Микросервисы, Kafka, отдельный search cluster, vector DB и Kubernetes не добавляются без измеримой необходимости.

Функциональные области появляются только когда их требует slice: Identity, Sellers, Locations, Catalog, Offers, Search, Discovery, Seller Input, AI Processing, Media, Reviews, Moderation, Notifications, Monetization, Analytics.

Техническая база: [`docs/architecture/TECHNICAL_FOUNDATION_V0.md`](docs/architecture/TECHNICAL_FOUNDATION_V0.md).

## Как устроены проектные документы

У каждого типа информации один владелец:

- [`AGENTS.md`](AGENTS.md) — короткий router для агента: что читать в зависимости от задачи;
- [`docs/PROJECT_RULES.md`](docs/PROJECT_RULES.md) — процесс разработки и стабильные архитектурные правила;
- [`docs/product/EXECUTION_PLAN.md`](docs/product/EXECUTION_PLAN.md) — **единственный источник текущей очередности**;
- [`docs/product/FEATURE_MAP.md`](docs/product/FEATURE_MAP.md) — долгосрочная карта capabilities и зависимостей, не roadmap текущего дня;
- GitHub Issues — подробные требования ещё не закрытой работы;
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — UI/presentation rules;
- [`docs/product/UX_REFERENCE_INDEX.md`](docs/product/UX_REFERENCE_INDEX.md) — routing по внешним UX references и результаты UX audit;
- [`docs/UX_BACKLOG.md`](docs/UX_BACKLOG.md) — только короткий inbox ещё не разобранных UX-наблюдений;
- `docs/slices/**/SLICE_CONTRACT.md` и исторические slice docs — точное поведение и evidence конкретных закрытых slices;
- [`docs/agents/KAIDA_CONTROLLER.md`](docs/agents/KAIDA_CONTROLLER.md) — процедура независимой проверки slice.

Фактический `main`, tag и CI всегда проверяются в GitHub. Текст из чата или старый SHA в документе не заменяет repository state.

## Разработка

Проект развивается маленькими vertical slices. Каждый product slice решает одну user task end-to-end и после завершения оставляет заведомо рабочий checkpoint.

Нормальный цикл:

`Slice Contract → implementation → targeted tests → full branch CI → manual acceptance → merge → merged-main CI → annotated checkpoint tag`

Если новый slice требует изменить closed contract, изменение сначала явно согласовывается; соседний рефакторинг «заодно» запрещён.

## Stack

- Node.js 24 LTS;
- pnpm 11.19.0;
- Next.js 16 App Router / Route Handlers;
- React 19;
- TypeScript strict;
- PostgreSQL 18;
- Drizzle ORM;
- Zod;
- Vitest;
- Playwright Chromium.

Docker используется для PostgreSQL. Integration tests работают с реальным PostgreSQL, не с SQLite/mock database.

## Локальный запуск

```bash
git clone https://github.com/RashRosh/KAIDA.KZ-2.0.git
cd KAIDA.KZ-2.0
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Для локального test OTP нужен `IDENTITY_OTP_HMAC_SECRET_HEX`. Сгенерировать 32 random bytes:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Актуальный полный перечень переменных — в [`.env.example`](.env.example).

Открыть: `http://localhost:3000`.

## Verification

Установить Chromium:

```bash
pnpm exec playwright install --with-deps chromium
```

Полный regression:

```bash
pnpm verify
```

`pnpm verify` включает lint, typecheck, migrations, seed, подготовку test DB, unit, integration, production build и E2E.

## Public-launch caveat

Текущий phone auth использует **test OTP** и подходит для закрытого теста. Перед публичным запуском нужен отдельный real-SMS/security gate: provider, rate limiting, brute-force/abuse protection, resend/delivery policy, production secrets и Secure cookie.

Текущая разработка и очередность публичного запуска определяются только через `EXECUTION_PLAN.md` и соответствующие Slice Contracts.
