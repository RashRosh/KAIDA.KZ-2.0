# Mandatory Offer Price — Slice Contract

**Status:** DRAFT — STOP / PRODUCT REVIEW REQUIRED

**Implementation:** NOT AUTHORIZED until the Gate section is explicitly approved

**Related:** Issue #13

Verified product checkpoint:

- tag: `v0.0.22-ux2a`;
- checkpoint commit: `66fb1def48b59f9321b2c3eb21cb0320ac3071ce`;
- merged-main CI: PASS.

Implementation base:

- `main`: `d44b3bfbf8fb48e7ad17a3265c7f244425f34c75`;
- this commit is a docs-only post-checkpoint planning merge;
- merged-main CI for this exact base: PASS;
- branch: `slice/mandatory-offer-price`.

`docs/product/EXECUTION_PLAN.md` identifies this capability as the first open COMMITTED item after the closed Gate R1 decision.

## 1. User task

Seller can publish and keep an Offer only when a concrete price amount is present. Buyer never receives or sees a publishable Offer with an unknown price.

## 2. Product decisions proposed for approval

### 2.1 Mandatory amount

For every new or changed publishable Offer:

```text
price.amount is required
price.currency = KZT server-side
price.unit is optional
```

The existing amount semantics remain unchanged:

- decimal string input;
- `0` remains valid;
- maximum 12 integer digits;
- maximum 2 fractional digits;
- no `NaN`, `Infinity` or negative amount;
- client cannot select currency.

Changing the lower bound from `0` to a positive amount is not part of this slice.

### 2.2 `unit` semantics

Recommended decision:

```text
unit = null means the displayed amount is the total/package/lot price
for the Offer as presented by Seller; it does not mean that price is unknown.
```

When present, `unit` keeps the current trim and `1..32` character rules.

`unit` remains optional because the current value is free text. Making free-text `unit` mandatory would not make `кг`, `kg`, `килограмм`, `шт` and package prices commercially comparable. Canonical units, conversions and comparison groups require a separate product model and are out of scope.

Future Search price sorting must not compare incompatible normalized units or mix `unit = null` with per-unit prices without a separate comparability decision.

### 2.3 Legacy data policy

No migration may invent a historical amount, convert `NULL` to `0`, delete an Offer or silently assign a unit.

Existing active Offers without an amount are quarantined by changing them to `inactive`. Existing inactive Offers without an amount remain stored for Seller remediation and audit/history continuity.

This is an explicit transitional exception:

```text
legacy inactive Offer may temporarily have price = null
after migration, every application-originated Offer insert/update must end priced
active Offer may never have price = null
buyer-visible Offer may never have price = null
```

The quarantine UPDATE performed by `0010` is the sole migration exception: it may change an active legacy row to `inactive` while preserving its unknown amount as `NULL`.

Seller repairs a quarantined Offer by submitting a priced `update_offer`, then using a separate `activate_offer` ChangeSet. This preserves the existing ChangeSet, revision and confirmation boundaries.

If Product Owner instead requires immediate physical `NOT NULL` for every historical row, implementation must STOP: a safe automatic migration cannot satisfy that requirement without deleting data or fabricating prices. That policy requires an operator-supplied remediation phase before a later `SET NOT NULL` migration.

## 3. Scope

This slice includes only:

- required non-null price object for single `create_offer`;
- required non-null price object for single `update_offer`;
- the same rule for S12 batch `create_offer` and `update_offer` items;
- rejection of activation for a legacy Offer without price;
- confirmation-time guard against persisted legacy proposals that would create, update or activate an Offer without price;
- one forward PostgreSQL migration after `0009`;
- quarantine of legacy active Offers without price;
- DB enforcement for active Offers and future writes;
- non-null buyer Search / Nearby price contract;
- Seller UI validation and remediation presentation;
- buyer Offer card without a no-price fallback;
- deterministic seed data in which both active seed Offers have prices;
- targeted unit, integration, migration-upgrade and E2E proof;
- one full branch CI, manual acceptance and normal merge/checkpoint gates.

## 4. Explicit out of scope

Not included:

- Seller Offer Workspace from Issue #27;
- Search Sorting A or Search Sorting B;
- price filters, price ranges or price comparison;
- canonical unit catalog, aliases, conversion or normalization beyond existing trim;
- making `unit` mandatory;
- multiple currencies or currency conversion;
- discounts, promotions, price history, taxes or inventory;
- SellerChangeSet presentation redesign;
- new ChangeSet statuses or cleanup of historical ChangeSets;
- AI input, media or Catalog redesign;
- general Offer/Seller/Search refactoring;
- rewriting migrations `0000` through `0009`;
- immediate deletion or fabricated backfill of legacy price-less data.

