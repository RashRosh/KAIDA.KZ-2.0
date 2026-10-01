# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`; текущей очередью владеет только `docs/product/EXECUTION_PLAN.md`. Перед работой всегда перепроверить git/GitHub: этот файл намеренно хранит только текущее состояние и может устареть.

## Verified base

- Проверено: 2026-10-01.
- `origin/main`: `a5df3a7` (merge PR #71), merged-main CI run `36847545091` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Активная product branch: `slice/address-directory`; PR #72 открыт.
- Product implementation head до maintenance merge: `8316991`.
- Maintenance merge head: `fa4e2af`; `KAIDA verify` run `36850756559` green.
- Текущий branch head: `2162a60` (`slice/address-directory` = `origin/slice/address-directory`); blocker/handoff-only commits follow product-code SHA `71faf9d`.
- PR #72 **не готов к merge** до закрытия real-data blocker и Product Owner manual acceptance.

## Current task

Stage 1a, KAIDA address directory для Almaty pilot. PO подтвердил Almaty-only boundary `r2465058` and replacement of only the invalid real-data example with `Рынок Барыс`; `Зеленый базар` remains required. Root-only boundary selection, targeted real-data proof and same-checksum no-op now pass in a disposable local PostgreSQL database. Next gate is full branch verification; stop before Product Owner manual acceptance.

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
- Blocker handoff is at `2162a60`; full branch verification on this docs-only head passed in PR run `36897496111` and push run `36897489846`.
- Product Owner decision (2026-10-01): retain the exact Almaty boundary; replace the invalid Altyn Orda real-data example only; keep Green Bazaar required for real-data and manual acceptance.
- Existing real-data extract identifies `Рынок Барыс` (OSM way `216728654`, `amenity=marketplace`); representative point `[76.88979141052631, 43.258162726315796]` is covered by the saved `r2465058` polygon.
- Diagnosis: recursive boundary extraction includes nine `subarea` relations; exporting it yields ten polygon features. The workflow previously used a multi-feature collection while Osmium takes only its first feature, and the importer passed the overlapping relation bundle as a polygon.
- Local root-only extraction test retained only exported relation `2465058`; resulting 12,659,819-byte extract contains both Green Bazaar relation `r20040804` and Barys way `216728654`.
- Local targeted import on the checksummed `kazakhstan-260929.osm.pbf` into disposable PostgreSQL 18 completed with `activated:true`: 132,113 entries (128,955 addresses, 2,940 streets, 63 marketplaces, 155 retail). The working dev DB on port 5432 was not used.
- Import status is `active`; the exact-SHA import completed. Latest read-only `pg_stat_activity` inspection showed no active importer query; disposable proof DB remains on `127.0.0.1:55432` for continuation.
- Importer and existing proof workflow now export IDs and select only relation `2465058`; contract/proof example uses `Рынок Барыс`; static YAML/criteria checks and TypeScript diagnostics pass.
- Repository-backed query proof PASS: house `улица Кабдолова, 14А`; street prefix `10-ый п` and typo `10-й проезд`; Green Bazaar `osm:r20040804` → `Зелёный Базар`; Barys `osm:w216728654` → `Рынок Барыс`.
- Measured 4-run app-query latency ranges: house 787.540–1,158.787 ms; street prefix 24.100–26.582 ms; street typo 13.411–14.817 ms; Green Bazaar 7.999–9.426 ms; Barys 6.944–7.703 ms.
- Same-checksum retry using all 132,113 stored rows returned `activated:false` with the same import ID and active counts unchanged.

## Verification

- full regression (`pnpm verify`) and branch CI `36857093256` on `71faf9d`: PASS;
- push CI `36857088758` on `71faf9d`: PASS;
- full branch verification on docs-only blocker handoff `2162a60`: PASS (`36897496111`, `36897489846`); this does not override the failed real-data acceptance proof;
- manual workflow YAML parse / pinned-checkout assertions: PASS; run `36896594370` checkout guard passed for exact SHA `71faf9d2d81f8f28e146699750c64f6ba127a825`;
- real source: Geofabrik `kazakhstan-260929.osm.pbf`, published MD5 `eb97ae46ad3a65672fd48bd885763dab`, SHA-256 `0020c7643397915c195e897d759eec3fe19dd602a4f44b7da48039144d34716c`, timestamp `2026-09-29T23:52:32Z`, 223,792,807 bytes; boundary `r2465058` and candidate extraction: PASS;
- replacement candidate `Рынок Барыс` (`way 216728654`) is an existing named marketplace feature inside `r2465058`: PASS;
- confirmed exact boundary export contains one relation feature with `@id=2465058` plus nine subarea features; importing must filter by both relation type and ID before polygon extraction;
- isolated root-only geometry extract includes both required marketplace objects: PASS; imported result generation uses only the contracted relation geometry;
- importer TypeScript diagnostics: PASS; proof YAML parse and exact-boundary/market-query assertions: PASS;
- root-only local real-data import: PASS; active snapshot contains 63 marketplaces and 132,113 total entries;
- repository-backed representative house/street/typo, Green Bazaar and Barys queries: PASS;
- measured 4-run app-query latency ranges: house 787.540–1,158.787 ms; street prefix 24.100–26.582 ms; street typo 13.411–14.817 ms; Green Bazaar 7.999–9.426 ms; Barys 6.944–7.703 ms;
- DB size: table 33 MB, indexes 24 MB, trigram index 11 MB, total 57 MB;
- Green Bazaar EXPLAIN uses `address_directory_entries_search_trgm_idx`: PASS, 3.704 ms execution, 142 shared buffer hits;
- same-checksum retry with all exact snapshot entries: `activated:false`, same import ID, active status/counts unchanged: PASS;
- import wall-clock/peak memory not captured locally; existing remote real-data workflow captures those with `/usr/bin/time -v`;
- local `pnpm verify`: FAIL at global ESLint with 2,376 errors and 8,127 warnings; typecheck, database tests, unit, integration, build and E2E stages did not run;
- focused ESLint for `src/cli/import-address-directory.ts`: PASS; full clean-checkout branch verification: PENDING;
- read-only OSM diagnosis artifacts from runs `36855912179` / `36856552657`: Green Bazaar probe inside Almaty: true; Altyn Orda representative point inside: false; both artifacts uploaded successfully;
- real candidates: raw 6,361; accepted 6,160; rejected 201; deduplicated 3,072 (3,011 address, 60 street, zero marketplace, one retail);
- pinned importer: activated 3,533 (3,147 addresses, 385 streets, zero marketplaces, one retail); same-checksum retry was an idempotent no-op;
- DB size: table 888 kB, all indexes 2,696 kB, trigram index 2,264 kB, total 3,624 kB;
- representative query step failed: `Зеленый базар` returned no result; `Алтын Орда`, latency and EXPLAIN were not reached. The workflow's subsequent `pnpm verify` was skipped, although branch `pnpm verify` independently passed later on docs-only head `2162a60`. Evidence artifact: `address-directory-real-proof-71faf9d2d81f8f28e146699750c64f6ba127a825` from run `36896594370`;
- real PBF download/checksum: PASS;
- prior proof on pre-fix SHA `881aceb` also failed the same marketplace query;
- Product Owner manual acceptance: PENDING.

## Blocker
Targeted proof override (2026-10-02): root-only import, Green Bazaar and Barys queries, representative house/street/typo searches, measured latency, trigram EXPLAIN, and same-checksum no-op all passed in the disposable local database. The preceding paragraph describes only the older pre-fix failure and is superseded for current status.

The earlier exact-SHA proof produced zero marketplace entries and `Зеленый базар` returned no result. Root cause is resolved in the local importer/proof edits by filtering the exported boundary to relation `2465058`; the local import now has 63 marketplace entries. Search-level acceptance is unverified because the terminal channel is replaying buffered commands and no clean database execution channel is currently available. Do not commit/push or claim the targeted proof green until query, latency, EXPLAIN and idempotency evidence is collected. Keep boundary `r2465058` and all marketplace acceptance.

## Next action

1. Commit/push only the four authorized files now that targeted real-data proof is green; keep all local generated folders unstaged.
2. Run clean-checkout branch verification and the existing exact-SHA real-data workflow; resolve any changed-source failures without changing boundary or acceptance.
3. Stop before Product Owner manual acceptance.

## Current constraints

- manual address entry и закрытые browser/map-link geo flows остаются first-class fallbacks;
- no public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS или второй runtime service;
- no other city / Kazakhstan-wide rollout, buyer geocoding или Backoffice без contract decision;
- no KK proofreading/localization pass или отдельный desktop redesign;
- keep Almaty boundary `r2465058`; do not expand geography, add runtime services or weaken marketplace acceptance;
- only correct the invalid real-data example and fix the Green Bazaar import defect under the PO decision;
- generated OSM data/dumps не коммитить;
- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/` не включать.
