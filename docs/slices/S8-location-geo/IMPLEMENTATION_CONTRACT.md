# S8 Implementation Contract — Location Geo

**Status:** CONTRACT STAGE; IMPLEMENTATION BLOCKED  
**Feature Spec:** S8 DESIGN APPROVED  
**Base checkpoint:** `v0.0.8-s7`  
**Base main:** `2ee23d35575d88c192d14e0ebfa57d542c7d0bbd`  
**Branch:** `slice/s8-location-geo`  
**Planned checkpoint after full DoD:** `v0.0.9-s8`

## 1. Objective and hard boundary

Implement exactly:

```text
owned Location
→ explicit Seller browser geolocation action
→ validated complete geographic point
→ owner-scoped atomic Location update
→ persisted owner-side geo
```

Geo belongs to `Location` only.

Do not add coordinates to `Seller` or `Offer`.

Do not implement Buyer geo, distance/ranking, Nearby, PostGIS, maps or geocoding.

## 2. Existing contracts preserved

S8 consumes existing boundaries unchanged:

- Identity owns `resolveCurrentUser` and session cookie semantics;
- Sellers owns `Current User → owned Seller` lookup;
- Locations owns Location persistence;
- Offer keeps existing `location_id` foreign key;
- Search keeps its existing public Location projection;
- Seller ChangeSet keeps its existing Location DTO.

The canonical relation remains:

```text
Offer.location_id
→ Location.id
→ Location.geo
```

## 3. Resulting Location model

Modify the existing `locations` table by adding:

```text
latitude  DOUBLE PRECISION NULL
longitude DOUBLE PRECISION NULL
```

No default values.

No coordinate backfill.

Conceptual owner-side view:

```ts
type LocationGeo = {
  latitude: number;
  longitude: number;
};

type LocationView = {
  id: string;
  name: string;
  addressText: string;
  type: LocationType;
  geo: LocationGeo | null;
};
```

Storage remains nullable for legacy and newly setup Locations.

### 3.1 Canonical valid states

Only these states are legal:

```text
latitude IS NULL AND longitude IS NULL
```

or:

```text
latitude IS NOT NULL AND longitude IS NOT NULL
```

Half-point is forbidden.

For non-null coordinates:

```text
-90  <= latitude  <= 90
-180 <= longitude <= 180
```

No application-level rounding is introduced. PostgreSQL `DOUBLE PRECISION` stores the browser numeric values supplied after validation.

S8 does not persist accuracy, altitude, heading, speed or any geolocation metadata.

## 4. Canonical geo validation contract

All S8 request validation for a geographic point belongs to the Locations contract, preferably in:

`src/modules/locations/contracts/location.contract.ts`

Define one strict request schema equivalent to:

```ts
{
  latitude: finite number in [-90, 90],
  longitude: finite number in [-180, 180]
}
```

Required rules:

- root object is strict;
- both fields are mandatory;
- values must be JSON numbers;
- strings are rejected;
- null is rejected;
- missing latitude is rejected;
- missing longitude is rejected;
- `NaN`, `Infinity` and `-Infinity` are rejected by the canonical application schema if values ever reach it programmatically;
- unknown fields are rejected.

Request body remains exactly:

```json
{
  "latitude": 43.238949,
  "longitude": 76.889709
}
```

Do not introduce a generic validation framework.

## 5. Database defense in depth

Migration `0007` must add named PostgreSQL CHECK constraints that independently enforce:

### Pair consistency

```sql
(
  latitude IS NULL AND longitude IS NULL
)
OR
(
  latitude IS NOT NULL AND longitude IS NOT NULL
)
```

### Latitude range

For a non-null latitude:

```sql
latitude BETWEEN -90 AND 90
```

### Longitude range

For a non-null longitude:

```sql
longitude BETWEEN -180 AND 180
```

PostgreSQL 18 `double precision` accepts IEEE special values including `NaN`, `Infinity` and `-Infinity`. PostgreSQL ordering semantics make the ordinary finite range checks expected to reject these values, but S8 must not accept that as untested reasoning.

