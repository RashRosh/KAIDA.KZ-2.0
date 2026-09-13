# S6 Feature Spec — Catalog Product / aliases

**Status:** DESIGN APPROVED; IMPLEMENTATION BLOCKED pending `S6 CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED`  
**Base checkpoint:** `v0.0.6-s5`  
**Base main:** `b43ca9a82a37a1298a06318aefc17d92ef7153ee`  
**Proof branch:** `slice/s6-catalog-aliases`

## 1. User task

Buyer or Seller may use a known non-canonical human term for an already existing Catalog Product, and KAIDA.KZ resolves that term to the canonical Product without creating or mutating Product automatically.

Acceptance example:

```text
мясо барана
→ Баранина
```

For S6:

```text
баран
```

is not added as an alias for `Баранина`.

Canonical user flows:

```text
Buyer Search term
→ Catalog resolver
→ canonical Product
→ existing Search Offer read
```

and:

```text
Seller create_offer Product term
→ Catalog resolver
→ canonical Product
→ SellerChangeItem.product_id
→ existing S4 confirmation path
```

## 2. Product value

S6 removes the requirement that a buyer or seller know the exact canonical Product spelling while preserving one canonical Catalog identity.

The central rule is:

```text
aliases resolve to Product
aliases never become commercial identity
```

Offer continues to reference only:

```text
canonical product_id
```

Search results and Seller ChangeSet preview continue to display canonical `Product.name`.

## 3. Scope

S6 includes only:

- existing `Product` as canonical Catalog entity;
- new Catalog-owned `ProductAlias` lookup entity;
- one Catalog-owned Product resolver shared by Search and S4 `create_offer` Seller Input;
- deterministic Product-term normalization;
- normalized canonical Product uniqueness at DB level;
- alias uniqueness only within the same `(normalized alias, product_id)` pair;
- intentional support for one normalized alias belonging to multiple Products;
- deterministic `not_found` / `resolved` / `ambiguous` resolution;
- Search resolution before Offer lookup;
- Seller Input resolution before SellerChangeItem persistence;
- one forward migration `0006`;
- one minimal deterministic alias seed fixture: `мясо барана → Баранина`;
- migration, integration and E2E verification after implementation authorization;
- full S0–S5 regression verification.

## 4. Catalog entities

### Product

`Product` remains the canonical Catalog entity.

Existing logical shape remains:

```text
Product
- id
- name
```

Rules:

- `Product.id` is stable canonical identity;
- `Product.name` is canonical display name;
- Offer references `Product.id` only;
- SellerChangeItem references `Product.id` only;
- aliases do not replace canonical names in UI or API responses.

### ProductAlias

S6 introduces:

```text
ProductAlias
- id
- product_id
- name
```

A Product may have multiple aliases.

An alias:

- belongs to Catalog;
- is only a lookup term;
- is not an Offer foreign key;
- is not a second Product identity;
- is not a display replacement for canonical Product name;
- has no rank, weight, language, source, status or moderation workflow in S6;
- cannot be created by Seller in S6.

## 5. Normalization contract

Authoritative normalized key is PostgreSQL 18, not JavaScript and not the database default collation.

Exact logical pipeline:

```text
btrim
→ NFC
→ Unicode full case folding under pg_catalog.pg_unicode_fast
→ NFC
```

Authoritative SQL expression:

```sql
normalize(
  casefold(
    normalize(btrim(value), NFC)
      COLLATE pg_catalog.pg_unicode_fast
  ),
  NFC
) COLLATE pg_catalog.pg_unicode_fast
```

`value` is replaced by Product name, ProductAlias name or incoming resolver term.

The explicit built-in `pg_catalog.pg_unicode_fast` semantics are required independently of the database default libc locale.

Normalization intentionally does not:

- collapse internal spaces;
- strip punctuation;
- map `е` to `ё`;
- transliterate;
- stem;
- tokenize;
- fuzzy-match;
- perform semantic/AI matching.

Required examples:

```text
БАРАНИНА == баранина
  Баранина   == баранина
NFC-composed == NFC-equivalent decomposed
е != ё
мясо барана != мясо  барана
баранина != баранина!
```

## 6. Resolver contract

There is one logical Catalog resolver used by both Search and S4 `create_offer`.

Algorithm:

```text
1. normalize input term
2. collect canonical Product.name matches
3. collect ProductAlias.name matches
4. combine both candidate sources
5. deduplicate by DISTINCT Product ID
6. classify by number of distinct Product IDs
```

Classification is exactly:

