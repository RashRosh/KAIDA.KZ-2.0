# S5 Implementation Contract — Offer management through ChangeSet

**Status:** APPROVED  
**Feature Spec:** DRAFT  
**Base checkpoint:** `v0.0.5-s4`  
**Base main:** `773ff9225c865d4721494fef74bdfce01569f174`

## 1. Hard boundary

Implement only:

```text
authenticated User
→ owned Seller
→ existing owned Offer
→ one S5 SellerChangeSet
→ exactly one SellerChangeItem
→ persisted preview
→ explicit confirmation
→ atomic mutation of same existing Offer
```

Supported S5 actions:

```text
update_offer
deactivate_offer
activate_offer
```

Existing:

```text
create_offer
```

remains supported unchanged.

No direct Seller write to Offer outside ChangeSet confirmation.

## 2. Migration contract

Add exactly one forward migration:

```text
drizzle/migrations/0005_s5_offer_management.sql
```

Historical:

```text
0000
0001
0002
0003
0004
```

must not be modified.

### Offers

Add:

```sql
revision integer NOT NULL DEFAULT 1
```

This is an explicitly approved additive S5 change.

Existing rows receive revision 1.

Do not modify any existing Offer column, constraint or lifecycle field.

### Seller Change Items

Add:

```text
target_offer_id uuid NULL
expected_offer_revision integer NULL
```

FK:

```text
target_offer_id → offers.id
ON DELETE NO ACTION
ON UPDATE NO ACTION
```

Revision validity:

```text
expected_offer_revision IS NULL
OR expected_offer_revision >= 1
```

Expand allowed actions to exactly:

```text
create_offer
update_offer
deactivate_offer
activate_offer
```

Required action/target consistency:

```text
action = create_offer
→ target_offer_id IS NULL
→ expected_offer_revision IS NULL

action IN (
  update_offer,
  deactivate_offer,
  activate_offer
)
→ target_offer_id IS NOT NULL
→ expected_offer_revision IS NOT NULL
```

Existing S4 rows therefore remain valid unchanged.

No generic action table or workflow schema.

## 3. Offer model contract

`Offer.revision` is an internal concurrency field.

Initial:

```text
revision = 1
```

For every successful S5 application:

```text
revision := revision + 1
```

Revision does not change for:

- proposal creation;
- preview;
- failed confirmation;
- stale confirmation;
- repeated confirmation of already confirmed ChangeSet.

Existing S4 `createOffer()` must not be required to supply revision explicitly.

DB default owns initial revision.

S4 public response does not need to expose revision.

## 4. Seller Change Item semantics

### S4

```text
action = create_offer
target_offer_id = NULL
expected_offer_revision = NULL
```

All existing S4 proposal fields retain their meaning.

### S5 common fields

At proposal creation:

```text
product_id = current target Offer.product_id
location_id = current target Offer.location_id
target_offer_id = current Offer.id
expected_offer_revision = current Offer.revision
```

`SellerChangeSet.seller_id` remains current owned Seller.

These copied Product/Location fields become immutable proposal context and are revalidated during confirmation.

### `update_offer`

Existing nullable fields contain **desired final state**:

```text
price_amount
price_currency
price_unit
seller_comment
```

No presence flags.

No partial patch.

### `deactivate_offer` and `activate_offer`

No client-controlled price/comment changes exist.

Server may persist the current Offer price/comment into the Item for stable preview, but these values are not write commands during status-only confirmation.

Confirmation of these actions must not modify price/comment.

## 5. S5 request validation

New management request is action-discriminated and strict.

### Update

Required exact logical shape:

```json
{
  "action": "update_offer",
  "price": {
    "amount": "4500.00",
    "unit": "кг"
  },
  "sellerComment": "Новая партия"
}
```

Both `price` and `sellerComment` keys are mandatory.

Valid clear operation:

```json
{
  "action": "update_offer",
  "price": null,
  "sellerComment": null
}
```

Invalid:

```json
{
  "action": "update_offer",
  "price": null
}
```

Invalid:

```json
{
  "action": "update_offer",
  "sellerComment": null
}
```

Price validation reuses S4 limits and decimal-string semantics.

Currency cannot be sent by client.

### Deactivate

Exact shape:

```json
{
  "action": "deactivate_offer"
}
```

Extra update fields are rejected.

### Activate

Exact shape:

```json
{
  "action": "activate_offer"
}
```

