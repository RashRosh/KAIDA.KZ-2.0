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

- Exact-SHA real-data proof `36931827113` + independent branch CI на `c1ddbf9` — PASS.
- Current head `0e2fd5b` green: KAIDA verify `36933053991` — SUCCESS.
- Automated §10 evidence собран локально на production build (head `0e2fd5b`): оба e2e `tests/e2e/address-directory.spec.ts` PASS (Trading Points workspace + embedded card flow; выбор «Зелёный базар» → canonical address+geo `43.263, 76.956`, attribution OSM, manual fallback). Остальные сценарии §10 подтверждены existing green e2e/integration (ручной адрес без блокировки, «Местоположение не задано», изменение текста после выбора = manual, geo не сохраняется, atomic resolve + stale reject в integration).

## Verification

- Current head `0e2fd5b`: green (technical gates closed).
- Automated manual-acceptance evidence: PASS (e2e на production build).
- Product Owner manual acceptance: **PASS** — PO прошёл ручной тест на телефоне через `http://192.168.8.71:3000/seller/points` (production-сервер поднят локально и после теста остановлен). «все прощелкал. все норм. принято».
- Pre-merge diff audit PR #72: **APPROVED FOR MERGE** — чисто: closed contracts сохранены, риски доказаны, manual acceptance пройден лично PO. Единственная заметка — статус `SLICE_CONTRACT.md` (обновлён здесь же).

## Next action

PO поручил мердж PR #72: «поправь и мердж». Выполняется merge branch `slice/address-directory` в `main`; tag пока не поручен.

## Blocker

Технических и acceptance gates закрыты. Остаётся только решение Product Owner о merge PR #72 (и, при желании, checkpoint tag).

## Current constraints

- Almaty boundary только relation `2465058`; geography не расширять.
- `Зелёный Базар` и `Рынок Барыс` остаются acceptance cases.
- Не добавлять public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service.
- Manual address entry и browser/map-link geo flows остаются first-class fallbacks.
- Generated OSM data/dumps не коммитить.
- `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/` и другие local-only файлы не коммитить.
- Commit/push/PR/merge/tag — только по прямому поручению Product Owner.

