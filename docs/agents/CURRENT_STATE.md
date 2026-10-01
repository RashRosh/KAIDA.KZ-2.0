# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-02.
- `origin/main`: `a5df3a7` (merge PR #71); merged-main CI green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная branch: `slice/address-directory`; PR #72 открыт.
- PR #72 не готов к merge до green exact-SHA proof + independent branch CI + Product Owner manual acceptance.

## Current task

Stage 1a — Address Directory для Almaty pilot. Boundary строго relation `2465058`. Невалидный пример `Алтын Орда` заменён на `Рынок Барыс`; `Зелёный Базар` остаётся обязательным real-data и manual-acceptance кейсом.

## Last completed

- Exact-SHA real-data proof `36931827113` on `c1ddbf9` — PASS/full success: все proof-шаги (clean-DB guard, migrate, pinned Geofabrik PBF, boundary+counts, real importer+idempotency, query latency+EXPLAIN) и embedded `pnpm verify` (включая E2E) green.
- Root cause of prior verify failure was workflow-only: proof-workflow не устанавливал Playwright Chromium (в отличие от `ci.yml`). Добавлен шаг `Install Chromium` перед `pnpm verify`; без ослабления проверок и без правок продукта/контракта.
- Independent branch CI `KAIDA verify` на том же head `c1ddbf9` — success (оба run: 36931770044, 36931776050).

## Verification

- Exact-SHA real-data proof на `c1ddbf9`: PASS.
- Independent branch CI на `c1ddbf9`: PASS (2 runs green).
- Product Owner manual acceptance: PENDING — остановка по инструкции.

## Blocker

Нет открытого technical blocker. Финальный gate — Product Owner manual acceptance.

## Next action

Пройти Product Owner manual acceptance на `c1ddbf9`. Никаких дальнейших изменений/merge/tag до его явного поручения.

## Current constraints

- Almaty boundary только relation `2465058`; geography не расширять.
- `Зелёный Базар` и `Рынок Барыс` остаются acceptance cases.
- Не добавлять public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service.
- Manual address entry и browser/map-link geo flows остаются first-class fallbacks.
- Generated OSM data/dumps не коммитить.
- `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/` и другие local-only файлы не коммитить.
- Commit/push/PR/merge/tag — только по прямому поручению Product Owner.