Dedicated PostgreSQL 18 integration/migration tests must directly attempt all three special values for both columns and prove whether the selected range constraints reject them.

If those tests prove the range constraints reject them, no redundant additional finite-value DB construction may be added.

If the proof unexpectedly demonstrates an escape, implementation must stop for contract review before adding a different DB expression.

## 6. Migration contract

Create exactly one new migration after S6:

`drizzle/migrations/0007_s8_location_coordinates.sql`

Historical migrations are immutable:

- `0000_s0_first_search.sql`
- `0001_s1_offer_lifecycle.sql`
- `0002_s2_auth.sql`
- `0003_s3_seller_location.sql`
- `0004_s4_seller_change_set.sql`
- `0005_s5_offer_management.sql`
- `0006_s6_product_aliases.sql`

Generated Drizzle metadata for `0007` is allowed as listed in the whitelist.

Migration semantics:

- add only nullable `latitude` and `longitude` plus S8 CHECK constraints;
- no PostGIS;
- no extension;
- no spatial index;
- no geocoding;
- no backfill;
- no seed coordinate writes;
- no invented Almaty coordinates.

### 6.1 Legacy upgrade preservation

A real `0000→...→0006` database upgraded with `0007` must preserve:

- Seller IDs;
- Location IDs;
- Location `seller_id` ownership;
- Offer IDs;
- every existing `Offer.location_id`;
- Product/Offer/Search behavior required by S0-S7.

Every pre-S8 Location must have:

```text
latitude = NULL
longitude = NULL
```

after upgrade.

Location without geo remains valid.

Offer referencing geo-less Location remains valid and searchable.

## 7. Ownership mutation boundary

Do not add a generic unsafe `updateLocationById` persistence function.

The S8 mutation must use both ownership and identity in the SQL predicate.

Repository contract:

```ts
updateLocationGeo(
  database,
  {
    sellerId,
    locationId,
    latitude,
    longitude,
  },
)
```

The SQL update must be logically equivalent to:

```sql
UPDATE locations
SET latitude = :latitude,
    longitude = :longitude
WHERE id = :locationId
  AND seller_id = :sellerId
RETURNING ...;
```

Both coordinates are replaced in the same SQL statement.

If no row is returned, application semantics are:

`LOCATION_NOT_FOUND`

Foreign and nonexistent Location are intentionally indistinguishable.

Client never submits `sellerId`, `ownerUserId`, `userId` or any ownership field.

## 8. Application use-case

Add one Locations application use-case:

`set-owned-location-geo.ts`

Flow:

```text
ownerUserId
→ findSellerByOwner(ownerUserId)
→ if no owned Seller: LOCATION_NOT_FOUND
→ updateLocationGeo(database, seller.id + locationId + full point)
→ if no row: LOCATION_NOT_FOUND
→ return updated LocationView
```

An authenticated User without Seller receives the same not-found semantics rather than a new Seller-specific geo error.

No transaction wrapper is required around multiple business writes because S8 performs one atomic SQL UPDATE only.

No revision, optimistic locking or Location ChangeSet is introduced.

## 9. HTTP API contract

Create:

`PUT /api/seller/locations/:id/geo`

Node runtime, `Cache-Control: no-store`, same Identity integration pattern as existing Seller APIs.

### 9.1 Authentication

Read existing session cookie and call existing `resolveCurrentUser`.

- Identity resolution failure → `503 AUTH_UNAVAILABLE`;
- no current User → `401 AUTH_REQUIRED`.

Do not modify Identity.

### 9.2 Location ID

Route param must be validated as UUID server-side.

To keep the S8 owner mutation error surface minimal, malformed, nonexistent and foreign Location identifiers all map to:

```text
404 LOCATION_NOT_FOUND
```

Do not expose whether another Seller owns the supplied identifier.

### 9.3 Request validation

Parse body with the canonical strict Location geo schema.

Invalid body:

```text
400 INVALID_LOCATION_GEO
```

Message may be a short stable human-readable equivalent of:

`Проверьте данные местоположения.`

### 9.4 Success

`200 OK`

