# S4 Implementation Contract — First Seller Change Set

**Status:** APPROVED  
**Feature Spec:** APPROVED  
**Base checkpoint:** `v0.0.4-s3`  
**Base main:** `80d97bebd5e3427cdae96441df64dad23efdbb30`  
**Branch:** `slice/s4-seller-input`  
**Planned checkpoint after full verification:** `v0.0.5-s4`

## 1. Objective and hard boundary

Implement exactly:

```text
authenticated User
→ owned Seller
→ owned Location
→ one manual seller input
→ persisted proposed SellerChangeSet
→ exactly one SellerChangeItem in the S4 flow
→ explicit confirmation
→ one active Offer for that Change Set
```

Seller Input never writes Offer directly before confirmation.

No S5/S6/S7/S12/S17+ behavior is implemented.

## 2. Product and Search decisions

Product resolution is only `trim + case-insensitive exact match Product.name` against existing Product rows.

Results:

- 0 rows → `PRODUCT_NOT_FOUND`, no writes;
- 1 row → use Product;
- >1 rows → `PRODUCT_AMBIGUOUS`, no writes.

No Product creation, alias, synonym, fuzzy match or case-insensitive uniqueness migration.

Search code/API is not modified. A confirmed fresh S4 Offer may be visible through existing generic Search. No publication/searchable/source flag is added.

After an S4 `Баранина` flow, Search regression asserts the original seed Offer remains present and unchanged; an additional S4 Offer is allowed; no exact result count or ordering requirement is added.

## 3. Price semantics

Price is optional.

If price is absent:

```text
price_amount = NULL
price_currency = NULL
price_unit = NULL
```

If price is present:

- server sets currency `KZT`;
- unit may be present or absent;
- client cannot supply currency.

Seller comment is optional.

S4 Seller Input amount guardrail is `0` through `999999999999.99`, maximum two decimal digits. This is a Seller Input guardrail, not a product-wide Offer limit. Existing Offer schema is not changed for it.

HTTP amount is decimal string, not JavaScript float canonical data.

Allowed syntax:

```regex
^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$
```

Unit after trim: optional, 1..32 chars if non-null. Blank normalizes to null.

Seller comment after trim: optional, 1..500 chars if non-null. Blank normalizes to null.

## 4. Exact DB schema

S4 creates exactly two tables.

### 4.1 `seller_change_sets`

| Column | PostgreSQL | NULL | Default |
|---|---|---:|---|
| `id` | uuid | no | random UUID |
| `seller_id` | uuid | no | none |
| `status` | text | no | none |
| `created_at` | timestamptz | no | `now()` |
| `confirmed_at` | timestamptz | yes | none |

FK:

```text
seller_id → sellers.id
ON DELETE NO ACTION
ON UPDATE NO ACTION
```

Checks:

```text
seller_change_sets_status_allowed
status IN ('proposed', 'confirmed')
```

```text
seller_change_sets_confirmation_consistent
(status='proposed' AND confirmed_at IS NULL)
OR
(status='confirmed' AND confirmed_at IS NOT NULL)
```

No updated_at, cancelled_at, source, User FK, AI metadata, version field or workflow framework.

### 4.2 `seller_change_items`

| Column | PostgreSQL | NULL | Default |
|---|---|---:|---|
| `id` | uuid | no | random UUID |
| `change_set_id` | uuid | no | none |
| `action` | text | no | none |
| `product_id` | uuid | no | none |
| `location_id` | uuid | no | none |
| `price_amount` | numeric | yes | none |
| `price_currency` | char(3) | yes | none |
| `price_unit` | text | yes | none |
| `seller_comment` | text | yes | none |
| `result_offer_id` | uuid | yes | none |

FKs:

```text
change_set_id → seller_change_sets.id
product_id → products.id
location_id → locations.id
result_offer_id → offers.id
```

All use `ON DELETE NO ACTION`, `ON UPDATE NO ACTION`.

Index:

```text
seller_change_items_change_set_id_idx(change_set_id)
```