Extra update fields are rejected.

Forbidden client fields include:

```text
sellerId
userId
productId
locationId
targetOfferId
expectedOfferRevision
revision
currency
status
resultOfferId
```

## 6. No-op update contract

Proposal creation loads current owned Offer.

Normalize desired state using the same rules used for persistence.

Comparison is semantic.

### Price equality

Equal means same:

- null/non-null state;
- numeric amount value;
- effective currency;
- normalized unit.

Raw decimal formatting does not matter.

For example:

```text
"4500"
"4500.0"
"4500.00"
```

represent the same numeric amount.

### Comment equality

Comparison occurs after trim/null normalization.

If both desired fields equal current state:

```text
no SellerChangeSet
no SellerChangeItem
no Offer mutation
```

Application error:

```text
OFFER_UPDATE_NO_CHANGES
```

HTTP:

```text
409
```

Stable message:

```text
Изменения совпадают с текущим предложением.
```

No-op update does not refresh freshness.

Seller must use `activate_offer` for explicit freshness confirmation.

## 7. Status-action proposal rules

### Deactivate

Proposal creation requires:

```text
Offer.status = active
```

If:

```text
Offer.status = inactive
```

return:

```text
409 OFFER_ALREADY_INACTIVE
```

No ChangeSet rows are created.

### Activate

Allowed for:

```text
inactive
active expired
active fresh
```

No `already active` conflict exists.

Active Offer may always be explicitly reconfirmed.

## 8. Offer management read API

Add:

```text
GET /api/seller/offers
```

Purpose:

Return Offers belonging to current owned Seller.

It must include active, inactive and expired Offers.

Do not apply buyer Search visibility filtering to this seller management list.

Minimum seller-facing shape:

```json
{
  "offers": [
    {
      "id": "uuid",
      "product": {
        "id": "uuid",
        "name": "Баранина"
      },
      "location": {
        "id": "uuid",
        "name": "Точка",
        "addressText": "..."
      },
      "price": {
        "amount": "4200.00",
        "currency": "KZT",
        "unit": "кг"
      },
      "sellerComment": "Свежий привоз",
      "status": "active",
      "lastConfirmedAt": "..."
    }
  ]
}
```

Revision does not need to be exposed to browser.

No pagination/filtering/dashboard framework in S5.

Do not modify:

```text
GET /api/seller/me
```

## 9. Offer management proposal API

Add:

```text
POST /api/seller/offers/{offerId}/change-sets
```

Server flow:

```text
1. resolve authenticated User
2. resolve owned Seller
3. resolve target Offer owned by Seller
4. verify Offer Location belongs to same Seller
5. validate requested action
6. capture Offer.revision
7. normalize desired state
8. enforce no-op/status rules
9. create proposed SellerChangeSet
10. create exactly one SellerChangeItem
11. commit
```

Proposal creation itself performs no Offer mutation.

No Seller ID is accepted from client.

Foreign/nonexistent target:

```text
404 OFFER_NOT_FOUND
```

Suggested stable errors:

```text
400 INVALID_OFFER_CHANGE_INPUT
401 AUTH_REQUIRED
404 OFFER_NOT_FOUND
409 SELLER_REQUIRED
409 OFFER_UPDATE_NO_CHANGES
409 OFFER_ALREADY_INACTIVE
503 AUTH_UNAVAILABLE
503 SELLER_INPUT_UNAVAILABLE
```

## 10. Existing ChangeSet read

Keep existing:

```text
GET /api/seller/change-sets/{id}
```

S4 public response semantics must remain compatible.

S5 action values may appear for S5 resources.

No requirement to expose:

```text
targetOfferId
expectedOfferRevision
revision
```

to client.

Preview contains enough persisted business information to explain the proposed operation.

Reload must use PostgreSQL persisted state.

## 11. Confirmation dispatch

Existing confirmation use case is extended with explicit action dispatch.

Conceptually:

```text
switch action:

create_offer
→ existing S4 path

update_offer
→ S5 update path

deactivate_offer
→ S5 deactivate path

activate_offer
→ S5 activate path
```

Do not implement a generic mutation engine.

S4 branch must preserve existing semantics.

## 12. S5 confirmation transaction

For S5 actions:

```text
BEGIN

1. resolve current owned Seller

2. SELECT ChangeSet
   WHERE id = requested
   AND seller_id = Seller.id
   FOR UPDATE

3. missing/foreign
   → CHANGE_SET_NOT_FOUND

4. SELECT ChangeItem FOR UPDATE

5. validate exactly one S5 Item

6. if ChangeSet.status = confirmed:
     verify result_offer_id
     verify referenced Offer exists
     verify result_offer_id = target_offer_id
     return persisted confirmed result
     DO NOT mutate Offer
     DO NOT increment revision

7. SELECT target Offer FOR UPDATE

8. verify:
     Offer.seller_id = Seller.id
     Offer.location_id belongs to Seller
     Offer.product_id = Item.product_id
     Offer.location_id = Item.location_id

9. compare:
     Offer.revision = Item.expected_offer_revision

10. mismatch:
      rollback
      OFFER_CHANGED

11. capture confirmationTime once

12. apply exact action
    with revision = revision + 1

13. set Item.result_offer_id = target Offer.id

14. mark ChangeSet:
      status = confirmed
      confirmed_at = confirmationTime

15. reconstruct final persisted view

COMMIT
```

Stale failure:

```text
409 OFFER_CHANGED
```

must commit no writes.

ChangeSet therefore remains proposed.

## 13. Atomic Offer mutation

Target Offer update must be guarded by expected revision.

Semantically:

```text
UPDATE offers
SET
  ...action fields...,
  revision = revision + 1
WHERE
  id = target_offer_id
  AND revision = expected_offer_revision
RETURNING ...
```

Expected updated row count:

```text
exactly 1
```

Otherwise treat as stale/invariant failure according to whether revision changed.

Row locking remains mandatory before application.

No global SERIALIZABLE isolation.

No advisory locks.

No Redis locks.

## 14. `update_offer` application

Successful apply:

```text
price_amount = Item.price_amount
price_currency = Item.price_currency
price_unit = Item.price_unit
seller_comment = Item.seller_comment

status = existing status

last_confirmed_at = confirmationTime
updated_at = confirmationTime

revision = revision + 1
```

Immutable:

```text
id
product_id
seller_id
location_id
created_at
```

## 15. `deactivate_offer` application

Before apply, target Offer must still satisfy all revision/ownership invariants.

Proposal was originally created only for an active Offer.

If no intervening write occurred, expected revision guarantees the target is the same version that was reviewed.

Apply:

```text
status = inactive
updated_at = confirmationTime
revision = revision + 1
```

Unchanged:

```text
price_*
seller_comment
last_confirmed_at
product_id
seller_id
location_id
created_at
```

## 16. `activate_offer` application

Apply regardless of whether the matching expected revision currently has:

```text
inactive
active fresh
active expired
```

Apply:

```text
status = active
last_confirmed_at = confirmationTime
updated_at = confirmationTime
revision = revision + 1
```

Unchanged:

```text
price_*
seller_comment
product_id
seller_id
location_id
created_at
```

Same Offer ID is preserved.

## 17. Same-ChangeSet repeated confirmation

If ChangeSet is already confirmed and persisted state is valid:

```text
return same result
```

Do not:

- lock/update target for another mutation;
- refresh freshness;
- modify timestamps;
- increment revision.

Corrupted confirmed state remains internal invariant failure, not successful idempotency.

## 18. Different ChangeSets concurrency

Example:

```text
Offer revision = 7

ChangeSet A expected = 7
ChangeSet B expected = 7
```

Concurrent confirms:

```text
A locks Offer
A applies
revision = 8
A commits
```

B then obtains lock and sees:

```text
8 != 7
```

Result:

```text
409 OFFER_CHANGED
```

Final revision:

```text
8
```

not 9.

Exactly one proposal wins one source revision.

## 19. Search boundary

Do not modify:

```text
src/modules/search/**
src/app/api/search/**
```

Search continues reading committed Offers.

Existing S1 visibility predicate remains unchanged.

Therefore:

```text
proposed deactivate
→ Search old state

confirmed deactivate
→ Search excludes inactive

confirmed activate
→ Search can include Offer again
```

No ranking/order requirement added.

## 20. UI contract

Primary entry remains:

```text
/seller
```

Existing S3 setup and S4 add-product UI remain.

Add minimal section:

```text
Мои предложения
```

Each Offer exposes only necessary S5 actions:

```text
Изменить
Выключить
Подтвердить актуальность / Включить
```

No dashboard framework.

### Update

UI requests both current fields and submits a full snapshot:

- price;
- seller comment.

Preview explicitly shows final desired values.

