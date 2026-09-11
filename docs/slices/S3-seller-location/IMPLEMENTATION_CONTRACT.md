# S3 Implementation Contract — Seller / first Location

**Status:** APPROVED  
**Feature Spec:** APPROVED  
**Base checkpoint:** `v0.0.3-s2` / `c5c3934bb22652321c2882017ee3a6dc61f7089e`  
**Planned branch:** `slice/s3-seller-location`  
**Planned checkpoint tag after full verification:** `v0.0.4-s3`

## 1. Objective and hard boundary

Implement exactly:

`authenticated User → owned Seller → first Location`

No Offer create/edit, Seller Change Set, Seller Input, Geo, Discovery, seller dashboard or multi-location management.

## 2. Resulting database model

### sellers

- `id UUID PK`
- `display_name TEXT NOT NULL`
- `owner_user_id UUID NULL`

`owner_user_id`:

- FK → `users.id`;
- nullable only for existing/system fixture Sellers;
- always non-null for new Sellers created by S3;
- never accepted from client;
- resolved from `CurrentUser.id`.

Required PostgreSQL constraints/indexes:

- existing PK on `id`;
- FK `sellers_owner_user_id_users_id_fk` → `users.id`, `ON DELETE NO ACTION`, `ON UPDATE NO ACTION`;
- partial unique B-tree index `sellers_owner_user_id_owned_unique` on `owner_user_id WHERE owner_user_id IS NOT NULL`;
- CHECK `sellers_display_name_not_blank`: `char_length(btrim(display_name)) >= 1`;
- CHECK `sellers_display_name_max_length`: `char_length(btrim(display_name)) <= 120`.

One owned Seller per User is an S3 invariant, not a permanent product invariant.

### locations

- `id UUID PK`
- `seller_id UUID NOT NULL`
- `name TEXT NOT NULL`
- `address_text TEXT NOT NULL`
- `type TEXT NOT NULL`

Allowed `type` values:

- `market`
- `shop`
- `pavilion`
- `home`
- `other`

Use TEXT + CHECK, not PostgreSQL enum.

Required PostgreSQL constraints/indexes:

- FK `locations_seller_id_sellers_id_fk` → `sellers.id`, `ON DELETE NO ACTION`, `ON UPDATE NO ACTION`;
- non-unique B-tree index `locations_seller_id_idx`;
- CHECK `locations_name_not_blank`: `char_length(btrim(name)) >= 1`;
- CHECK `locations_name_max_length`: `char_length(btrim(name)) <= 120`;
- CHECK `locations_address_text_not_blank`: `char_length(btrim(address_text)) >= 1`;
- CHECK `locations_address_text_max_length`: `char_length(btrim(address_text)) <= 500`;
- CHECK `locations_type_allowed`: `type IN ('market','shop','pavilion','home','other')`.

No default for `seller_id` or `type`.

## 3. Migration file and immutability

Create exactly one new migration:

`drizzle/migrations/0003_s3_seller_location.sql`

Do not modify:

- `0000_s0_first_search.sql`
- `0001_s1_offer_lifecycle.sql`
- `0002_s2_auth.sql`

The migration must support:

- clean chain `0000 → 0001 → 0002 → 0003`;
- real S2 database upgraded by applying `0003` only.

## 4. Atomic migration requirement

`0003` must execute atomically under the transaction semantics of the existing Drizzle/PostgreSQL migration runner.

No custom migration framework or custom migration runner may be added.

Required behavior:

- all schema additions, legacy validation, backfill and final constraints for `0003` belong to the same migration transaction;
- if legacy ownership validation raises failure, all effects of `0003` roll back;
- no half-applied `owner_user_id`, `seller_id`, `type`, constraints or indexes may remain;
- Drizzle migration journal must not record `0003` as successfully applied after rollback;
- the ambiguous-legacy upgrade integration test must verify both the expected failure and absence of partial S3 state after failure.

## 5. S2 → S3 migration sequence

### Step A — Seller ownership

Add `sellers.owner_user_id UUID NULL`.

Do not backfill legacy Seller ownership to any User. Every pre-S3 Seller remains `owner_user_id = NULL` unless created later through S3 application flow.

Add the User FK and partial unique ownership index.

### Step B — temporary nullable Location columns