Do not add `UNIQUE(change_set_id)`. DB remains future-compatible with `SellerChangeSet 1 → N SellerChangeItems`; S4 application flow itself creates exactly one Item.

Action check:

```text
seller_change_items_action_allowed
action = 'create_offer'
```

Price validity check semantically requires:

```text
price_amount IS NULL
OR (
  price_amount >= 0
  AND finite/not NaN
  AND scale(price_amount) <= 2
  AND price_amount < 1000000000000
)
```

Price shape check:

```text
price_amount IS NULL
→ price_currency IS NULL AND price_unit IS NULL

price_amount IS NOT NULL
→ price_currency = 'KZT'
   AND price_unit may be NULL or non-NULL
```

Non-null unit must be trimmed nonblank and ≤32 chars. Non-null seller comment must be trimmed nonblank and ≤500 chars.

`result_offer_id` is NULL before confirmation and points to created Offer after successful confirmation.

Do not add global `UNIQUE(result_offer_id)` because later Items may legitimately reference the same existing Offer in future slices.

## 5. No global Offer tuple uniqueness

S4 guarantee is:

```text
one Change Set → maximum one result Offer
```

S4 explicitly does **not** guarantee:

```text
Seller + Product + Location → one Offer
```

Do not add unique constraint/index on:

```text
offers(seller_id, product_id, location_id)
```

Do not add deduplication framework.

Two different independently created and confirmed Change Sets may create two separate Offers even with the same Seller/Product/Location tuple.

Idempotency/concurrency protection applies only to repeated/concurrent confirmation of the **same Change Set**.

## 6. Runtime validation

Use existing Zod. No dependency additions.

Create body is strict at all object levels. Unknown fields are rejected.

Forbidden client-controlled fields include seller/user/owner IDs, currency, status and resultOfferId.

Public create shape:

```json
{
  "productName": "Баранина",
  "locationId": "uuid",
  "price": {
    "amount": "4200.00",
    "unit": "кг"
  },
  "sellerComment": "Свежий привоз."
}
```

`price` may be omitted or null. `sellerComment` may be omitted or null. Unit only exists inside price.

## 7. Mandatory create transaction boundary

Semantic use case:

```text
createSellerChangeSet(currentUserId, input)
```

**One PostgreSQL transaction is mandatory for the entire operation.**

Inside the same transaction, in this order semantically:

1. resolve owned Seller by `CurrentUser.id`;
2. if none → `SELLER_REQUIRED`;
3. validate requested Location belongs to that Seller;
4. exact-resolve Product;
5. insert `SellerChangeSet(status='proposed')`;
6. insert exactly one mandatory `SellerChangeItem(action='create_offer')`;
7. commit;
8. return persisted Change Set view.

The only successful committed S4 proposal shape is:

```text
ChangeSet + exactly one S4 Item
```

If any step after transaction start fails, no S4 rows remain.

Unknown/ambiguous Product or foreign/nonexistent Location creates no S4 rows.

Do not introduce elevated isolation level, advisory locks or row locks for proposal creation without a demonstrated need.

## 8. Ownership and isolation

HTTP derives User only through existing session + `resolveCurrentUser`.

Then:

```text
CurrentUser.id
→ Seller.owner_user_id
→ Seller.id
```

Seller ID is never accepted from client.

Location must satisfy:

```text
Location.seller_id == SellerChangeSet.seller_id
```

Ownerless seed Seller cannot be used by authenticated User.

For read/confirm, nonexistent Change Set and Change Set belonging to another User both return:

```text
404 CHANGE_SET_NOT_FOUND
```

No cross-user existence leak.

## 9. Persisted read by ID

Required use case:

```text
getSellerChangeSet(currentUserId, changeSetId)
```

It reconstructs the Change Set from PostgreSQL with ownership enforcement.

Browser state is not source of truth. Reload may not depend on React state, localStorage, sessionStorage, navigation state or cached POST response.

Response is future-compatible with multiple Items:

```json
{
  "changeSet": {
    "id": "uuid",
    "status": "proposed",
    "createdAt": "timestamp",
    "confirmedAt": null,
    "seller": { "id": "uuid", "displayName": "Seller" },
    "items": [
      {
        "id": "uuid",
        "action": "create_offer",
        "product": { "id": "uuid", "name": "Баранина" },
        "location": {
          "id": "uuid",
          "name": "Точка",
          "addressText": "Алматы ...",
          "type": "pavilion"
        },
        "price": { "amount": "4200.00", "currency": "KZT", "unit": "кг" },
        "sellerComment": "Свежий привоз.",
        "resultOffer": null
      }
    ]
  }
}
```

Absent price is `price: null`.

Confirmed result contains minimum:

```json
"resultOffer": {
  "id": "uuid",
  "status": "active",
  "lastConfirmedAt": "timestamp"
}
```

No Change Set list/history endpoint.

## 10. Confirmation transaction and state transition

Only state transition:

```text
proposed → confirmed
```

Confirmation is one PostgreSQL transaction.

Required semantic algorithm:

```text
BEGIN

1. resolve current owned Seller
2. SELECT owned ChangeSet by requested id + seller id FOR UPDATE
3. absent/foreign → CHANGE_SET_NOT_FOUND
4. load S4 Items FOR UPDATE
5. verify exactly one Item for S4 and action=create_offer

6. if status=confirmed:
     verify result_offer_id is non-null
     load referenced Offer
     verify referenced Offer exists
     verify it is the persisted result for this Item
     if any invariant fails → internal invariant failure / rollback / 503
     otherwise return the existing successful result without a new Offer

7. if status=proposed:
     revalidate Location belongs to Seller
     capture confirmationTime once
     INSERT one Offer
     UPDATE Item SET result_offer_id=created Offer.id while result_offer_id IS NULL
     UPDATE ChangeSet SET status='confirmed', confirmed_at=confirmationTime while status='proposed'
     assert expected write counts/invariants

COMMIT
```

Any failure rolls back every write.

Confirmed-state corruption such as:

```text
confirmed ChangeSet + result_offer_id = NULL
```

or a result_offer_id whose Offer does not exist is never a successful idempotent `200`. It maps to internal `503 SELLER_INPUT_UNAVAILABLE` at HTTP boundary.

No trigger or generic invariant framework is added solely for this case; application invariant + integration coverage is sufficient.

## 11. Concurrent confirmation mechanism

Correctness depends on PostgreSQL, not frontend button state.

Serialize confirms of one Change Set using:

```text
SELECT SellerChangeSet ... FOR UPDATE
```

inside confirmation transaction.

Request A locks the Change Set. Request B waits. A creates/link/confirms and commits. B then sees confirmed state, verifies the persisted result integrity and returns the same result without creating another Offer.

No Redis/advisory/distributed locks, queue, global SERIALIZABLE or generic optimistic-version framework.

## 12. Guarantee: one applied Offer for one S4 Change Set/Item

Guarantee is composed of:

1. one mandatory S4 Item created in one proposal transaction;
2. parent ChangeSet row locked `FOR UPDATE` during confirmation;
3. Item row locked during confirmation;
4. `result_offer_id` starts NULL;
5. Offer creation and Item result link occur in same confirmation transaction;
6. ChangeSet confirmation occurs in that same transaction;
7. repeat confirm verifies and returns existing result;
8. rollback removes all partial writes.

Do not add `Offer.source_change_item_id`, DB trigger or tuple-deduplication mechanism in S4.

## 13. Offer creation

Add minimal Offers write repository accepting caller-supplied transaction.

Create values:

```text
Offer.product_id = Item.product_id
Offer.seller_id = ChangeSet.seller_id
Offer.location_id = Item.location_id
Offer.price_amount = Item.price_amount
Offer.price_currency = Item.price_currency
Offer.price_unit = Item.price_unit
Offer.seller_comment = Item.seller_comment
Offer.status = active
Offer.last_confirmed_at = confirmationTime
```

`created_at` and `updated_at` may be explicitly set to the same captured confirmationTime for deterministic single-clock operation.

Reuse existing S1 Clock contract if available. Do not duplicate 168-hour freshness logic or introduce TimeService.

