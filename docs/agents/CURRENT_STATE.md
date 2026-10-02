# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-02.
- `origin/main`: `debd9f0` (docs: record PR #72 merged state); base merge `4362660` (Merge PR #72). Слито и запушено.
- Merged-main CI green: run `36973303192` на `debd9f0` — SUCCESS.
- PR #72 `MERGED` (state MERGED `2026-10-02T06:22:07Z`); ветка `slice/address-directory` слита, PR закрыт.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`. Checkpoint tag для Address Directory не создан — ждёт поручения PO.

## Current task

Stage 1a — Address Directory для Almaty pilot. Boundary строго relation `2465058`. Невалидный пример `Алтын Орда` заменён на `Рынок Барыс`; `Зелёный Базар` остаётся обязательным real-data и manual-acceptance кейсом.

## Last completed

- PR #72 (`stage 1a`) **MERGED** в `main` через `4362660`, финальный doc-коммит `debd9f0` запушен, PR авто-закрыт (state MERGED).
- Exact-SHA real-data proof `36931827113` + independent branch CI на `c1ddbf9` — PASS.
- KAIDA verify на merge-base: green.
- Automated §10 evidence собрано на production build (head `0e2fd5b`): оба e2e `tests/e2e/address-directory.spec.ts` PASS (Trading Points workspace + embedded card flow; выбор «Зелёный базар» → canonical address+geo `43.263, 76.956`, attribution OSM, manual fallback). Остальные сценарии §10 подтверждены existing green e2e/integration (ручной адрес без блокировки, «Местоположение не задано», изменение текста после выбора = manual, geo не сохраняется, atomic resolve + stale reject в integration).

## Verification

- Merged-main CI на финальном `main` (`debd9f0`): run `36973303192` — SUCCESS (green).
- Automated manual-acceptance evidence: PASS (e2e на production build, head `0e2fd5b`).
- Product Owner manual acceptance: **PASS** — PO прошёл ручной тест на телефоне через `http://192.168.8.71:3000/seller/points` (production-сервер поднят локально и после теста остановлен). «все прощелкал. все норм. принято».
- Pre-merge diff audit PR #72: **APPROVED FOR MERGE** — чисто: closed contracts сохранены, риски доказаны, manual acceptance пройден лично PO. Единственная заметка — статус `SLICE_CONTRACT.md` (обновлён здесь же).

## Next action

PR #72 слит и закрыт: `main` = `debd9f0`, merge-коммит `4362660`, PR №72 state MERGED. Убраны все «open/pending merge» записи; slice `address-directory` (stage 1a) завершён и закрыт. По поручению PO осталось: создать annotated checkpoint tag (ожидается имя, напр. `v0.0.44-address-directory`) и выбрать следующий stage из NEXT. Worktree чистый, только локальные/игнорируемые файлы (`next-env.d.ts`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`) — коммитить их нельзя.

## Blocker

Merge и acceptance gates закрыты (PR #72 MERGED, merged-main CI green). Остаётся только: создание checkpoint tag по имени, которое назовёт Product Owner, и решение PO о выборе следующего stage из NEXT.

## Current constraints

- Almaty boundary только relation `2465058`; geography не расширять.
- `Зелёный Базар` и `Рынок Барыс` остаются acceptance cases.
- Не добавлять public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service.
- Manual address entry и browser/map-link geo flows остаются first-class fallbacks.
- Generated OSM data/dumps не коммитить.
- `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/` и другие local-only файлы не коммитить.
- Commit/push/PR/merge/tag — только по прямому поручению Product Owner.