```json
{
  "location": {
    "id": "uuid",
    "name": "Location",
    "addressText": "Address",
    "type": "shop",
    "geo": {
      "latitude": 43.238949,
      "longitude": 76.889709
    }
  }
}
```

### 9.5 Not found

Foreign/nonexistent/malformed route id or authenticated User without an owned Seller:

```text
404 LOCATION_NOT_FOUND
```

### 9.6 Infrastructure failure

Use current project naming style:

```text
503 LOCATION_UNAVAILABLE
```

with a stable user-safe message equivalent to:

`Не удалось сохранить местоположение.`

Do not expose PostgreSQL details or constraint names.

### 9.7 Idempotency

PUT is complete replacement of the geo subresource.

Same coordinate pair again:

```text
200 OK
same persisted state
```

Do not add:

- `NO_CHANGES`;
- revision;
- optimistic locking;
- ChangeSet.

### 9.8 Clearing

No `DELETE /geo` endpoint.

No null PUT body.

No `Удалить местоположение` UI.

S8 only sets or replaces a full point.

## 10. Owner API extension

Existing:

`GET /api/seller/me`

intentionally changes its owner-side response through the extended `LocationView`:

```json
{
  "seller": {
    "locations": [
      {
        "id": "...",
        "name": "...",
        "addressText": "...",
        "type": "shop",
        "geo": null
      }
    ]
  }
}
```

or with a saved point:

```json
"geo": {
  "latitude": 43.238949,
  "longitude": 76.889709
}
```

The existing `/api/seller/me/route.ts` file should require no code change because `SellerView` already consumes `LocationView`; the response extension is nevertheless an intentional S8 API contract change.

Seller setup request is not extended.

`POST /api/seller/setup` still accepts only existing Seller and Location name/type/address data.

A new Location created by setup has `geo = null` in its returned `LocationView`.

## 11. Browser geolocation contract

The Seller UI must feature-detect:

```text
navigator.geolocation
```

No geolocation request may occur until Seller explicitly presses the geo action for a Location.

Use exactly one:

```ts
navigator.geolocation.getCurrentPosition(success, error, {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
});
```

Engineering rationale:

- `enableHighAccuracy: true` because Seller is setting a physical sales point;
- `timeout: 15000` gives mobile GPS/location services a bounded opportunity to resolve without an unbounded spinner;
- `maximumAge: 0` requires a fresh position for this explicit action rather than accepting a cached location.

Do not use:

- `watchPosition()`;
- polling;
- automatic refresh;
- background location access.

### 11.1 Secure context

Real deployment must run this browser function under HTTPS because Geolocation API requires a secure context.

Localhost is acceptable for development and automated tests.

This is a deployment/browser capability condition, not a new server dependency.

### 11.2 Browser-side failure class

These failures happen before S8 API mutation:

- `navigator.geolocation` unsupported/unavailable;
- permission denied;
- position unavailable;
- timeout;
- other browser/location-service error returned by `getCurrentPosition`.

Required behavior:

```text
no PUT request
existing Location.geo unchanged
clear inline Seller UI error
```

Do not translate these browser failures into `LOCATION_UNAVAILABLE` or another server error.

## 12. Seller UI contract

Extend each existing owned Location card on `/seller`.

Geo absent:

```text
Местоположение не задано
[Использовать моё местоположение]
```

Geo present:

```text
Местоположение сохранено
[Обновить местоположение]
```

A short helper may tell Seller to perform the action while physically at the sales point.

Do not display raw coordinates merely because they are stored.

While browser geolocation or server PUT is in progress, prevent duplicate clicks for that Location.

Browser error and server error must be distinguishable in control flow, although both may be rendered with the existing inline error style.

No map, map preview, manual coordinate fields or address edit is added.

Existing seller page mobile behavior must remain intact.

No new stylesheet change is required: implementation must reuse existing `page.module.css` classes. If actual implementation proves additional CSS is objectively necessary, stop for whitelist approval rather than modifying it opportunistically.

## 13. Public privacy boundary

Buyer Search schema and projection are closed for S8.

