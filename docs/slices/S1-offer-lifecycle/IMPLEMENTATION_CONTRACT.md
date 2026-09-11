# KAIDA.KZ 2.0 — S1 Implementation Contract

**Slice:** S1 Offer Lifecycle / актуальность предложения  
**Статус:** готов к утверждению, реализация не начата  
**Рабочая ветка:** `slice/s1-offer-lifecycle`  
**База:** утверждённые `FEATURE_SPEC.md` и `MIGRATION_MODEL_CONTRACT.md`  
**Контрольная версия после полного DoD:** `v0.0.2-s1`

## 1. Цель slice

S1 должен добавить ровно одно законченное пользовательское поведение:

> П1 не видит Offer, который больше не является актуальным.

Утверждённое правило видимости:

`visible ⇔ status = active AND last_confirmed_at > cutoff`

где:

`cutoff = now - OFFER_VALIDITY_PERIOD_HOURS`

Boundary строгий:

`last_confirmed_at == cutoff` уже означает, что Offer просрочен и не показывается.

S1 является эволюцией S0. Он не переписывает First Search и не начинает Seller Input, Offer management или S2+.

## 2. Неизменяемые решения S1

Implementation обязан сохранить без переосмысления:

1. `expires_at` отсутствует.
2. `expired` не является status.
3. `status` допускает только `active | inactive`.
4. `last_confirmed_at` является единственной сохранённой временной точкой актуальности Offer.
5. `OFFER_VALIDITY_PERIOD_HOURS` является конфигурацией, а не полем Offer.
6. Technical default равен `168` часам и не является утверждённой продуктовой политикой.
7. Search API S0 не меняется.
8. Lifecycle fields не выходят в публичный Search response.
9. Runtime lifecycle filtering не использует PostgreSQL `now()` / `CURRENT_TIMESTAMP`.
10. Migration backfill может использовать PostgreSQL `CURRENT_TIMESTAMP`.
11. После migration нет постоянных DB defaults для `status` и `last_confirmed_at`.
12. `inactive` в S1 является только состоянием модели и read-filter. Пользовательского write-сценария нет.

Изменение любого пункта требует отдельного согласования до кода.

## 3. Архитектурная ответственность

### 3.1 Offers владеет lifecycle semantics

Модуль Offers обязан владеть:

- допустимыми status;
- смыслом `last_confirmed_at`;
- вычислением cutoff;
- правилом видимости Offer;
- SQL/Drizzle predicate, выражающим правило `active AND last_confirmed_at > cutoff`;
- минимальным clock contract, необходимым для тестируемости;
- parser/configuration policy validity period.

Search не должен дублировать lifecycle-формулу.

### 3.2 Search только координирует read-case

Search сохраняет ответственность S0:

`query → Product → visible Offers → Search result`.

Search может:

1. получить/принять clock dependency;
2. получить validated validity period из Offers configuration layer;
3. попросить Offers вычислить cutoff;
4. передать cutoff в repository;
5. применить готовый Offers visibility predicate при read query.

Search не определяет самостоятельно:

- список lifecycle status;
- срок актуальности;
- формулу cutoff;
- boundary semantics;
- SQL-условие актуальности.

### 3.3 HTTP layer не меняется по смыслу

`GET /api/search?q=<query>` остаётся тем же публичным endpoint.

`src/app/api/search/route.ts` не должен требовать изменения для S1. Если реализация внезапно требует его менять, исполнитель сначала останавливается и объясняет причину.

## 4. Итоговая модель `offers`

Сохраняются все S0 fields.

Добавляются:

| Поле | Drizzle/PostgreSQL | NULL | Permanent default |
|---|---|---:|---:|
| `status` | `text` | нет | нет |
| `last_confirmed_at` | `timestamptz` | нет | нет |

### 4.1 Status в Drizzle

Не использовать PostgreSQL enum.

Drizzle column должен быть обычным `text`, типизированным на уровне TypeScript как `active | inactive`.

