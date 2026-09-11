# S3 Feature Spec — Seller / Location

**Status:** APPROVED  
**Base checkpoint:** `v0.0.3-s2` / `c5c3934bb22652321c2882017ee3a6dc61f7089e`

## 1. User task

Authenticated User creates exactly one owned Seller for S3 and the Seller's first physical Location.

Canonical flow:

`authenticated User → Seller → first Location`

After successful setup and reload, the same User sees the same Seller and Location. S3 does not create or edit Offer.

## 2. Scope

S3 adds only the minimum required to prove the relation:

- `User → Seller` ownership;
- `Seller → Location` ownership;
- one owned Seller per User for the current slice;
- first Location creation;
- minimal seller setup UI;
- minimal seller API;
- server-side authorization through existing Identity `resolveCurrentUser`;
- atomic Seller + first Location creation;
- validation, migration, automated tests, regression, manual acceptance.

## 3. User model

Identity continues to own User. S3 does not add roles, permissions or seller flags to User.

Current S2 model remains:

- `users.id`
- `users.phone_e164`
- `users.created_at`

## 4. Seller model

Resulting conceptual model:

- `sellers.id`
- `sellers.display_name`
- `sellers.owner_user_id NULLABLE`

Rules:

- Seller created through S3 always receives `authenticated User.id` as `owner_user_id`;
- ownership is derived only server-side through existing Identity `resolveCurrentUser`;
- `user_id` / `owner_user_id` are never accepted from the client;
- existing/system fixture Seller may remain `owner_user_id = NULL`;
- the canonical S0 seed Seller remains ownerless and cannot be claimed by login;
- in S3 one User may own at most one Seller;
- this is an S3 restriction, not a permanent product invariant;
- PostgreSQL must enforce at most one non-null `owner_user_id`, preferably via partial unique index for non-null ownership.

## 5. Location model

Resulting conceptual model:

- `locations.id`
- `locations.seller_id`
- `locations.name`
- `locations.address_text`
- `locations.type`

Relationship:

`Seller 1 → N Locations`

S3 UI creates only the first Location and does not provide multi-location management.

Allowed `Location.type` values:

- `market`
- `shop`
- `pavilion`
- `home`
- `other`

No Market/Pavilion entities and no hierarchy are introduced.

## 6. Validation semantics

At Feature Spec level:

- `Seller.display_name` is required after trim;
- `Location.name` is required after trim;
- `Location.address_text` is required after trim;
- whitespace-only values are invalid;
- `Location.type` must be one of the approved values.

Concrete max lengths, Zod schemas and DB checks are fixed in the Implementation Contract. No generic validation framework is introduced.

## 7. Atomic setup invariant

Seller and the mandatory first Location are one business operation and must be created in one DB transaction.

A successful intermediate state `Seller exists, Location failed` is forbidden.

On Location failure the whole setup rolls back.

## 8. Repeat and concurrent setup semantics

If the User already owns a Seller:

`POST /api/seller/setup → 409 SELLER_ALREADY_EXISTS`

The endpoint must not silently return the existing Seller and ignore new input.

For two concurrent setup requests by the same User:

- at most one Seller is created;
- at most one first Location is created by the successful transaction;
- one operation may succeed;
- the concurrent loser receives the same agreed conflict;
- no orphan Seller/Location may remain;
- the PostgreSQL ownership uniqueness invariant is the final guarantee.

## 9. Seller API semantics

### GET `/api/seller/me`

The public shape reflects `Seller 1 → N Locations` from the start:

```json
{
  "seller": {
    "id": "uuid",
    "displayName": "Seller",
    "locations": [
      {
        "id": "uuid",
        "name": "Location",
        "addressText": "Address",
        "type": "shop"
      }
    ]
  }
}
```

If the authenticated User has no Seller:

```json
{ "seller": null }
```

The API must not expose a singular public `location` field. In S3 the `locations` array will normally contain one item because no second-location UI exists.

### POST `/api/seller/setup`

Creates Seller + first Location for the current authenticated User in one transaction.

The client cannot choose owner or arbitrary Seller ownership.

## 10. Authorization

S3 must use the existing Identity `resolveCurrentUser` path.

Required behavior:

- anonymous setup is rejected;
- Seller is created only for current authenticated User;
- Location is created only for that Seller;
- User cannot read another User's Seller/Locations through seller API;
- repeated setup does not create a second Seller;
- seed Seller with `owner_user_id = NULL` is never treated as current User's Seller.