### Deactivate

Preview clearly says that proposal will be switched off only after explicit confirmation.

### Activate

Preview clearly says that Seller is confirming current availability.

Existing review page may be narrowly adapted to render action-specific language.

Do not show internal:

- revision;
- locking;
- stale token;
- DB terminology.

On `OFFER_CHANGED`, UI explains that Offer changed since this proposal was created and asks Seller to create a new change from current data.

## 21. File whitelist

This is the allowed future implementation scope after APPROVAL.

### Documentation

New:

```text
docs/slices/S5-offer-management/FEATURE_SPEC.md
docs/slices/S5-offer-management/IMPLEMENTATION_CONTRACT.md
docs/slices/S5-offer-management/IMPLEMENTATION_NOTES.md
docs/slices/S5-offer-management/VERIFICATION.md
```

### Migration

New:

```text
drizzle/migrations/0005_s5_offer_management.sql
drizzle/migrations/meta/0005_snapshot.json
```

Modify:

```text
drizzle/migrations/meta/_journal.json
```

### Offer schema

Modify only for additive revision:

```text
src/modules/offers/db/offers.table.ts
```

Permitted change only:

```text
revision integer NOT NULL DEFAULT 1
```

No other Offer schema/lifecycle modification.

### Seller Input schema/contracts

Modify:

```text
src/modules/seller-input/db/seller-change-items.table.ts
src/modules/seller-input/contracts/seller-change-set.contract.ts
src/modules/seller-input/application/confirm-seller-change-set.ts
src/modules/seller-input/infrastructure/seller-change-sets.repository.ts
```

New:

```text
src/modules/seller-input/application/create-offer-management-change-set.ts
```

### Offers application/infrastructure

Modify:

```text
src/modules/offers/infrastructure/offers.repository.ts
```

New if needed:

```text
src/modules/offers/application/list-owned-offers.ts
src/modules/offers/contracts/seller-offer.contract.ts
```

Do not create unnecessary abstraction merely because whitelist permits it.

### API

New:

```text
src/app/api/seller/offers/route.ts
src/app/api/seller/offers/[id]/change-sets/route.ts
```

Modify:

```text
src/app/api/seller/change-sets/[id]/confirm/route.ts
```

Existing ChangeSet GET route may be modified only if strictly necessary for S5 rendering without breaking S4 shape.

### UI

Modify:

```text
src/app/seller/_components/SellerSetup.tsx
src/app/seller/change-sets/[id]/_components/SellerChangeSetReview.tsx
src/app/seller/page.module.css
```

New:

```text
src/app/seller/_components/SellerOfferManagement.tsx
```

### Tests

New:

```text
tests/unit/seller-offer-management-validation.test.ts
tests/integration/seller-offer-management.test.ts
tests/integration/seller-offer-management-concurrency.test.ts
tests/integration/s5-migration-upgrade.test.ts
tests/e2e/seller-offer-management.spec.ts
```

Existing tests may only be modified if an approved additive revision assertion objectively requires it. Existing behavioural expectations may not be weakened.

## 22. Forbidden changes

Do not modify:

```text
drizzle/migrations/0000_s0_first_search.sql
drizzle/migrations/0001_s1_offer_lifecycle.sql
drizzle/migrations/0002_s2_auth.sql
drizzle/migrations/0003_s3_seller_location.sql
drizzle/migrations/0004_s4_seller_change_set.sql
```

Do not modify S1 lifecycle:

```text
src/modules/offers/config/offer-lifecycle.config.ts
src/modules/offers/lifecycle/offer-lifecycle.ts
```

Do not modify:

```text
src/modules/search/**
src/modules/identity/**
src/modules/sellers/db/**
src/modules/locations/db/**
src/modules/sellers/contracts/**
src/modules/locations/contracts/**
src/app/api/search/**
src/app/api/auth/**
src/app/api/seller/me/**
src/app/api/seller/setup/**
```

Do not change existing S4 create public contract:

```text
POST /api/seller/change-sets
```

Do not add dependencies.

Do not modify CI/tooling without separate approval.

## 23. Automated test contract

### Unit validation

Must cover:

- all three S5 actions;
- strict discriminated input;
- update requires `price`;
- update requires `sellerComment`;
- price null;
- comment null;
- both null;
- valid decimal price;
- invalid price;
- unit normalization;
- comment normalization;
- forbidden fields;
- extra fields on status actions;
- no-op normalized comparison.

