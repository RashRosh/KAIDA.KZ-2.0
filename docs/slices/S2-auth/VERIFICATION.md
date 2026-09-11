# S2 Auth — Verification

Current status: **NOT READY: manual acceptance pending**.

Automated verification is complete and green. S2 must not be merged to `main`, tagged `v0.0.3-s2`, or followed by S3 until separate manual acceptance is completed.

## Automated evidence

Final implementation SHA before this documentation update:

`5825aa8312b3a717f0bbe247310f6f88242dfcd0`

GitHub Actions:

- workflow: `S2 verify`;
- run: `34639883281`;
- job: `verify`;
- conclusion: `success`;
- PostgreSQL: `18.6`;
- command path: full `pnpm verify` (`lint → typecheck → db:migrate → db:seed → db:test:prepare → unit → integration → build → E2E`).

Verified results:

- clean `0000 → 0001 → 0002` / S0 → S1 → S2 migration path: PASS;
- real S1 → S2 upgrade path: PASS;
- repeat migration and deterministic repeat seed: PASS;
- Identity unit tests: PASS;
- unit suite: 83/83 PASS;
- Identity integration tests: PASS;
- integration suite: 39/39 PASS;
- concurrent OTP request test: PASS;
- concurrent OTP consume exactly-one-success test: PASS;
- concurrent User uniqueness test: PASS;
- S0 Search regression integration suite: 21/21 PASS;
- S1 Offer Lifecycle regression integration suite: 8/8 PASS;
- production build: PASS;
- mobile + desktop Playwright E2E: 20/20 PASS;
- full `pnpm verify`: PASS;
- actual GitHub Actions conclusion: SUCCESS.

The final E2E locator fix changed only the two assertions for `Неверный код.` and `Срок действия кода истёк. Запросите новый.` to exact text locators. Product UI, `role="alert"`, accessibility semantics, Next.js route announcer, auth application logic, API and DB were not changed for that fix.

## Manual acceptance

Pending and intentionally separate from CI.

Until manual acceptance passes:

- do not merge `slice/s2-auth` into `main`;
- do not create `v0.0.3-s2`;
- do not start S3.
