# S7 Implementation Contract — Real seller Offers search

**Status:** READY FOR CONTRACT APPROVAL; IMPLEMENTATION BLOCKED  
**Feature Spec:** DESIGN APPROVED  
**Base checkpoint:** `v0.0.7-s6`  
**Base main:** `6f5e0ca7e1b7aca945f344e2527d5aa626c9e29c`  
**Branch:** `slice/s7-real-seller-search`

## 1. Hard boundary

S7 is a contract/proof slice.

Approved conclusion:

```text
S7 gap = contract/proof gap, not production architecture gap
```

The current production path already is:

```text
Seller ChangeSet
→ explicit confirmation
→ ordinary Offer
→ existing Search
→ Catalog resolver
→ canonical product_id
→ same offers table
→ S1 lifecycle
→ Buyer
```

S7 test-only implementation must prove this exact behavior without introducing a parallel system.

## 2. Production whitelist

Production whitelist is exactly:

```text
EMPTY
```

No `src/**` file is pre-authorized for modification.

No migration, schema, seed, API, UI, dependency, Playwright configuration or CI workflow change is pre-authorized.

If proof reveals a real production defect, this whitelist does not expand automatically. The implementer must stop, classify the defect, identify the smallest required production change and request a separate scope expansion.

## 3. Allowed artifacts after next gate

Only after explicit:

```text
S7 CONTRACT APPROVED → TEST-ONLY IMPLEMENTATION AUTHORIZED
```

may the following test files be created:

```text
tests/integration/s7-real-seller-search.test.ts
tests/e2e/s7-real-seller-search.spec.ts
```

After successful implementation proof and before slice closure, the following documentation may later be added:

```text
docs/slices/S7-real-seller-search/VERIFICATION.md
```

No other implementation artifact is pre-authorized.

## 4. Closed files and contracts

The following remain closed for S7 unless a separately approved defect requires expansion:

```text
src/**

drizzle/migrations/0000_s0_first_search.sql
drizzle/migrations/0001_s1_offer_lifecycle.sql
drizzle/migrations/0002_s2_auth.sql
drizzle/migrations/0003_s3_seller_location.sql
drizzle/migrations/0004_s4_seller_change_set.sql
drizzle/migrations/0005_s5_offer_management.sql
drizzle/migrations/0006_s6_product_aliases.sql

drizzle/migrations/meta/**

src/db/schema.ts
src/db/seed.ts

package.json
pnpm-lock.yaml
playwright.config.ts
.github/**
```

Existing S0-S6 tests are also closed by default. They may not be edited simply to make S7 easier. If a new S7 proof exposes an objectively invalid legacy assertion, stop and classify it before changing an existing test.

Closed semantic contracts include:

```text
S1 lifecycle visibility
S4 ChangeSet-only Offer creation
S5 ChangeSet-only Offer management
S5 revision/concurrency semantics
S6 shared Catalog resolver
canonical Product identity
existing Search API
existing Search response shape
existing Buyer UI
existing Seller UI
existing result ordering semantics
```

## 5. No production architecture additions

S7 must not create or introduce:

```text
SearchOffer
PublishedOffer
SellerSearchOffer
search index entity
published flag
searchable flag
source flag
publish state
publish endpoint
indexing endpoint
background indexer
queue for publication
event-driven Search synchronization
Search shadow table
```

Offer remains the single commercial entity.

Required model:

```text
confirmed Offer
→ existing offers table
→ existing Search read
```

## 6. Existing write path is authoritative

Integration and E2E proof must use the real existing Seller flow.

Creation path:

```text
Seller Input
→ create SellerChangeSet
→ persisted proposed SellerChangeItem
→ explicit confirmSellerChangeSet
→ existing Offer repository
→ ordinary Offer
```

Management path:

```text
existing Offer
→ create S5 management ChangeSet
→ explicit confirmation
→ mutate same Offer
```

Forbidden proof shortcut:

```text
direct INSERT INTO offers as substitute for Seller flow
```

Direct SQL may be used only for narrow test setup/cleanup or persisted-state inspection where it does not replace the application-layer business path being proved.

## 7. Product resolution contract

S7 does not implement Product matching.

Both Seller creation and Buyer Search continue to use the existing S6 Catalog resolver:

```text
human term
→ Catalog resolver
→ canonical Product
```

For the approved acceptance fixture:

```text
мясо барана
→ Баранина
```

