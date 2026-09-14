# S13 — Interests / Slice Contract

Status: `S13 DESIGN APPROVED CONDITIONALLY` / `IMPLEMENTATION BLOCKED`

Verified product checkpoint:

- tag: `v0.0.13-s12`
- product checkpoint SHA: `dbb3f105010818f3650a301f1749743ae632dc29`

Docs-synced implementation base:

- `main`: `42a89532edb74f85dcbd4821faa61916bdd50673`
- S13 branch: `slice/s13-interests`

S13 branch is created from the docs-synced `main` above. No production implementation is authorized by this document.

## 1. User task

Authenticated buyer marks one existing canonical Product as interesting, KAIDA.KZ persists that explicit interest for the current User, and the buyer can later see and remove that mark.

## 2. Scope

S13 includes only:

- a new Interests module owning the persistent `User ↔ Product` interest relation;
- interest only in an existing canonical `Product`;
- list of the current authenticated User's interests;
- idempotent add of an interest;
- idempotent remove of an interest;
- persistence across reload and later authenticated sessions of the same User;
- minimal buyer UI for showing/toggling interest state around an existing Product shown by Search;
- a new authenticated Interests API;
- one additive forward DB migration;
- DB-level uniqueness for one interest per `(user_id, product_id)`;
- targeted migration, API/auth/ownership/idempotency/concurrency and E2E verification.

Interest identity is the canonical `Product.id`. Search terms, aliases, Offer IDs, Seller IDs and Location IDs are not Interest identity.

## 3. Explicit out of scope

S13 does not include:

- S14 "Для вас" or any Offer feed based on interests;
- changes to Search matching, Search response DTO, Search ranking or Search lifecycle filtering;
- changes to Nearby / Discovery composition or ranking;
- recommendations, ML or inferred interests;
- notifications;
- interest in Category, Seller, Location or Offer;
- weights, priorities, folders, tags or levels of interest;
- Product creation or mutation from buyer input;
- alias/catalog administration;
- public interest profiles;
- Seller access to buyer interests;
- operator analytics over interests;
- bulk interest management;
- new auth/session mechanics;
- external services.

## 4. Closed contracts used by S13

### S2 — Auth

S13 uses the existing authenticated `User` and the Identity boundary for current-user resolution.

The current User must be derived only through the existing Identity contract. S13 must not read `auth_sessions` directly, parse the session cookie independently, accept a client-supplied trusted `userId`, or create a separate Buyer profile/role.

### S6 — Catalog

`Product` remains the canonical catalog identity. Interest may reference only an existing canonical `Product.id`.

S13 does not change Product resolution, aliases, canonical names or Catalog write semantics.

### S7 — Search

Existing Search already returns canonical `product.id` and `product.name` in its closed response DTO. Buyer UI may use that `product.id` to match interest state client-side.

Search itself remains unchanged.

## 5. Closed contracts potentially touched

S13 must preserve:

- S0/S7 public anonymous Search behavior and Search response DTO;
- S2 Identity/session semantics and `resolveCurrentUser` boundary;
- S6 Product/alias semantics and canonical Product identity;
- S9 Search ranking semantics;
- S11 Nearby / Discovery semantics;
- all S0-S12 public behavior unrelated to Interests.

No closed S0-S12 contract needs to change for S13. If implementation discovers otherwise, STOP before changing it and explain the blocker and consequences.

## 6. Public API contract

S13 adds exactly this buyer-facing resource boundary:

```text
GET    /api/interests
PUT    /api/interests/{productId}
DELETE /api/interests/{productId}
```

`{productId}` is the canonical `Product.id` and must be a valid UUID.

No S13 endpoint accepts `userId` in path, query or body. There is no API for reading or changing another User's interests.

Private responses use `Cache-Control: no-store`.

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

Only interests of the current authenticated User are returned.

S13 defines no pagination, sorting control or filtering query parameters. Unsupported query input is not part of the contract and must not be interpreted as another User selector.

### PUT /api/interests/{productId}

Adds the current User's interest in an existing canonical Product.

Success, both for first add and repeated add:

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

Semantics are idempotent. Repeating the same PUT does not create another row and is not a business error.

