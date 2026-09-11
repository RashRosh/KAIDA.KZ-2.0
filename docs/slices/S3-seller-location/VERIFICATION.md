# S3 Verification — Seller / first Location

**Slice:** S3 Seller / Location  
**Base:** `c5c3934bb22652321c2882017ee3a6dc61f7089e`  
**Branch:** `slice/s3-seller-location`

## Status

Implementation automated verification has passed on implementation head `3ab0174d7194ef744222490dd35f1e88e9775966`.

A final docs-only commit is intentionally followed by another branch CI run so the branch's final head is itself verified.

Until that final-head CI succeeds:

**NOT READY: automated verification pending**

After final-head CI succeeds:

**NOT READY: manual acceptance pending**

Manual acceptance is not yet recorded in this document.

## GitHub Actions implementation-head evidence

Run:

`34649399309`

Head SHA:

`3ab0174d7194ef744222490dd35f1e88e9775966`

Conclusion:

`SUCCESS`

The workflow's full `pnpm verify` step completed successfully.

## Environment verified in CI

- Node.js `24.19.0`;
- PostgreSQL `18.6`;
- locked dependencies installed from existing lockfile;
- existing Chromium/Playwright setup used;
- no dependency or workflow modification for S3.

## Migration / seed

PASS:

- `drizzle-kit migrate`;
- clean `S0 → S1 → S2 → S3` chain;
- repeated migration;
- deterministic repeated seed;
- seed creates zero Users;
- seed Seller remains ownerless;
- seed Location links to seed Seller and is `pavilion`;
- two canonical Offers remain.

## Unit verification

PASS:

- test files: `10 passed`;
- tests: `105 passed`.

New S3 validation coverage verifies:

- trim/nonblank/max-length rules;
- all approved Location types;
- invalid type rejection;
- strict root object;
- strict nested seller object;
- strict nested location object;
- ownership/Seller-ID spoof fields rejected rather than silently stripped.

## Integration verification

PASS:

- test files: `9 passed`;
- tests: `46 passed`.

S3-specific PASS:

- `s3-migration-upgrade.test.ts`: 2 tests;
- `seller-setup.test.ts`: 4 tests;
- `seller-setup-concurrency.test.ts`: 1 test.

Verified behavior includes:

- correct Seller owner;
- correct Location Seller relation/type;
- `locations: [...]` owned read model;
- cross-user owned lookup isolation;
- seed Seller remains unowned;
- setup does not create Offer;
- repeat setup conflict;
- real DB transaction rollback after forced Location failure;
- direct PostgreSQL FKs/checks/partial unique ownership index;
- concurrent same-User setup produces one success + one conflict and no orphan;
- S2 → S3 migration preserves existing business data;
- ambiguous/unowned legacy Location causes migration failure;
- failed `0003` leaves no partial S3 columns/constraints/indexes and does not advance the migration journal.

Existing S0/S1/S2 integration suites all remained green.

## Build

PASS.

Next.js production build completed successfully and includes:

- `/api/seller/me`;
- `/api/seller/setup`;
- `/seller`.

## E2E verification

PASS:

`22 passed`

Both existing Playwright projects passed:

- mobile;
- desktop.

New Seller setup E2E passed on both projects and verifies:

- anonymous Search before login;
- anonymous `/seller` login-required state;
- existing S2 login flow;
- Seller + first Location creation;
- read-only result;
- persistence after reload;
- `GET /api/seller/me` returns `locations` array;
- repeated setup returns 409;
- Offer count unchanged;
- no horizontal overflow;
- Search still works after setup;
- logout;
- anonymous Search still works after logout.

Existing auth, Search and Offer Lifecycle E2E also passed unchanged.

## Regression boundary

Verified without modifying Search/Offers/Identity implementations:

- S0 anonymous Search: PASS;
- existing `баранина` behavior: PASS;
- existing Search cases: PASS;
- S1 Offer Lifecycle: PASS;
- S2 phone auth/session/persistence/logout: PASS;
- Search before/after authentication: PASS.

## Whitelist check

Implementation diff is confined to the approved S3 whitelist.

Explicitly untouched:

- `0000_s0_first_search.sql`;
- `0001_s1_offer_lifecycle.sql`;
- `0002_s2_auth.sql`;
- Search module;
- Offers module;
- Identity module;
- Catalog module;
- dependencies;
- CI workflow;
- S2 documentation.

## Manual acceptance — PENDING

The approved human acceptance path remains:

1. open KAIDA.KZ anonymously;
2. search `баранина` and see existing result;
3. open `/seller` and see login-required state;
4. login with existing S2 phone flow;
5. open `/seller`;
6. enter Seller display name;
7. enter Location name;
8. select Location type;
9. enter address;
10. submit;
11. confirm read-only Seller + Location;
12. reload and confirm persistence;
13. search `баранина` again;
14. logout;
15. confirm anonymous Search still works.

Manual acceptance must be recorded separately before merge.

## Merge / tag gate

Not performed.

After manual acceptance only:

- compare branch with actual `main` and whitelist;
- merge to `main`;
- wait for actual green merged-main CI;
- only then create annotated `v0.0.4-s3` pointing exactly to the verified merged commit.

No `v0.0.4-s3` tag exists as part of this verification stage.