## 5. Revised closed contracts

This slice intentionally revises the following closed behavior.

### S0 / S1 — seeded Search behavior

The deterministic `Говядина` seed Offer remains buyer-visible with exact synthetic fixture price `3900.00 KZT` and `unit = null`, proving total/package-price presentation.

The closed acceptance expectation:

```text
говядина -> Offer -> "Цена не указана"
```

is superseded by:

```text
говядина -> Offer -> numeric KZT price without "/ unit" when unit = null
```

Freshness and lifecycle boundary semantics remain unchanged.

### S4 — single create

Superseded behavior:

```text
price is optional/nullable
```

New behavior:

```text
price is a required non-null object
unit inside price remains optional/nullable
```

Missing or `null` price is rejected before a ChangeSet or Item is persisted.

### S5 — Offer management

Superseded behavior:

```text
update_offer.price = null clears price
```

New behavior:

```text
update_offer.price must be a non-null full-state price object
```

`sellerComment` remains a required key and may remain `null`. Full-state update, semantic no-op detection, expected revision and stale-proposal behavior remain unchanged.

`activate_offer` for a legacy price-less Offer is rejected before a new ChangeSet is created.

New `deactivate_offer` and `activate_offer` Items continue to snapshot the current server-owned price. Under this slice every newly created status-action Item therefore contains a non-null amount and KZT currency; historical Items remain readable unchanged.

### S12 — batch Seller Input

For each batch Item:

- `create_offer.price` becomes required and non-null;
- `update_offer.price` remains a required key and becomes non-null;
- one invalid Item rejects the whole request before persistence;
- confirmation remains all-or-nothing.

### S7 / S9 / S10 / S11 / UX1B / UX1D — buyer projection

Buyer-facing `SearchOffer.price` changes from:

```text
Price | null
```

to:

```text
Price
```

Search and Nearby never return a price-less Offer. Buyer Offer cards always render a numeric amount and currency. When `unit = null`, no `/ unit` suffix is shown.

Search matching, buyer-visibility predicate, lifecycle cutoff, ranking, contacts, route action, interests and privacy remain unchanged.

## 6. Preserved contracts

The following guarantees remain closed and unchanged:

- `Seller Input -> SellerChangeSet -> SellerChangeItem -> confirmation/apply -> Offer`;
- Seller UI never writes Offer directly;
- current User and Seller are resolved server-side;
- Seller/Location/Offer ownership and foreign/not-found privacy;
- S6 Product resolution and alias semantics;
- persisted proposal, addressable review and explicit confirmation;
- transaction atomicity;
- repeated confirmation idempotency and concurrency guarantees;
- `Offer.revision`, expected revision and stale-proposal protection;
- S12 all-or-nothing batch confirmation;
- deactivation and activation semantics for priced Offers;
- immutable Product/Seller/Location identity during Offer update;
- optional Seller comment and comment clearing;
- KZT as server-owned currency;
- S1 expiration/freshness behavior;
- S9 distance/freshness ordering and deterministic tie-breaker;
- S10 public contact projection;
- S11 Nearby composition/ranking, except that returned price is now non-null;
- S13 Interests behavior;
- anonymous Search and existing Auth/session boundaries.

## 7. Public API changes

No new endpoint is added.

### Single create

`POST /api/seller/change-sets`

Accepted price shape:

```json
{
  "productName": "Баранина",
  "locationId": "uuid",
  "price": {
    "amount": "4500.00",
    "unit": "кг"
  },
  "sellerComment": "Свежая партия"
}
```

`price` missing or `null` returns the existing strict-validation response:

HTTP `400`

```json
{ "error": { "code": "INVALID_CHANGE_SET_INPUT", "message": "Проверьте товар, точку и цену." } }
```

### Single update

`POST /api/seller/offers/{id}/change-sets`

`update_offer.price` remains a required key and must contain a price object. `price: null` returns:

HTTP `400`

```json
{ "error": { "code": "INVALID_OFFER_CHANGE_INPUT", "message": "Проверьте данные изменения предложения." } }
```

### Batch create/update

`POST /api/seller/change-sets/batch`

