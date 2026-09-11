# S3 Implementation Notes — Seller / first Location

**Slice:** S3 Seller / Location  
**Base:** `c5c3934bb22652321c2882017ee3a6dc61f7089e` (`v0.0.3-s2`)  
**Branch:** `slice/s3-seller-location`  
**Feature Spec:** APPROVED  
**Implementation Contract:** APPROVED

## Commit sequence

- `89720fd7db3bda50afe0e8a6b7e6a58c8ab2c66c` — approved Feature Spec + Implementation Contract only.
- `4cfe6b246734722885f5cd9bd174533654af9884` — Seller/Location persistence model and `0003` migration.
- `a625f2c51225c5587cf56f0af157053a04e904d0` — seller setup application/API/UI flow.
- `3ab0174d7194ef744222490dd35f1e88e9775966` — S3 unit/integration/migration/E2E coverage.

## Implemented behavior

S3 implements only:

`authenticated User → owned Seller → first Location`

The existing S2 Identity `resolveCurrentUser` contract is consumed without Identity changes.

`POST /api/seller/setup`:

- requires authenticated User;
- validates root, nested `seller` and nested `location` objects strictly with Zod;
- derives ownership only from authenticated `CurrentUser.id`;
- creates Seller + first Location in one PostgreSQL transaction;
- returns `201` on success;
- returns `409 SELLER_ALREADY_EXISTS` for sequential duplicate and concurrent loser;
- never accepts owner/User/Seller IDs from request body.

`GET /api/seller/me`:

- requires authenticated User;
- returns `{ "seller": null }` when no Seller exists;
- otherwise returns the owned Seller with `locations: [...]`;
- never returns another User's Seller through the owned lookup;
- uses `Cache-Control: no-store`.

The `/seller` UI provides only:

- anonymous login-required state;
- first Seller + first Location setup form;
- read-only result after successful setup/reload.

No edit/delete/dashboard/second-Location functionality was added.

## Database changes

New migration:

`drizzle/migrations/0003_s3_seller_location.sql`

`0000`, `0001`, `0002` were not modified.

Seller changes:

- nullable `owner_user_id` FK → `users.id`;
- partial unique index for non-null owner;
- nonblank/max-length checks for `display_name`.

Location changes:

- required `seller_id` FK → `sellers.id`;
- required `type`;
- allowed types: `market`, `shop`, `pavilion`, `home`, `other`;
- seller index;
- nonblank/max-length checks for name/address.

## Legacy/backfill behavior

`0003` derives each pre-S3 Location Seller only from existing Offers.

- exactly one distinct Seller → backfill succeeds;
- zero or multiple distinct Sellers → migration raises failure;
- no arbitrary Seller inference is performed.

Canonical S0 seed remains:

- Seller `20000000-0000-4000-8000-000000000001`, `owner_user_id = NULL`;
- Location `30000000-0000-4000-8000-000000000001`, linked to that Seller, `type = pavilion`.

Other valid legacy Locations receive `type = other` when no precise type existed before S3.

The migration is executed through the existing Drizzle/PostgreSQL migration runner. The migration upgrade test proves ambiguous/unowned failure rolls back the S3 schema and does not advance the Drizzle journal.

## Transaction/concurrency behavior

Seller + first Location use one DB transaction.

A forced Location constraint failure after Seller insertion proves Seller rollback.

The partial unique owner index is the final concurrency guarantee. A real concurrent PostgreSQL test proves two same-User setup calls yield one success and one `SELLER_ALREADY_EXISTS`, with exactly one Seller and one Location left.

No advisory/distributed locks, queues, Redis or global SERIALIZABLE behavior were added.

## Intentional S3 boundary

After S3 these coexist:

- `Offer.seller_id`
- `Offer.location_id`
- `Location.seller_id`

`offers` was not changed. S3 does not add a constraint enforcing `Offer.seller_id == Location.seller_id`. That invariant for future seller-created Offers remains explicitly deferred to S4.

## Files deliberately not changed

No implementation changes were made to:

- `src/modules/search/**`;
- `src/modules/offers/**`;
- `src/modules/identity/**`;
- `src/modules/catalog/**`;
- existing auth/search/offer-lifecycle routes/tests;
- `.github/workflows/ci.yml`;
- `package.json` / `pnpm-lock.yaml`;
- S2 documentation.

No dependencies were added.

## Automated verification evidence

First full implementation-head GitHub Actions run:

- run: `34649399309`;
- head: `3ab0174d7194ef744222490dd35f1e88e9775966`;
- conclusion: SUCCESS;
- PostgreSQL: 18.6;
- unit: 105 passed;
- integration: 46 passed;
- production build: PASS;
- Playwright: 22 passed across mobile + desktop;
- clean/repeat migrations and seed: PASS;
- S3 migration upgrade + atomic failure rollback: PASS;
- S0/S1/S2 regression: PASS.

A final docs-only commit containing these notes and `VERIFICATION.md` is followed by a fresh branch CI run. Manual acceptance remains a separate gate.

## Current readiness rule

Before final branch-head CI is green:

`NOT READY: automated verification pending`

After final branch-head CI is green, until separate manual acceptance:

`NOT READY: manual acceptance pending`

No merge or S3 tag is allowed before that manual acceptance.
