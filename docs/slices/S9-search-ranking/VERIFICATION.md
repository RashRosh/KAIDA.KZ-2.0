# S9 Verification

## Slice identity

**S9 — deterministic distance / freshness sorting**

## Base checkpoint

- Verified checkpoint: `v0.0.9-s8`
- Base / `main` SHA: `23bda8d0c2ae83235ffe75257dd256227b070bc3`

## Approved contract and implementation commits

- Approved S9 contract commit: `4d0079528a4de6439a2fb076144979a848997e7c`
- Test-first commit: `7a616142f5866d1a73e88a61f7eb4008bd284631`
- Initial implementation commit / head used for first CI: `2c2900eb061c499ddfa2576574f49b34112cee63`

## Authorized legacy test / harness repairs

### S8 migration harness repair

Commit: `213a18d6eb32aea2d2e892ccf05e8975759e96f2`

Reason: current S9 Search legitimately depends on the S8 `Location.geo` schema and must not be required to run against the deliberate pre-S8 schema state `0000–0006`.

### S2 migration teardown repair

Commit: `118fa3cab99e7a3909cd1f9eec964e2870cc6d3a`

Reason: deterministic PostgreSQL pool shutdown before temporary database `DROP`; fixes the unhandled `57P01` cleanup race.

Both changes were **TEST / HARNESS repairs only** and introduced no production behavior changes.

## Final automated verification

- GitHub Actions run: `34774342366`
- Exact CI SHA: `118fa3cab99e7a3909cd1f9eec964e2870cc6d3a`
- Attempt: `1`
- Result: **SUCCESS**
- PostgreSQL: `18.6 (Debian 18.6-1.pgdg13+2)`

Verified results:

- locked install: PASS
- lint: PASS
- typecheck: PASS
- migrations: PASS
- seed: PASS
- test DB prepare: PASS
- unit: `222 / 222` PASS
- S9 unit: `38 / 38` PASS
- integration: `108 / 108` PASS
- S2 migration upgrade: PASS
- S8 migration upgrade: PASS
- S9 integration: `8 / 8` PASS
- unhandled errors: `0`
- build: PASS
- E2E: `44 / 44` PASS
- S9 E2E: `8 / 8` PASS
- full `pnpm verify`: PASS

## Contract proofs

- Existing `searchOffers(...)` source call forms remain compatible: PASS
- One shared Search application flow: PASS
- GET backward compatibility: PASS
- Strict POST Buyer-location validation: PASS
- GET / POST public privacy; no raw geo or ranking metadata is exposed: PASS
- S6 canonical / alias equivalence: PASS
- S1 inactive / expired exclusion occurs before ranking: PASS
- Deterministic repeated ordering: PASS
- Geoless Offers remain searchable: PASS
- Buyer geo affects ordering only and never eligibility / filtering: PASS
- Buyer location is transient and not persisted: PASS

## Manual acceptance

**MANUAL ACCEPTANCE: PASS**

- Exact application SHA tested: `118fa3cab99e7a3909cd1f9eec964e2870cc6d3a`
- HTTPS preview: `https://kaida2-s9-manual.onrender.com`
- Test product: `S9 ручная проверка`

Visible proof:

Without Buyer location:

`S9 без геолокации → S9 далеко → S9 рядом`

Enabling Buyer location did **not** automatically reorder the existing results.

Next explicit Search with Buyer location:

`S9 рядом → S9 далеко → S9 без геолокации`

Disabling Buyer location did **not** automatically reorder the existing results.

The next explicit Search without Buyer location returned the no-location ordering:

`S9 без геолокации → S9 далеко → S9 рядом`

After enabling Buyer location and reloading the page, Buyer location state reset and was not persisted.

## Scope integrity

The final S9 branch changes are limited to:

- approved S9 documentation;
- approved S9 production files;
- approved S9 test files;
- separately authorized S8 migration harness repair;
- separately authorized S2 migration harness repair.

No historical migration, schema, seed, dependency, lockfile, workflow, or Playwright configuration changes occurred.

## Known non-blocking notices

The final automated verification emitted only non-blocking tooling notices:

- Next.js build cache notice;
- GitHub Actions Node runtime deprecation notices;
- tooling `punycode` / `url.parse()` deprecation notices.

None affected verification or S9 acceptance.