PostgreSQL обязан иметь реальный CHECK constraint, семантически эквивалентный:

`status IN ('active', 'inactive')`.

Недостаточно только TypeScript union. Некорректная строка должна отклоняться самой PostgreSQL.

### 4.2 Temporal constraints

S1 не добавляет constraints вида:

- `last_confirmed_at >= created_at`;
- `last_confirmed_at <= updated_at`;
- `last_confirmed_at <= now()`.

Они не нужны для задачи S1 и преждевременно ограничат будущие write-сценарии.

## 5. Minimal clock contract

Не вводить DI-container, service locator, generic TimeService, shared infrastructure framework или abstraction «на будущее».

Достаточен маленький Offers-local function contract:

```ts
type Clock = () => Date;
```

Production implementation семантически:

```ts
const systemClock: Clock = () => new Date();
```

Tests могут передать:

```ts
const fixedClock = () => new Date('2026-09-11T12:00:00.000Z');
```

Один вызов `searchOffers` обязан вызвать clock ровно один раз для lifecycle decision данного Search operation.

Полученное `now` передаётся в Offers cutoff function. Repository clock не вызывает.

## 6. Offers lifecycle API внутри modular monolith

Создать один маленький Offers-local lifecycle module:

`src/modules/offers/lifecycle/offer-lifecycle.ts`

Он должен содержать только то, что требуется S1:

- `Clock` type;
- production `systemClock`;
- функцию вычисления cutoff из `now` и validated `validityPeriodHours`;
- функцию/Drizzle predicate для видимых Offers.

Ожидаемая семантика:

```ts
calculateOfferCutoff(now, validityPeriodHours) -> Date
visibleOffersPredicate(cutoff) -> Drizzle SQL predicate
```

Имена могут отличаться только косметически. Ответственность и граница модуля менять нельзя.

`visibleOffersPredicate(cutoff)` должен быть владельцем SQL-семантики:

`status = active AND last_confirmed_at > cutoff`.

Search repository импортирует этот predicate из Offers, а не собирает lifecycle condition заново.

## 7. Configuration contract

Создать одно место:

`src/modules/offers/config/offer-lifecycle.config.ts`

Оно владеет:

- key `OFFER_VALIDITY_PERIOD_HOURS`;
- technical default `168`;
- parsing;
- validation.

### 7.1 Validation

Значение должно быть positive integer.

Должны отклоняться минимум:

- `0`;
- отрицательное число;
- decimal value;
- `NaN`/произвольный текст;
- бесконечность или значение, которое parser не может безопасно представить как положительное целое число.

Отсутствующее значение использует technical default `168`.

### 7.2 Единственное чтение environment

Только configuration layer имеет право читать:

`process.env.OFFER_VALIDITY_PERIOD_HOURS`.

Запрещено читать этот env напрямую в:

- Search repository;
- Offers lifecycle predicate;
- business/application logic;
- React;
- HTTP route.

Business/read code получает уже validated number.

### 7.3 Документация config

`.env.example` получает:

`OFFER_VALIDITY_PERIOD_HOURS=168`

с коротким комментарием, что это technical S1 default, не финальная продуктовая политика.

README кратко документирует параметр.

## 8. Search application contract

Существующая функция `searchOffers` сохраняет публичный смысл и существующие вызовы S0.

Допускается минимальное расширение внутренней сигнатуры для тестовой зависимости, без изменения HTTP/API contract.

Предпочтительный вариант:

```ts
searchOffers(input, database?, lifecycleOptions?)
```

где lifecycle options содержат только необходимое для deterministic tests, например:

```ts
{
  clock?: Clock;
  validityPeriodHours?: number;
}
```

Правила:

1. query normalisation S0 выполняется как раньше;
2. clock выбирается `injected clock ?? systemClock`;
3. clock вызывается ровно один раз;
4. validity period берётся из explicit test override либо Offers config;
5. Offers module вычисляет cutoff;
6. Search repository получает cutoff;
7. response shape остаётся S0.

