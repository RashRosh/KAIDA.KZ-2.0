# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`; текущей очередью владеет только `docs/product/EXECUTION_PLAN.md`. Перед работой всегда перепроверить git/GitHub: этот файл намеренно хранит только текущее состояние и может устареть.

## Verified base

- Проверено: 2026-10-01.
- `origin/main`: `a5df3a7` (merge PR #71), merged-main CI run `36847545091` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная product branch: `slice/address-directory` от checkpoint `v0.0.43-seller-location-geo-fallback`.
- Product implementation head до maintenance merge: `8316991` (`feat: add Almaty address directory`).
- Актуальный post-maintenance merge head: `fa4e2af`.
- `KAIDA verify` run `36850756559` на exact head `fa4e2af`: green.
- PR #72 открыт и mergeable; merge не разрешён до закрытия real-data proof и Product Owner manual acceptance.

## Current task

Stage 1a, KAIDA address directory для Almaty pilot.

Implementation, maintenance merge и автоматическая branch verification завершены. Текущий существенный шаг: закрыть обязательный real-data operational proof на реальном checksummed Geofabrik Kazakhstan PBF без изменения product code.

Slice **не закрыт**: real-data proof и Product Owner manual acceptance ещё pending.

Точный behavior и закрытая contract revision принадлежат `docs/slices/address-directory/SLICE_CONTRACT.md`. Очередь после закрытия этого slice смотреть только в `docs/product/EXECUTION_PLAN.md`.

## Last completed

- Реализация address directory закоммичена и отправлена в `slice/address-directory` как `8316991`.
- Maintenance-изменения PR #71 интегрированы обычным merge commit `fa4e2af`; единственный конфликт `CURRENT_STATE.md` разрешён на новой структуре #71 с сохранением актуального Address Directory state.
- Product code относительно `8316991` при maintenance merge не менялся.
- Post-merge `KAIDA verify` run `36850756559` на exact SHA `fa4e2af`: PASS.
- Синтетический PBF proof подтверждает importer path, same-checksum idempotency и автоматические сценарии, но не подменяет требуемый real Geofabrik proof.

## Verification

- lint: PASS;
- typecheck: PASS;
- build: PASS;
- unit: 317 PASS;
- integration: 197 PASS;
- synthetic PBF import + повторный идемпотентный import: PASS;
- новые address-directory E2E: PASS;
- full E2E: 150 PASS, 3 expected skipped; один старый geo-тест получил timeout при клике и сразу прошёл изолированный повтор;
- branch CI `36845040888` на implementation head `8316991`: PASS;
- post-maintenance branch CI `36850756559` на `fa4e2af`: PASS;
- real Geofabrik PBF operational proof: IN PROGRESS;
- Product Owner manual acceptance: PENDING.

## Blocker / pending external gate

Предыдущее execution environment не могло получить Geofabrik endpoint. Новый recovery-run должен сначала повторно проверить доступность реального `kazakhstan-latest.osm.pbf`; synthetic fixture не считается доказательством real-data acceptance и criterion 12 не ослабляется.

## Next action

1. на disposable PostgreSQL скачать текущий Geofabrik Kazakhstan PBF и проверить опубликованный checksum/provenance;
2. запустить pinned importer с Almaty boundary `r2465058`;
3. записать source timestamp/checksum, raw/accepted/deduplicated/rejected counts by kind, DB/index size, import duration/peak requirements и representative exact/prefix/typo query evidence;
4. записать `EXPLAIN` evidence использования intended indexes;
5. после proof прогнать полный `pnpm verify` и branch CI на финальном executable SHA;
6. затем передать Product Owner manual acceptance scenario из Slice Contract;
7. только после manual acceptance проходить оставшиеся repository gates slice по `PROJECT_RULES.md`.

## Current constraints

- manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks;
- no public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service;
- no other city / Kazakhstan-wide rollout, buyer geocoding или Backoffice;
- no KK proofreading/localization pass или отдельный desktop redesign;
- product code Address Directory не менять ради verification/handoff без объективной необходимости;
- generated OSM data/dumps не коммитить;
- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/` не включать.
