# S13 — Interests / Slice Contract

Status: `S13 CONTRACT APPROVED` / `IMPLEMENTATION AUTHORIZED`

Verified product checkpoint:

- tag: `v0.0.13-s12`
- checkpoint SHA: `dbb3f105010818f3650a301f1749743ae632dc29`

Docs-synced implementation base:

- `main`: `42a89532edb74f85dcbd4821faa61916bdd50673`
- branch: `slice/s13-interests`

S13 branch is based exactly on the docs-synced `main` above. Production implementation is authorized within this contract only.

## 1. User task

Authenticated buyer marks an existing canonical Product as interesting, KAIDA.KZ persists that explicit interest for the current User, and the buyer can later see and remove the mark.

## 2. Scope

S13 includes only:

- new Interests module owning persistent `User ↔ Product` interest;
- interest only in an existing canonical Product;
- list of current User's interests;
- idempotent add;
- idempotent remove;
- persistence across reload and later authenticated sessions of the same User;
- minimal buyer UI for showing/toggling interest state around Product shown by Search;
- new authenticated Interests API;
- one additive forward DB migration;
- DB-level uniqueness for `(user_id, product_id)`;
- targeted migration/API/auth/ownership/idempotency/concurrency/E2E verification.

Interest identity is canonical `Product.id`, never search term, alias, Offer, Seller or Location.

## 3. Explicit out of scope

Not included:

- S14 "Для вас" or any Offer feed based on Interests;
- changes to Search matching, Search response DTO, lifecycle filtering or ranking;
- changes to Nearby / Discovery composition or ranking;
- recommendations, ML or inferred interests;
- notifications;
- interests in Category, Seller, Location or Offer;
- weights, priorities or interest levels;
- Product creation/mutation from buyer input;
- alias/catalog administration;
- public interest profiles;
- Seller access to buyer interests;
- interest analytics;
- bulk interest management;
- new auth/session mechanics;
- external services.

## 4. Closed contracts used

### S2 — Auth

S13 uses the existing authenticated `User` and current-user resolution boundary.

S13 must not:

- read `auth_sessions` directly;
- parse session cookie independently;
- accept trusted client `userId`;
- create separate Buyer profile/role.

### S6 — Catalog

`Product` remains canonical Catalog identity. Interest references only existing canonical `Product.id`.

Product resolution, aliases and Catalog write semantics stay unchanged.

### S7 — Search

Closed Search already returns canonical `product.id` and `product.name`. Buyer UI may use `product.id` to match Interest state client-side.

Search API/business logic remains unchanged.

## 5. Closed contracts potentially touched

S13 must preserve:

- S0/S7 anonymous Search and Search DTO;
- S2 Identity/session semantics and current-user boundary;
- S6 Product/alias semantics;
- S9 Search ranking;
- S11 Nearby / Discovery semantics;
- all other closed S0-S12 behavior.

No closed S0-S12 contract needs modification. If implementation discovers otherwise, STOP before changing it and explain blocker, required change and consequences.

## 6. Public API contract

S13 adds exactly:

```text
GET    /api/interests
PUT    /api/interests/{productId}
DELETE /api/interests/{productId}
```

`{productId}` is canonical `Product.id` and must be a UUID.

No endpoint accepts `userId` in path, query or body. No API exists for reading/changing another User's interests.

Private responses use `Cache-Control: no-store`.

### Strict route/input semantics

`GET /api/interests` accepts no query parameters and no request body.

Any query parameter on this endpoint returns:

HTTP `400`

```json
{ "error": { "code": "INVALID_INTERESTS_QUERY", "message": "Некорректный запрос интересов." } }
```

`PUT` and `DELETE` accept exactly one `{productId}` path segment, no query parameters and no request body.

Any query parameter or non-empty request body on PUT/DELETE returns:

HTTP `400`

```json
{ "error": { "code": "INVALID_INTEREST_INPUT", "message": "Некорректный запрос интереса." } }
```

