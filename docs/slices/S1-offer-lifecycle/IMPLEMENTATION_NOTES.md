# S1 Offer Lifecycle — Implementation Notes

Рабочая ветка: `slice/s1-offer-lifecycle`.

Статус реализации: **READY — automated verification and manual acceptance PASS**.

## Реализованная модель

Lifecycle semantics принадлежат модулю Offers.

Правило видимости:

`status = active AND last_confirmed_at > cutoff`

`cutoff = now - validityPeriodHours`.

В модели нет `expires_at`; `expired` не является сохранённым status.

`status` представлен обычным PostgreSQL `text`, типизирован в TypeScript как `active | inactive`, и дополнительно защищён реальным PostgreSQL CHECK `offers_status_allowed`.

`status` и `last_confirmed_at` после S1 обязательны и не имеют permanent DB defaults.

## Configuration

Единственное место чтения `OFFER_VALIDITY_PERIOD_HOURS`:

`src/modules/offers/config/offer-lifecycle.config.ts`.

Technical default: `168` часов. Это не утверждённая продуктовая политика.

Одна validation function принимает только positive safe integer. Она используется как для env string, так и для explicit internal/test override `validityPeriodHours`; application logic не получает непроверенный period.

Во время первого S1 CI обнаружилась только типовая несовместимость слишком узкого env-типа с `NodeJS.ProcessEnv`. Она исправлена без изменения поведения: input environment теперь является readonly string-keyed record. Новых abstractions/dependencies не добавлено.

## Clock

Offers-local clock минимален:

`type Clock = () => Date`.

Production clock использует `new Date()`.

Один Search operation вызывает выбранный clock один раз, затем Offers вычисляет cutoff. Repository не читает системное время и не использует PostgreSQL `now()`/`CURRENT_TIMESTAMP` для lifecycle filtering.

Tests передают fixed clock; `sleep`, polling и ожидание реального expiry не используются.

## Search integration

Публичный Search API и response contract S0 не менялись.

Search application:

1. валидирует/нормализует query по S0;
2. захватывает `now` один раз;
3. получает validated validity period;
4. вызывает Offers-owned cutoff calculation;
5. передаёт cutoff в repository.

Search repository не собирает lifecycle rule самостоятельно. Он импортирует Offers-owned `visibleOffersPredicate(cutoff)`.

Lifecycle fields в public projection отсутствуют.

## Migration 0001

Создана единственная новая S1 migration:

`drizzle/migrations/0001_s1_offer_lifecycle.sql`.

`0000_s0_first_search.sql` не изменена.

Порядок 0001:

1. nullable `status`;
2. nullable `last_confirmed_at`;
3. backfill existing Offers: `active` + migration `CURRENT_TIMESTAMP`;
4. PostgreSQL CHECK `active | inactive`;
5. `status SET NOT NULL`;
6. `last_confirmed_at SET NOT NULL`;
7. permanent lifecycle defaults отсутствуют.

Migration не drop/recreate Offers и не изменяет старые business fields.

Drizzle journal/snapshot содержат только S1 schema evolution. Фактические migration artifacts проверяются двумя независимыми путями на PostgreSQL 18: clean chain через Drizzle migrator и реальный S0 → S1 upgrade test через actual SQL files.

## Upgrade path

`tests/integration/s1-migration-upgrade.test.ts` создаёт временную database только с exact name `kaida_s1_upgrade_test` на том же PostgreSQL 18 instance.

Test:

1. применяет actual `0000`;
2. вставляет S0-format Offer без lifecycle fields;
3. сохраняет ID и старые business values;
4. применяет actual `0001`;
5. проверяет сохранность старых values;
6. проверяет `status = active` и non-null `last_confirmed_at`;
7. проверяет NOT NULL и отсутствие defaults через `information_schema`;
8. реально провоцирует CHECK violation на invalid status;
9. проверяет migration timestamp только как invariant внутри controlled lower/upper window, а не на точное равенство.

Temporary database удаляется в `finally`.

## Clean path и seed

`kaida_test` пересоздаётся штатным guarded setup.

Полная migration chain применяется дважды; второй проход является no-op. Один captured `seedNow` передаётся в два repeat seed calls для детерминированности.

Seed изменяет lifecycle state только двух собственных фиксированных Offers:

- `lambOffer`;
- `beefOffer`.

Оба получают `active` + `last_confirmed_at = seedNow`.

Общего `UPDATE offers` нет. Произвольные Offers seed не освежает.

## Tests

Добавлены:

- unit config validation;
- unit cutoff/single-clock application path;
- PostgreSQL lifecycle integration matrix;
- реальный S0 → S1 migration upgrade test;
- lifecycle E2E через существующий UI.

Boundary на реальной PostgreSQL:

- `cutoff + 1 ms` → visible;
- `== cutoff` → hidden;
- `cutoff - 1 ms` → hidden;
- inactive fresh → hidden.

Existing S0 `tests/e2e/search.spec.ts` не изменён.

S1 E2E создаёт scoped unique fixture отдельно для mobile/desktop, меняет lifecycle только прямым technical DB setup и удаляет fixture после test. Lifecycle/debug/test/admin endpoints или UI не добавлены.

## Scope

Не менялись:

- public Search contract;
- `/api/search` route;
- UI;
- S0 E2E file;
- `package.json`;
- Playwright/Vitest configs;
- `0000_s0_first_search.sql`;
- Catalog/Sellers/Locations;
- S2+.

Dependencies не добавлялись.

## Фактический CI

Run `34613957998` на commit `d5c2848...` поднял PostgreSQL 18.6 и дошёл до `pnpm verify`, но остановился на TypeScript error в env input type до migrations/tests.

После минимального fix commit `6433304f...` run `34614267031` прошёл полный `pnpm verify` успешно на PostgreSQL 18.6.

Финальный implementation head до manual acceptance: `30e7a05ed8528a26d68190062731cd10cf9c7a0b`. GitHub Actions run `34614711926` также прошёл полный `pnpm verify` успешно на PostgreSQL 18.6.

## Manual acceptance

Ручная приёмка выполнена 2026-09-11 в GitHub Codespaces через существующий Search UI и реальный PostgreSQL 18.

Подтверждено вручную:

- S0 baseline searches работают;
- fresh active lamb виден;
- active lamb с `last_confirmed_at = NOW() - 169 hours` скрывается;
- после fresh restore lamb снова появляется;
- fresh `inactive` lamb скрывается;
- seed восстанавливает нормальное состояние;
- mobile/desktop layout и keyboard focus regression проходят.

Результат: **PASS**.

Финальная verification документация хранится в `VERIFICATION.md`.

Approved checkpoint после завершения S1: `v0.0.2-s1`.