Missing/null price in any `create_offer` or `update_offer` Item returns:

HTTP `400`

```json
{ "error": { "code": "INVALID_BATCH_CHANGE_SET_INPUT", "message": "Проверьте пакет изменений." } }
```

No ChangeSet or Item is persisted.

### Legacy activation / confirmation

Attempting to create an `activate_offer` proposal for a legacy price-less Offer returns:

HTTP `409`

```json
{ "error": { "code": "OFFER_PRICE_REQUIRED", "message": "Укажите цену предложения перед публикацией." } }
```

Confirming a persisted legacy `create_offer`, `update_offer` or `activate_offer` proposal that would leave the Offer without price returns the same `409` response. The ChangeSet stays `proposed`; Offer and linked Items remain unchanged.

For management proposals, existing ownership, target existence and expected-revision checks run first. A proposal made stale by migration remediation continues to return `OFFER_CHANGED` rather than hiding the stale revision behind the price error.

## 8. Seller and buyer DTO boundary

### Buyer

`SearchOffer.price` is non-null. Search and Discovery repository projections must reject impossible stored price shape rather than manufacture a fallback.

The validated active-price DB constraint makes an active price-less row impossible after migration. Existing S1/S7 buyer-visibility predicates stay unchanged; repository projections throw on impossible stored price shape instead of silently hiding corruption.

### Seller

`SellerOfferView.price` remains nullable during the transitional legacy-remediation phase because Seller must be able to see and repair quarantined inactive rows.

Seller UI displays a clear `Требуется цена` state for that legacy row, allows priced edit, and does not offer successful activation until price is repaired.

`SellerChangeSetView.price` also remains nullable so historical ChangeItems remain readable. New create/update Items are always priced.

No fabricated price is projected into either DTO.

## 9. Forward migration contract

Add exactly one migration after `0009`, expected name:

```text
0010_mandatory_offer_price.sql
```

Historical migrations remain byte-for-byte unchanged.

Migration order:

1. Abort migration with an explicit diagnostic if any Offer has `price_amount IS NULL` while `price_currency` or `price_unit` is non-null. Such an anomalous tuple is not silently normalized; it requires operator review before retry.
2. For every active row with `price_amount IS NULL`:
   - set `status = 'inactive'`;
   - increment `revision` by `1`;
   - set `updated_at = CURRENT_TIMESTAMP`.
3. Add and validate named constraint `offers_active_price_required` equivalent to:

```sql
status <> 'active' OR price_amount IS NOT NULL
```

4. Add named constraint `offers_future_price_required` to `offers`, equivalent to:

```sql
price_amount IS NOT NULL
```

with `NOT VALID`. Historical inactive violating rows remain stored, while every inserted or subsequently updated row must contain an amount.
5. Add named constraint `seller_change_items_future_price_required`, equivalent to `price_amount IS NOT NULL`, with `NOT VALID` to `seller_change_items`. Historical Items remain stored; every new create/update/status Item must snapshot a price.

The physical columns remain nullable in this slice. Drizzle table fields must not use `.notNull()` while legacy violating rows are intentionally preserved. Named Drizzle checks mirror the migration constraints.

The migration must preserve:

- Offer IDs and all foreign keys;
- Product, Seller and Location links;
- price tuple, comments and timestamps except the intentional `status`, `revision` and `updated_at` changes on quarantined active rows;
- historical ChangeSets/Items and result/target links;
- priced Offer values and revisions;
- inactive legacy price-less rows.

This slice closes the publishability invariant, not physical cleanup of all legacy rows. Checkpoint evidence records the remaining count:

```sql
SELECT count(*) FROM offers WHERE price_amount IS NULL;
```

If the count is non-zero in any target environment, a linked follow-up remediation issue must exist before this slice closes. A later cleanup migration may validate the future-write constraints and set physical columns `NOT NULL` only after explicit evidence shows zero remaining legacy rows. That cleanup is not part of this slice.

## 10. Confirmation and atomicity rules

Confirmation revalidates the mandatory-price invariant from persisted Item data; request-time validation alone is insufficient.

After current ownership, target existence and expected-revision validation, but before any DB write to Offer, ChangeItem or ChangeSet, confirmation validates every locked Item in the batch:

- `create_offer` Item must contain amount and `KZT` currency;
- `update_offer` Item must contain amount and `KZT` currency;
- `activate_offer` target Offer and persisted Item snapshot must contain amount and `KZT` currency;
- `deactivate_offer` preserves the target's existing price snapshot.