### Migration S4 → S5

Real PostgreSQL 18 test must:

1. apply real migrations through `0004`;
2. insert representative S4 data;
3. include existing confirmed `create_offer`;
4. snapshot business values;
5. apply actual `0005`;
6. verify historical rows unchanged;
7. verify all existing Offers have revision 1;
8. verify existing S4 Items have target/revision fields null;
9. verify new constraints;
10. verify all four actions accepted only in valid target shape;
11. verify full clean migration chain.

### S4 `create_offer` regression

Create Offer through existing S4 flow.

Verify:

```text
revision = 1
```

without changing S4 request body or public response contract.

Repeated/concurrent S4 confirmation must remain green.

### Proposal isolation

For each S5 action:

```text
create proposal
→ Offer unchanged
→ revision unchanged
```

### Update tests

Cover:

- price change;
- price removal;
- comment change;
- comment removal;
- both;
- inactive update preserves inactive;
- same Offer ID;
- immutable Product/Location/Seller;
- freshness update;
- revision +1;
- normalized no-op rejection;
- no rows created for no-op.

### Deactivate tests

Cover:

```text
active N
→ proposal
→ still active N
→ confirm
→ inactive N+1
```

Already inactive:

```text
409 OFFER_ALREADY_INACTIVE
```

and no proposal rows.

### Activate tests

Cover separately:

```text
inactive N → active N+1
active expired N → active fresh N+1
active fresh N → active fresh N+1
```

Always same Offer ID.

### Sequential stale proposals

Required exact scenario:

```text
Offer revision = N

create A expecting N
create B expecting N

confirm A
→ revision N+1

confirm B
→ 409 OFFER_CHANGED
```

Verify:

- Offer retains A result;
- revision remains N+1;
- B remains proposed;
- B result_offer_id remains null.

### Concurrent different ChangeSets

Create A and B from revision N.

Confirm simultaneously using separate real DB connections.

Exactly one:

```text
success
```

Exactly one:

```text
OFFER_CHANGED
```

Final:

```text
revision = N+1
```

Never N+2.

### Repeated same ChangeSet

Required:

```text
revision N
→ confirm
→ N+1
→ repeat same confirm
→ still N+1
```

Also unchanged on repeat:

- confirmedAt;
- updatedAt;
- lastConfirmedAt;
- Offer ID.

### Same ChangeSet concurrency

Two concurrent confirms of one proposal:

- same successful final result;
- one mutation;
- one revision increment.

### Atomicity failure

Use test-only real PostgreSQL failure injection.

After failed S5 application:

```text
Offer unchanged
revision unchanged
ChangeSet proposed
confirmed_at NULL
result_offer_id NULL
```

No production fault injection.

### Ownership

Cover:

- own Offer;
- foreign Offer;
- nonexistent Offer;
- ownerless seed Offer;
- inconsistent Location ownership;
- client spoof fields.

### Search regression

Cover:

- before confirmation old state;
- update after confirmation new data;
- deactivate disappears;
- activate returns;
- S0 canonical seed unchanged;
- S1 expiry semantics unchanged.

### E2E

Mobile + desktop:

```text
login
→ create Offer via existing S4
→ manage own Offer
→ update preview
→ old data before confirmation
→ new data after confirmation
→ deactivate
→ disappears only after confirmation
→ activate
→ returns
→ create another Offer using S4
→ logout
→ anonymous Search still works
```

## 24. Scope drift blockers

Implementation must stop and request approval if it appears necessary to:

- alter migrations `0000-0004`;
- change Search code;
- change S1 lifecycle semantics;
- change Identity;
- change Seller/Location public contracts;
- make Product/Location/Seller editable through S5;
- add direct Offer CRUD;
- add new ChangeSet statuses;
- add batch;
- add history;
- add AI;
- add generic workflow machinery;
- add new dependency;
- add another Offer concurrency mechanism instead of revision.

## 25. Verification gates

After explicit APPROVAL only:

```text
implementation
→ migration 0005
→ clean PostgreSQL 18 chain
→ S4 → S5 upgrade
→ unit tests
→ integration tests
→ revision/stale tests
→ concurrency tests
→ atomicity tests
→ S0-S4 regression
→ build
→ E2E mobile + desktop
→ full verify
→ branch CI
→ manual acceptance
```

Until explicit authorization to begin implementation:

```text
S5 IMPLEMENTATION BLOCKED
```
