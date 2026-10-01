# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`, очередь — в
`docs/product/EXECUTION_PLAN.md`. Перед работой перепроверить git/GitHub: этот файл может устареть.

- Проверено: 2026-10-01.
- `origin/main`: `762e170` (merge PR #70), merged-main CI run `36813870467` green.
- Последний annotated product checkpoint: `v0.0.43-seller-location-geo-fallback` на `762e170`.
- Текущая локальная ветка: `slice/address-directory` от checkpoint `v0.0.43-seller-location-geo-fallback`.

## Current task

Активный implementation stage: 1a, KAIDA address directory для Almaty pilot.

Обязательный preflight завершён:

1. OSM coverage внутри Almaty relation `2465058`: 134,066 объектов с house number, 129,026 также со street
   (96.24%); Зелёный Базар и Алтын Орда присутствуют как marketplace data;
2. source: weekly checksummed Geofabrik Kazakhstan PBF, no OSM/Overpass/Nominatim runtime calls;
3. licence: ODbL attribution/provenance/share-alike are acceptance requirements;
4. hosting proposal: isolated index in current PostgreSQL with `pg_trgm`, no Nominatim/PostGIS/second service;
5. manual address and existing browser/map-link geo flows remain first-class fallbacks.

Approved exact behavior and closed-contract revision are in
`docs/slices/address-directory/SLICE_CONTRACT.md`. Product Owner approved implementation on 2026-10-01 by direct
instruction «Утверждают контракт реализуй». Implementation and automated verification are complete; acceptance is
still pending real Geofabrik data evidence and Product Owner manual verification.

## Implemented approved revision

Current Location identity mutations deliberately do not change geo. A selected server-owned directory entry must
save its address and coordinates atomically. Approved solution: accept only an opaque `addressDirectoryEntryId`,
resolve it server-side and atomically write
`addressText + latitude + longitude`; arbitrary client coordinates remain
rejected. Manual address edit keeps existing geo semantics.

## Fixed near queue after current slice

1. Nearby result-first;
2. Search filters closer/fresher/distance;
3. Search filters cheaper/price range;
4. AI Input;
5. AI moderation;
6. Discovery / `Для вас`;
7. S15A → S15B → S15C;
8. S16 remainder + MVP/Demand readiness;
9. future Commercial/Backoffice readiness-gated slices.

## Next action

Run the importer against the real checksummed Geofabrik Kazakhstan PBF when that endpoint is reachable from the
execution environment, verify the Almaty counts/search sample, then perform Product Owner manual acceptance.
Automated evidence is green: lint, typecheck, build, 317 unit tests, 197 integration tests, the synthetic PBF
end-to-end importer proof, 150/154 full E2E tests with three expected skips and one unrelated timeout that passed on
isolated rerun. Commit/push/PR/merge/tag remain separate direct commands.

## Do not include

- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/`;
- public Nominatim/Overpass runtime dependency, paid geocoder, map SDK, PostGIS or a second runtime service;
- another city, Kazakhstan-wide rollout, buyer geocoding or Backoffice;
- KK proofreading/localization pass or separate desktop redesign.
