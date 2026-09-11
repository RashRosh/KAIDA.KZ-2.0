# S1 — Migration / Model Contract

## Статус документа

Точный контракт модели и migration для S1 Offer Lifecycle.

Этот документ фиксирует поведение schema, backfill, времени, конфигурации и Search filter до написания Implementation Contract и до реализации S1.

## 1. Цель изменения модели

S0 хранит Offer без lifecycle-состояния.

S1 добавляет минимальные данные, достаточные для ответа на вопрос:

> можно ли показывать этот Offer покупателю сейчас?

Единственная временная сущность истины в Offer:

`last_confirmed_at`.

`expires_at` не добавляется.

## 2. Итоговая модель Offer после S1

Все поля S0 сохраняются без изменения публичного смысла.

Добавляются:

| Поле | PostgreSQL type | NULL | Default после migration | Назначение |
|---|---|---:|---|---|
| `status` | `text` | нет | нет | Явное состояние `active` или `inactive` |
| `last_confirmed_at` | `timestamptz` | нет | нет | Момент последнего подтверждения актуальности Offer |

### Почему без DB default

После завершения migration новые Offer rows не должны неявно становиться актуальными только потому, что caller забыл lifecycle-поля.

Поэтому финальная schema S1 не задаёт постоянный DB default ни для `status`, ни для `last_confirmed_at`.

Backfill существующих S0 rows выполняется внутри migration отдельно.

Будущие write-сценарии должны указывать lifecycle-состояние явно в том slice, который создаёт или меняет Offer.

## 3. Status contract

Допустимы только значения:

- `active`;
- `inactive`.

На уровне PostgreSQL обязателен CHECK constraint, эквивалентный:

`status IN ('active', 'inactive')`.

Другие строки должны отклоняться БД.

`expired` не является status и нигде не хранится.

В S1 `inactive` используется только как состояние модели и read-filter.

Пользовательского write-сценария для `inactive` в S1 нет.

## 4. last_confirmed_at contract

`last_confirmed_at`:

- обязателен;
- хранится как `timestamp with time zone` / `timestamptz`;
- является единственной сохранённой временной точкой, от которой вычисляется freshness Offer;
- не дублируется полем `expires_at`.

S1 не вводит дополнительный DB constraint относительно `created_at` или `updated_at`.

Причина: для пользовательского поведения S1 достаточно обязательности `last_confirmed_at`; дополнительные temporal invariants не нужны для этого slice и могут ограничить будущие write-сценарии без доказанной необходимости.

## 5. Runtime visibility rule

Пусть:

- `now` — единый текущий момент Search operation;
- `validityPeriod` — configured offer validity period;
- `cutoff = now - validityPeriod`.

Offer видим только если:

`status = 'active' AND last_confirmed_at > cutoff`.

Сравнение `>` строгое.

### Boundary

При:

`last_confirmed_at == cutoff`

Offer уже просрочен.

SQL/read predicate должен быть семантически эквивалентен:

`offers.status = 'active' AND offers.last_confirmed_at > :cutoff`.

## 6. Конфигурация validity period

Runtime configuration key для S1:

`OFFER_VALIDITY_PERIOD_HOURS`.

Требования:

- единица измерения фиксирована в имени: часы;
- значение должно быть положительным целым числом;
- invalid / zero / negative value не должно молча приниматься;
- изменение значения не требует migration;
- изменение значения не требует изменения Offer rows;
- business/read logic получает уже валидированную duration, а не читает `process.env` напрямую.

Технический default S1:

`168` часов = 7 дней.

Этот default находится только в configuration layer и документации S1.

Он не является утверждённой продуктовой политикой.

## 7. Единый источник времени

S1 вводит внутренний тестируемый контракт времени, семантически эквивалентный:

`Clock.now(): Date`.

Конкретное имя interface/function может быть уточнено Implementation Contract, но следующие свойства обязательны.

### Production

Production clock возвращает системное текущее время.

### Tests

Tests могут передать фиксированный `now` без ожидания реального времени.

### Search operation

Один Search operation должен:

1. получить `now` ровно один раз;
2. получить validated `validityPeriod`;
3. вычислить один `cutoff`;
4. передать этот cutoff в read-path;
5. использовать этот же cutoff для всего lifecycle-решения данного запроса.