If one Item in a batch fails price validation, no Item applies, no result link is written and the ChangeSet remains `proposed`.

No raw PostgreSQL constraint error may escape as a generic `503` for this known legacy condition. The application guard must return `OFFER_PRICE_REQUIRED` before any attempt to update an old violating Item, including `result_offer_id` linkage.

Migration revision increment deliberately invalidates pre-migration management proposals against an active price-less Offer through the existing stale-proposal contract.

Already-confirmed historical ChangeSets remain readable and idempotent: repeated confirmation performs no Item/Offer mutation and returns the existing result even if a historical Item contains `price_amount IS NULL`.

## 11. Exact file whitelist

### Documentation and migration

- `docs/slices/mandatory-offer-price/SLICE_CONTRACT.md`;
- `docs/slices/mandatory-offer-price/VERIFICATION.md`;
- `drizzle/migrations/0010_mandatory_offer_price.sql`;
- `drizzle/migrations/meta/_journal.json`.

Historical migrations `0000` through `0009` and their snapshots are forbidden.

### Production

- `src/db/seed.ts`;
- `src/modules/offers/db/offers.table.ts`;
- `src/modules/offers/contracts/seller-offer.contract.ts`;
- `src/modules/offers/application/list-owned-offers.ts`;
- `src/modules/offers/infrastructure/offers.repository.ts`;
- `src/modules/seller-input/db/seller-change-items.table.ts`;
- `src/modules/seller-input/contracts/seller-change-set.contract.ts`;
- `src/modules/seller-input/application/create-seller-change-set.ts`;
- `src/modules/seller-input/application/create-offer-management-change-set.ts`;
- `src/modules/seller-input/application/create-batch-seller-change-set.ts`;
- `src/modules/seller-input/application/confirm-seller-change-set.ts`;
- `src/modules/search/contracts/search.contract.ts`;
- `src/modules/search/infrastructure/search.repository.ts`;
- `src/modules/discovery/infrastructure/discovery.repository.ts`;
- `src/app/api/seller/offers/[id]/change-sets/route.ts`;
- `src/app/api/seller/change-sets/[id]/confirm/route.ts`;
- `src/app/seller/_components/SellerChangeSetCreate.tsx`;
- `src/app/seller/_components/SellerOfferManagement.tsx`;
- `src/app/seller/_components/SellerBatchChangeSetCreate.tsx`;
- `src/app/seller/change-sets/[id]/_components/SellerChangeSetReview.tsx`;
- `src/app/seller/page.module.css`;
- `src/app/_components/OfferCard.tsx`;
- `src/app/page.module.css`.

`src/modules/offers/visibility/buyer-offer-visibility.ts` is intentionally not included because buyer-visibility semantics stay unchanged.

### Unit tests

- `tests/unit/seller-change-set-validation.test.ts`;
- `tests/unit/seller-offer-management-validation.test.ts`;
- `tests/unit/s12-batch-seller-input.test.ts`;
- `tests/unit/s9-search-ranking.test.ts`;
- `tests/unit/s10-public-contact-projection.test.ts`;
- `tests/unit/s11-nearby-discovery.test.ts`.

### Integration and migration tests

- `tests/integration/mandatory-offer-price-migration-upgrade.test.ts`;
- `tests/integration/offer-lifecycle.test.ts`;
- `tests/integration/search.test.ts`;
- `tests/integration/s1-migration-upgrade.test.ts`;
- `tests/integration/s2-migration-upgrade.test.ts`;
- `tests/integration/s3-migration-upgrade.test.ts`;
- `tests/integration/s4-migration-upgrade.test.ts`;
- `tests/integration/s5-migration-upgrade.test.ts`;
- `tests/integration/s6-migration-upgrade.test.ts`;
- `tests/integration/s8-migration-upgrade.test.ts`;
- `tests/integration/s10-migration-upgrade.test.ts`;
- `tests/integration/s6-search-aliases.test.ts`;
- `tests/integration/s6-seller-input-aliases.test.ts`;
- `tests/integration/s8-location-geo.test.ts`;
- `tests/integration/s9-search-ranking.test.ts`;
- `tests/integration/s10-search-contact-projection.test.ts`;
- `tests/integration/s11-nearby-discovery.test.ts`;
- `tests/integration/ux1d-buyer-offer-actionability.test.ts`;
- `tests/integration/seller-change-set.test.ts`;
- `tests/integration/seller-change-set-concurrency.test.ts`;
- `tests/integration/seller-offer-management.test.ts`;
- `tests/integration/seller-offer-management-concurrency.test.ts`;
- `tests/integration/s12-batch-seller-input.test.ts`;
- `tests/integration/s12-batch-ownership.test.ts`;
- `tests/integration/s12-batch-concurrency.test.ts`.

