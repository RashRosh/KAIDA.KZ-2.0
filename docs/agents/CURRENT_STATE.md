# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`; текущей очередью владеет только `docs/product/EXECUTION_PLAN.md`. Перед работой всегда перепроверить git/GitHub: этот файл намеренно хранит только текущее состояние и может устареть.

## Verified base

- Проверено: 2026-10-01.
- `origin/main`: `a5df3a7` (merge PR #71), merged-main CI run `36847545091` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная product branch: `slice/address-directory`; PR #72 открыт.
- Product implementation head до maintenance merge: `8316991`.
- Maintenance merge head: `fa4e2af`; `KAIDA verify` run `36850756559` green.
- Текущий branch head после real-data proof harness и reconciliation: `71faf9d`; exact head всегда перепроверять через git/GitHub.
- PR #72 **не готов к merge** до закрытия real-data blocker и Product Owner manual acceptance.

## Current task

Stage 1a, KAIDA address directory для Almaty pilot. Текущая задача — добавить ручной запуск existing real-data proof workflow с явным `proof_sha`, затем запустить его для точного product-code SHA `71faf9d2d81f8f28e146699750c64f6ba127a825`. Изменение только CI workflow; product behavior, contracted boundary и Slice Contract остаются неизменными.

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
- Diagnosis commits established that polygon extraction discarded boundary relations; importer fix `71faf9d` now extracts with the relation-bearing boundary PBF.
- Current-head full regression / branch CI: PASS on `71faf9d` (`36857093256` pull request run; `36857088758` push run).
- Existing proof workflow now has a manual-only `proof_sha` dispatch, pinned checkout and SHA assertion; local YAML parse and diff check pass.
- Workflow/handoff commit `1166d5063b6610addb88cffa54f74e68bf690e33` is pushed to `origin/slice/address-directory`; tracked worktree is clean.
- Exact-SHA real-data proof dispatched as run `36896594370`, targeting `71faf9d2d81f8f28e146699750c64f6ba127a825`; result pending.

## Verification

- full regression (`pnpm verify`) and branch CI `36857093256` on `71faf9d`: PASS;
- push CI `36857088758` on `71faf9d`: PASS;
- manual workflow YAML parse / pinned-checkout assertions: PASS; GitHub dispatch on exact SHA: PENDING;
- GitHub real-data proof run `36896594370`: in progress; evidence artifact pending;
- real PBF download/checksum: PASS;
- baseline real import and its counts/DB sizes: recorded before importer fix; representative `Зеленый базар` query failed on pre-fix SHA `881aceb`;
- post-fix exact-SHA real-data proof, representative queries, latency and EXPLAIN evidence: PENDING;
- Product Owner manual acceptance: PENDING.

## Blocker

Post-fix real-data acceptance is not yet verified. PR #72 remains blocked on the exact-SHA real-data proof and Product Owner manual acceptance. Do not weaken contract criteria, hardcode market names or change the approved geography.

## Next action

1. Inspect run `36896594370` until complete; verify its checkout assertion, proof result and uploaded evidence artifact.
2. If proof passes, run required branch verification on the resulting head. If real-data criteria fail due to a genuine contract conflict, stop for Product Owner decision; do not alter product behavior, boundary or contract.
3. Stop before Product Owner manual acceptance.

## Current constraints

- manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks;
- no public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service;
- no other city / Kazakhstan-wide rollout, buyer geocoding или Backoffice без contract decision;
- no KK proofreading/localization pass или отдельный desktop redesign;
- this task changes CI workflow only; do not change product behavior, approved boundary or Slice Contract;
- generated OSM data/dumps не коммитить;
- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/` не включать.
