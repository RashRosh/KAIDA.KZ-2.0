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
- Exact-SHA real-data proof run `36896594370` targeted `71faf9d2d81f8f28e146699750c64f6ba127a825`; it completed but failed the Green Bazaar representative query.
- Existing diagnostics: Green Bazaar relation `r20040804` is tagged `amenity=marketplace`, `building=retail`, with `name:ru=Зелёный Базар`; its Almaty probe is inside boundary `r2465058`. Altyn Orda relation `r17596655` is `type=marketplace`, but its representative point `[76.76804085874286, 43.23370785]` is outside the contracted boundary; no Altyn Orda name match was found in the Almaty extraction.
- Run `36896594370` completed with failure after successfully verifying checkout SHA, source checksum, boundary/candidate extraction and importer; importer activated 3,533 entries but still recorded zero marketplaces.

## Verification

- full regression (`pnpm verify`) and branch CI `36857093256` on `71faf9d`: PASS;
- push CI `36857088758` on `71faf9d`: PASS;
- manual workflow YAML parse / pinned-checkout assertions: PASS; run `36896594370` checkout guard passed for exact SHA `71faf9d2d81f8f28e146699750c64f6ba127a825`;
- real source: Geofabrik `kazakhstan-260929.osm.pbf`, published MD5 `eb97ae46ad3a65672fd48bd885763dab`, SHA-256 `0020c7643397915c195e897d759eec3fe19dd602a4f44b7da48039144d34716c`, timestamp `2026-09-29T23:52:32Z`, 223,792,807 bytes; boundary `r2465058` and candidate extraction: PASS;
- read-only OSM diagnosis artifacts from runs `36855912179` / `36856552657`: Green Bazaar probe inside Almaty: true; Altyn Orda representative point inside: false; both artifacts uploaded successfully;
- real candidates: raw 6,361; accepted 6,160; rejected 201; deduplicated 3,072 (3,011 address, 60 street, zero marketplace, one retail);
- pinned importer: activated 3,533 (3,147 addresses, 385 streets, zero marketplaces, one retail); same-checksum retry was an idempotent no-op;
- DB size: table 888 kB, all indexes 2,696 kB, trigram index 2,264 kB, total 3,624 kB;
- representative query step failed: `Зеленый базар` returned no result; `Алтын Орда`, latency, EXPLAIN and full `pnpm verify` were not reached. Evidence artifact: `address-directory-real-proof-71faf9d2d81f8f28e146699750c64f6ba127a825` from run `36896594370`;
- real PBF download/checksum: PASS;
- prior proof on pre-fix SHA `881aceb` also failed the same marketplace query;
- Product Owner manual acceptance: PENDING.

## Blocker

Two blockers remain. The exact-SHA proof still produced zero marketplace entries and `Зеленый базар` returned no result. Separately, Slice Contract requires an Altyn Orda representative query while restricting the dataset to Almaty; the identified `r17596655` marketplace is outside boundary `r2465058`, with no matching Altyn Orda result in the Almaty extraction. This is a genuine contract conflict requiring Product Owner decision before any change to geography or acceptance. Do not weaken criteria, hardcode names or change the approved boundary.

## Next action

1. Stop and request Product Owner decision on the conflict between the Almaty-only boundary and the required Altyn Orda representative query; no product behavior, boundary or Slice Contract edits are authorized before that decision.
2. Do not run branch verification as a passing proof; full `pnpm verify` was skipped after the failed real-data step.
3. Stop before Product Owner manual acceptance.

## Current constraints

- manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks;
- no public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service;
- no other city / Kazakhstan-wide rollout, buyer geocoding или Backoffice без contract decision;
- no KK proofreading/localization pass или отдельный desktop redesign;
- this task changes CI workflow only; do not change product behavior, approved boundary or Slice Contract;
- generated OSM data/dumps не коммитить;
- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/` не включать.