Before Offer insert, verify:

```text
Location.seller_id == ChangeSet.seller_id
```

S4 does not retrofit cross-table DB trigger/constraint to historical Offers.

## 14. HTTP contracts

All S4 routes use Node runtime, existing session cookie + `resolveCurrentUser`, `Cache-Control: no-store`, and existing error shape:

```json
{ "error": { "code": "CODE", "message": "Human readable text" } }
```

### POST `/api/seller/change-sets`

Success `201` with `{ changeSet }`.

Errors:

- `400 INVALID_CHANGE_SET_INPUT`
- `401 AUTH_REQUIRED`
- `404 LOCATION_NOT_FOUND`
- `404 PRODUCT_NOT_FOUND`
- `409 PRODUCT_AMBIGUOUS`
- `409 SELLER_REQUIRED`
- `503 AUTH_UNAVAILABLE`
- `503 SELLER_INPUT_UNAVAILABLE`

Foreign Location is indistinguishable from missing Location through this seller-owned path.

### GET `/api/seller/change-sets/{id}`

Success `200` with `{ changeSet }`.

Errors:

- `400 INVALID_CHANGE_SET_ID` for syntactically invalid UUID path value;
- `401 AUTH_REQUIRED`
- `404 CHANGE_SET_NOT_FOUND` for nonexistent or foreign resource;
- `409 SELLER_REQUIRED`
- `503 AUTH_UNAVAILABLE`
- `503 SELLER_INPUT_UNAVAILABLE`.

### POST `/api/seller/change-sets/{id}/confirm`

First successful confirmation: `200`.

Repeated intact confirmation: `200` with same ChangeSet ID, result Offer ID and confirmedAt.

Errors:

- `400 INVALID_CHANGE_SET_ID`
- `401 AUTH_REQUIRED`
- `404 CHANGE_SET_NOT_FOUND`
- `409 SELLER_REQUIRED`
- `503 AUTH_UNAVAILABLE`
- `503 SELLER_INPUT_UNAVAILABLE` for unexpected DB errors or internal invariant corruption.

Raw PostgreSQL details/constraint names are never returned.

## 15. UI contract

Primary entry remains `/seller`.

Anonymous and authenticated-without-Seller states preserve S3 behavior.

Owned Seller state adds a minimal `Добавить товар` section with Product name, optional price, optional unit and optional comment. Location is visible. No Seller selector, dashboard or Offer list.

Successful create navigates to:

```text
/seller/change-sets/{id}
```

That page loads persisted resource through GET API rather than relying on POST response state.

Proposed screen shows Product/Seller/Location/price/comment, explicit not-applied state and Confirm button.

Confirmed screen shows same proposal data plus created Offer result and no editable controls.

Reload proposed and confirmed screens must work from persisted state.

No history/list/dashboard.

## 16. Migration

Create exactly:

```text
drizzle/migrations/0004_s4_seller_change_set.sql
drizzle/migrations/meta/0004_snapshot.json
```

Update:

```text
drizzle/migrations/meta/_journal.json
```

Do not modify `0000` through `0003`.

`0004` creates only the two Seller Input tables, their checks/FKs/indexes, performs no existing-data backfill and changes no existing rows.

Clean chain:

```text
0000 → 0001 → 0002 → 0003 → 0004
```

must pass on PostgreSQL 18.

## 17. S3 → S4 upgrade test

Add `tests/integration/s4-migration-upgrade.test.ts` using an isolated temporary PostgreSQL 18 DB.

It must:

1. apply real migrations through `0003` only;
2. insert representative valid S3 data;
3. snapshot existing Product/User/Seller/Location/Offer values;
4. apply actual `0004`;
5. verify old business values unchanged;
6. verify both new tables exist and are empty;
7. verify required FK/check/index behavior;
8. verify invalid status/action/price/direct missing FKs are rejected;
9. close connections and drop only its test DB.

## 18. Clean database preparation

Modify `tests/integration/prepare-database.ts` expected public table list from seven to nine by adding:

```text
seller_change_items
seller_change_sets
```