Extra path segments do not match S13 routes and use normal application `404` routing behavior.

### GET /api/interests

Authenticated success:

HTTP `200`

```json
{
  "interests": [
    {
      "product": {
        "id": "uuid",
        "name": "Баранина"
      }
    }
  ]
}
```

Only current authenticated User's interests are returned.

S13 defines no pagination, filtering or sorting input.

### PUT /api/interests/{productId}

Adds current User's Interest in an existing canonical Product.

First add and repeated add both return:

HTTP `200`

```json
{
  "interest": {
    "product": {
      "id": "uuid",
      "name": "Баранина"
    }
  }
}
```

Repeated PUT is successful and creates no duplicate.

Malformed UUID:

HTTP `400`

```json
{ "error": { "code": "INVALID_PRODUCT_ID", "message": "Некорректный товар." } }
```

Valid UUID with no existing Product:

HTTP `404`

```json
{ "error": { "code": "PRODUCT_NOT_FOUND", "message": "Товар не найден." } }
```

Unknown Product creates/mutates no Product, alias, Offer or Interest.

### DELETE /api/interests/{productId}

Removes current User's Interest for that Product ID.

For syntactically valid UUID:

HTTP `204`, empty body.

This is idempotent:

- existing Interest is removed;
- already absent Interest remains absent;
- valid UUID that no longer identifies an existing Product also returns `204`, because requested final state is already satisfied.

Malformed UUID returns `400 INVALID_PRODUCT_ID`.

### Anonymous / auth unavailable

All three endpoints resolve current User only through existing S2 Identity boundary.

Anonymous:

HTTP `401`

```json
{ "error": { "code": "AUTH_REQUIRED", "message": "Войдите, чтобы управлять интересами." } }
```

Current-user resolution unavailable:

HTTP `503`

```json
{ "error": { "code": "AUTH_UNAVAILABLE", "message": "Не удалось проверить вход." } }
```

Anonymous request performs no Interest read/write.

## 7. Idempotency and concurrency

DB invariant:

```text
UNIQUE(user_id, product_id)
```

### PUT

- first valid PUT creates Interest;
- repeated PUT returns successful current state;
- two concurrent PUTs for same `(User, Product)` both complete without duplicate data or uniqueness failure escaping as business response;
- exactly one Interest exists afterwards.

No generic lock manager, Redis lock, global SERIALIZABLE policy or new concurrency framework is introduced.

### DELETE

DELETE is idempotent. Existing or already absent Interest ends in the same absent state.

No stronger concurrency guarantee is introduced beyond uniqueness/absence invariants.

## 8. Privacy boundary

Interests are private User data.

S13 guarantees:

- current User derives only from Identity;
- client `userId` is never trusted/accepted;
- User A receives only User A's Interests;
- User A cannot query, mutate or obtain existence information about User B's Interests through S13 API;
- Sellers have no access to buyer Interests;
- Interests are not projected into public Search/Discovery DTOs;
- public interest counts/aggregates are not added.

No separate security subsystem is introduced.

## 9. Buyer UI boundary

S13 may add an Interest control around Search results, but Search API must remain closed and unchanged.

Allowed flow:

```text
Search API → existing SearchOffer.product.id
Interests API → current User's interest state
buyer UI → client-side match by product.id
```

Forbidden:

- adding `isInterested`, `interestId` or private User data to Search DTO;
- changing Search matching, Product resolution, Offer filtering or ranking.

Exact visual placement is implementation detail, provided the task is clear/testable on mobile and desktop.

## 10. Risk flags

| Risk | Status | Required proof |
|---|---|---|
| DB migration | YES | upgrade proof + clean chain |
| Public API | YES | integration contract tests + E2E |
| auth/security/privacy | YES | anonymous + ownership isolation |
| concurrency/atomicity | YES, narrow | duplicate-PUT concurrency proof + DB unique invariant |
| data loss | NO | additive migration; verify existing data survives |
| external service | NO | none |