Add temporarily nullable during migration:

- `locations.seller_id UUID NULL`
- `locations.type TEXT NULL`

Do not make them NOT NULL before legacy backfill/validation completes.

### Step C — legacy Location ownership derivation

For each pre-S3 Location derive candidate Seller only from existing Offers:

`offers.location_id → DISTINCT offers.seller_id`

Rules:

- exactly one distinct Seller → use it;
- zero Sellers → migration failure;
- more than one distinct Seller → migration failure;
- never choose first/lowest/arbitrary Seller;
- never infer from names or addresses.

### Step D — type backfill

Canonical S0 seed Location gets `type = 'pavilion'`.

Other valid legacy Locations whose exact type is unknown get `type = 'other'`.

### Step E — final constraints

After successful validation/backfill:

- add Location FK/index/checks;
- make `locations.seller_id NOT NULL`;
- make `locations.type NOT NULL`;
- add Seller validation checks.

All above remains within atomic `0003`.

## 6. Canonical seed backfill

Canonical Seller:

`20000000-0000-4000-8000-000000000001`

must remain:

`owner_user_id = NULL`

Canonical Location:

`30000000-0000-4000-8000-000000000001`

must become:

- `seller_id = 20000000-0000-4000-8000-000000000001`
- `type = 'pavilion'`

Existing Product/Seller/Location/Offer IDs and existing Search projection must not change.

`src/db/seed.ts` must explicitly preserve these values and remain deterministic/idempotent. Repeated seed creates no User/session/OTP/additional Seller/additional Location/additional Offer.

## 7. Intentional temporary Offer/Location redundancy

After S3:

- `Offer.seller_id`
- `Offer.location_id`
- `Location.seller_id`

coexist intentionally.

Do not modify `offers` schema, repository or lifecycle.

Do not add Offer trigger/check/constraint for `Offer.seller_id == Location.seller_id` in S3.

Existing S0 fixture must remain factually consistent after Location backfill. Enforcement for future seller-created Offers belongs to S4.

## 8. Validation contract

Use existing Zod dependency only. No generic validation framework.

Normalize strings with `.trim()` before persistence.

Limits:

- Seller `displayName`: 1..120 after trim;
- Location `name`: 1..120 after trim;
- Location `addressText`: 1..500 after trim;
- Location `type`: exact approved code.

Whitespace-only values are invalid.

### Strictness on every POST body level

`POST /api/seller/setup` schemas must be strict at all three object levels:

1. root object;
2. nested `seller` object;
3. nested `location` object.

Unknown fields at any level cause `400 INVALID_SELLER_SETUP`; they must not be stripped and ignored.

This includes attempts such as:

- `ownerUserId`
- `owner_user_id`
- `userId`
- `user_id`
- `sellerId`
- `seller_id`
- arbitrary unknown root/seller/location fields.

Example containing `seller.ownerUserId` must return 400.

## 9. Identity integration

Consume existing:

`resolveCurrentUser(sessionToken) → CurrentUser | null`

Each seller API request:

1. reads existing `SESSION_COOKIE_NAME` cookie;
2. calls existing `resolveCurrentUser`;
3. uses only returned `CurrentUser.id` for ownership.

Behavior:

- no current User → `401 AUTH_REQUIRED`;
- Identity resolution error → `503 AUTH_UNAVAILABLE`.

Do not modify Identity files, auth sessions, cookie semantics, JWT/global middleware/roles.

## 10. Module boundaries

### Identity

Owns User, OTP, session and `resolveCurrentUser`. S3 only consumes it.

### Sellers

Owns:

- Seller DB model;
- `owner_user_id`;
- S3 owned-Seller uniqueness behavior;
- find Seller by owner;
- create Seller;
- setup use-case orchestration.

Seller setup application service may coordinate one transaction but must not duplicate Location persistence logic.

### Locations

Owns:

- Location DB model;
- Location type;
- Location validation contract/type;
- create Location for Seller;
- list Locations by Seller.

Location repository must be able to use the same transaction supplied by Seller setup.

### App/API layer

Composes session → `resolveCurrentUser` → Sellers application use-case → HTTP response. Ownership logic must not exist only in React.

## 11. Setup transaction semantics

`POST /api/seller/setup` is one DB transaction:

```text
BEGIN
  INSERT Seller(owner_user_id = CurrentUser.id)
  INSERT first Location(seller_id = inserted Seller.id)
COMMIT
```

Both writes use the exact same transaction.

If Location insert fails, Seller insert rolls back. If Seller insert fails, no Location is inserted.

No two-request create flow.

## 12. Sequential and concurrent duplicate semantics

If User already owns Seller:

`POST /api/seller/setup → 409 SELLER_ALREADY_EXISTS`

Do not return existing Seller as success, overwrite it or ignore new input.

For two concurrent valid setup requests from same User:

- exactly at most one transaction succeeds;
- the other maps the specific ownership unique violation to `409 SELLER_ALREADY_EXISTS`;
- final owned Seller count = 1;
- Location count for that Seller = 1;
- no orphan rows.

Use normal PostgreSQL transaction semantics + partial unique index. Do not add advisory locks, Redis/distributed locks, global SERIALIZABLE or queues.

Only the specific owned-Seller unique violation maps to `SELLER_ALREADY_EXISTS`; unrelated DB errors must not be mislabeled.

## 13. HTTP contracts

### GET `/api/seller/me`

Authentication required. `Cache-Control: no-store`.

No owned Seller:

```json
{ "seller": null }
```

Owned Seller:

```json
{
  "seller": {
    "id": "uuid",
    "displayName": "Seller name",
    "locations": [
      {
        "id": "uuid",
        "name": "Location name",
        "addressText": "Address",
        "type": "market"
      }
    ]
  }
}
```

`locations` is always an array. Do not expose singular `location`. S3 normally produces one Location but does not define API cardinality as singular.

Do not expose `ownerUserId` in response.

### POST `/api/seller/setup`

Request:

```json
{
  "seller": { "displayName": "Асыл Ет" },
  "location": {
    "name": "Точка на рынке",
    "type": "pavilion",
    "addressText": "Алматы, ..."
  }
}
```

No IDs accepted from client.

Success: `201 Created` with the same Seller shape as GET, including `locations: [createdLocation]`.

### Errors

Common shape:

```json
{ "error": { "code": "CODE", "message": "Human-readable message" } }
```

- `400 INVALID_SELLER_SETUP` — `Проверьте данные продавца и точки.`
- `401 AUTH_REQUIRED` — `Войдите, чтобы настроить продавца.`
- `409 SELLER_ALREADY_EXISTS` — `У этого пользователя уже есть продавец.`
- `503 AUTH_UNAVAILABLE` — `Не удалось проверить вход.`
- `503 SELLER_UNAVAILABLE` — `Не удалось загрузить или сохранить данные продавца.`

Do not expose raw PostgreSQL errors/constraint names.

## 14. UI contract

Create route `/seller` only.

Anonymous:

- login-required state;
- link to existing `/login`;
- no duplicate login implementation.

Authenticated without Seller:

- Seller display name;
- Location name;
- Location type select;
- Location address;
- submit.

Authenticated with Seller:

- read-only Seller display name;
- read-only first Location name/type/address.

No edit/delete/dashboard/second Location/Offer UI.

If POST returns 409, show conflict/reload guidance; do not fake success.

## 15. Exact file whitelist

### Documentation

New:

- `docs/slices/S3-seller-location/FEATURE_SPEC.md`
- `docs/slices/S3-seller-location/IMPLEMENTATION_CONTRACT.md`
- `docs/slices/S3-seller-location/IMPLEMENTATION_NOTES.md`
- `docs/slices/S3-seller-location/VERIFICATION.md`

### Migration

New:

- `drizzle/migrations/0003_s3_seller_location.sql`
- `drizzle/migrations/meta/0003_snapshot.json`

Modify:

- `drizzle/migrations/meta/_journal.json`

No earlier migration or snapshot changes.

### Existing DB model

Modify only:

- `src/modules/sellers/db/sellers.table.ts`
- `src/modules/locations/db/locations.table.ts`
- `src/db/seed.ts`

`src/db/schema.ts` should require no change. If it does, stop for scope approval.

### Sellers module

New:

- `src/modules/sellers/contracts/seller.contract.ts`
- `src/modules/sellers/application/setup-seller.ts`
- `src/modules/sellers/application/get-owned-seller.ts`
- `src/modules/sellers/infrastructure/sellers.repository.ts`

