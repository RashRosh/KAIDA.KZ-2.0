# KAIDA.KZ 2.0

KAIDA.KZ помогает покупателю понять, **где сейчас купить нужный товар**, а продавцу — быстро поддерживать свои предложения актуальными.

Это не интернет-магазин и не путеводитель по рынкам. Центральная сущность продукта — **Offer**: текущее предложение конкретного продавца в конкретной торговой точке.

Базовый цикл продукта:

```text
Seller Input
→ Normalization / Processing
→ Offer
→ Search / Matching / Discovery
→ Buyer Action
```

П1 = покупатель.
П2 = продавец.

## Что важно в продукте

- покупатель ищет конкретный товар и видит, где он есть сейчас;
- Location может быть магазином, павильоном, киоском, домашней точкой, местом на рынке и т. п.; рынок не является центром архитектуры;
- свежесть Offer — ключевая часть ценности: продавец регулярно подтверждает или обновляет предложение;
- покупатель связывается с продавцом напрямую — звонок, маршрут, поддерживаемые мессенджеры;
- AI в будущем помогает сформировать Seller Change Set, но **никогда не изменяет Offer напрямую**;
- пользовательский поисковый запрос и канонический Product — разные сущности;
- подписка продавца, удобство массового ввода и продвижение Offer — разные механизмы монетизации.

## Как развивается проект

KAIDA.KZ строится маленькими независимыми vertical slices. Каждый product slice должен закрывать одну пользовательскую задачу полностью:

```text
UI → API → business logic → DB → tests → manual acceptance
```

Следующий product slice начинается только после закрытия предыдущего checkpoint, если Product Owner явно не согласовал отдельную независимую maintenance-задачу.

Текущая очередь работ **не хранится в README**. Единственный канонический источник текущего порядка и inserted/reprioritized этапов:

- [`docs/product/EXECUTION_PLAN.md`](docs/product/EXECUTION_PLAN.md)

Долгосрочная карта capabilities и зависимостей:

- [`docs/product/FEATURE_MAP.md`](docs/product/FEATURE_MAP.md)

## Источники истины

Перед любой работой агент или разработчик должен начать с [`AGENTS.md`](AGENTS.md).

Основные документы имеют разные роли:

- [`docs/PROJECT_RULES.md`](docs/PROJECT_RULES.md) — процесс разработки, verification и устойчивые архитектурные/product boundaries;
- [`docs/product/EXECUTION_PLAN.md`](docs/product/EXECUTION_PLAN.md) — текущий checkpoint, NEXT и committed/insertion-candidate очередь;
- [`docs/product/FEATURE_MAP.md`](docs/product/FEATURE_MAP.md) — долгосрочная capability/dependency map;
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — visual/presentation rules;
- [`docs/product/UX_REFERENCE_INDEX.md`](docs/product/UX_REFERENCE_INDEX.md) — маршрутизация по внешним UX references;
- `docs/slices/**/SLICE_CONTRACT.md` — точное поведение отдельного slice и историческое evidence закрытых contracts;
- GitHub Issues — подробные требования к ещё не закрытой работе.

Если status-текст в старом документе, issue или чате расходится с фактическим repository state, сначала проверяются `main`, tags, CI и `EXECUTION_PLAN.md`.

## Архитектурные принципы MVP

MVP — **modular monolith**. Микросервисы, отдельный search cluster, event bus, vector DB и другие инфраструктурные усложнения не добавляются без измеримой необходимости.

Функциональные области появляются только когда их требует конкретный slice: Identity, Sellers, Locations, Catalog, Offers, Search, Discovery, Seller Input, Media, Reviews, Moderation, Notifications, Monetization, Analytics и AI Processing.

Seller Input не пишет Offer напрямую. Базовая граница:

```text
Seller Input
→ SellerChangeSet
→ SellerChangeItem(s)
→ confirmation / apply
→ Offer
```

## Технологический стек

- Node.js 24;
- pnpm 11.19.0;
- Next.js 16 App Router / Route Handlers;
- React 19;
- TypeScript strict;
- PostgreSQL 18;
- Drizzle ORM;
- Zod;
- Vitest;
- Playwright Chromium.

SQLite/mock database не заменяет PostgreSQL integration environment. Docker используется для локального PostgreSQL.

## Локальный запуск

```bash
git clone https://github.com/RashRosh/KAIDA.KZ-2.0.git
cd KAIDA.KZ-2.0
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

Для test OTP нужен локальный HMAC secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Значение сохранить в `.env` как:

```text
IDENTITY_OTP_HMAC_SECRET_HEX=<64 hex characters>
```

Далее:

```bash
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Приложение: `http://localhost:3000`.

Полный regression suite:

```bash
pnpm verify
```

`pnpm verify` включает lint, typecheck, migrations, seed, clean test DB preparation, unit, integration, production build и E2E.

## Авторизация и public launch

На закрытом тесте используется phone → dynamic test OTP → database-backed session. Реальный SMS provider подключается отдельным launch-stage изменением; test OTP нельзя считать production-ready механизмом.

Public launch требует отдельной проверки delivery, abuse/rate-limit, secrets и Secure-cookie поведения. Точные launch requirements должны подтверждаться актуальными contracts и Execution Plan, а не историческим README.

## Где смотреть историю

Исторические Slice Contracts, verification docs, tags и Git history сохраняются как evidence. Они не должны превращаться в параллельный текущий roadmap.
