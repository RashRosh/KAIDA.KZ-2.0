# KAIDA.KZ 2.0 — Technical Foundation v0

Этот фундамент выбран для первых vertical slices. Он не является попыткой заранее спроектировать весь будущий продукт.

## Стек

| Слой | Решение |
|---|---|
| Runtime | Node.js 24 LTS |
| Язык | TypeScript, strict mode |
| Web | Next.js 16, App Router |
| API | Next.js Route Handlers |
| БД | PostgreSQL 18 |
| ORM / migrations | Drizzle ORM |
| Runtime validation | Zod |
| Unit / integration tests | Vitest |
| E2E | Playwright |
| Package manager | pnpm |
| Стили | CSS Modules + CSS variables |
| Архитектура | modular monolith |
| Git | GitHub, `main` только для проверенных версий |

## Почему один Next.js на старте

Для первых slices не делим проект на отдельные frontend и backend приложения.

Причина: отдельный backend сейчас создаёт два dev-процесса, отдельный deploy, CORS и больше точек отказа, не добавляя продуктовой ценности.

При этом бизнес-логика не должна жить в Next.js route handlers.

Структура ответственности:

`HTTP → application module → repository → PostgreSQL`

UI и transport могут позднее быть заменены или вынесены, не меняя бизнес-модули.

## Модульные границы S0

### Catalog

Владеет `Product`.

Не знает цену, Seller, Location или Search UI.

### Sellers

Владеет `Seller`.

### Locations

Владеет `Location`.

Географическая логика появится только в отдельном slice.

### Offers

Владеет `Offer`, утверждением о том, что конкретный Seller предлагает конкретный Product в конкретной Location.

### Search

Не владеет Product или Offer. Координирует read-case:

`query → Product → Offers → search result`

## Предлагаемая структура S0

```text
kaida/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   └── api/
│   │       └── search/
│   │           └── route.ts
│   ├── modules/
│   │   ├── catalog/
│   │   ├── sellers/
│   │   ├── locations/
│   │   ├── offers/
│   │   └── search/
│   ├── db/
│   └── shared/
├── tests/
│   ├── integration/
│   └── e2e/
├── drizzle/
│   └── migrations/
├── docs/
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
└── README.md
```

`shared` нельзя превращать в свалку. То, что принадлежит конкретному доменному модулю, остаётся внутри этого модуля.

## БД в S0

S0 создаёт только четыре продуктовые таблицы:

- `products`;
- `sellers`;
- `locations`;
- `offers`.

Не создавать заранее User, Category, ChangeSet и другие будущие сущности.

`last_confirmed_at`, expiry и статус Offer появляются отдельной миграцией в S1.

## API в S0

Одна продуктовая endpoint:

`GET /api/search?q=баранина`

Допустим технический health check:

`GET /api/health`

CRUD API для Product/Seller/Location/Offer заранее не создаётся.

## Миграции

Изменения БД только через migrations.

Нормальный процесс:

`schema change → generate migration → inspect SQL → apply → test`

Schema push не считается штатным способом изменения общей/production БД.

## Тестовая стратегия

### Unit

Проверяют чистую бизнес-логику там, где она реально существует. Не писать unit tests ради числа тестов.

### Integration

Работают с настоящим PostgreSQL, а не mock DB.

### E2E

Playwright проходит пользовательский сценарий через реальный интерфейс.

Минимум проверяются mobile и desktop viewport.

## Локальная инфраструктура

Docker используется только для PostgreSQL.

Приложение запускается обычным Node/Next процессом.

Локально должны существовать отдельные базы:

- `kaida`;
- `kaida_test`.

Integration tests не меняют development database.

## CI

С первого slice GitHub Actions должен выполнять минимум:

`install → lint → typecheck → migrations → tests → build → E2E`

Красный CI означает, что slice не готов.

## Git

`main` = только рабочая версия.

Работа над S0:

`slice/s0-search`

После полного Definition of Done и ручной проверки:

- merge в `main`;
- tag `v0.0.1-s0`.

## Дизайн S0

S0 не должен быть технически уродливым, но полноценная дизайн-система не строится.

Разрешены:

- mobile-first responsive layout;
- Plus Jakarta Sans;
- CSS variables;
- фиолетовый primary;
- нормальная типографика;
- поле поиска;
- Offer card;
- loading / empty / error states.

Не подключать UI-kit только ради S0.

## Что намеренно отсутствует

До появления конкретного slice не добавлять:

- отдельный NestJS/Fastify backend;
- Redis;
- Elasticsearch;
- Supabase как платформенный слой;
- PostGIS;
- vector DB;
- queues;
- event bus;
- Kubernetes;
- recommendation service;
- AI orchestration platform;
- сложный CDN;
- auth provider;
- observability stack.

## Критерий правильности фундамента

После каждого следующего slice система должна оставаться понятной, тестируемой и откатываемой к последней рабочей точке. Сложность добавляется только вслед за реальной продуктовой необходимостью.
