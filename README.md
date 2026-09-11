# KAIDA.KZ 2.0

Slice S0: анонимный покупатель вводит точное название товара и получает тестовое предложение из PostgreSQL. Код написан с нуля. Следующие slices не реализованы.

Статус: **READY — S0 verified and manually accepted**. Фактические проверки зафиксированы в [VERIFICATION.md](docs/slices/S0-search/VERIFICATION.md).

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

`.env.example` содержит только локальные тестовые учётные данные. Используются `DATABASE_URL` и `TEST_DATABASE_URL`; `.env` не коммитится. Next.js, Drizzle и тестовые команды читают `.env` в корне. При недоступной БД API возвращает безопасную ошибку 503.

## Сценарии

| Запрос | Результат |
| --- | --- |
| `баранина` | Баранина, 4 200 ₸ / кг, Асыл Ет, точка, адрес, Свежий привоз. |
| `БАРАНИНА` или `  баранина  ` | То же предложение |
| `говядина` | Предложение и Цена не указана |
| `единорог` | По вашему запросу ничего не найдено. |
| Пустая строка | Введите название товара. |

Поиск точный, без учёта регистра и крайних пробелов. Части слов, категории, синонимы, опечатки и AI не поддерживаются.

## База, миграции и seed

Четыре продуктовые таблицы: `products`, `sellers`, `locations`, `offers`. История миграций хранится в служебной схеме `drizzle`.

```bash
pnpm db:generate --name=change_name
# Изучите сгенерированный SQL перед применением.
pnpm db:migrate
```

Schema push не используется. В S0 добавлена только `drizzle/migrations/0000_s0_first_search.sql`.

`pnpm db:seed` явно загружает два товара, продавца, точку и два предложения. UUID и даты фиксированы. Повторный запуск обновляет только эти тестовые записи без дублирования. При `dev`, `start` или `build` seed автоматически не запускается.

## Тесты и verify

Один раз установите браузер:

```bash
pnpm exec playwright install --with-deps chromium
```

Полная проверка при работающем PostgreSQL:

```bash
pnpm verify
```

Последовательность: lint, typecheck, миграции/seed в `kaida`, пересоздание схем **kaida_test**, миграции с нуля и повторное применение, повторный seed, unit, integration, production build, E2E. Команда останавливается при первой ошибке.

Перед сбросом тестовой БД проверяются оба URL, фактическое имя `kaida_test` и PostgreSQL 18. Integration и E2E используют `TEST_DATABASE_URL`. Playwright запускает отдельный production-сервер на порту 3100 с этой БД; существующий сервер не переиспользуется.

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

Integration tests требуют подготовленную `kaida_test`, E2E также требуют build и Chromium. Mock-базы нет. Один E2E намеренно обрывает браузерный запрос для проверки ошибки; успешные поиски идут в реальный PostgreSQL.

GitHub Actions запускает PostgreSQL 18 с двумя БД, затем тот же `pnpm verify`. Последний полный run S0 прошёл успешно: PostgreSQL 18.6, unit 18/18, integration 21/21, E2E 14/14, build и полный `verify` — PASS.

## Ручная приёмка

Ручная приёмка S0 выполнена 2026-09-11 в GitHub Codespaces с реальным PostgreSQL 18.

Проверены desktop и mobile сценарии:

1. `баранина` — цена, продавец, точка, адрес и комментарий отображаются.
2. `говядина` — отображается `Цена не указана`.
3. `единорог` — предыдущая карточка исчезает, показывается empty state.
4. Пустой запрос — показывается понятная validation error.
5. Tab-navigation и видимый focus state работают.
6. После reload повторный поиск работает.
7. Mobile около 400 px читаем и не развален.

Результат: **PASS**.

## Границы реализации

`UI → /api/search → Search application → read repository → PostgreSQL`. HTTP и UI не обращаются к таблицам; ESLint ограничивает такие импорты. Владельцы таблиц: Catalog, Sellers, Locations, Offers. Search строит read-проекцию.

Единственный продуктовый endpoint: `GET /api/search?q=...`. Цена передаётся decimal string или `null`. Ошибки: `INVALID_QUERY` (400) или `SEARCH_UNAVAILABLE` (503), без внутренних деталей.

Plus Jakarta Sans поставляется локально из npm-пакета; кириллица использует системный Arial/sans-serif fallback. Внешних запросов к шрифтовым сервисам нет. Данные вымышлены.

Требования: [Implementation Contract](docs/slices/S0-search/IMPLEMENTATION_CONTRACT.md), [Execution Prompt](docs/slices/S0-search/EXECUTION_PROMPT.md), [Project Rules](docs/PROJECT_RULES.md).
