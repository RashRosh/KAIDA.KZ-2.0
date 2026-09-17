# KAIDA.KZ 2.0 — Technical Foundation v0

> **HISTORICAL FOUNDATION.** Этот документ фиксирует архитектурное решение старта S0 и сохраняется как history/evidence. Он **не является текущей инструкцией по очередности, UI или product state**. Текущие правила разработки — `docs/PROJECT_RULES.md`, текущая очередь — `docs/product/EXECUTION_PLAN.md`, фактический stack — `package.json`/repository state. Если текст ниже расходится с более поздним closed contract, побеждает более поздний verified contract.

Этот фундамент был выбран для первых vertical slices. Он не является попыткой заранее спроектировать весь будущий продукт.

## Стек на старте

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

Для первых slices проект не делился на отдельные frontend и backend приложения.

Причина: отдельный backend создавал бы два dev-процесса, отдельный deploy, CORS и больше точек отказа без продуктовой ценности.

При этом бизнес-логика не должна жить в Next.js route handlers.

Структура ответственности:

```text
HTTP → application module → repository → PostgreSQL
```

UI и transport могут позднее быть заменены или вынесены, не меняя бизнес-модули.

## Модульные границы S0

### Catalog

Владеет `Product`.

### Sellers

Владеет `Seller`.

### Locations

Владеет `Location`.

### Offers

Владеет `Offer`: утверждением о том, что конкретный Seller предлагает конкретный Product в конкретной Location.

### Search

Не владеет Product или Offer. Координирует read-case:

```text
query → Product → Offers → search result
```

## Предлагавшаяся структура S0

```text
kaida/
├── src/
│   ├── app/
│   ├── modules/
│   │   ├── catalog/
│   │   ├── sellers/
│   │   ├── locations/
│   │   ├── offers/
│   │   └── search/
│   ├── db/
│   └── shared/
├── tests/
├── drizzle/
├── docs/
├── docker-compose.yml
├── package.json
└── README.md
```

`shared` нельзя превращать в свалку. То, что принадлежит конкретному доменному модулю, остаётся внутри модуля.

## Историческая граница БД S0

S0 создавал только:

- `products`;
- `sellers`;
- `locations`;
- `offers`.

Позднейшие таблицы и invariants появились следующими verified slices и не описываются этим v0-документом.

## API S0

Исторически первым product endpoint был:

`GET /api/search?q=баранина`

CRUD API заранее не создавался.

## Миграции

Изменения БД — через migrations:

```text
schema change → migration → inspect → apply → test
```

Schema push не является штатным способом изменения shared/production DB.

## Тестовая стратегия

### Unit

Проверяют чистую бизнес-логику там, где она реально существует.

### Integration

Работают с настоящим PostgreSQL, а не mock DB.

### E2E

Playwright проверяет пользовательский сценарий через реальный интерфейс.

## Локальная инфраструктура

Docker используется для PostgreSQL; app работает обычным Node/Next process.

Integration tests не должны изменять development database.

## CI

С первого slice CI включал install/lint/typecheck/migrations/tests/build/E2E. Актуальный verification contract определяется `PROJECT_RULES.md` и фактическим workflow.

## Git

Исторический принцип сохраняется: `main` — только проверенное состояние, product slices работают в отдельных branches, checkpoints отмечаются tags.

## Что намеренно не строилось заранее

Без конкретной необходимости не добавлялись:

- отдельный backend service;
- Redis;
- Elasticsearch;
- PostGIS;
- vector DB;
- queues/event bus;
- Kubernetes;
- recommendation service;
- AI orchestration platform;
- сложный CDN/observability stack.

Этот принцип complexity-on-demand остаётся актуальным через `PROJECT_RULES.md`; конкретный список технологий здесь является историческим context.

## Критерий правильности фундамента

После каждого следующего slice система должна оставаться понятной, тестируемой и откатываемой к последнему verified checkpoint. Сложность добавляется только вслед за реальной продуктовой необходимостью.
