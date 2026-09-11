# S2 Auth — Verification

Current status: **MANUAL ACCEPTANCE COMPLETE. Merge remains blocked until this documentation head has green GitHub Actions and the user explicitly authorizes merge.**

S2 must not be merged to `main`, tagged `v0.0.3-s2`, or followed by S3 without the required final CI result and separate explicit authorization.

## Automated evidence

Final implementation SHA before the automated-verification documentation update:

`5825aa8312b3a717f0bbe247310f6f88242dfcd0`

GitHub Actions implementation verification:

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

The prior documentation head `53a92cfdb948919f4955906a909d04ee1e2f8df9` also completed `S2 verify` successfully in GitHub Actions run `34640228182`.

## Manual acceptance

Manual acceptance was performed in GitHub Codespaces against `slice/s2-auth` at SHA `53a92cfdb948919f4955906a909d04ee1e2f8df9` with real `postgres:18` reporting PostgreSQL `18.6`.

Environment setup:

- branch and SHA matched the expected S2 head: PASS;
- PostgreSQL 18.6 container healthy: PASS;
- migrations applied through the normal `pnpm db:migrate` path: PASS;
- deterministic S1 seed applied through `pnpm db:seed`: PASS;
- application opened through the Codespaces port-3000 browser URL: PASS.

Buyer/auth flow:

- anonymous state before login: PASS;
- anonymous Search for `баранина`: PASS;
- login opened from the real UI: PASS;
- input `8 (700) 123-45-67` normalized/displayed as `+77001234567`: PASS;
- dynamic test OTP displayed: PASS;
- wrong OTP rejected with exact message `Неверный код.`: PASS;
- correct OTP authenticated successfully: PASS;
- authenticated header displayed `+77001234567`: PASS;
- Search after login: PASS;
- reload preserved authenticated session: PASS;
- closing and reopening the application tab preserved authenticated session: PASS;
- logout returned to anonymous state: PASS;
- Search after logout: PASS;
- repeated login with the same phone: PASS.

Persistence limitation:

- a full operating-system browser process close/reopen was **not manually performed** in this Codespaces/chat session;
- this result is intentionally not reported as a manual PASS;
- the closest manual check available in-session (tab close/reopen) passed;
- automated Playwright already passed the separate-browser-context persistence scenario;
- if a literal browser-process restart is desired later, the correct check is to keep the Codespace/server running, fully close the browser process, reopen a normal browser profile, navigate back to the same Codespaces application URL, and confirm `+77001234567` is still resolved from the persistent cookie/session.

Database/auth lifecycle checks:

- direct PostgreSQL query after repeated login returned exactly one `users` row for `+77001234567`: PASS (`user_count = 1`);
- expired challenge was created only by permitted direct DB setup; one unfinished challenge row was moved into the past: PASS;
- submitting its original correct OTP through the real UI returned exact message `Срок действия кода истёк. Запросите новый.`: PASS;
- requesting a subsequent OTP superseded the previous unfinished challenge: PASS;
- PostgreSQL showed `superseded_at` populated on the previous challenge and empty terminal fields on the newest active challenge: PASS;
- submitting the superseded OLD challenge/code through its original real UI returned exact message `Код больше недействителен. Запросите новый.`: PASS;
- submitting the NEW challenge/code through the real UI authenticated successfully: PASS.

Responsive and accessibility checks:

- mobile approximately 390 px: PASS;
- desktop approximately 1440 px: PASS;
- no horizontal scroll: PASS;
- keyboard Tab navigation: PASS;
- visible focus: PASS;
- phone and OTP labels focus their corresponding inputs: PASS;
- Enter submits the phone form: PASS;
- Enter submits the OTP form: PASS.

No product defect was found during manual acceptance. No product code, tests, API, database schema, or architecture were changed during manual acceptance.

## Remaining gates

This documentation commit must itself complete the full GitHub Actions `S2 verify` workflow successfully before S2 is declared ready for merge.

After that green result:

- S2 satisfies the defined S2 verification/manual-acceptance gates and is ready for merge;
- merge into `main` still requires explicit user authorization;
- do not create `v0.0.3-s2` without explicit user authorization;
- do not start S3.
