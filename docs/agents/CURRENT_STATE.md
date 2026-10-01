# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`; текущей очередью владеет только `docs/product/EXECUTION_PLAN.md`. Перед работой всегда перепроверить git/GitHub: этот файл намеренно хранит только текущее состояние и может устареть.

## Verified base

- Проверено: 2026-10-01.
- `origin/main`: `a5df3a7` (merge PR #71), merged-main CI run `36847545091` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная product branch: `slice/address-directory` от checkpoint `v0.0.43-seller-location-geo-fallback`.
- Product implementation head до maintenance merge: `8316991` (`feat: add Almaty address directory`).
- Branch CI run `36845040888` на exact implementation head `8316991`: green.
- Maintenance base `a5df3a7` из PR #71 интегрирован обычным merge в текущий repository HEAD; exact SHA этого merge всегда сверять через git, post-merge branch CI — через GitHub.

## Current task

Stage 1a, KAIDA address directory для Almaty pilot.

Implementation и автоматическая verification завершены. Slice **не закрыт**: обязательный real-data operational proof на реальном checksummed Geofabrik Kazakhstan PBF и Product Owner manual acceptance ещё pending.

Точный behavior и закрытая contract revision принадлежат `docs/slices/address-directory/SLICE_CONTRACT.md`. Очередь после закрытия этого slice смотреть только в `docs/product/EXECUTION_PLAN.md`.

## Last completed

- Реализация address directory закоммичена и отправлена в `slice/address-directory` как `8316991`.
- GitHub branch CI на этом exact implementation SHA завершён успешно.
- Синтетический PBF proof подтверждает importer path, same-checksum idempotency и автоматические сценарии, но не подменяет требуемый real Geofabrik proof.
- Maintenance-изменения PR #71 сохранены: crash-safe handoff / effort policy и общий workflow `KAIDA verify`.
- Единственный merge conflict был в `CURRENT_STATE.md`; он разрешён на новой структуре #71 с сохранением актуального Address Directory state. Product code относительно `8316991` не менялся.

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
- post-merge scoped lint: PASS;
- post-merge typecheck: PASS;
- post-merge unit: 317 PASS;
- post-merge branch CI: PENDING;
- real Geofabrik PBF operational proof: PENDING;
- Product Owner manual acceptance: PENDING.

## Blocker / pending external gate

Из текущей execution environment Geofabrik endpoint не отвечает. Не считать synthetic fixture доказательством real-data acceptance и не ослаблять criterion 12 ради закрытия slice.

## Next action

1. push текущего merge head в `slice/address-directory` без force-push и дождаться green CI PR #72;
2. когда checksummed Geofabrik Kazakhstan PBF доступен из execution environment, запустить pinned real importer в disposable/local database;
3. записать source timestamp/checksum, Almaty counts, DB/index size, import duration и representative exact/prefix/typo query evidence согласно Slice Contract;
4. убедиться, что intended indexes используются;
5. после real-data proof выполнить Product Owner manual acceptance;
6. только затем проходить оставшиеся repository gates slice по `PROJECT_RULES.md`.

## Current constraints

- manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks;
- no public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service;
- no other city / Kazakhstan-wide rollout, buyer geocoding или Backoffice;
- no KK proofreading/localization pass или отдельный desktop redesign;
- product code Address Directory не менять ради maintenance merge без объективной необходимости;
- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/` не включать.