Search repository не должен самостоятельно вызывать:

- JavaScript `new Date()` для lifecycle filtering;
- PostgreSQL `CURRENT_TIMESTAMP` / `now()` для runtime lifecycle filtering.

Это предотвращает два разных источника текущего времени внутри одного запроса и делает boundary полностью тестируемой.

### Запрет в tests

Lifecycle tests не используют:

- `sleep`;
- timers ради фактического ожидания истечения Offer;
- polling ожидания cutoff;
- зависимость от текущей даты машины CI.

## 8. Распределение ответственности

### Offers

Offers владеет lifecycle semantics:

- допустимыми status;
- смыслом `last_confirmed_at`;
- правилом актуальности;
- вычислением/представлением validity cutoff на уровне доменной политики.

### Search

Search не становится владельцем lifecycle-модели.

Search использует lifecycle rule при read-case и возвращает только видимые Offers.

### HTTP

`GET /api/search` не знает деталей lifecycle schema и не получает новых query parameters.

## 9. Internal read contract

S0 repository read-case расширяется только внутренним lifecycle filter.

Публичный Search response остаётся прежним.

Внутренний read должен получать уже вычисленный cutoff либо эквивалентный validated lifecycle context.

Предпочтительный контракт:

`findOffersByProductName(db, query, cutoff)`

или типизированный эквивалент без изменения публичного HTTP contract.

Repository predicate:

- exact Product match S0;
- `status = active`;
- `last_confirmed_at > cutoff`.

Существующий deterministic ordering S0 сохраняется, если нет объективной причины менять его.

## 10. Migration S1

Migration S1 создаётся отдельным новым migration file после `0000_s0_first_search.sql`.

Migration S0 не редактируется.

### Обязательный порядок upgrade существующей S0 database

Migration должна семантически выполнить следующие этапы.

#### Step 1. Добавить nullable columns

Добавить:

- `status text NULL`;
- `last_confirmed_at timestamptz NULL`.

Они временно nullable только для безопасного backfill существующих строк.

#### Step 2. Backfill существующих Offers

Все существующие Offer rows S0 получают:

`status = 'active'`.

Все существующие Offer rows S0 получают:

`last_confirmed_at = CURRENT_TIMESTAMP` миграционной транзакции.

Цель этого backfill не в восстановлении исторической даты подтверждения, которой S0 не хранил.

Его смысл:

> S0 считал все существующие seed/existing Offers актуальными по определению, поэтому upgrade в S1 не должен внезапно скрыть их.

PostgreSQL `CURRENT_TIMESTAMP` здесь допустим как одноразовое migration-time значение.

Runtime lifecycle filtering после migration не использует DB current time и следует разделу 7.

#### Step 3. Добавить status constraint

Добавить CHECK constraint, допускающий только:

- `active`;
- `inactive`.

#### Step 4. Сделать columns NOT NULL

После успешного backfill:

- `status SET NOT NULL`;
- `last_confirmed_at SET NOT NULL`.

#### Step 5. Не добавлять defaults

Финальная schema не оставляет DB default для новых строк.

### Данные, которые migration не меняет

Migration S1 не должна менять существующие:

- Offer `id`;
- `product_id`;
- `seller_id`;
- `location_id`;
- price fields;
- `seller_comment`;
- `created_at`;
- `updated_at`;
- Product rows;
- Seller rows;
- Location rows.

Migration не удаляет и не пересоздаёт Offers ради добавления lifecycle.

## 11. Upgrade invariant

Сразу после upgrade S0 → S1 существующий S0 Offer должен удовлетворять:

- `status = active`;
- `last_confirmed_at` заполнен migration time;
- при любом корректном положительном validity period он является свежим непосредственно после migration.

Тем самым S1 не создаёт пользовательскую регрессию в момент обновления.

## 12. Clean migration invariant

На чистой PostgreSQL 18 database должна успешно применяться полная последовательность:

`0000 S0 → 0001 S1 → ...`

Если до seed таблица `offers` пуста, backfill S1 является корректным no-op.

После migrations schema уже требует lifecycle-поля у всех новых Offer rows.

## 13. Seed S1 contract

Seed продолжает владеть только своими детерминированными fictional records по фиксированным IDs S0.

Для двух существующих seed Offers:

