# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`; текущей очередью владеет только `docs/product/EXECUTION_PLAN.md`. Перед работой всегда перепроверить git/GitHub: этот файл намеренно хранит только текущее состояние и может устареть.

## Verified base

- Проверено: 2026-10-01.
- `origin/main`: `a5df3a7` (merge PR #71), merged-main CI run `36847545091` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная product branch: `slice/address-directory`; PR #72 открыт.
- Product implementation head до maintenance merge: `8316991`.
- Maintenance merge head: `fa4e2af`; `KAIDA verify` run `36850756559` green.
- Текущий branch head после real-data proof harness: `881aceb`; exact head всегда перепроверять через git/GitHub.
- PR #72 **не готов к merge** до закрытия real-data blocker и Product Owner manual acceptance.

## Current task

Stage 1a, KAIDA address directory для Almaty pilot.

Real-data operational proof на реальном checksummed Geofabrik Kazakhstan PBF обнаружил contract blocker: текущий импорт реальных данных даёт `marketplaces: 0`, поэтому обязательный representative query `Зеленый базар` не возвращает результат.

Текущий существенный шаг: определить, является ли причина несовпадением OSM tags/filtering или географической границей, и внести только минимальное исправление, необходимое для выполнения уже утверждённого Slice Contract. Contract не ослаблять.

## Last completed

- Реализация Address Directory: `8316991`.
- PR #71 maintenance интегрирован merge commit `fa4e2af`; post-merge branch CI green.
- Добавлен одноразовый real-data proof workflow; generated OSM data остаются вне Git.
- `kazakhstan-latest.osm.pbf` 2026-10-01 возвращал redirect loop; proof воспроизведён на последнем доступном датированном Geofabrik Kazakhstan extract `kazakhstan-260929.osm.pbf` с опубликованным MD5.
- Real source provenance подтверждён: MD5 `eb97ae46ad3a65672fd48bd885763dab`, SHA-256 `0020c7643397915c195e897d759eec3fe19dd602a4f44b7da48039144d34716c`, source timestamp `2026-09-29T23:52:32Z`, size `223792807` bytes.
- Almaty boundary `r2465058` успешно воспроизведён.
- Real candidate counts: raw `6361`; accepted `6160`; rejected `201`; deduplicated `3072` (`3011` address, `60` street, `0` marketplace, `1` retail).
- Pinned importer активировал snapshot из `3072` entries; повторный импорт того же checksum вернул `activated:false` с тем же import id — idempotency подтверждён.
- DB size после real import: table `760 kB`, all indexes `2016 kB`, trigram index `1656 kB`, total `2808 kB`.

## Verification

- ранее закрытые lint/typecheck/build/unit/integration/E2E: PASS на implementation/merge heads;
- branch CI `36845040888` на `8316991`: PASS;
- post-maintenance branch CI `36850756559` на `fa4e2af`: PASS;
- real PBF download/checksum: PASS;
- Almaty boundary extraction: PASS;
- real importer first activation: PASS;
- same-checksum idempotent import: PASS;
- real counts / DB sizes: RECORDED;
- representative `Зеленый базар` query: **FAIL — no result**;
- representative `Алтын Орда` query: not reached after Green Bazaar failure;
- EXPLAIN evidence / full `pnpm verify` after completed real-data proof: PENDING until blocker is fixed;
- Product Owner manual acceptance: PENDING.

## Blocker

Approved Slice Contract requires real representative queries for a house, street, `Зелёный Базар` and `Алтын Орда`, and manual acceptance requires `Зеленый базар` to resolve to `Зелёный Базар`. Current real extract/import produces zero marketplace entries, so synthetic fixtures cannot close this criterion.

Не менять contract, не хардкодить названия рынков и не расширять географию молча. Сначала доказать фактическую причину на OSM data.

## Next action

1. inspect actual OSM object/tags for Green Bazaar (`relation 20040804`) in the same PBF and search real PBF for Altyn Orda name variants;
2. определить, находится ли Altyn Orda внутри contracted Almaty boundary;
3. если проблема только в generic tag coverage — минимально расширить importer filter/transform, добавить targeted tests и повторить real-data proof;
4. если для Altyn Orda требуется изменить contracted geographic boundary — STOP и вынести Product Owner contract decision до изменения behavior;
5. после успешного real-data proof прогнать полный `pnpm verify` и branch CI на final executable SHA;
6. затем передать Product Owner manual acceptance scenario.

## Current constraints

- manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks;
- no public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service;
- no other city / Kazakhstan-wide rollout, buyer geocoding или Backoffice без contract decision;
- no KK proofreading/localization pass или отдельный desktop redesign;
- product code не менять до доказательства причины real-data blocker;
- generated OSM data/dumps не коммитить;
- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/` не включать.
