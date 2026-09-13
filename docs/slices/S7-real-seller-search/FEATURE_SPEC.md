# S7 Feature Spec — Real seller Offers search

**Status:** DESIGN APPROVED; CONTRACT STAGE AUTHORIZED; IMPLEMENTATION BLOCKED  
**Base checkpoint:** `v0.0.7-s6`  
**Base main:** `6f5e0ca7e1b7aca945f344e2527d5aa626c9e29c`  
**Branch:** `slice/s7-real-seller-search`

## 1. User task

Buyer must be able to find through the existing Search an Offer that a real Seller created through the existing Seller ChangeSet flow.

Canonical end-to-end flow:

```text
authenticated Seller
→ Seller Input
→ proposed SellerChangeSet
→ explicit confirmation
→ ordinary Offer in existing offers table
→ Buyer Search
→ Catalog resolver
→ canonical Product
→ existing Offer read
→ Buyer sees that exact Seller-created Offer
```

Acceptance example:

```text
Seller:
мясо барана
→ canonical Баранина
→ proposed ChangeSet
→ confirm
→ Offer

Buyer:
Баранина
or
мясо барана
→ same exact Seller-created Offer
```

Then:

```text
Seller:
propose deactivate
→ Buyer still sees committed Offer
→ confirm deactivate

Buyer:
canonical or alias Search
→ exact Seller-created Offer is absent
```

S7 does not create a new Search architecture. It promotes the already existing cross-slice behavior to an explicit production contract.

## 2. Design finding

The approved design conclusion is:

```text
S7 gap = contract/proof gap, not production architecture gap
```

Current main already has the required production chain:

```text
Seller ChangeSet
→ confirmation
→ ordinary Offer
→ existing Search
→ Catalog resolver
→ product_id
→ same offers table
→ S1 lifecycle
→ Buyer
```

Therefore expected S7 production diff is:

```text
0 files
```

No production change is allowed merely to create visible S7 implementation work.

## 3. Existing contracts reused unchanged

### S1 lifecycle

Buyer Search visibility remains exactly:

```text
status = active
AND
last_confirmed_at > freshness cutoff
```

Inactive and expired Offers remain hidden.

### S4 create flow

Seller never writes Offer directly.

Creation remains:

```text
Seller Input
→ proposed ChangeSet
→ explicit confirmation
→ Offer creation
```

Before confirmation the result Offer does not exist.

### S5 management

Existing Offer changes remain:

```text
Seller management action
→ proposed ChangeSet
→ explicit confirmation
→ mutation of same Offer
```

S7 relies on existing committed-state semantics:

```text
proposed deactivate
→ Buyer still sees prior committed Offer

confirmed deactivate
→ Buyer no longer sees that Offer
```

### S6 Product resolution

Product resolution remains:

```text
human term
→ one Catalog resolver
→ canonical Product
```

Seller proposal stores canonical `product_id`.

Buyer Search resolves canonical names and aliases to the same canonical Product ID.

Alias never becomes Offer identity.

## 4. Scope

S7 includes only:

- dedicated proof that a Seller-created Offer becomes part of normal Buyer Search immediately after successful confirmation;
- proof through the real application-layer Seller flow, not direct Offer fixture insertion;
- canonical Product Search for that exact Seller-created Offer;
- S6 alias Search for that exact same Offer;
- proof that both searches identify the same exact `resultOffer.id`;
- proof that before confirmation Buyer Search does not contain an Offer belonging to this test Seller proposal;
- proof that proposed S5 deactivation does not change Search;
- proof that confirmed S5 deactivation removes that exact Offer from canonical and alias Search;
- independent Seller and Buyer browser contexts in E2E;
- deterministic, isolated test fixtures;
- full S0-S6 regression verification;
- manual acceptance of the same end-to-end behavior.

## 5. Pre-confirmation identity rule

Before confirmation the new Offer does not exist and no result Offer ID is known.

Therefore S7 must not attempt to assert absence through a future Offer ID.

Pre-confirmation absence must be established using unique test-owned identity, for example the combination:

```text
unique Seller
+ unique Location
+ unique sellerComment
```

The test must prove that Buyer Search contains no Offer belonging to this unique test Seller/proposal identity before confirmation.

After successful confirmation, S7 captures the persisted exact:

```text
resultOffer.id
```

All subsequent canonical/alias visibility assertions are based on that exact ID.

## 6. Result-set rules

S7 explicitly does not assert any of the following:

```text
offers.length === 1
created Offer === offers[0]
Search is globally empty
```

Seed Offers and Offers created by other legal flows may coexist.

S7 checks only the presence or absence of the exact test Seller-created Offer.

S7 owns no ranking or ordering contract.

## 7. Search source of truth

There is one normal Buyer Search read source:

```text
existing offers table
```

Seller-created Offer and seed Offer are the same commercial entity type.

S7 must not add or require:

```text
SearchOffer
PublishedOffer
SellerSearchOffer
search index entity
published flag
searchable flag
source flag
publish step
indexing step
background synchronization
```