### Locations module

New:

- `src/modules/locations/contracts/location.contract.ts`
- `src/modules/locations/infrastructure/locations.repository.ts`

### API

New:

- `src/app/api/seller/me/route.ts`
- `src/app/api/seller/setup/route.ts`

### UI

New:

- `src/app/seller/page.tsx`
- `src/app/seller/page.module.css`
- `src/app/seller/_components/SellerSetup.tsx`

### Test infrastructure

Modify:

- `tests/integration/prepare-database.ts`

### Tests

New:

- `tests/unit/seller-setup-validation.test.ts`
- `tests/integration/seller-setup.test.ts`
- `tests/integration/seller-setup-concurrency.test.ts`
- `tests/integration/s3-migration-upgrade.test.ts`
- `tests/e2e/seller-setup.spec.ts`

## 16. Forbidden changes without new approval

Do not modify:

- `drizzle/migrations/0000_s0_first_search.sql`
- `drizzle/migrations/0001_s1_offer_lifecycle.sql`
- `drizzle/migrations/0002_s2_auth.sql`
- anything under `src/modules/offers/`
- anything under `src/modules/search/`
- anything under `src/modules/identity/`
- anything under `src/modules/catalog/`
- `src/app/api/search/route.ts`
- `src/app/api/auth/**`
- `src/app/login/**`
- existing S0/S1/S2 E2E/integration tests except `tests/integration/prepare-database.ts`
- `.github/workflows/ci.yml`
- `package.json`
- `pnpm-lock.yaml`
- `playwright.config.ts`
- S2 documentation.

No dependency additions.

If implementation genuinely requires a file outside whitelist or neighboring public contract change, stop and report reason before changing it.

## 17. Unit test matrix

Validation tests must cover:

- Seller name valid/trim/blank/whitespace/120/121;
- Location name valid/trim/blank/whitespace/120/121;
- address valid/trim/blank/whitespace/500/501;
- each allowed type and invalid type;
- strict unknown-field rejection at root, seller and location levels;
- ownership spoofing examples rejected.

## 18. Integration matrix

Seller setup integration tests must prove:

- authenticated User creates Seller with correct `owner_user_id`;
- first Location created with correct `seller_id` and type;
- trimmed data stored;
- GET-owned result has `locations: [...]`;
- no-Seller User returns no Seller;
- User B cannot read User A seller data through owned path;
- seed Seller is not returned as owned Seller;
- repeat setup produces conflict;
- Seller and Location counts stay 1;
- setup inserts no Offer.

### Real transaction rollback test

Force Location step to fail after Seller insert within a real PostgreSQL transaction. Verify after rollback:

- owned Seller count = 0;
- attempted Location count = 0.

No mock-only substitute.

### Concurrency test

Run two setup operations concurrently for same User with distinguishable valid input. Required:

- one success;
- one `SELLER_ALREADY_EXISTS` conflict;
- final owned Seller count = 1;
- final Location count for Seller = 1;
- no orphan rows.

### Direct DB constraints

Verify PostgreSQL rejects:

- nonexistent User owner FK;
- second non-null Seller for same owner;
- nonexistent Seller Location FK;
- blank/overlong Seller name;
- blank/overlong Location name;
- blank/overlong address;
- invalid Location type.

Verify multiple NULL-owner Sellers remain legal.

## 19. S3 migration upgrade test

Create dedicated PostgreSQL 18 upgrade DB using existing S1/S2 safety pattern.

Sequence:

`apply 0000 → 0001 → 0002 → insert pre-S3 data → snapshot → apply 0003 → verify`

Must verify:

- Product/Seller/Location/Offer/User data preservation;
- Offer row fields unchanged;
- seed Seller remains NULL-owner;
- canonical seed Location points to canonical seed Seller and is `pavilion`;
- unambiguous legacy Location ownership derives from Offer;
- unknown legacy type becomes `other`;
- new constraints/indexes function;
- Offers schema is unchanged.

### Ambiguous/unowned legacy failure case

Create a pre-S3 state where a Location has zero or multiple distinct Seller candidates.

Applying `0003` must fail.

After failure, test must additionally verify atomic rollback:

- S3 columns/constraints/indexes are not left partially applied;
- pre-S3 table/data state remains usable as S2 state;
- migration journal does not report `0003` as successfully applied.

Do not use a custom migration runner to achieve this; test existing Drizzle/PostgreSQL migration transaction behavior.

## 20. Clean migration and seed verification

Update `tests/integration/prepare-database.ts` to verify:

`clean PostgreSQL 18 → migrate 0000..0003 → migrate again → seed → seed again`

Required:

- expected table set unchanged except schema columns;
- zero Users from seed;
- canonical Seller owner NULL;
- canonical Location linked to Seller/type `pavilion`;
- two canonical Offers remain;
- repeat migration/seed deterministic.

## 21. E2E matrix

New `tests/e2e/seller-setup.spec.ts` runs in existing mobile and desktop projects.

Primary scenario:

`anonymous → /seller login required → existing S2 login → /seller setup → submit → read-only Seller+Location → reload → same data`

Also verify:

- setup creates no Offer;
- mobile has no horizontal overflow;
- second ordinary setup POST receives 409.

Browser racing is not required; concurrency belongs to PostgreSQL integration test.

## 22. Regression S0/S1/S2

All existing tests remain unchanged and pass.

Mandatory regressions:

- anonymous Search;
- `баранина`;
- `говядина`;
- existing Search API/projection;
- S1 lifecycle active/inactive/freshness/config;
- S2 OTP request/verify/session/persistence/logout/auth concurrency;
- Search before login, after login, after logout.

Do not weaken old tests.

Search implementation must not change. New `Location.seller_id` must not change Search result content.

S3 setup must not insert/update/deactivate/confirm Offers or alter Offer timestamps.

## 23. Manual acceptance

One short path:

1. anonymous Search `баранина` works;
2. `/seller` requires login;
3. login via existing S2 phone flow;
4. enter Seller display name;
5. enter Location name;
6. choose type;
7. enter address;
8. submit;
9. read-only Seller + Location shown;
10. reload preserves same data;
11. Search `баранина` still works;
12. logout;
13. anonymous Search still works.

Concurrency, migration failure, rollback/FKs and cross-user DB isolation remain automated responsibilities.

## 24. Verification cycle

Before manual acceptance run the existing complete gate:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm db:test:prepare`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm verify`

Then push branch and obtain actual GitHub Actions result.

Status rules:

- until actual green branch GitHub Actions: `NOT READY: automated verification pending`;
- after green branch CI and before manual acceptance: `NOT READY: manual acceptance pending`.

Local PASS is not a substitute for CI.

## 25. Merge/tag protocol

After separate manual acceptance only:

1. confirm branch still based on expected main without unexpected divergence;
2. compare diff to whitelist;
3. merge S3 to `main`;
4. do not tag immediately;
5. wait for actual green CI on merged `main`;
6. only then create annotated `v0.0.4-s3` pointing exactly to verified merged commit;
7. if tag-triggered CI exists, it must also be green before checkpoint finalization.

## 26. Definition of Done

S3 is READY only when all are true:

- Feature Spec APPROVED;
- Implementation Contract APPROVED;
- implementation stays inside whitelist;
- `0003` only, earlier migrations untouched;
- atomic `0003` rollback semantics verified;
- clean migration chain PASS;
- S2→S3 upgrade PASS;
- ambiguous/unowned legacy failure and no-partial-state PASS;
- seed backfill PASS;
- Seller ownership FK/partial unique invariant PASS;
- Location seller/type invariants PASS;
- strict Zod validation at root/seller/location PASS;
- atomic Seller+Location transaction PASS;
- transaction rollback PASS;
- sequential duplicate → 409 PASS;
- concurrent setup → one success + one conflict PASS;
- cross-user isolation PASS;
- GET returns `locations[]` PASS;
- Offer count/schema/behavior unchanged PASS;
- Search/Offer Lifecycle/Identity regression PASS;
- unit/integration/build/E2E mobile+desktop PASS;
- `pnpm verify` PASS;
- branch GitHub Actions PASS;
- manual acceptance PASS;
- merge to main;
- merged-main CI PASS;
- annotated `v0.0.4-s3` created only after merged-main green CI and points exactly to that commit.

Until all applicable gates pass, S3 must not be described as complete.
