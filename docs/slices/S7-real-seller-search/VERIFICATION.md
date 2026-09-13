# S7 — Real Seller Search — Verification

Status: `MANUAL ACCEPTANCE PASS`

Date: 2026-09-13

Verified implementation head before manual acceptance:

`6dde63c3d76df597e611e8654924ec46a09c8702`

Verified main before merge:

`6f5e0ca7e1b7aca945f344e2527d5aa626c9e29c`

Production diff for S7: `0 files`.

S7 is a proof/contract slice. The production path already existed through S0–S6; S7 adds automated proof that a Seller-created Offer participates in the existing buyer Search contract without a parallel publication/search state.

## Manual acceptance

Manual acceptance was intentionally limited to visible user behavior. Database state, exact Offer IDs, resolver internals, parallel execution, test isolation and CI mechanics were not repeated manually because they are covered by automated verification.

Visible scenario accepted by the user:

- P2 created a new proposal using Product input `мясо барана` with identifiable Seller / Location / seller comment;
- before confirmation, that specific proposal was not visible to P1 through Search;
- P2 confirmed creation;
- P1 searched first for `Баранина`, then for `мясо барана`;
- in both searches, the same newly created Seller Offer was visible through its Seller / Location / comment identity;
- other `Баранина` offers were allowed to coexist and were not treated as a failure;
- P2 proposed `Выключить` for that Offer;
- while the deactivation ChangeSet was only proposed, the Offer remained visible to P1;
- P2 confirmed deactivation;
- after confirmation, that specific Offer was no longer visible through either `Баранина` or `мясо барана`.

Result: PASS.

## Automated S7 proof

### Integration

`tests/integration/s7-real-seller-search.test.ts`

Result on implementation head `6dde63c3d76df597e611e8654924ec46a09c8702`: `1/1 PASS`.

The proof uses the real application-layer Seller ChangeSet flow and existing Search contract. It verifies proposal invisibility, confirmed Offer visibility through canonical and alias search, continued visibility while deactivation is only proposed, and disappearance after confirmed deactivation.

### E2E

`tests/e2e/s7-real-seller-search.spec.ts`

Results on implementation head `6dde63c3d76df597e611e8654924ec46a09c8702`:

- mobile: PASS;
- desktop: PASS.

The E2E proof uses separate Seller and Buyer browser contexts and verifies the visible end-to-end contract without requiring a singleton Search result.

## Regression adaptations

During S7 proof execution, existing S0/S2 E2E tests exposed stale assumptions that `Баранина` always returns exactly one Offer. These were classified as:

`STALE EXISTING E2E ASSUMPTIONS / MULTI-OFFER TEST ISOLATION FAILURE`

No production defect and no S7 contract failure were found.

Authorized test-only adaptations were limited to:

- `tests/e2e/search.spec.ts` — replaced singleton/global assumptions with assertions against the stable seed Offer identity where multiple legal `Баранина` Offers may coexist; preserved valid global-zero assertions for empty/failed Search results;
- `tests/e2e/auth.spec.ts` — in the first auth flow only, scoped the three `Баранина` assertions to the stable seed card while preserving all S2 auth semantics.

Production code, seed, Search API, Auth production code, result ordering, Playwright config, CI, dependencies and parallel execution were not changed.

## Final implementation branch CI before verification docs

GitHub Actions run: `34755585635`

Exact CI SHA: `6dde63c3d76df597e611e8654924ec46a09c8702`

Conclusion: `SUCCESS`.

Verified totals:

- lint: PASS;
- typecheck: PASS;
- migrations: PASS;
- seed: PASS;
- DB prepare: PASS on PostgreSQL 18;
- unit: `162/162 PASS`;
- integration: `93/93 PASS`;
- S7 integration: `1/1 PASS`;
- build: PASS;
- E2E: `32/32 PASS`;
- S7 E2E mobile: PASS;
- S7 E2E desktop: PASS;
- full `pnpm verify`: PASS.

## Conclusion

S7 manual acceptance: PASS.

S7 production diff: `0 files`.

Merge remains blocked pending explicit controller authorization.