The endpoint has no request body in the S13 public contract. Client-supplied ownership fields such as `userId` are never trusted or used.

Malformed UUID:

HTTP `400`

```json
{ "error": { "code": "INVALID_PRODUCT_ID", "message": "Некорректный товар." } }
```

Valid UUID that does not identify an existing Product:

HTTP `404`

```json
{ "error": { "code": "PRODUCT_NOT_FOUND", "message": "Товар не найден." } }
```

Unknown Product must not create or mutate Product, alias or Offer data.

### DELETE /api/interests/{productId}

Removes the current User's interest for that Product ID.

Success is idempotent:

HTTP `204`, empty body.

If the Interest existed, it is removed. If it was already absent, the same `204` result is returned.

For DELETE, after a syntactically valid UUID is supplied, absence of an Interest or absence of the Product does not become a business error: the requested final state, "current User has no Interest for this productId", is already satisfied.

Malformed UUID returns the same `400 INVALID_PRODUCT_ID` contract as PUT.

### Anonymous / unavailable auth semantics

All three endpoints resolve current User through the existing S2 Identity boundary.

Anonymous request:

HTTP `401`

```json
{ "error": { "code": "AUTH_REQUIRED", "message": "Войдите, чтобы управлять интересами." } }
```

If current-user resolution itself is unavailable, S13 follows the existing authenticated-route boundary:

HTTP `503`

```json
{ "error": { "code": "AUTH_UNAVAILABLE", "message": "Не удалось проверить вход." } }
```

No anonymous request creates, reads or deletes Interest data.

## 7. Idempotency and concurrency semantics

The database owns this invariant:

```text
UNIQUE(user_id, product_id)
```

### Add

`PUT /api/interests/{productId}` is idempotent.

- first valid PUT creates the Interest;
- repeated PUT returns successful current state;
- two concurrent PUT requests for the same `(User, Product)` may race internally but both must complete without duplicate data or uniqueness error escaping as an observable business failure;
- after concurrent duplicate PUT, exactly one Interest exists in DB.

No generic lock manager, Redis lock, global SERIALIZABLE policy or new concurrency framework is introduced for S13.

### Remove

DELETE is idempotent.

- existing Interest becomes absent;
- already absent Interest remains absent;
- repeated DELETE remains successful.

No stronger concurrency guarantee is introduced beyond preserving the final uniqueness/absence invariants.

## 8. Privacy and ownership boundary

Interests are private User data.

S13 guarantees:

- current User comes only from Identity resolution;
- `userId` is never accepted as an ownership selector from the client;
- User A receives only User A's interests;
- User A cannot query, mutate or infer existence of User B's interests through S13 API;
- Sellers have no S13 access to buyer interests;
- Interests are not projected into public Search or Discovery DTOs;
- S13 does not expose interest counts or other aggregate signals publicly.

No separate security subsystem is introduced.

## 9. Buyer UI boundary

S13 may add an interest control to buyer UI around Search results.

The closed Search API must not change.

Allowed flow:

```text
Search API → existing SearchOffer.product.id
Interests API → current User's Product IDs/state
buyer UI → client-side match by product.id
```

S13 must not add `isInterested`, `interestId`, private User data or any other Interests field to the Search response DTO.

Search business logic, matching, Catalog resolution, Offer filtering and ranking remain untouched.

The exact visual placement of the control is an implementation detail as long as the completed buyer task is clear and testable on mobile and desktop.

## 10. Risk flags

| Risk | Status | Required proof |
|---|---|---|
| DB migration | YES | upgrade proof + clean chain |
| Public API | YES | integration contract tests + E2E |
| auth/security/privacy | YES | anonymous + owner isolation integration tests |
| concurrency/atomicity | YES, narrow | targeted duplicate-PUT concurrency proof + DB unique invariant |
| data loss | NO | additive migration; still prove existing data survives upgrade |
| external service | NO | none |

## 11. Expected modules of change

Expected scope is limited to:

- new Interests module: application/contracts/DB/repository boundary as needed;
- schema aggregation and one forward migration;
- `/api/interests` route surface;
- minimal buyer UI state/control around existing Search results;
- S13 migration/integration/E2E tests;
- S13 Slice Contract / verification notes as needed.

