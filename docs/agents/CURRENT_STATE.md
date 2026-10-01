# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-02.
- `origin/main`: `a5df3a7` (merge PR #71); merged-main CI `36847545091` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная branch: `slice/address-directory`; PR #72 открыт.
- Последний product/proof head: `f76e454` (`ci: provide isolated test db for address proof`).
- Docs-only compactness policy для handoff добавлена поверх него; фактический branch head всегда перепроверять через git/GitHub.
- PR #72 не готов к merge до green real-data proof + full verification + Product Owner manual acceptance.

## Current task

Stage 1a — Address Directory для Almaty pilot. География остаётся строго boundary relation `2465058`. Невалидный пример `Алтын Орда` заменён на `Рынок Барыс`; `Зелёный Базар` остаётся обязательным real-data и manual-acceptance кейсом.

Targeted local real-data proof уже green. Единственный текущий технический blocker — порядок шагов в remote proof workflow на `f76e454`.

## Last completed

- Root-only boundary/import fix и Barys example correction запушены как `93ee724`.
- `f76e454` добавил `TEST_DATABASE_URL=.../kaida_test` и test env для embedded `pnpm verify`.
- Реальный импорт из pinned `kazakhstan-260929.osm.pbf` / SHA-256 `0020c764...` завершён в disposable PostgreSQL 18.
- Active snapshot: `132113` entries = `128955` address / `2940` street / `63` marketplace / `155` retail.
- Representative queries PASS: `улица Кабдолова, 14А`, street prefix/typo, `Зелёный Базар` (`osm:r20040804`), `Рынок Барыс` (`osm:w216728654`).
- Trigram EXPLAIN uses `address_directory_entries_search_trgm_idx`; same-checksum retry is an idempotent no-op.
- DB footprint after real import: ~57 MB total; generated OSM data остаются вне Git.

## Verification

- Targeted local real-data proof: PASS.
- Exact-SHA run `36913897409` on `93ee724`: import + operational queries/latency/index-plan PASS; embedded `pnpm verify` stopped because test-DB env/setup was missing.
- Exact-SHA run `36914624726` on `f76e454`: FAIL deterministically at `Create separate test database and assert clean development database` immediately after successful `pnpm db:migrate`; later real-data/proof/verify steps were skipped.
- Причина текущего failure: workflow мигрирует `kaida`, затем требует `0` public tables в той же `kaida`.
- Independent clean branch CI на результирующем исправленном head: PENDING.
- Product Owner manual acceptance: PENDING.

## Blocker

Workflow ordering defect only; product code, Almaty boundary и marketplace acceptance не менять.

Правильный порядок:

1. создать `kaida_test`;
2. подтвердить, что disposable proof DB `kaida` чистая;
3. выполнить `pnpm db:migrate` в `kaida`;
4. real-data import/query/EXPLAIN работают с `kaida`;
5. embedded `pnpm verify` использует `kaida_test` через `TEST_DATABASE_URL`.

Не переносить real-data migration/import в `kaida_test`.

## Next action

1. Минимально переставить test-DB creation + clean-DB assertion перед `pnpm db:migrate`; не менять product code/contracts.
2. Выполнить static/local validation, затем commit/push только разрешённого workflow fix + coherent handoff update.
3. Запустить exact-SHA real-data proof на новом head и потребовать PASS всего workflow, включая embedded `pnpm verify`.
4. Подтвердить independent branch CI на том же результирующем head и остановиться перед Product Owner manual acceptance.

## Current constraints

- Almaty boundary только relation `2465058`; geography не расширять.
- `Зелёный Базар` и `Рынок Барыс` должны оставаться acceptance cases.
- Не добавлять public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service.
- Manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks.
- Generated OSM data/dumps не коммитить.
- `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/` и другие local-only файлы не коммитить.
- Commit/push/PR/merge/tag — только по прямому поручению Product Owner.