No roles, RBAC, organizations, teams or policy framework.

## 11. Existing S0 fixture

The existing S0 seed Seller remains the same row and receives no owner.

The existing S0 Location is linked to that existing seed Seller without changing existing Search results.

No fake User is created for the seed Seller.

## 12. Intentional temporary Offer/Location redundancy

After S3 all three relations coexist:

- `Offer.seller_id`
- `Offer.location_id`
- `Location.seller_id`

S3 does not modify `offers` and does not introduce a new Offer constraint or trigger.

The invariant `Offer.seller_id == Location.seller_id` for future seller-created Offers is **not S3 responsibility**. It is intentionally deferred to S4, where seller-created Offer appears.

This is an explicit temporary slice boundary, not a forgotten invariant.

## 13. Out of scope

S3 excludes:

- Offer create/edit;
- Seller Change Set / Seller Input;
- Catalog work;
- latitude / longitude;
- browser Geolocation API;
- permissions/geolocation error flows;
- map/geocoding/distance/geo search;
- Discovery;
- contacts;
- reviews/rating/moderation;
- AI/media/voice/photo/video;
- Telegram/notifications;
- monetization/subscriptions/promotion;
- roles/admin/teams/organizations;
- second Seller UI/switching;
- second Location creation or branch management;
- Seller/Location edit/delete;
- seller dashboard;
- S2 documentation cleanup;
- Search, Offers, Offer Lifecycle or Identity refactoring.

## 14. Acceptance criteria

S3 is acceptable only when all of the following are true:

1. New migration is added after S2; `0000`, `0001`, `0002` are unchanged.
2. Existing Product/Seller/Location/Offer/User rows survive upgrade.
3. Existing seed Seller remains `owner_user_id = NULL`.
4. Existing seed Location is linked to existing seed Seller.
5. PostgreSQL enforces at most one owned Seller per non-null User owner in S3.
6. Location has a valid approved type and belongs to Seller.
7. Clean PostgreSQL 18 migration chain passes.
8. Real S2 → S3 upgrade path passes.
9. Authenticated User without Seller sees setup.
10. Seller display name, Location name, type and address can be submitted.
11. Seller + first Location are created atomically in one transaction.
12. Location failure cannot leave an orphan Seller.
13. Reload shows the same owned Seller and Location.
14. `GET /api/seller/me` returns `seller.locations: [...]`, not singular `location`.
15. Sequential second setup receives `409 SELLER_ALREADY_EXISTS`.
16. Concurrent same-User setup leaves at most one owned Seller and one first Location; loser receives agreed conflict.
17. Another User cannot read the first User's Seller/Locations through seller API.
18. Ownership spoofing from request body is rejected.
19. Setup creates no Offer and does not change Offer count.
20. Anonymous Search remains public and unchanged.
21. Search works before login, after login and after logout.
22. Existing `баранина` and `говядина` fixtures continue to behave under S0/S1 rules.
23. Offer Lifecycle remains unchanged.
24. Phone login, persistent session and logout remain unchanged.
25. All S0/S1/S2 tests continue to pass unchanged.
26. New unit/integration/migration/E2E coverage passes on PostgreSQL 18 and existing Playwright mobile/desktop projects.
27. `pnpm verify` and actual GitHub Actions are green before manual acceptance.
28. Manual acceptance passes in one short scenario.
29. Only after manual acceptance may S3 merge to `main`.
30. Only after green CI on merged `main` may annotated checkpoint tag `v0.0.4-s3` be created.

## 15. Manual acceptance

One short human scenario is sufficient:

1. Open KAIDA.KZ anonymously and verify Search for `баранина`.
2. Open `/seller` and see login-required state.
3. Login through existing S2 phone flow.
4. Open seller setup.
5. Enter Seller display name.
6. Enter Location name.
7. Select Location type.
8. Enter address.
9. Submit.
10. See read-only Seller + Location.
11. Reload and see the same Seller + Location.
12. Verify `баранина` Search still works.
13. Logout.
14. Verify anonymous Search still works.

Concurrency, DB rollback, FK violations, migration failure and cross-user isolation are automated-test responsibilities, not manual acceptance steps.

## 16. Checkpoint

Planned checkpoint after full DoD only:

`v0.0.4-s3`