Do not modify:

- `src/modules/search/contracts/search.contract.ts`;
- `src/modules/search/infrastructure/search.repository.ts`;
- `/api/search`;
- Buyer Offer card.

Direct API tests must prove `/api/search` response contains none of these keys at any depth of the public Location object:

```text
geo
latitude
longitude
```

Proof is required for:

- a `shop` Location with saved geo;
- a `home` Location with saved geo.

Visual non-display alone is insufficient.

This privacy boundary is intentional because precise raw coordinates, especially for `home`, are not automatically public merely because they exist in Locations storage.

## 14. Seller ChangeSet boundary

Do not extend Seller ChangeSet Location projection with geo.

Existing S4/S5/S7 Location shape stays:

```text
id
name
addressText
type
```

Coordinates must not be copied into:

- Seller ChangeSet item DTOs;
- Seller ChangeSet persistence;
- Offer management DTOs;
- Offer rows.

The fact that owner-side `LocationView` gains `geo` does not authorize DTO propagation across modules.

## 15. Search and Offer behavior

S8 does not change Search ordering or visibility.

An Offer whose Location has `geo = null` remains governed only by existing Search/S1 lifecycle rules.

An Offer whose Location gains geo is still the same Offer with the same `location_id`.

No new searchable/published/nearby flags.

No distance value is calculated or returned.

## 16. Failure separation

Browser-side failures are UI/browser events and occur before API mutation:

```text
unsupported
permission denied
position unavailable
timeout
browser/location service error
```

Server-side API failures are:

```text
400 INVALID_LOCATION_GEO
401 AUTH_REQUIRED
404 LOCATION_NOT_FOUND
503 AUTH_UNAVAILABLE
503 LOCATION_UNAVAILABLE
```

Do not collapse browser capability/permission problems into a server 503.

Do not add a generic Location error hierarchy.

## 17. Exact implementation whitelist

The following whitelist is fixed for implementation unless an objective blocker is demonstrated and separately approved.

### Production — modify

```text
src/modules/locations/contracts/location.contract.ts
src/modules/locations/db/locations.table.ts
src/modules/locations/infrastructure/locations.repository.ts
src/app/seller/_components/SellerSetup.tsx
```

### Production — new

```text
src/modules/locations/application/set-owned-location-geo.ts
src/app/api/seller/locations/[id]/geo/route.ts
```

### Migration — new

```text
drizzle/migrations/0007_s8_location_coordinates.sql
drizzle/migrations/meta/0007_snapshot.json
```

### Migration metadata — modify

```text
drizzle/migrations/meta/_journal.json
```

### Tests — new

```text
tests/unit/location-geo-validation.test.ts
tests/integration/s8-location-geo.test.ts
tests/integration/s8-migration-upgrade.test.ts
tests/e2e/s8-location-geo.spec.ts
```

No existing test file is expected to require modification.

`tests/integration/prepare-database.ts` already discovers the migration folder dynamically and its table-set assertion is unaffected because S8 adds columns, not tables. Its stale S6 log wording is not an S8 functional blocker and does not justify widening scope.

`src/app/seller/page.module.css` is removed from the design-stage tentative whitelist because existing card/action/status/error styles are sufficient for S8 behavior.

`src/db/schema.ts` is already an export of the Location table and requires no change.

`src/db/seed.ts` requires no change because new coordinate columns are nullable and S8 forbids seed coordinates.

`src/modules/sellers/contracts/seller.contract.ts`, `get-owned-seller.ts`, `/api/seller/me/route.ts` and `/api/seller/setup/route.ts` require no code change because they already compose/import `LocationView` or serialize the returned Seller representation.

## 18. Closed files and contracts

Without separate scope approval do not modify:

### Historical migrations/meta

```text
drizzle/migrations/0000_s0_first_search.sql
drizzle/migrations/0001_s1_offer_lifecycle.sql
drizzle/migrations/0002_s2_auth.sql
drizzle/migrations/0003_s3_seller_location.sql
drizzle/migrations/0004_s4_seller_change_set.sql
drizzle/migrations/0005_s5_offer_management.sql
drizzle/migrations/0006_s6_product_aliases.sql
drizzle/migrations/meta/0000_snapshot.json
...
drizzle/migrations/meta/0006_snapshot.json
```

