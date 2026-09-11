# KAIDA.KZ 2.0

Текущий завершённый slice: S1 Offer Lifecycle. S0 First Search сохранён: анонимный покупатель вводит точное название товара и получает предложения из PostgreSQL. S1 добавляет фильтрацию неактуальных Offers без изменения публичного Search API или UI.

Статус ветки S1: **READY — automated verification and manual acceptance PASS**. Контрольная версия после завершения S1: `v0.0.2-s1`.

## Что потребуется

- Node.js 24 LTS (версия в `.node-version`).
- pnpm 11.19.0 (версия в `package.json`).
- Docker с Compose v2 для PostgreSQL 18.
- Chromium Playwright и системные зависимости для E2E.

Next.js 16, TypeScript strict, Drizzle, Zod, Vitest и Playwright устанавливаются из lockfile. Docker запускает только БД. Приложение работает отдельным Node-процессом.

## Чистая установка

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

В PowerShell вместо `cp` можно использовать `Copy-Item .env.example .env`. Если Corepack не установлен, установите pnpm 11.19.0 штатным способом для вашей системы.

Откройте [localhost:3000](http://localhost:3000).

При первом запуске контейнер создаёт `kaida` и через `docker/init/01-create-test-db.sql` отдельную `kaida_test`. Данные PostgreSQL 18 сохраняются в Docker volume, смонтированном в `/var/lib/postgresql`. Остановка: `docker compose stop`.

`.env.example` содержит только локальные тестовые учётные данные. Используются `DATABASE_URL`, `TEST_DATABASE_URL` и `OFFER_VALIDITY_PERIOD_HOURS`. `.env` не коммитится. Next.js, Drizzle и тестовые команды читают `.env` в корне. При недоступной БД API возвращает безопасную ошибку 503.

## Offer Lifecycle S1

Offer видим покупателю только если:

```text
status = active AND last_confirmed_at > cutoff
cutoff = now - OFFER_VALIDITY_PERIOD_HOURS
```

`status` допускает только `active | inactive`. `expired` как status не хранится, `expires_at` отсутствует.

`OFFER_VALIDITY_PERIOD_HOURS=168` является только техническим default S1, а не утверждённой продуктовой политикой. Значение валидируется как positive integer в одном Offers config layer. Internal/test override проходит ту же validation.

Один Search operation захватывает текущее время один раз и передаёт вычисленный cutoff в read-path. Runtime lifecycle filtering не использует PostgreSQL `now()`/`CURRENT_TIMESTAMP`. PostgreSQL `CURRENT_TIMESTAMP` используется только для backfill существующих S0 Offers во время migration S1.

Публичный endpoint остаётся прежним:

`GET /api/search?q=...`

Lifecycle-поля в response не выходят. Product с expired/inactive Offer возвращает обычный успешный empty result.

## Сценарии Search

| Запрос | Результат |
| --- | --- |
| `баранина` | Баранина, 4 200 ₸ / кг, Асыл Ет, точка, адрес, Свежий привоз. |
| `БАРАНИНА` или `  баранина  ` | То же предложение |
| `говядина` | Предложение и Цена не указана |
| `единорог` | По вашему запросу ничего не найдено. |
| Пустая строка | Введите название товара. |
| Product с expired/inactive Offer | По вашему запросу ничего не найдено. |

Поиск точный, без учёта регистра и крайних пробелов. Части слов, категории, синонимы, опечатки и AI не поддерживаются.

## База, миграции и seed

Четыре продуктовые таблицы остаются неизменными по количеству: `products`, `sellers`, `locations`, `offers`. История миграций хранится в служебной схеме `drizzle`.

```bash
pnpm db:generate --name=change_name
# Изучите сгенерированный SQL перед применением.
pnpm db:migrate
```

Schema push не используется. Migration chain:

- `0000_s0_first_search.sql` — исходная S0 schema, не изменена S1;
- `0001_s1_offer_lifecycle.sql` — добавляет `status` и `last_confirmed_at`, backfill existing Offers, CHECK и NOT NULL без permanent lifecycle defaults.

`pnpm db:seed` загружает два товара, продавца, точку и два предложения. UUID и старые business values фиксированы. Каждый запуск освежает `last_confirmed_at` только у двух собственных fictional seed Offers и оставляет их `active`. Произвольные Offers seed не обновляет.

## Тесты и verify

Один раз установите браузер:

```bash
pnpm exec playwright install --with-deps chromium
```

Полная проверка при работающем PostgreSQL:

```bash
pnpm verify
```

Последовательность остаётся единой: lint, typecheck, migrations/seed в `kaida`, пересоздание схем `kaida_test`, clean migration chain, repeat migration/seed, unit, integration, production build, E2E. Команда останавливается при первой ошибке.

S1 дополнительно проверяет:

- config validation и fixed clock без `sleep`;
- lifecycle boundary `cutoff + 1 ms / == cutoff / cutoff - 1 ms`;
- inactive Offer;
- реальный S0 → S1 upgrade на отдельной временной PostgreSQL 18 database `kaida_s1_upgrade_test`;
- сохранность S0 Offer IDs/business fields;
- реальный PostgreSQL CHECK;
- отсутствие lifecycle DB defaults;
- lifecycle E2E через существующий Search UI на mobile и desktop без test/debug API.

Перед сбросом тестовой БД проверяются URL, фактическое имя `kaida_test` и PostgreSQL 18. Integration и E2E используют `TEST_DATABASE_URL`. Playwright запускает отдельный production-сервер на порту 3100 с этой БД; существующий сервер не переиспользуется.

Отдельные команды:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm db:test:prepare
pnpm test:integration
pnpm build
pnpm test:e2e
```

Mock/SQLite замены PostgreSQL нет. GitHub Actions поднимает реальный PostgreSQL 18 и запускает тот же `pnpm verify`.

## Ручная приёмка S1

Ручная приёмка выполнена **2026-09-11** в GitHub Codespaces через существующий Search UI и реальный PostgreSQL 18.

Проверено вручную:

- normal seed;
- `баранина` visible;
- `говядина` visible + `Цена не указана`;
- `единорог` empty;
- empty query validation;
- active lamb, искусственно состаренный на 169 часов → hidden;
- fresh restore → visible;
- fresh `inactive` lamb → hidden;
- seed restore;
- mobile ~390–400 px;
- desktop layout;
- keyboard/focus regression.

Результат: **PASS**.

Никаких lifecycle/debug/test endpoints, временных UI-кнопок или admin route для этого не добавлялось.

## Границы реализации

`UI → /api/search → Search application → read repository → PostgreSQL`. HTTP и UI не обращаются к таблицам. Владельцы таблиц: Catalog, Sellers, Locations, Offers. Offers владеет lifecycle semantics; Search только использует готовые cutoff/visibility rules.

Единственный продуктовый endpoint по-прежнему `GET /api/search?q=...`. Цена передаётся decimal string или `null`. Ошибки: `INVALID_QUERY` (400) или `SEARCH_UNAVAILABLE` (503), без внутренних деталей.

Plus Jakarta Sans поставляется локально из npm-пакета; кириллица использует системный Arial/sans-serif fallback. Внешних запросов к шрифтовым сервисам нет. Данные вымышлены.

Требования S1: [Feature Spec](docs/slices/S1-offer-lifecycle/FEATURE_SPEC.md), [Migration / Model Contract](docs/slices/S1-offer-lifecycle/MIGRATION_MODEL_CONTRACT.md), [Implementation Contract](docs/slices/S1-offer-lifecycle/IMPLEMENTATION_CONTRACT.md). Фактическая проверка: [Verification](docs/slices/S1-offer-lifecycle/VERIFICATION.md). Общие правила: [Project Rules](docs/PROJECT_RULES.md).