Не создавать generic dependency object для всех будущих сервисов.

## 9. Search repository contract

`findOffersByProductName` получает cutoff как внутренний аргумент.

Сохраняются:

- exact Product match S0;
- joins Product / Offer / Seller / Location;
- deterministic ordering;
- price mapping;
- public projection S0.

Добавляется только готовый Offers visibility predicate.

Repository не вызывает:

- `new Date()`;
- `Date.now()`;
- PostgreSQL `now()` / `CURRENT_TIMESTAMP` для lifecycle;
- `process.env`.

Repository не возвращает lifecycle fields наружу.

## 10. Migration contract

Создать только новую S1 migration.

`drizzle/migrations/0000_s0_first_search.sql` не изменять ни на один байт.

### 10.1 Exact migration files

Разрешены новые/generated migration artifacts:

- `drizzle/migrations/0001_s1_offer_lifecycle.sql`;
- `drizzle/migrations/meta/0001_snapshot.json`;
- изменение `drizzle/migrations/meta/_journal.json` только записью generated S1 migration.

Migration генерируется из final Drizzle schema с фиксированным custom name `s1_offer_lifecycle`, затем SQL обязательно инспектируется и при необходимости вручную приводится к безопасному upgrade-порядку ниже.

Не создавать вторую S1 migration для исправления первой до merge. До коммита S1 migration должна быть приведена в окончательный корректный вид.

### 10.2 Required SQL semantics

Migration должна выполнить:

1. добавить `status text NULL`;
2. добавить `last_confirmed_at timestamptz NULL`;
3. backfill всех существующих Offers:
   - `status = 'active'`;
   - `last_confirmed_at = CURRENT_TIMESTAMP`;
4. добавить CHECK `active | inactive`;
5. сделать `status NOT NULL`;
6. сделать `last_confirmed_at NOT NULL`;
7. не оставить defaults.

Migration не должна:

- drop/recreate `offers`;
- менять IDs;
- менять старые business fields;
- обновлять `updated_at` только из-за lifecycle backfill;
- трогать Product/Seller/Location data.

## 11. Upgrade migration test

Обязателен отдельный integration test:

`tests/integration/s1-migration-upgrade.test.ts`

Он не использует S1 seed для подготовки исходного состояния.

### 11.1 Изолированная database

Test создаёт временную database с точным техническим именем:

`kaida_s1_upgrade_test`

на том же PostgreSQL 18 test instance.

Перед созданием обязательно выполняются safety guards:

- исходный URL является `TEST_DATABASE_URL` и проходит существующую защиту test DB;
- server major = 18;
- development DB не является target;
- destructive create/drop разрешён только для exact database name `kaida_s1_upgrade_test`.

Test закрывает connections и удаляет только эту temporary database в `finally`.

Не использовать development database для upgrade test.

### 11.2 Реальный S0 state

Test выполняет:

1. создать чистую `kaida_s1_upgrade_test`;
2. применить **только** фактический SQL `0000_s0_first_search.sql`;
3. вставить Product/Seller/Location/Offer в формате S0 прямыми SQL inserts;
4. S0 Offer insert не содержит `status` и `last_confirmed_at`;
5. зафиксировать исходные значения всех старых Offer business fields и ID;
6. зафиксировать time window вокруг S1 migration;
7. применить фактический SQL `0001_s1_offer_lifecycle.sql`;
8. проверить итог.

Для выполнения отдельных migration SQL files test может иметь маленький локальный helper, который читает конкретный файл и исполняет Drizzle statement-breakpoints в transaction. Не создавать общий migration framework.

### 11.3 Что проверять после 0001

Обязательно:

- тот же Offer ID;
- те же `product_id`, `seller_id`, `location_id`;
- те же price fields;
- тот же `seller_comment`;
- те же `created_at`, `updated_at`;
- `status = active`;
- `last_confirmed_at IS NOT NULL`;
- schema columns после migration `NOT NULL`;
- CHECK реально отклоняет invalid status;
- permanent DB defaults у lifecycle fields отсутствуют.

### 11.4 Проверка migration timestamp

Не проверять точное равенство `last_confirmed_at` конкретному wall-clock timestamp.

Перед migration получить lower bound, после migration upper bound.

Проверить invariant:

`lower_bound <= last_confirmed_at <= upper_bound`.

Дополнительно при controlled runtime `now = upper_bound` и validity period 168h backfilled Offer должен удовлетворять freshness rule.

Так test проверяет смысл backfill, а не случайную микросекунду PostgreSQL clock.

## 12. Clean migration path

Существующий `tests/integration/prepare-database.ts` остаётся владельцем clean-path подготовки `kaida_test`.

Его S1-поведение:

1. destructive guard остаётся;
2. очистить только test schemas;
3. применить полную migration chain `0000 → 0001` через штатный Drizzle migrator;
4. повторно запустить migrate и доказать idempotent no-op;
5. захватить один `seedNow`;
6. запустить S1-aware seed с этим `seedNow`;
7. повторить seed с тем же `seedNow`;
8. проверить ожидаемые четыре product tables;
9. не создавать новые product tables ради S1.

Это отдельный сценарий от upgrade test.

`verify` обязан проходить оба:

- clean path;
- S0 → S1 upgrade path.

## 13. Seed contract implementation

Изменить только существующий:

`src/db/seed.ts`.

### 13.1 Seed signature

`seedDatabase` получает возможность принять controlled `seedNow`.

Предпочтительно простой Date/function dependency без generic seed context.

Один seed run использует одно значение `seedNow` для обоих S0 Offers.

### 13.2 Seed values

Для `баранина` и `говядина`:

- `status = active`;
- `last_confirmed_at = seedNow`.

Остальные S0 fixture values сохраняются.

### 13.3 Scope of updates

Seed продолжает upsert только собственные фиксированные IDs.

Разрешено освежать `last_confirmed_at` только у:

- `seedIds.lambOffer`;
- `seedIds.beefOffer`.

Запрещён общий запрос вида:

`UPDATE offers SET last_confirmed_at = ...`.

Seed не трогает произвольные/пользовательские Offers.

### 13.4 Repeat seed

Automated repeat-seed test передаёт тот же fixed/captured `seedNow`, поэтому повтор остаётся детерминированным.

Обычный CLI seed может захватить новый current time при новом отдельном запуске и тем самым освежить только свои fictional fixture records.

## 14. Lifecycle unit tests

Создать:

- `tests/unit/offer-lifecycle.test.ts`;
- `tests/unit/offer-lifecycle-config.test.ts`.

### 14.1 `offer-lifecycle.test.ts`

Минимально проверить:

- cutoff для fixed `now` + 168h;
- clock dependency вызывается/используется детерминированно на application path без sleep;
- никакой расчёт expiry date не хранится в Offer.

Boundary видимости проверяется прежде всего integration test на реальном PostgreSQL, потому что actual `>` predicate должен быть доказан на DB read-path.

### 14.2 `offer-lifecycle-config.test.ts`

Проверить:

- missing env → `168`;
- `1` valid;
- `168` valid;
- `0` invalid;
- negative invalid;
- decimal invalid;
- text invalid;
- unsafe/non-finite value invalid.

Tests вызывают parser напрямую и не мутируют global environment без необходимости.

## 15. Lifecycle integration test

Создать:

`tests/integration/offer-lifecycle.test.ts`.

Использовать реальную PostgreSQL 18 `kaida_test` после clean migration + seed.

Fixed runtime:

`now = 2026-09-11T12:00:00.000Z`

`validityPeriodHours = 168`

`cutoff = 2026-09-04T12:00:00.000Z`

Обязательная матрица:

| status | last_confirmed_at | result |
|---|---|---|
| active | `2026-09-11T11:00:00.000Z` | visible |
| active | `2026-09-04T12:00:00.001Z` | visible |
| active | `2026-09-04T12:00:00.000Z` | hidden |
| active | `2026-09-04T11:59:59.999Z` | hidden |
| inactive | `2026-09-11T11:00:00.000Z` | hidden |

Никаких `sleep`, fake timer waiting или polling.

Test fixtures должны быть отдельными от S0 `баранина`/`говядина` либо гарантированно восстановлены после каждого test. Предпочтение: отдельный lifecycle fixture с cleanup, чтобы regression tests S0 не зависели от порядка тестов.

Дополнительно проверить:

- Product существует, но Offer expired → `offers: []`;
- Product существует, но Offer inactive → `offers: []`;
- response по-прежнему проходит существующий `searchResponseSchema`;
- lifecycle fields в response отсутствуют.

## 16. Existing S0 integration regression

`tests/integration/search.test.ts` разрешено менять только там, где S1 объективно изменил внутреннюю fixture-модель.

Нельзя ослаблять существующие S0 assertions.

Обязательные regression scenarios сохраняются:

- `баранина`;
- case-insensitive;
- trim;
- `единорог`;
- `говядина` nullable price;
- Product/Seller/Location;
- price constraints;
- FK constraints;
- Product name constraints;
- zero price;
- null seller comment.

Repeat-seed assertion обновляется только для controlled `seedNow`, чтобы lifecycle timestamp не делал test случайно недетерминированным.

## 17. E2E strategy

Существующий файл:

`tests/e2e/search.spec.ts`

**не изменять**, если нет доказанной блокирующей причины.

Добавить отдельный:

`tests/e2e/offer-lifecycle.spec.ts`.

### 17.1 Никаких test APIs

Для E2E запрещено создавать:

- lifecycle endpoint;
- debug API;
- admin route;
- hidden UI;
- temporary button.

### 17.2 Technical setup через DB

Playwright test может напрямую подготовить/изменить test fixture в `kaida_test` из Node-side test code.

Чтобы не ломать parallel mobile/desktop projects:

- не менять S0 lamb/beef fixture для automated E2E;
- каждый Playwright project использует собственный уникальный Product/Offer fixture либо уникальные deterministic IDs/names на основе project name;
- fixture использует существующие test Seller/Location либо собственные scoped rows;
- cleanup выполняется после test.

### 17.3 Минимальный lifecycle E2E

Через существующий UI доказать минимум:

1. fresh active lifecycle fixture находится;
2. техническим DB setup сделать его expired;
3. повторный поиск показывает existing empty state;
4. вернуть fresh, поставить inactive;
5. повторный поиск показывает existing empty state.

Boundary `±1 ms` в E2E не нужен, он обязателен в deterministic integration tests.

Existing S0 mobile/desktop E2E должны пройти без изменений поведения.

## 18. CI contract

Сохраняется один GitHub Actions workflow и один финальный regression command:

`pnpm verify`

Нельзя разбивать Definition of Done на набор ручных команд, которые CI не выполняет.

`.github/workflows/ci.yml` разрешено изменить только для S1:

- workflow/display naming из S0 в S1;
- добавить явный `OFFER_VALIDITY_PERIOD_HOURS: '168'` в CI env;
- сохранить real `postgres:18`;
- сохранить отдельные `kaida` и `kaida_test`;
- сохранить запуск `pnpm verify`;
- сохранить browser artifacts;
- не использовать `continue-on-error`.

Upgrade migration test создаёт свою временную database во время integration suite и не требует отдельного CI service.

## 19. `verify` contract

Финальная команда остаётся:

`pnpm verify`

`package.json` менять не требуется и в normal S1 scope он не разрешён к изменению.

Существующая цепочка уже покрывает:

`lint → typecheck → development migration → development seed → clean test DB prepare → unit → integration → build → E2E`.