### Modules/contracts

```text
src/modules/offers/**
src/modules/search/**
src/modules/seller-input/**
src/modules/catalog/**
src/modules/identity/**
src/modules/sellers/**
```

Exception: none. S8 consumes Sellers/Identity only through existing public/internal contracts.

### App/API

```text
src/app/api/search/**
src/app/api/auth/**
src/app/api/seller/setup/**
src/app/api/seller/me/**
src/app/api/seller/change-sets/**
src/app/api/seller/offers/**
src/app/login/**
src/app/_components/SearchForm.tsx
src/app/_components/OfferCard.tsx
src/app/seller/page.module.css
```

### Infrastructure/config

```text
src/db/schema.ts
src/db/seed.ts
package.json
pnpm-lock.yaml
playwright.config.ts
.github/workflows/ci.yml
drizzle.config.ts
```

### Existing tests

All existing S0-S7 tests are regression assets and remain unchanged unless a separately approved objective blocker is discovered.

No dependency additions.

## 19. Unit test contract

Create:

`tests/unit/location-geo-validation.test.ts`

Must prove canonical Location geo schema behavior for:

- normal valid point;
- exact latitude boundaries `-90`, `90`;
- exact longitude boundaries `-180`, `180`;
- just-outside each boundary;
- strings;
- null;
- missing latitude;
- missing longitude;
- `NaN`;
- `Infinity`;
- `-Infinity`;
- extra root fields.

## 20. Integration test contract

Create:

`tests/integration/s8-location-geo.test.ts`

Use real PostgreSQL 18 and existing application/repository path.

Must prove:

1. Seller setup creates Location with `geo = null`.
2. Owned Location can receive a valid point.
3. DB stores the same coordinate pair.
4. Owner read returns the same `geo`.
5. Setting a second point replaces both coordinates together.
6. Repeating the same point succeeds and preserves state.
7. User A cannot update User B Location.
8. Foreign Location row remains unchanged after rejected mutation.
9. User without Seller cannot mutate seed/foreign Location and receives not-found semantics.
10. Direct DB writes reject half-point.
11. Direct DB writes reject latitude out of range.
12. Direct DB writes reject longitude out of range.
13. Direct DB writes explicitly exercise PostgreSQL 18 `NaN`, `Infinity`, `-Infinity` for latitude and longitude.
14. Existing geo remains unchanged after a rejected application mutation.
15. Search behavior for geo-less existing Offer remains unchanged.
16. Direct `/api/search` contract-level coverage must additionally be provided in E2E/API assertions as specified below.

## 21. Migration test contract

Create:

`tests/integration/s8-migration-upgrade.test.ts`

Must construct/retain a real pre-S8 database state through `0000-0006`, then apply `0007` and prove:

- migration succeeds on PostgreSQL 18;
- Seller IDs preserved;
- Location IDs preserved;
- Location seller ownership preserved;
- Offer IDs preserved;
- every existing `Offer.location_id` preserved;
- legacy coordinate columns are both null;
- seed Location remains ownerless-seed Seller's pavilion and receives no invented coordinates;
- existing Offers remain searchable under existing Search rules;
- valid complete geo pair accepted after upgrade;
- partial pair rejected;
- range violations rejected;
- `NaN`, `Infinity`, `-Infinity` rejection behavior is explicitly proven against the actual migrated constraints;
- no historical migration content is changed.

The test must not require PostGIS or any extension.

## 22. E2E test contract

Create:

`tests/e2e/s8-location-geo.spec.ts`

It runs under existing Playwright projects:

- mobile `390×844`;
- desktop `1440×900`.

Tests must not depend on the physical location or permission state of the CI machine.

### 22.1 Deterministic success

Use Playwright browser context geolocation and explicit permission setup so a deterministic point is returned.

Flow:

