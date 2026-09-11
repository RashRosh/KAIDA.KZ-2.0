# S2 Auth — Verification

Current status: **NOT READY: automated verification pending**.

S2 must not be merged to `main`, tagged `v0.0.3-s2`, or followed by S3 until automated verification is green and separate manual acceptance is completed.

## Required automated evidence

- real PostgreSQL 18;
- clean `0000 → 0001 → 0002` migration path;
- real S1 → S2 upgrade path;
- Identity unit tests;
- Identity integration tests;
- concurrent OTP request test;
- concurrent OTP consume test;
- concurrent User uniqueness test;
- all S0/S1 regression tests;
- production build;
- mobile + desktop E2E;
- full `pnpm verify`;
- actual GitHub Actions conclusion.

## Manual acceptance

Pending and intentionally separate from CI.