После добавления S1 tests integration step автоматически включает upgrade migration test и lifecycle integration test.

Если во время реализации окажется, что существующая команда не может реально включить обязательную S1-проверку, исполнитель должен остановиться и запросить расширение file scope до изменения `package.json`.

## 20. Manual acceptance

Manual acceptance выполняется отдельно после зелёного CI.

Зелёный CI сам по себе не делает S1 `READY`.

Проверка через существующий UI:

1. обычный migration + seed;
2. `баранина` видна;
3. `говядина` видна и показывает `Цена не указана`;
4. техническим DB setup изменить только `last_confirmed_at` lamb Offer на заведомо expired относительно configured period;
5. повторный поиск `баранина` → existing empty state;
6. техническим DB setup вернуть fresh `last_confirmed_at`;
7. `баранина` снова видна;
8. техническим DB setup поставить `status = inactive`;
9. `баранина` исчезает;
10. вернуть `status = active` и fresh timestamp;
11. `единорог` → empty;
12. пустой query → validation state;
13. mobile ~390–400 px;
14. desktop ~1440 px;
15. keyboard/focus regression.

Technical setup выполняется напрямую через development/test DB или локальный one-off command.

Не добавлять test endpoint/UI ради manual acceptance.

После проверки fixture должен быть возвращён в normal seeded state либо seed должен быть повторно выполнен.

## 21. Exact allowed file scope

Ниже полный whitelist S1. Файл вне списка менять/создавать запрещено без предварительного объяснения и согласования.

### 21.1 Existing files, разрешено изменить

1. `.env.example` — документировать `OFFER_VALIDITY_PERIOD_HOURS=168`.
2. `.github/workflows/ci.yml` — S1 naming/env, без изменения фундаментального CI contract.
3. `README.md` — кратко документировать lifecycle config и verification.
4. `src/db/seed.ts` — S1-aware lifecycle fields и controlled `seedNow`.
5. `src/modules/offers/db/offers.table.ts` — `status`, `lastConfirmedAt`, CHECK.
6. `src/modules/search/application/search-offers.ts` — один clock capture, validated config, cutoff orchestration.
7. `src/modules/search/infrastructure/search.repository.ts` — принять cutoff и использовать Offers visibility predicate.
8. `tests/integration/prepare-database.ts` — clean S1 migration chain + deterministic repeat seed.
9. `tests/integration/search.test.ts` — только необходимые S1 fixture/regression adjustments.
10. `drizzle/migrations/meta/_journal.json` — generated запись migration 0001.

### 21.2 New files, разрешено создать

11. `src/modules/offers/lifecycle/offer-lifecycle.ts` — Offers-owned cutoff/clock/visibility predicate.
12. `src/modules/offers/config/offer-lifecycle.config.ts` — единственный parser/config source.
13. `drizzle/migrations/0001_s1_offer_lifecycle.sql` — единственная новая S1 migration.
14. `drizzle/migrations/meta/0001_snapshot.json` — generated Drizzle snapshot.
15. `tests/unit/offer-lifecycle.test.ts` — lifecycle/cutoff/clock tests.
16. `tests/unit/offer-lifecycle-config.test.ts` — config validation tests.
17. `tests/integration/offer-lifecycle.test.ts` — PostgreSQL visibility/boundary tests.
18. `tests/integration/s1-migration-upgrade.test.ts` — реальный S0 → S1 upgrade test.
19. `tests/e2e/offer-lifecycle.spec.ts` — lifecycle E2E через существующий UI.
20. `docs/slices/S1-offer-lifecycle/IMPLEMENTATION_NOTES.md` — фактические решения/отклонения реализации.
21. `docs/slices/S1-offer-lifecycle/VERIFICATION.md` — фактические результаты CI/manual acceptance.

### 21.3 Документы design phase

Эти файлы уже существуют и считаются утверждёнными входными контрактами. В Implementation их не менять без нового согласования:

- `docs/slices/S1-offer-lifecycle/FEATURE_SPEC.md`;
- `docs/slices/S1-offer-lifecycle/MIGRATION_MODEL_CONTRACT.md`;
- `docs/slices/S1-offer-lifecycle/IMPLEMENTATION_CONTRACT.md` после его утверждения.

## 22. Explicitly forbidden file changes

Если нет отдельного согласования, S1 не меняет:

- `drizzle/migrations/0000_s0_first_search.sql`;
- `src/db/schema.ts`;
- `src/modules/catalog/**`;
- `src/modules/sellers/**`;
- `src/modules/locations/**`;
- `src/modules/search/contracts/search.contract.ts`;
- `src/app/api/search/route.ts`;
- `src/app/_components/**`;
- `src/app/page.tsx`;
- `src/app/page.module.css`;
- `src/app/globals.css`;
- `tests/e2e/search.spec.ts`;
- `vitest.config.ts`;
- `playwright.config.ts`;
- `package.json`;
- `pnpm-lock.yaml`;
- `docker-compose.yml`;
- `docker/init/01-create-test-db.sql`;
- `tests/integration/database.ts`;
- Technical Foundation / Feature Map / Project Rules.

Не добавлять dependencies.

## 23. Test-first implementation order

После утверждения этого Implementation Contract рекомендуемый порядок реализации:

1. убедиться, что branch `slice/s1-offer-lifecycle` основана на актуальном `main` и working diff содержит только S1 docs;
2. создать failing unit tests config/lifecycle;
3. создать failing integration lifecycle tests;
4. создать failing S0 → S1 migration-upgrade test;
5. создать minimal lifecycle E2E fixture/test без изменения S0 E2E;
6. изменить Offers schema;
7. создать Offers lifecycle module;
8. создать Offers config parser;
9. сгенерировать `0001_s1_offer_lifecycle` и inspect SQL;
10. привести migration SQL к nullable → backfill → CHECK → NOT NULL → no defaults;
11. обновить seed controlled `seedNow`;
12. подключить cutoff/visibility rule в Search read-path;
13. обновить clean test DB preparation;
14. выполнить новые unit tests;
15. выполнить upgrade migration test;
16. выполнить lifecycle integration tests;
17. выполнить все S0 integration tests;
18. выполнить build;
19. выполнить S0 + S1 E2E mobile/desktop;
20. обновить README/.env.example/CI naming/env;
21. выполнить полный `pnpm verify`;
22. push и получить фактически зелёный GitHub Actions;
23. отдельно выполнить manual acceptance;
24. заполнить `IMPLEMENTATION_NOTES.md` и `VERIFICATION.md` фактическими результатами;
25. только при полном DoD считать S1 READY.

Если test-first порядок требует временного red state внутри рабочей ветки, это нормально. В `main` красное состояние не попадает.

## 24. Regression invariants S0

После S1 обязательно остаются неизменными пользовательские сценарии:

- `баранина` → Offer с ценой;
- `говядина` → Offer + `Цена не указана`;
- `единорог` → empty;
- пустой query → validation;
- exact case-insensitive Product search;
- trim;
- refresh;
- loading;
- network/system error behaviour;
- decimal price string;
- mobile layout;
- desktop layout;
- keyboard/focus accessibility.

Lifecycle не является поводом рефакторить UI, price formatting, Search contract или error handling.

## 25. Out of Scope / запреты реализации

Не реализовывать и не создавать заготовки для:

- `expires_at`;
- materialized `expired` status;
- Seller UI;
- Offer create/edit/deactivate UI;
- lifecycle write endpoint;
- Seller Change Set;
- Seller Input;
- auth;
- OTP;
- Category;
- aliases;
- geo;
- Discovery;
- freshness ranking;
- freshness score;
- cron;
- scheduler;
- background jobs;
- notification;
- AI;
- Telegram;
- moderation;
- admin;
- promotion;
- monetization;
- event bus;
- queues;
- Redis;
- microservices;
- generic repository/service abstractions;
- DI container;
- generic clock/time infrastructure.