```text
0 distinct Products → not_found
1 distinct Product  → resolved(Product)
2+ distinct Products → ambiguous
```

Deduplication happens before ambiguity classification.

Therefore canonical-name and alias matches for the same Product do not create false ambiguity.

Example:

```text
Product A.name = Баранина
Product A.alias = баранина
```

resolves to Product A once.

Canonical/alias collision across different Products remains genuine ambiguity.

One normalized alias may intentionally belong to two or more Products and therefore produce `ambiguous`.

No Product is selected randomly.

## 7. Buyer Search behavior

Search public API contract remains unchanged.

Flow becomes:

```text
validated buyer term
→ Catalog resolver
→ canonical Product ID
→ existing visible Offer query by product_id
→ existing Search response
```

Results continue displaying canonical Product name.

`SearchResponse.query` remains the trimmed user query and is not replaced with the canonical name.

Resolution outcomes:

```text
resolved
→ existing visible Offers for canonical Product

not_found
→ existing 200 + offers: []

ambiguous
→ existing 200 + offers: []
```

S6 adds no disambiguation UI.

Existing S1 visibility semantics remain unchanged:

```text
status = active
AND
last_confirmed_at > cutoff
```

S6 does not change ranking or result ordering.

## 8. Seller Input behavior

Only the S4 `create_offer` Product-resolution point changes after implementation authorization.

Flow:

```text
seller Product term
→ Catalog resolver
→ canonical Product
→ persist canonical product_id in SellerChangeItem
```

Outcomes preserve existing public errors:

```text
not_found
→ PRODUCT_NOT_FOUND

ambiguous
→ PRODUCT_AMBIGUOUS

resolved
→ existing proposed ChangeSet flow
```

Failure creates no Product, ChangeSet, ChangeItem or Offer.

Once a proposed SellerChangeItem contains canonical `product_id`, resolution is not repeated during confirmation.

Existing S4/S5 confirmation semantics remain unchanged.

## 9. Database and migration intent

S6 will add exactly one forward migration after implementation authorization:

```text
drizzle/migrations/0006_s6_product_aliases.sql
```

Historical migrations:

```text
0000
0001
0002
0003
0004
0005
```

remain immutable.

### Canonical Product uniqueness

Existing exact `Product.name` uniqueness remains.

S6 adds DB-level uniqueness on the normalized Product name using the authoritative expression.

Therefore Products equivalent after S6 normalization cannot coexist.

### Alias uniqueness

The same normalized alias may not be duplicated for the same Product.

The same normalized alias may be associated with different Products.

Conceptually:

```text
UNIQUE(normalized_alias, product_id)
```

not:

```text
UNIQUE(normalized_alias)
```

## 10. Legacy normalized collisions

If an existing S5 database contains canonical Products that collide under the new S6 normalization, migration `0006` must fail.

Example:

```text
Баранина
баранина
```

S6 must not automatically:

- merge Products;
- rename Product;
- delete Product;
- reassign Offer.product_id;
- reassign SellerChangeItem.product_id.

Migration failure must be atomic: no partially installed S6 schema or partially modified data may remain committed.

The migration verification suite must prove this on PostgreSQL 18.

## 11. Concurrency

S6 adds no Catalog write UI or runtime alias-management flow.

Therefore S6 requires no new:

- advisory locks;
- Redis locks;
- global SERIALIZABLE isolation;
- generic concurrency framework.

DB constraints own Catalog uniqueness.

Existing Seller proposal transaction and S5 confirmation concurrency semantics remain unchanged.

## 12. Explicit Out of Scope

S6 does not include:

- Category;
- category tree or taxonomy;
- Product creation by Seller;
- Product edit by Seller;
- alias management UI;
- seller-defined aliases;
- admin/bulk alias workflow;
- alias moderation;
- query logging;
- search learning;
- autocomplete;
- suggestions;
- fuzzy matching;
- typo correction;
- stemming;
- token matching;
- substring/contains search;
- transliteration;
- embeddings;
- vector search;
- semantic search;
- AI normalization;
- language framework;
- geo or distance;
- Discovery;
- personalization/interests;
- notifications;
- promotion/monetization;
- Search ranking redesign;
- Search disambiguation UI;
- Offer lifecycle changes;
- S5 management changes;
- API redesign;
- UI redesign.

## 13. Acceptance Criteria

S6 may be accepted only if all of the following hold after implementation authorization.