```text
login
→ Seller setup
→ Location shows geo absent
→ explicit geo button click
→ deterministic browser position
→ PUT succeeds
→ saved state visible
→ direct owner API returns exact geo
→ reload
→ saved state persists
```

### 22.2 Deterministic browser failure

Use deterministic mocked/controlled browser behavior for a geolocation failure such as denied permission or a patched `getCurrentPosition` error callback.

Must prove:

```text
explicit click
→ browser-side error
→ no geo PUT request
→ inline error visible
→ existing geo unchanged
```

Do not rely on real CI browser permission prompts.

### 22.3 Public privacy API proof

Create Seller Locations of both types in isolated scenarios/fixtures:

```text
shop
home
```

with saved geo and searchable Offers as needed.

Call normal `/api/search` directly through the Buyer/public context and assert the public Location object does not contain:

```text
geo
latitude
longitude
```

for either type.

Also verify normal buyer-visible Offer behavior remains intact.

Visual absence alone is not sufficient.

## 23. Regression perimeter

Before manual acceptance, full `pnpm verify` must remain green, covering:

- lint;
- typecheck;
- clean migration chain;
- deterministic seed;
- test DB preparation;
- all unit tests;
- all integration tests;
- build;
- all E2E mobile/desktop projects.

Critical unchanged behavior:

- S0 Search;
- S1 Offer lifecycle/freshness;
- S2 Auth/session/logout;
- S3 Seller + first Location setup;
- S4 Seller ChangeSet create/confirm;
- S5 Offer management;
- S6 Catalog aliases;
- S7 real Seller-created Offer through Buyer Search.

## 24. Manual acceptance

Manual acceptance checks visible product behavior only:

1. Login as Seller.
2. Open `/seller` with existing Location.
3. See `Местоположение не задано`.
4. Click `Использовать моё местоположение`.
5. Allow browser location permission.
6. See successful saved state.
7. Reload and see saved state remains.
8. Verify existing Buyer Search behavior still works and no raw coordinates are visible.

Cross-user isolation, malformed input, special floating values, DB constraint behavior and API privacy are automated-test responsibilities.

## 25. Acceptance criteria

Implementation may be accepted only when:

1. Implementation is based on exact S7 checkpoint SHA.
2. Diff is limited to the exact whitelist.
3. `0000-0006` and their snapshots are unchanged.
4. No dependency/config/CI expansion occurs.
5. Location is the only owner of geo.
6. Legacy/new setup Location may remain geo null.
7. No coordinate backfill exists.
8. Canonical strict validation contract passes all required cases.
9. PostgreSQL 18 constraints independently enforce pair/range rules and special-value proof passes.
10. Owner-scoped SQL mutation includes both Location ID and Seller ID.
11. Foreign/nonexistent Location is indistinguishable through `LOCATION_NOT_FOUND`.
12. Browser geolocation occurs only on explicit Seller action.
13. Browser unsupported/denied/unavailable/timeout produces no API mutation.
14. `getCurrentPosition` options exactly match this contract.
15. Saved point persists and replacement/idempotent PUT semantics pass.
16. `GET /api/seller/me` intentionally exposes owner `location.geo`.
17. Seller setup request remains unchanged and returns geo null for new Location.
18. Buyer Search contract exposes no raw geo for shop or home.
19. Seller ChangeSet projection is unchanged.
20. Search visibility/order and Offer lifecycle remain unchanged.
21. No PostGIS/map/geocoder/S9/S11 behavior is introduced.
22. New S8 unit/integration/migration/E2E tests pass.
23. Existing S0-S7 regression tests pass unchanged.
24. Full GitHub Actions verify on exact implementation head is green.
25. Manual acceptance passes.

## 26. Contract-stage file boundary

During the currently authorized contract stage, the only permitted repository changes are:

```text
docs/slices/S8-location-geo/FEATURE_SPEC.md
docs/slices/S8-location-geo/IMPLEMENTATION_CONTRACT.md
```

No production, migration or test file may be created or modified before the next gate.

## 27. Gate

Implementation is blocked after this docs-only contract commit.

Required next authorization:

```text
S8 CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED
```