Repeat migrations and seed remain deterministic. Repeat seed creates zero Change Sets/Items. `src/db/seed.ts` does not change.

## 19. Exact file whitelist

### Documentation

New:

```text
docs/slices/S4-seller-input/FEATURE_SPEC.md
docs/slices/S4-seller-input/IMPLEMENTATION_CONTRACT.md
docs/slices/S4-seller-input/IMPLEMENTATION_NOTES.md
docs/slices/S4-seller-input/VERIFICATION.md
```

### Migration

New:

```text
drizzle/migrations/0004_s4_seller_change_set.sql
drizzle/migrations/meta/0004_snapshot.json
```

Modify:

```text
drizzle/migrations/meta/_journal.json
```

### DB registry

Modify:

```text
src/db/schema.ts
```

### Seller Input module

New:

```text
src/modules/seller-input/db/seller-change-sets.table.ts
src/modules/seller-input/db/seller-change-items.table.ts
src/modules/seller-input/contracts/seller-change-set.contract.ts
src/modules/seller-input/application/create-seller-change-set.ts
src/modules/seller-input/application/get-seller-change-set.ts
src/modules/seller-input/application/confirm-seller-change-set.ts
src/modules/seller-input/infrastructure/seller-change-sets.repository.ts
```

### Catalog

New only:

```text
src/modules/catalog/infrastructure/products.repository.ts
```

### Offers

New only:

```text
src/modules/offers/infrastructure/offers.repository.ts
```

### API

New:

```text
src/app/api/seller/change-sets/route.ts
src/app/api/seller/change-sets/[id]/route.ts
src/app/api/seller/change-sets/[id]/confirm/route.ts
```

### Seller UI

Modify:

```text
src/app/seller/page.tsx
src/app/seller/page.module.css
src/app/seller/_components/SellerSetup.tsx
```

New:

```text
src/app/seller/_components/SellerChangeSetCreate.tsx
src/app/seller/change-sets/[id]/page.tsx
src/app/seller/change-sets/[id]/_components/SellerChangeSetReview.tsx
```

### Tests

Modify:

```text
tests/integration/prepare-database.ts
```

New:

```text
tests/unit/seller-change-set-validation.test.ts
tests/integration/seller-change-set.test.ts
tests/integration/seller-change-set-concurrency.test.ts
tests/integration/s4-migration-upgrade.test.ts
tests/e2e/seller-change-set.spec.ts
```

If implementation requires a file outside whitelist, a closed S0-S3 contract change or a new dependency, stop before modifying it and report the reason/consequence.

## 20. Forbidden changes

Do not modify:

- migrations `0000`-`0003`;
- `src/modules/catalog/db/products.table.ts`;
- `src/modules/offers/db/offers.table.ts`;
- existing Offer lifecycle/config;
- `src/modules/identity/**`;
- `src/modules/search/**`;
- existing seller/location DB tables;
- existing search/auth/login API/UI;
- `package.json`, lockfile, Vitest/Playwright config or workflow;
- existing S0-S3 tests merely to make S4 pass.

No dependencies or CI workflow rename.

## 21. Automated test matrix

### Unit validation

Cover strict root input, blank/missing Product, invalid Location UUID, unknown/spoofed fields, all valid/invalid price examples, optional price/unit relations, unit 32/33 boundary, comment 500/501 boundary and blank normalization.

### Integration: proposal creation

Cover:

- authenticated owned Seller create;
- mandatory transaction produces ChangeSet + exactly one Item;
- Item action `create_offer`;
- proposed/confirmedAt null/resultOfferId null;
- Offer count unchanged before confirmation;
- Product case/trim variants;
- unknown and ambiguous Product produce no S4 rows;
- foreign/nonexistent Location produce no S4 rows;
- ownerless seed Seller cannot be used;
- absent price persists amount/currency/unit all null;
- present price sets KZT and optional unit;
- zero accepted;
- optional comment;
- two distinct Change Sets may coexist and later yield distinct Offers even for equal Seller/Product/Location tuple.

### Persisted read

