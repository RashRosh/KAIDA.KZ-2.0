# S1 Offer Lifecycle — Verification

## Current status

**NOT READY: manual acceptance pending**

Implementation и automated regression выполнены. Ручная приёмка S1 ещё не выполнена, поэтому slice нельзя merge в `main`, нельзя создавать `v0.0.2-s1` и нельзя начинать S2.

## Environment

GitHub Actions workflow: `S1 verify`.

Фактически проверено на:

- Ubuntu 24.04 runner;
- Node.js 24.19.0;
- pnpm 11.19.0;
- PostgreSQL **18.6** (`postgres:18`);
- Next.js 16.3.4;
- Vitest 4.1.11;
- Playwright 1.63.0 / Chromium.

Mock/SQLite database не использовались.

## CI history during implementation

### Run 34613957998 — FAIL, useful red feedback

Head: `d5c2848dd0a78d5ce015ea97703590db2514f8d2`.

PostgreSQL 18.6 успешно поднялся, dependency install и lint прошли. `pnpm verify` остановился на `typecheck`:

`TS2559: Type 'ProcessEnv' has no properties in common with type 'OfferLifecycleEnvironment'`.

Причина была локальной TypeScript typing issue в Offers config reader. Ни migration, ни tests на этом run не исполнялись после failure, поэтому этот run не считался доказательством S1.

Fix: commit `6433304ffb407aafd17b515dff5ef1c434dfab13`, без расширения scope.

### Run 34614267031 — PASS

Head: `6433304ffb407aafd17b515dff5ef1c434dfab13`.

Фактический `pnpm verify` прошёл полностью на PostgreSQL 18.6.

Результаты:

- lint: PASS;
- typecheck: PASS;
- development migration chain: PASS;
- S1-aware development seed: PASS;
- clean `kaida_test` migration chain: PASS;
- repeat migration: PASS;
- deterministic repeat seed: PASS;
- unit: **42/42 PASS**, 5 files;
- integration: **30/30 PASS**, 3 files;
- production build: PASS;
- E2E: **16/16 PASS**, mobile + desktop;
- browser artifact uploaded successfully.

## Migration verification

### Clean path — PASS

`tests/integration/prepare-database.ts` доказал на PostgreSQL 18:

1. clean `kaida_test`;
2. full `0000 → 0001` migration chain;
3. repeat migration without duplicate application;
4. S1-aware seed с одним controlled `seedNow`;
5. repeat seed с тем же `seedNow`;
6. product tables по-прежнему ровно `locations`, `offers`, `products`, `sellers`.

### Real S0 → S1 upgrade path — PASS

`tests/integration/s1-migration-upgrade.test.ts`: **1/1 PASS**.

Фактически:

1. создана отдельная PostgreSQL 18 database `kaida_s1_upgrade_test`;
2. применён только actual `0000_s0_first_search.sql`;
3. вставлен Offer формата S0 без `status`/`last_confirmed_at`;
4. применён actual `0001_s1_offer_lifecycle.sql`;
5. сохранены Offer ID и старые business fields/timestamps;
6. backfill дал `status = active` и non-null `last_confirmed_at`;
7. migration timestamp проверен внутри lower/upper time window, без точного wall-clock equality;
8. lifecycle columns реально NOT NULL;
9. permanent defaults отсутствуют;
10. invalid status реально отклонён PostgreSQL CHECK с SQLSTATE `23514`;
11. temporary database удалена после test.

`0000_s0_first_search.sql` не изменялся.

## Lifecycle verification — PASS

Fixed runtime:

`now = 2026-09-11T12:00:00.000Z`

`validityPeriodHours = 168`

`cutoff = 2026-09-04T12:00:00.000Z`

PostgreSQL lifecycle integration: **8/8 PASS**.

Проверены:

- fresh active → visible;
- `cutoff + 1 ms` → visible;
- `== cutoff` → hidden;
- `cutoff - 1 ms` → hidden;
- inactive fresh → hidden;
- expired Product → successful empty result;
- inactive Product → successful empty result;
- public Search response по-прежнему проходит S0 schema и не содержит lifecycle fields.

`sleep`, polling или реальное ожидание expiry не использовались.

## Config / Clock verification — PASS

Новые unit suites:

- `offer-lifecycle.test.ts`: 3/3 PASS;
- `offer-lifecycle-config.test.ts`: 21/21 PASS.

Проверены:

- technical default 168;
- positive integer validation;
- invalid zero/negative/decimal/text/non-finite/unsafe values;
- explicit internal override проходит ту же validation;
- fixed cutoff;
- injected clock вызывается один раз на Search operation;
- invalid override отклоняется до repository call.

## S0 regression — PASS

Existing integration regression `search.test.ts`: **21/21 PASS**.

Сохранены сценарии:

- `баранина`;
- case-insensitive exact search;
- trim;
- unmatched / injection-like strings;
- `говядина` с nullable price;
- Product/Seller/Location projection;
- repeat seed;
- price constraints;
- FK constraint;
- Product constraints;
- zero price;
- null seller comment.

Публичный Search contract и API route не менялись.

## E2E — PASS

Всего: **16/16 PASS**.

Existing S0 `tests/e2e/search.spec.ts` не переписывался.

На mobile и desktop прошли все S0 E2E плюс отдельный S1 lifecycle scenario:

- fresh active fixture виден через существующий UI;
- direct DB technical setup делает его expired → existing empty state;
- direct DB technical setup делает его fresh + inactive → existing empty state.

Lifecycle/debug/test/admin API или временный UI для E2E не создавались.

## Build — PASS

Next.js production build прошёл. Единственный продуктовый API route остаётся `/api/search`.

## Scope verification

Перед финальным автоматическим run требуется ещё раз сравнить branch с `main`.

Ожидаемый invariant:

- только whitelist S1;
- no package dependency changes;
- no API/UI changes;
- no Search contract change;
- no S0 E2E rewrite;
- no `0000` change;
- no S2+.

## Manual acceptance — PENDING

Отдельно через существующий UI ещё требуется фактически пройти:

1. normal seed;
2. `баранина` visible;
3. `говядина` visible + `Цена не указана`;
4. direct DB setup: lamb expired → empty;
5. restore fresh → visible;
6. direct DB setup: inactive → empty;
7. restore `active` + fresh;
8. `единорог`;
9. empty query validation;
10. mobile ~390–400 px;
11. desktop ~1440 px;
12. keyboard/focus regression.

До выполнения этого списка статус остаётся:

**NOT READY: manual acceptance pending**
