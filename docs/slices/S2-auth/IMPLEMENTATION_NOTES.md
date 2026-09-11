# S2 Auth — Implementation Notes

Status: implementation complete; automated verification is green; manual acceptance is pending.

## Scope

Implementation is based on `v0.0.2-s1` and stays inside the approved S2 whitelist.

Implemented design:

- Identity-local phone normalization;
- three Identity tables only;
- HMAC-SHA-256 OTP verification material;
- 256-bit opaque session token with SHA-256 DB digest;
- PostgreSQL advisory transaction lock for per-phone challenge replacement;
- partial unique unfinished-challenge index;
- conditional atomic challenge consume;
- PostgreSQL-backed concurrent User get-or-create;
- database session + `kaida_session` cookie;
- four auth Route Handlers;
- minimal `/login` and auth status UI;
- no auth framework/JWT/Redis/global auth middleware/debug endpoint.

## Advisory lock key

The exact approved deterministic key is SHA-256 of `kaida-identity-phone-lock-v1\0${phoneE164}`, first 8 bytes interpreted as signed big-endian int64. It is never persisted.

## Security boundary

Test OTP is intentionally exposed only by `TestOtpDelivery`. This remains a closed-test implementation and is not public-launch ready. Rate limiting, anti-abuse, brute-force protection and real SMS remain mandatory pre-public-launch blockers.

## Final automated verification

The locator-only E2E fix was committed as `5825aa8312b3a717f0bbe247310f6f88242dfcd0` (`fix(s2): target auth error text in E2E`). No UI, accessibility semantics, auth logic, API or DB behavior changed in that fix.

GitHub Actions run `34639883281` executed the full `pnpm verify` path on PostgreSQL 18.6 and completed successfully on that SHA.

Observed results:

- clean S0 → S1 → S2 migration chain: PASS;
- repeat migration and deterministic repeat seed: PASS;
- unit tests: 83/83 PASS;
- integration tests: 39/39 PASS;
- Search regression integration tests: 21/21 PASS;
- Offer Lifecycle regression integration tests: 8/8 PASS;
- Identity concurrency tests: 3/3 PASS;
- production build: PASS;
- Playwright E2E: 20/20 PASS across mobile + desktop;
- GitHub Actions job `verify`: SUCCESS.

## Release state

S2 is not accepted yet. Manual acceptance remains intentionally separate from CI. Do not merge to `main`, create `v0.0.3-s2`, or start S3 until manual acceptance is completed.

Automated and manual acceptance state is recorded in `VERIFICATION.md`.