## 26. Stop conditions during implementation

Исполнитель останавливается до изменения scope, если выясняется хотя бы одно:

1. требуется изменить публичный Search API;
2. требуется изменить `0000_s0_first_search.sql`;
3. требуется новый product table/entity;
4. требуется файл вне whitelist;
5. требуется dependency/package change;
6. lifecycle rule невозможно выразить через утверждённую модель;
7. upgrade migration требует потери/пересоздания S0 Offer data;
8. требуется lifecycle API/UI для тестирования;
9. existing S0 E2E невозможно сохранить без переписывания;
10. PostgreSQL 18/Drizzle поведение противоречит migration/model contract;
11. нужен платный сервис, secret или внешний аккаунт.

Мелкие implementation details внутри whitelist, не меняющие contracts, отдельного согласования не требуют.

## 27. Definition of Done

S1 получает статус `READY` только если одновременно выполнено всё ниже.

### Model / migration

- `status` существует и ограничен PostgreSQL CHECK;
- `last_confirmed_at` существует и NOT NULL;
- нет `expires_at`;
- нет permanent lifecycle defaults;
- 0000 не изменена;
- upgrade path S0 → S1 green;
- clean migration chain green;
- S0 business data сохраняется.

### Lifecycle

- fresh active visible;
- `cutoff + 1ms` visible;
- `== cutoff` hidden;
- `cutoff - 1ms` hidden;
- inactive hidden;
- no sleep;
- fixed clock works;
- runtime DB `now()` не используется.

### Config

- env parser один;
- missing → 168;
- invalid values rejected;
- direct `process.env` lifecycle reads отсутствуют вне config layer.

### Seed

- lamb/beef fresh after normal seed;
- controlled seed reproducible;
- only fixed seed records refreshed;
- no blanket Offer update.

### Regression

- все S0 unit/integration expectations green;
- S0 Search response unchanged;
- S0 E2E green без переписывания;
- S1 E2E green;
- mobile + desktop green;
- build green;
- lint green;
- typecheck green.

### CI

- `pnpm verify` green;
- GitHub Actions на фактическом S1 commit green;
- no skipped/failing tests;
- no `continue-on-error` masking.

### Manual acceptance

- выполнена отдельно после CI;
- fresh / expired / inactive фактически проверены через UI;
- S0 regression фактически проверена;
- mobile/desktop фактически проверены.

Только после зелёного CI **и** отдельной manual acceptance S1 может быть назван READY.

## 28. Git checkpoint

Рабочая ветка:

`slice/s1-offer-lifecycle`

После полного Definition of Done:

1. проверить diff против актуального `main`;
2. убедиться, что все изменённые файлы входят в whitelist;
3. убедиться, что 0000 не изменена;
4. выполнить финальный `pnpm verify`;
5. получить зелёный GitHub Actions;
6. выполнить manual acceptance;
7. зафиксировать фактическую verification documentation;
8. merge S1 в `main`;
9. проверить `main`;
10. создать annotated tag:

`v0.0.2-s1`

Tag нельзя создавать до полного DoD.

## 29. Состояние после S1

После S1 KAIDA.KZ умеет:

`П1 ищет Product → Search возвращает только active и достаточно недавно подтверждённые Offers`.

При этом система всё ещё намеренно не умеет:

- создавать Offer пользователем;
- подтверждать Offer пользователем;
- выключать Offer пользователем;
- авторизовывать пользователя;
- управлять Seller/Location;
- использовать AI.

Это правильное состояние после S1.

## 30. Следующий шаг до реализации

Реализация S1 не начинается автоматически после создания этого документа.

Сначала пользователь утверждает `IMPLEMENTATION_CONTRACT.md`.

Только после отдельного подтверждения можно переходить к Implementation.