## 11. Expected modules of change

Expected scope:

- new Interests module;
- schema aggregation + one forward migration;
- `/api/interests` routes;
- minimal buyer UI state/control around existing Search results;
- S13 migration/integration/E2E tests;
- S13 verification notes as needed.

Existing Identity, Catalog and Search implementations should be consumed, not redesigned.

## 12. Acceptance criteria

1. Authenticated User receives only their own Interests.
2. Interest can be added only for an existing canonical Product; canonical `Product.id` is stored; unknown Product returns `404 PRODUCT_NOT_FOUND` with zero writes.
3. Repeated PUT is idempotent; two concurrent PUTs for the same pair complete safely and leave exactly one Interest.
4. Malformed Product ID and unsupported query/body return the fixed `400` responses without writes.
5. DELETE is idempotent and for a valid UUID leaves Interest absent with `204`.
6. Anonymous requests return `401`; User A cannot read, mutate or determine existence of User B Interests; Sellers receive no access.
7. Buyer UI obtains state only through Interests API and matches it by existing Search `product.id`; Search DTO/API remain unchanged.
8. Interest persists after reload and subsequent login as the same User until DELETE.
9. Interests do not enter public Search/Discovery DTOs and do not change Search/Nearby composition or ranking.
10. S13 migration is additive, preserves existing data, passes S12→S13 upgrade and clean PostgreSQL 18 chain; historical migrations remain unchanged.
11. Targeted migration/API/auth/concurrency/E2E proof and one full branch CI pass on final executable SHA.
12. Before manual acceptance that exact SHA is made available to the user in a real browser without repository code changes after successful CI.

## 13. Automated test plan

### Migration / PostgreSQL 18

Required:

- S12 schema/data → S13 upgrade;
- existing data unchanged;
- unique `(user_id, product_id)` invariant;
- clean full migration chain.

### Integration

Required:

- GET current User only;
- PUT existing Product;
- PUT unknown Product;
- malformed Product ID;
- strict unsupported query/body rejection;
- anonymous GET/PUT/DELETE;
- User A/User B ownership isolation;
- repeated PUT idempotency;
- repeated DELETE idempotency;
- one persistence proof across separate requests/sessions.

### Targeted concurrency

Required only for real S13 risk:

- two concurrent PUTs for same `(User, Product)`;
- both complete safely;
- exactly one Interest remains.

No repeated exact-SHA full-suite runs unless actual flake/race/nondeterminism appears.

### E2E

One completed buyer flow:

```text
login
→ search existing Product
→ mark interested
→ reload and observe mark
→ logout/login same User and observe mark
→ remove mark and observe unmarked state
```

### Regression

One full branch CI on final executable S13 head is mandatory. Closed Search/Discovery/Auth/Catalog behavior is regression-suite concern, not manual checklist.

## 14. Exact-SHA browser gate

After implementation and targeted tests, and before asking for manual acceptance:

1. run full branch CI on final executable S13 head;
2. record exact executable SHA;
3. verify branch head has not changed after successful CI;
4. make exactly that SHA available to user in a real browser;
5. only then request manual acceptance.

If browser availability requires repository code/config/migration/test-behavior changes, that creates a new candidate SHA and requires CI on the new final head.

If deployment changes no repository code, duplicate CI is not required.

## 15. Manual acceptance

Manual acceptance checks only S13 behavior:

1. login;
2. find existing Product;
3. mark it as interesting;
4. reload and confirm mark remains;
5. logout/login as same User and confirm mark remains;
6. remove mark and confirm state disappears.

Search/Nearby regression is covered by automated full CI, not manual acceptance.

## 16. Implementation gate

Current gate:

`S13 CONTRACT APPROVED`

`IMPLEMENTATION AUTHORIZED`

All implementation must remain within this contract. If a closed S0-S12 contract must change, STOP before that change and return with the blocker.