1. Base remains verified S5 checkpoint `b43ca9a82a37a1298a06318aefc17d92ef7153ee`.
2. Historical migrations `0000–0005` remain unchanged.
3. `Product` remains the canonical commercial Catalog identity.
4. `ProductAlias` belongs to exactly one Product row, while one Product may have multiple aliases.
5. Offers continue storing only canonical `product_id`.
6. SellerChangeItems continue storing only canonical `product_id`.
7. Normalization uses the exact approved PostgreSQL 18 expression with explicit `pg_catalog.pg_unicode_fast` semantics.
8. Normalized canonical Product names are globally unique in DB.
9. Duplicate normalized alias for the same Product is rejected by DB.
10. The same normalized alias may belong to multiple Products.
11. Canonical and alias matches are combined before resolution classification.
12. Resolver deduplicates by distinct Product ID before classification.
13. `0 → not_found`, `1 → resolved`, `2+ → ambiguous`.
14. Canonical plus alias match for the same Product resolves, not ambiguous.
15. Canonical/alias collision across different Products is ambiguous.
16. `мясо барана` resolves to canonical `Баранина`.
17. `баран` is not introduced as alias in S6.
18. Search via alias returns the same eligible Offers as canonical Product search.
19. Search continues displaying canonical `Product.name`.
20. Unknown buyer term remains `200 + offers: []`.
21. Ambiguous buyer term remains `200 + offers: []`.
22. S1 lifecycle filtering remains unchanged through alias search.
23. Search ranking/order semantics remain unchanged.
24. S4 Seller Input alias resolves to canonical Product ID before proposal persistence.
25. Seller preview displays canonical Product name.
26. Unknown Seller Product term preserves `PRODUCT_NOT_FOUND` with zero writes.
27. Ambiguous Seller Product term preserves `PRODUCT_AMBIGUOUS` with zero writes.
28. S4 confirmation does not re-resolve alias and uses persisted canonical Product ID.
29. S5 management and confirmation code remain unchanged.
30. Public Search and Seller Input contracts remain compatible.
31. Existing UI requires no S6-specific controls.
32. Migration succeeds from valid real S5 data without changing existing Product/Offer/ChangeSet identities.
33. Migration atomically fails on legacy normalized canonical collisions.
34. Clean `0000 → 0006` migration chain succeeds on PostgreSQL 18.
35. Full S0–S5 regression suite remains green.
36. S6-specific Catalog, Search, Seller Input, migration and E2E tests pass.
37. Manual acceptance passes through existing buyer and seller UI.

## 14. Manual acceptance scenario

Buyer:

```text
1. Existing Catalog contains Product Баранина.
2. Catalog contains alias мясо барана → Баранина.
3. Buyer searches мясо барана in existing Search UI.
4. Existing eligible Баранина Offer is shown.
5. Card displays canonical Product name Баранина.
```

Seller:

```text
1. Existing authenticated Seller opens existing Seller UI.
2. Seller enters мясо барана as Product term.
3. Proposed ChangeSet is created.
4. Preview displays canonical Баранина.
5. No Offer is created before confirmation.
6. Seller confirms.
7. Result Offer stores canonical Баранина product_id.
```

No new S6 UI is required.

## 15. PostgreSQL 18 runtime proof

Normalization contract was proven before implementation against the existing CI service container:

```text
postgres:18
PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2)
UTF8
```

Proof test:

```text
tests/integration/s6-normalization-proof.test.ts
```

Final proof-fix commit:

```text
93000570a2a778b8b461c2851c84edcfaed31d59
```

GitHub Actions run:

```text
34740264219
```

Verified on real PostgreSQL 18:

- `pg_catalog.pg_unicode_fast` exists as deterministic builtin `PG_UNICODE_FAST` collation;
- the normalized expression carries `pg_unicode_fast` semantics;
- `БАРАНИНА == баранина`;
- outer spaces are ignored by `btrim`;
- composed/decomposed NFC-equivalent text produces the same key;
- `е != ё`;
- one internal space differs from two;
- punctuation remains significant;
- the expression is valid in a PostgreSQL UNIQUE expression index;
- inserting canonical `Баранина` succeeds;
- inserting normalized duplicate `   БАРАНИНА   ` is rejected with SQLSTATE `23505`;
- exactly one row remains after rejected duplicate.

The same CI run passed full existing `pnpm verify`:

```text
unit:        162 passed
integration: 69 passed
build:       PASS
E2E:         26 passed
```

The runtime proof changes no production code, migration, schema, seed, dependencies or CI workflow.

## 16. Implementation gate

This document freezes the S6 Feature Spec only.

No S6 production implementation is authorized by this docs commit.

Next required controller decision:

```text
S6 CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED
```
