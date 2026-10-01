# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`; текущей очередью владеет только `docs/product/EXECUTION_PLAN.md`. Перед работой всегда перепроверить git/GitHub: этот файл намеренно хранит только текущее состояние и может устареть.

## Verified base

- Проверено: 2026-10-01.
- `origin/main`: `762e170` (merge PR #70), merged-main CI run `36813870467` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная product branch: `slice/address-directory` от checkpoint `v0.0.43-seller-location-geo-fallback`.
- Текущий head product branch: `8316991` (`feat: add Almaty address directory`).
- Branch CI run `36845040888` на exact head `8316991`: green.

## Current task

Stage 1a, KAIDA address directory для Almaty pilot.

Implementation и автоматическая verification завершены. Slice **не закрыт**: обязательный real-data operational proof на реальном checksummed Geofabrik Kazakhstan PBF и Product Owner manual acceptance ещё pending.

Точный behavior и закрытая contract revision принадлежат `docs/slices/address-directory/SLICE_CONTRACT.md`. Очередь после закрытия этого slice смотреть только в `docs/product/EXECUTION_PLAN.md`.

## Last completed

- Реализация address directory закоммичена и отправлена в `slice/address-directory` как `8316991`.
- GitHub branch CI на этом exact SHA завершён успешно.
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
- branch CI `36845040888` на `8316991`: PASS;
- real Geofabrik PBF operational proof: PENDING;
- Product Owner manual acceptance: PENDING.

## Blocker / pending external gate

Из текущей execution environment Geofabrik endpoint не отвечает. Не считать synthetic fixture доказательством real-data acceptance и не ослаблять criterion 12 ради закрытия slice.

## Next action

Когда checksummed Geofabrik Kazakhstan PBF доступен из execution environment:

1. запустить pinned real importer в disposable/local database;
2. записать source timestamp/checksum, Almaty counts, DB/index size, import duration и representative exact/prefix/typo query evidence согласно Slice Contract;
3. убедиться, что intended indexes используются;
4. после real-data proof выполнить Product Owner manual acceptance;
5. только затем проходить оставшиеся repository gates slice по `PROJECT_RULES.md`.

## Current constraints

- manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks;
- no public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service;
- no other city / Kazakhstan-wide rollout, buyer geocoding или Backoffice;
- no KK proofreading/localization pass или отдельный desktop redesign;
- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/` не включать.