### E2E tests

- `tests/e2e/offer-lifecycle.spec.ts`;
- `tests/e2e/search.spec.ts`;
- `tests/e2e/s6-catalog-aliases.spec.ts`;
- `tests/e2e/s7-real-seller-search.spec.ts`;
- `tests/e2e/s9-search-ranking.spec.ts`;
- `tests/e2e/s11-nearby-discovery.spec.ts`;
- `tests/e2e/ux1d-buyer-offer-actionability.spec.ts`;
- `tests/e2e/seller-change-set.spec.ts`;
- `tests/e2e/seller-offer-management.spec.ts`;
- `tests/e2e/s12-batch-seller-input.spec.ts`.

Some whitelisted regression fixtures may require only mechanical replacement of legacy no-price data. Assertions unrelated to the revised contracts must remain semantically unchanged.

Any required production, migration, documentation or test file outside this whitelist triggers STOP/review before modification.

## 12. Risk flags

| Risk | Status | Required proof |
|---|---|---|
| closed contract revision | YES | explicit approval of Sections 2, 5 and 9 |
| DB migration | YES | PostgreSQL 18 upgrade proof + clean chain |
| data migration/state change | YES | quarantine + exact revision/timestamp proof |
| data loss | NO | no delete, fabricated value or silent anomaly normalization |
| public API/DTO | YES | strict input + non-null buyer projection tests |
| ownership/privacy | touched | existing ownership regression |
| concurrency/atomicity | touched | existing S4/S5/S12 proof + invalid batch rollback |
| external service | NO | none |

## 13. Acceptance criteria

1. Single and batch create without price are rejected before persistence.
2. Single and batch update with `price: null` are rejected before persistence.
3. Priced create/update keep server-owned KZT and allow `unit = null` with total/package-price meaning.
4. Active Offer without amount is impossible at DB boundary.
5. Every new Offer, including an inactive Offer written directly at DB boundary, requires an amount.
6. Migration deletes no Offer, fabricates no amount/unit and refuses anomalous partial price tuples instead of silently normalizing them.
7. Existing active price-less Offer becomes inactive, gets exactly `revision + 1` and a new `updated_at`, while identity, links, comment and `last_confirmed_at` remain unchanged.
8. Existing inactive price-less Offer remains readable only to Seller for remediation and never enters buyer Search/Nearby.
9. Legacy price-less Offer cannot activate before a priced update.
10. Seller can repair legacy Offer through priced update and then activate it through the existing separate ChangeSet flow.
11. Persisted legacy no-price proposal cannot apply; error precedence preserves existing stale-revision behavior.
12. New priced deactivate/activate Items snapshot price and keep existing status-action behavior.
13. One invalid no-price Item prevents the entire batch from applying.
14. Search and Nearby response prices are always non-null.
15. Buyer card always shows numeric amount/currency; null unit adds no suffix.
16. Seed `Говядина` is deterministic at `3900.00 KZT`, `unit = null`; clean migration/seed creates no active price-less Offer.
17. Checkpoint evidence records remaining legacy-null count and links a follow-up remediation issue when it is non-zero.
18. Existing ownership, revision, idempotency, concurrency, lifecycle, ranking, contacts and Interests contracts remain green.

## 14. Automated verification plan

### Unit

- missing/null single-create price rejected;
- null single-update price rejected;
- missing/null batch create/update price rejected;
- amount boundaries including `0` preserved;
- missing/blank/null unit normalizes to `null`;
- comment clear behavior preserved;
- priced no-op comparison preserved.

### PostgreSQL 18 migration upgrade

Migrate through `0009`, insert representative:

- active legacy price-less Offer at revision `N`;
- inactive legacy price-less Offer with a clean all-null price tuple;
- priced Offer with `unit = null`;
- proposed `create_offer` Item with null price;
- proposed `update_offer` and `activate_offer` Items against an inactive null-price Offer whose revision does not change;
- proposed management Item against an active null-price Offer whose revision will be bumped by migration;
- confirmed historical null-price Item with an existing result link.