After the Seller confirmation transaction commits, the existing Search is expected to read the committed Offer directly.

## 8. Acceptance Criteria

S7 may be accepted only if all of the following are proven.

1. Base remains `6f5e0ca7e1b7aca945f344e2527d5aa626c9e29c`.
2. Historical migrations `0000-0006` remain unchanged.
3. Production `src/**` remains unchanged unless a separately approved production defect is discovered.
4. Seller uses the existing application-layer create ChangeSet flow.
5. Seller Product input may use S6 alias `мясо барана`.
6. Proposal resolves to canonical Product `Баранина` before persistence.
7. Before confirmation there is no result Offer for the proposal.
8. Pre-confirmation Search absence is asserted by unique test-owned Seller/Location/comment identity, not a future Offer ID and not global Offer count.
9. Successful confirmation returns/persists an exact `resultOffer.id`.
10. Created Offer is an ordinary row in the existing Offer model.
11. No separate publish/index action is required after confirmation.
12. Buyer canonical Search for `Баранина` contains the exact captured `resultOffer.id`.
13. Buyer alias Search for `мясо барана` contains the exact same `resultOffer.id`.
14. Both Search responses expose canonical Product `Баранина`.
15. Result ordering is not asserted.
16. Global result count is not asserted.
17. Presence of seed Offers is not treated as failure.
18. Seller creates an S5 deactivate proposal for the exact Offer.
19. Before deactivation confirmation Buyer Search still contains the exact Offer.
20. After deactivation confirmation canonical Search no longer contains the exact Offer ID.
21. After deactivation confirmation alias Search no longer contains the exact Offer ID.
22. Other Offers may remain visible after deactivation.
23. Existing S1 lifecycle remains the sole Buyer visibility contract.
24. Existing S5 update/activate regressions remain green.
25. Existing S6 canonical/alias resolver behavior remains green.
26. Search API contract remains unchanged.
27. Seller API contracts remain unchanged.
28. Buyer UI remains unchanged.
29. Seller UI remains unchanged.
30. Full S0-S6 regression suite remains green.
31. Dedicated S7 integration proof passes.
32. Dedicated S7 E2E proof passes on mobile and desktop.
33. Manual acceptance passes with independent Seller and Buyer browser contexts.

## 9. Manual acceptance scenario

Use two independent browser contexts.

### Seller context

```text
1. Log in with existing test OTP flow.
2. Create or use a unique owned Seller and Location for this acceptance run.
3. Enter Product term: мясо барана.
4. Use a unique seller comment for this run.
5. Create proposed ChangeSet.
6. Verify preview displays canonical Баранина.
7. Do not confirm yet.
```

### Buyer context before confirmation

```text
8. Open normal Buyer Search without using Seller browser state.
9. Search Баранина.
10. Verify no returned Offer belongs to the unique test Seller/proposal identity.
```

### Seller confirmation

```text
11. Confirm the ChangeSet.
12. Capture the created exact result Offer ID from persisted result.
```

### Buyer after confirmation

```text
13. Search Баранина.
14. Verify exact result Offer is present.
15. Search мясо барана.
16. Verify the same exact Offer is present.
17. Verify displayed Product is Баранина.
```

### Seller deactivation proposal

```text
18. Create deactivate ChangeSet for this exact Offer.
19. Do not confirm yet.
```

### Buyer before deactivate confirmation

```text
20. Repeat Search.
21. Exact Offer remains visible.
```

### Seller deactivate confirmation

```text
22. Confirm deactivate.
```

### Buyer after deactivate confirmation

```text
23. Search Баранина.
24. Exact Offer ID is absent.
25. Search мясо барана.
26. Exact same Offer ID is absent.
```

Other Offers for Баранина may remain visible and are not failures.

## 10. Database / migration / API / UI decision

S7 requires no persistent data-model change.

```text
DB changes: no
migration 0007: no
API changes: no
UI changes: no
production code changes: expected none
```

Historical migrations `0000-0006` are immutable.

## 11. Explicit Out of Scope

S7 excludes:

- Geo;
- coordinates;
- distance;
- nearby search;
- distance sorting;
- S8;
- S9 ranking work;
- Discovery;
- recommendations;
- interests/follow Product;
- personalization;
- query history;
- search learning;
- autocomplete;
- fuzzy search;
- typo correction;
- semantic/AI search;
- embeddings;
- notifications;
- contacts / WhatsApp / Telegram / Instagram actions;
- reviews;
- ratings;
- moderation;
- seller media;
- AI Seller Input;
- Telegram bot;
- monetization;
- promotion;
- categories/taxonomy;
- admin UI;
- redesign;
- new ranking algorithm;
- generic indexing/search framework;
- Offer tuple deduplication;
- new Search persistence;
- new Offer publication state.

## 12. Gate

This document records the approved S7 design only.

Implementation remains blocked until:

```text
S7 CONTRACT APPROVED → TEST-ONLY IMPLEMENTATION AUTHORIZED
```