- `status = active`;
- `last_confirmed_at = seed_now`.

### seed_now

Один запуск seed получает `seed_now` один раз из тестируемого clock/time provider.

Оба Offers используют одно и то же `seed_now`.

### Обычный CLI seed

При обычном запуске CLI `seed_now` берётся из production/system clock.

Следовательно, `баранина` и `говядина` после обычного seed являются свежими при текущем validity period.

Повторный обычный seed может намеренно обновить `last_confirmed_at` только у собственных фиксированных seed Offers. Это техническое поведение test fixture и не является пользовательским механизмом продления Offer.

### Test seed

Automated tests передают фиксированный `seed_now`.

Повтор seed с тем же fixed `seed_now` должен оставаться воспроизводимым и позволять deterministic comparison.

Seed не очищает таблицы целиком и не изменяет чужие rows.

## 14. Test matrix lifecycle

При фиксированных:

`now = 2026-09-11T12:00:00.000Z`

и

`validityPeriod = 168h`

cutoff равен:

`2026-09-04T12:00:00.000Z`.

Минимальная обязательная матрица:

| status | last_confirmed_at | Ожидаемо |
|---|---|---|
| active | `2026-09-11T11:00:00Z` | visible |
| active | `2026-09-04T12:00:00.001Z` | visible |
| active | `2026-09-04T12:00:00.000Z` | hidden |
| active | `2026-09-04T11:59:59.999Z` | hidden |
| inactive | `2026-09-11T11:00:00Z` | hidden |

Эти проверки выполняются без ожидания реального времени.

## 15. Migration verification contract

CI/integration verification S1 должна доказать два разных сценария.

### Upgrade path

1. Поднять PostgreSQL 18.
2. Применить только S0 migration.
3. Создать/загрузить S0 Offers без lifecycle columns.
4. Зафиксировать IDs и S0 business fields.
5. Применить S1 migration.
6. Проверить сохранность IDs и S0 fields.
7. Проверить `status = active`.
8. Проверить non-null `last_confirmed_at`.
9. Проверить, что Offers видимы сразу после upgrade при controlled runtime `now` относительно migration result.

### Clean path

1. Поднять пустую PostgreSQL 18 database.
2. Применить всю migration chain.
3. Запустить S1-aware seed.
4. Проверить актуальные `баранина` и `говядина`.
5. Запустить lifecycle integration tests.

## 16. Public contract invariant

S1 не меняет форму:

`GET /api/search?q=<query>`.

Search result по-прежнему содержит только S0 public fields:

- Offer id;
- Product;
- Seller;
- Location;
- price;
- sellerComment.

Не добавлять в response:

- `status`;
- `lastConfirmedAt`;
- cutoff;
- validity period;
- freshness flags.

Если все Offers скрыты lifecycle-filter, API отвечает успешным существующим empty result.

## 17. Manual acceptance data setup

Для ручной проверки разрешено менять тестовый Offer только техническим способом на уровне development/test database или штатного setup script.

Разрешённые изменения для проверки:

- `status`;
- `last_confirmed_at`.

Не создавать ради manual acceptance:

- lifecycle HTTP endpoint;
- Seller UI;
- admin UI;
- hidden debug UI;
- временную кнопку refresh/expire.

## 18. Что специально не проектируется в этом контракте

Не определяются:

- продуктовый финальный validity period;
- разные validity periods по Product/Category/Seller;
- продление Offer продавцом;
- автоматическое подтверждение;
- cron expiry;
- materialized expired status;
- status history;
- lifecycle events;
- notifications;
- Seller Change Set;
- S5 write semantics;
- freshness ranking.

Эти вопросы не нужны для пользовательской задачи S1.

## 19. Критерий изменения этого контракта

Implementation Contract не должен менять следующие решения без отдельного согласования:

1. отсутствие `expires_at`;
2. `status = active | inactive`;
3. strict boundary `last_confirmed_at > cutoff`;
4. configurable validity period;
5. technical default 168h только в config layer;
6. единый injectable/testable source of time;
7. runtime repository не использует собственный `now()`;
8. existing S0 Offers backfill в `active` + migration-time `last_confirmed_at`;
9. отсутствие permanent DB defaults для lifecycle fields;
10. публичный Search API S0 не меняется;
11. отсутствие lifecycle test API/UI.