Cover proposed and confirmed read by ID across independent application calls, cross-user/nonexistent isolation and corrupted confirmed-state behavior where applicable.

### Confirmation

Cover copied fields, active status, deterministic confirmation time, resultOffer link, confirmed status/time and `Offer.seller_id == Location.seller_id`.

### Idempotency

Second confirm of the same intact Change Set returns same Offer ID and confirmedAt with unchanged Offer count.

### Confirmed-state corruption

Using test-only DB manipulation within a transaction/isolated fixture, prove that `confirmed + NULL result_offer_id` or dangling/missing referenced Offer is treated as internal invariant failure, not successful `200`/application success. No production fault-injection hook.

### Atomicity failure

Use real PostgreSQL failure injection, preferably temporary test trigger rejecting Offer insert. After failed confirmation, ChangeSet remains proposed, confirmedAt/resultOfferId null and Offer count unchanged. Remove trigger in `finally`.

### Concurrency

Two simultaneous confirmations using real separate PostgreSQL connections create at most one Offer and both converge to same final persisted result.

### Search regression

After confirming `Баранина`, Search contains canonical seed Offer unchanged; S4 Offer may also be present; no exact result count/order assertion.

## 22. E2E matrix

New `tests/e2e/seller-change-set.spec.ts` runs existing mobile and desktop projects:

```text
anonymous Search works
→ /seller requires login
→ login through existing S2 flow
→ create/use owned Seller + Location
→ enter Баранина
→ create proposal
→ navigate to /seller/change-sets/{id}
→ proposed preview
→ reload and same proposal
→ confirm
→ confirmed result + Offer
→ reload and same result
→ Search баранина
→ canonical seed Offer still present unchanged
→ additional S4 Offer allowed, no ordering assertion
→ logout
→ anonymous Search still works
```

Verify proposal creation itself did not create Offer.

Cleanup only test-owned rows, respecting FK dependencies and never deleting canonical seed rows.

## 23. Regression S0-S3

S0: anonymous exact search, seed fixtures, nullable price and existing clean-seed expectations remain green.

S1: `active AND last_confirmed_at > cutoff` remains unchanged; no duplicated freshness logic.

S2: phone normalization, OTP, session persistence/current-user/logout/concurrency remain unchanged.

S3: Seller + first Location atomic setup, reload, ownership and seed-ownerless behavior remain unchanged; Seller setup creates no Offer/ChangeSet.

All existing S0-S3 tests remain green unchanged.

## 24. Manual acceptance

1. Search `баранина` anonymously and verify canonical seed Offer.
2. `/seller` requires login.
3. Login through S2 test flow.
4. Use/create owned Seller + Location.
5. Enter `Баранина` plus optional price/unit/comment.
6. Create proposal.
7. Verify proposed preview and explicit not-applied state.
8. Reload and verify same proposed Change Set loads from server.
9. Confirm.
10. Verify confirmed result and created Offer.
11. Reload and verify same Change Set/result Offer.
12. Search `баранина` and verify canonical seed Offer remains unchanged; extra S4 Offer is acceptable.
13. Do not judge result order.
14. Verify Seller/Location unchanged.
15. Logout and verify anonymous Search.
16. Check mobile and desktop responsive behavior.

Concurrency, rollback, corruption, spoofing, cross-user isolation, constraints and migration upgrade are automated responsibilities.

## 25. Verification sequence and readiness gates

After approved docs:

```text
implementation
→ migration 0004
→ clean PostgreSQL 18 migration chain
→ real S3→S4 upgrade
→ unit
→ integration
→ atomicity
→ concurrency
→ S0-S3 regression
→ build
→ Playwright mobile+desktop
→ full pnpm verify
→ branch GitHub Actions
```

Until branch CI is green, required status is:

```text
NOT READY: automated verification pending
```

After green branch CI and before separate manual acceptance:

```text
NOT READY: manual acceptance pending
```

Do not merge or tag before separate manual acceptance approval.

After manual acceptance only:

```text
merge main
→ merged-main CI green
→ annotated v0.0.5-s4
→ tag-triggered CI green
```

S5 must not start as part of S4.
