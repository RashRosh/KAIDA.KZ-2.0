# S1 Offer Lifecycle — Verification

## Current status

**READY — automated verification and manual acceptance PASS**

S1 implementation, full automated regression on real PostgreSQL 18 and separate manual acceptance through the existing Search UI are complete. Slice is eligible for the checkpoint `v0.0.2-s1` and merge into `main`. S2 has not started.

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

### Run 34614711926 — PASS, final implementation head before manual acceptance

Head: `30e7a05ed8528a26d68190062731cd10cf9c7a0b`.

Full `pnpm verify` again passed on PostgreSQL 18.6 after final implementation/verification documentation was present. This is the automated evidence used for manual acceptance.

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

## Scope verification — PASS

Перед ручной приёмкой branch был повторно сравнен с `main`: ahead 26 / behind 0.

Подтверждено:

- изменения только в whitelist S1;
- no package dependency changes;
- no API/UI changes;
- no Search contract change;
- no S0 E2E rewrite;
- no `0000` change;
- no S2+.

## Manual acceptance — PASS

Ручная приёмка выполнена **2026-09-11** в GitHub Codespaces на ветке `slice/s1-offer-lifecycle` с реальным PostgreSQL 18 и существующим Search UI.

Фактически пройден один полный сценарий:

1. normal S1 seed;
2. `баранина` → visible, цена 4 200 ₸ / кг;
3. `говядина` → visible + `Цена не указана`;
4. `единорог` → existing empty state;
5. empty query → existing validation message;
6. direct DB technical setup: lamb `active` + `last_confirmed_at = NOW() - 169 hours` → `баранина` hidden;
7. restore lamb `active` + fresh `last_confirmed_at` → visible again;
8. direct DB technical setup: lamb `inactive` + fresh `last_confirmed_at` → hidden;
9. S1 seed restored normal fixture state;
10. Search regression repeated after restore;
11. mobile ~390–400 px checked;
12. desktop and keyboard/focus regression checked.

No temporary lifecycle endpoint, debug API, test API, admin route or temporary UI was used.

Результат: **PASS**.

## Final result

**READY**

S1 acceptance criteria are satisfied by automated PostgreSQL 18 verification plus separate manual acceptance. The approved working checkpoint name is:

`v0.0.2-s1`