Then migrate through `0010` and prove:

- active price-less row is inactive with revision exactly `N + 1` and changed `updated_at`;
- its `last_confirmed_at`, IDs, FKs, Product/Seller/Location links and comment remain unchanged;
- inactive legacy row and historical Items remain stored;
- priced row is unchanged;
- `offers_active_price_required.convalidated = true`;
- `offers_future_price_required.convalidated = false`;
- `seller_change_items_future_price_required.convalidated = false`;
- historical violating rows remain readable;
- new active and inactive null-price Offer inserts fail with `23514` and named constraint;
- unrelated/no-op UPDATE of a historical null-price Offer fails with `23514`;
- atomic remediation UPDATE that sets amount and currency succeeds;
- new null-price ChangeItem insert and later UPDATE of a historical null-price Item fail with `23514` and named constraint;
- new priced status-action Item succeeds;
- new priced row with `unit = null` succeeds;
- IDs, links and unrelated data survive;
- clean full migration chain succeeds on PostgreSQL 18.

A separate upgrade case inserts `price_amount IS NULL` with stray non-null currency/unit and proves `0010` aborts with the explicit diagnostic before changing that row.

### Integration

- single create requires price and persists nothing on rejection;
- update cannot clear price;
- comment can still be cleared while preserving a price;
- activation of legacy no-price Offer returns `OFFER_PRICE_REQUIRED` with no ChangeSet;
- legacy inactive Offer can be updated with price and later activated;
- proposed legacy `create_offer`, same-revision `update_offer` and same-revision `activate_offer` with no price return `OFFER_PRICE_REQUIRED` before any DB write;
- proposal targeting an active legacy null-price Offer becomes stale after migration and returns `OFFER_CHANGED` first;
- repeated confirmation of a confirmed historical null-price Item remains readable/idempotent without mutation;
- priced `deactivate_offer` snapshots price and confirms normally;
- batch containing one invalid no-price Item persists/applies nothing;
- confirmation remains atomic under one invalid persisted Item;
- Search and Nearby exclude legacy price-less rows and return non-null price;
- existing ownership, repeated confirmation and concurrency proofs remain valid.

### E2E

On representative mobile and desktop viewports:

```text
login
-> attempt single create with blank price and remain on form with error
-> create with amount and no unit
-> review/reload/confirm
-> find buyer card with numeric price and no unit suffix
-> edit Offer and verify blank price cannot create proposal
```

Batch E2E proves a missing price in one create/update Item blocks the package before review.

A controlled legacy fixture proves the remediation UI:

```text
quarantined inactive price-less Offer is absent from buyer Search/Nearby
-> Seller sees "Требуется цена"
-> activation is unavailable/rejected
-> Seller submits priced update and confirms it while Offer remains inactive
-> Seller creates and confirms a separate activation
-> buyer can see the now-priced Offer
```

### Regression and manual gate

1. targeted unit/integration/migration/E2E proof;
2. one full branch CI on final executable SHA;
3. make that exact SHA available in a real browser;
4. manual acceptance of the user flow above;
5. pre-merge diff audit;
6. merge to `main`;
7. merged-main CI green;
8. annotated checkpoint tag;
9. tag-triggered CI green if the workflow runs on tags.

## 15. STOP conditions

Implementation stops before expanding scope if any of the following is required:

- changing historical migrations;
- fabricating or deleting a legacy price;
- silently normalizing an anomalous partial legacy price tuple;
- making unit mandatory or introducing unit taxonomy/conversion;
- changing amount `0` semantics;
- changing Seller Offer Workspace presentation/confirmation flow;
- adding sorting/filtering;
- weakening ownership, ChangeSet boundary, atomicity, idempotency or revision checks;
- making Search/Discovery behavior change beyond mandatory non-null price projection;
- requiring an immediate physical `NOT NULL` without an approved remediation source.

## 16. Product review gate

Implementation is intentionally paused until Product Owner explicitly approves all three decisions:

1. `unit = null` means total/package/lot price and remains allowed;
2. legacy active no-price Offers are quarantined to `inactive`, while legacy inactive rows remain temporarily nullable and repairable;
3. DB rollout uses validated active-price enforcement plus `NOT VALID` future-write checks, followed by a later cleanup only after legacy remediation reaches zero.

Current gate:

`DRAFT — STOP / PRODUCT REVIEW REQUIRED`

`PRODUCTION IMPLEMENTATION NOT AUTHORIZED`