SellerChangeItem persists canonical Product ID.

Buyer canonical search and alias search must resolve to that same canonical Product ID.

Alias is never Offer identity.

## 8. Lifecycle contract

S7 reuses S1 without modification:

```text
visible Offer =
status = active
AND
last_confirmed_at > freshness cutoff
```

S7 must not duplicate lifecycle logic in tests as a second implementation.

Tests should drive the application and observe Search behavior.

Controlled clocks should be used where application APIs already permit them so freshness assertions do not depend on wall-clock timing.

## 9. Pre-confirmation identity rule

Before successful Seller confirmation:

```text
result Offer does not exist
result Offer ID is unknown
```

Therefore tests must not attempt to prove absence through a future Offer ID.

They also must not use global assumptions such as:

```text
offers.length === 0
Search is empty
global offers count unchanged in isolation from parallel legal flows
```

The approved pre-confirmation identity is a unique test-owned combination such as:

```text
unique Seller display name
+ unique Location name/address
+ unique sellerComment
```

Buyer Search before confirmation must be checked for the absence of an Offer belonging to that unique test identity.

After confirmation, capture exact persisted:

```text
resultOffer.id
```

From that point onward all visibility assertions must use the exact ID wherever the layer exposes it, with Seller identity as an additional human-readable E2E discriminator.

## 10. Result-set and ranking rules

S7 must never assert:

```text
offers.length === 1
created Offer === offers[0]
Search becomes globally empty
created Offer is first
seed Offer disappears
```

Seed and other legal Offers may coexist.

S7 owns only:

```text
presence / absence of exact test Offer
```

No ranking, ordering or result-count contract is introduced.

## 11. Integration test contract

Authorized future file:

```text
tests/integration/s7-real-seller-search.test.ts
```

The test must use the real application-layer Seller flow.

### 11.1 Setup

Create an isolated authenticated User / owned Seller / owned Location through existing supported setup paths or existing test helpers that exercise the real application behavior.

Use unique values for at least:

```text
Seller display name
Location name/address
sellerComment
```

Reuse existing Catalog fixture:

```text
canonical Product: Баранина
alias: мясо барана
```

Do not create a parallel Product resolution fixture unless isolation requires it.

### 11.2 Proposal phase

Create Seller proposal using application layer:

```text
createSellerChangeSet(... productName = "мясо барана" ...)
```

Assert persisted proposal resolves to canonical Product `Баранина`.

Before confirmation:

```text
Buyer Search does not contain an Offer belonging to this unique test Seller/proposal identity
```

Do not assert future Offer ID.

Do not assert global result count.

### 11.3 Confirmation phase

Confirm through existing application layer:

```text
confirmSellerChangeSet(...)
```

Capture exact:

```text
resultOffer.id
```

Assert the persisted result uses canonical Product ID.

### 11.4 Canonical Buyer Search

Run existing:

```text
searchOffers("Баранина", ...)
```

Assert returned Offers contain exact captured `resultOffer.id`.

Do not assert its array position.

### 11.5 Alias Buyer Search

Run existing:

```text
searchOffers("мясо барана", ...)
```

Assert returned Offers contain exact same captured `resultOffer.id`.

Assert returned Product is canonical:

```text
name = Баранина
```

### 11.6 Proposed deactivate

Create an S5 management ChangeSet for the exact Offer:

```text
action = deactivate_offer
```

Before confirmation:

```text
canonical Search contains exact Offer ID
alias Search contains exact Offer ID
```

### 11.7 Confirmed deactivate

Confirm that S5 ChangeSet through existing confirmation flow.

After successful confirmation:

```text
canonical Search does not contain exact Offer ID
alias Search does not contain exact Offer ID
```

Other Offers may remain in both responses.

### 11.8 Cleanup

Cleanup must be scoped to the test-owned User/Seller resources.

Do not clear global Offers, Products, seed Seller or shared Catalog fixtures.

## 12. E2E test contract

Authorized future file:

```text
tests/e2e/s7-real-seller-search.spec.ts
```

The E2E proof must run through existing UI/API behavior and use two independent browser contexts.

### Seller browser context

Used for:

```text
login
Seller/Location setup
create Seller ChangeSet
review proposal
confirm create
create deactivate proposal
confirm deactivate
```

### Buyer browser context

A separate browser context is mandatory.

It must not rely on Seller context cookies, navigation state, React state or storage.

Used for:

```text
canonical Search
alias Search
presence/absence assertions
```

### Unique fixtures

Each E2E project/run must use unique values for:

```text
phone
Seller display name
Location name/address
sellerComment
```

Mobile and desktop runs must not collide.

### E2E sequence

Required sequence:

```text
Seller context:
login
→ setup unique Seller/Location
→ enter мясо барана
→ unique comment
→ create proposed ChangeSet
→ verify canonical Баранина preview

Buyer context:
search Баранина
→ no Offer belonging to unique test Seller/proposal identity

Seller context:
confirm create
→ Offer created
→ capture exact result Offer identity from persisted result/API where practical

Buyer context:
search Баранина
→ unique Seller-created Offer visible

Buyer context:
search мясо барана
→ same Seller-created Offer visible
→ canonical Баранина displayed

Seller context:
create deactivate proposal

Buyer context:
canonical / alias Search
→ same Offer still visible

Seller context:
confirm deactivate

Buyer context:
canonical / alias Search
→ exact Seller-created Offer absent
```

The E2E test must not assert ranking, global result count or complete Search emptiness.

## 13. Mobile and desktop requirement

Dedicated S7 E2E must run under the existing Playwright project matrix.

Required acceptance:

```text
mobile PASS
desktop PASS
```

Do not change `playwright.config.ts` for S7.

Do not serialize the suite merely to avoid isolation problems.

Use unique fixtures and scoped cleanup instead.

## 14. Existing S0-S6 regression requirement

Full existing regression suite remains mandatory.

No closed checkpoint is considered expendable for S7.

At minimum full project verification must continue to cover:

```text
migrations on PostgreSQL 18
lint
typecheck
unit
integration
build
E2E
full verify
```

S7 implementation is not accepted if any pre-existing valid S0-S6 contract becomes red.

## 15. Existing test edit rule

Existing S0-S6 tests are not part of the normal S7 whitelist.

If a new S7 test reveals that a pre-existing test assumes something no longer valid under already approved contracts, for example:

```text
exactly one Offer globally
unique Product result count
fixed global Offer count
```

then:

1. classify whether the failure is product defect, test harness defect or environmental failure;
2. do not edit the old test automatically;
3. report the exact invalid assertion and minimal required change;
4. request scope expansion before editing it.

## 16. Database and migration rule

S7 introduces no persistent data-model requirement.

Therefore:

```text
no DB change
no schema change
no 0007 migration
```

Historical migrations `0000-0006` remain immutable.

A migration must not be invented simply because S7 is a numbered slice.

## 17. API and UI rule

No API changes are expected or authorized.

Existing Search API remains the Buyer entry point.

Existing Seller ChangeSet and Offer management APIs remain the Seller paths.

No UI changes are expected or authorized.

Existing Buyer Search and Seller UI are used as the acceptance surface.

## 18. Production defect stop condition

If test-only implementation fails because current production behavior does not satisfy the approved contract, do not patch production immediately.

Required response:

```text
1. identify exact failing scenario;
2. classify defect layer;
3. show evidence that failure is production, not fixture/test isolation;
4. name the minimal production file(s) that would need modification;
5. explain why existing closed contract is insufficient;
6. stop before modification.
```

Production whitelist remains `EMPTY` until explicit controller approval.

## 19. Explicit Out of Scope

Do not implement:

- Geo;
- coordinates;
- distance;
- nearby Search;
- distance sorting;
- S8;
- S9 ranking;
- Discovery;
- recommendations;
- personalization;
- interests/follow Product;
- search learning;
- query history;
- autocomplete;
- fuzzy search;
- typo correction;
- semantic/AI Search;
- embeddings;
- notifications;
- contacts;
- reviews;
- ratings;
- moderation;
- seller media;
- AI Seller Input;
- Telegram bot;
- monetization;
- promotion;
- taxonomy/categories;
- admin UI;
- redesign;
- new generic Search/indexing framework;
- Offer publication subsystem;
- Offer tuple deduplication.

## 20. Contract-stage gate

At the current stage only these docs are authorized:

```text
docs/slices/S7-real-seller-search/FEATURE_SPEC.md
docs/slices/S7-real-seller-search/IMPLEMENTATION_CONTRACT.md
```

After these files are committed and CI is green, stop.

Next required authorization is exactly:

```text
S7 CONTRACT APPROVED → TEST-ONLY IMPLEMENTATION AUTHORIZED
```