Existing Identity, Catalog and Search implementations should normally be consumed, not redesigned.

## 12. Acceptance criteria

1. Authenticated User can list only their own Interests.
2. Authenticated User can add Interest for an existing canonical Product ID.
3. Interest persists canonical `Product.id`; no search term, alias or Offer becomes Interest identity.
4. PUT is idempotent: repeated add returns success and exactly one `(User, Product)` Interest exists.
5. Two concurrent duplicate PUTs do not expose a uniqueness failure and leave exactly one Interest row.
6. Unknown Product on PUT returns `404 PRODUCT_NOT_FOUND` with zero Product/alias/Offer creation or mutation.
7. Malformed `{productId}` returns `400 INVALID_PRODUCT_ID` without Interest writes.
8. DELETE is idempotent: existing or already-absent Interest ends in the same absent state and returns `204` for a valid UUID.
9. Anonymous requests to GET/PUT/DELETE return `401 AUTH_REQUIRED` and perform no Interest access or mutation.
10. User A cannot read or mutate User B's Interests, and S13 exposes no cross-user existence signal.
11. Buyer UI obtains Interest state through the separate Interests API and matches it to existing Search `product.id`; Search API/DTO/matching/ranking remain unchanged.
12. Reload and later login as the same User preserve the Interest until DELETE removes it.
13. S13 Interests never appear in public Search/Discovery DTOs and do not affect Search/Nearby ordering or composition.
14. Forward migration succeeds from the docs-synced S12 base without changing existing data, and the clean PostgreSQL 18 migration chain succeeds; historical migrations remain unchanged.
15. Targeted S13 proof and full branch CI pass on the final executable branch head before manual acceptance.

## 13. Automated test plan

### Migration / PostgreSQL 18

Required:

- verified S12 schema/data → S13 migration succeeds;
- pre-existing data remains unchanged;
- unique `(user_id, product_id)` invariant exists;
- clean full migration chain succeeds on PostgreSQL 18.

### Integration

Required API/application proofs:

- GET current User only;
- PUT existing canonical Product;
- PUT unknown Product;
- malformed Product ID;
- anonymous GET/PUT/DELETE;
- User A / User B ownership isolation;
- repeated PUT idempotency;
- repeated DELETE idempotency;
- one persistence proof across separate application/authenticated requests.

### Targeted concurrency

Required exactly for the real S13 concurrency risk:

- two concurrent PUTs for the same `(User, Product)`;
- both complete safely;
- exactly one Interest remains.

No repeated exact-SHA full-suite runs are required unless actual flake/race/nondeterminism appears.

### E2E

One completed buyer flow is sufficient:

```text
login
→ search existing Product
→ mark interested
→ reload and observe marked state
→ logout/login same User and observe marked state
→ remove mark and observe unmarked state
```

### Regression

One full branch CI on the final executable S13 head is mandatory. Closed Search/Discovery/Auth/Catalog behavior is a regression-suite concern, not a manual-acceptance checklist.

## 14. Exact-SHA browser gate before manual acceptance

After implementation and targeted tests:

1. run full branch CI on the final executable S13 head;
2. record the exact executable SHA;
3. verify branch head has not changed after that successful CI;
4. make exactly that SHA available to the user in a real browser;
5. only then request manual acceptance.

If making the browser version available requires repository code/config/migration/test-behavior changes, that creates a new candidate SHA and requires CI on the new final head.

If deployment/access changes no repository code, no duplicate CI run is required.

## 15. Manual acceptance

Manual acceptance checks only S13 user behavior:

1. login;
2. find an existing Product;
3. mark it as interesting;
4. reload and confirm the mark remains;
5. logout/login as the same User and confirm the mark remains;
6. remove the mark and confirm the state disappears.

Regression of Search, Nearby and other closed slices is proven by automated regression CI, not repeated manually.

## 16. Implementation gate

This Slice Contract authorizes no production implementation yet.

Current gate:

`S13 DESIGN APPROVED CONDITIONALLY`

`IMPLEMENTATION BLOCKED`

Expected next gate after controller approval:

`S13 CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED`
