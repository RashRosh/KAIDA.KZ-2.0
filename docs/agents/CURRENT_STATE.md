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

- Workflow ordering fix применён локально: перестановка двух существующих шагов — создание `kaida_test` + clean-guard на `kaida` теперь идут до `pnpm db:migrate`; продукт/контракты не менялись.
- Targeted real-data proof (live 2026-10-02): PASS — активный импорт на pinned checksum `0020c764...`, 132113 entries (128955 address / 2940 street / 63 marketplace / 155 retail); representative queries, latency/EXPLAIN, idempotency, index plan, size — green.

## Verification

- Targeted real-data proof: PASS (local/live, до remote).
- Exact-SHA remote proof на новом head: PENDING.
- Independent branch CI на новом head: PENDING.
- Product Owner manual acceptance: PENDING.

## Blocker

Нет открытого technical blocker. Открытые gates: green exact-SHA remote proof, independent branch CI, Product Owner manual acceptance.

## Next action

1. Commit + push workflow fix в `slice/address-directory`.
2. Запустить `Address directory real-data proof` на exact new HEAD SHA; требовать PASS всего workflow, включая embedded `pnpm verify`.
3. Проверить независимый branch CI на том же head.
4. Обновить snapshot и остановиться перед Product Owner manual acceptance.

## Current constraints

- Almaty boundary только relation `2465058`; geography не расширять.
- `Зелёный Базар` и `Рынок Барыс` остаются acceptance cases.
- Не добавлять public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service.
- Manual address entry и browser/map-link geo flows остаются first-class fallbacks.
- Generated OSM data/dumps не коммитить.
- `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/` и другие local-only файлы не коммитить.
- Commit/push/PR/merge/tag — только по прямому поручению Product Owner.

