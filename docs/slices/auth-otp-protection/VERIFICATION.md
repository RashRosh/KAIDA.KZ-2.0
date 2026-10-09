# Auth OTP protection: verification and acceptance

Implementation follows the approved [Slice Contract](SLICE_CONTRACT.md). This is closed local test login, with dynamically displayed test codes; no SMS provider, purchase or public-launch approval.

## Automated evidence

- Pure policy/config tests: approved defaults, positive-integer validation, interval/window boundaries and integer wait rounding.
- Real PostgreSQL tests: normalized aliases, accepted-history accounting, denial preservation, fifth/sixth request and exact rolling expiry, concurrent admission and guesses, correct/wrong/replacement races, committed failure counters, new-connection persistence, pre-commit rollback and post-commit delivery failure. New tests use owned synthetic phones in `+77000016001` onward and clean their own rows.
- Migration upgrade: the existing chain through 0024 is applied to an isolated database, with existing User/challenge/session UUIDs `16600000-0000-4000-8000-000000000001` / `...0002` / `...0003`. Migration 0025 preserves those rows, initializes failures to zero, adds the index and rejects negative counters. Fresh-chain migration is also verified.
- Browser tests exercise More, `/login`, seller contextual and interest-triggered entry; real HTTP 429 metadata; RU/KK countdown/exhaustion/replacement; late-response handling, expired-code recovery, committed-but-lost resend responses and browser-clock bypass denial. E2E phones `+77000016701`–`+77000016709` and `+77000016801`–`+77000016809` are isolated test fixtures, cleaned afterward.
- Existing immediate replacement tests now advance their fixed clock by 60 seconds. The existing interest re-login browser case ages only its own isolated challenge, modelling an eligible request. No production bypass or disabled limiter is used. Browser clock manipulation affects display only; deterministic integration tests prove server time boundaries.

Full branch CI is the final-SHA regression evidence: locked install, lint, types, migration/seed/test preparation, full unit/integration suite, production build and full Chromium mobile/desktop E2E, plus security checks. Exact SHA, run links and results are recorded in the PR and operational handoff after completion. Local evidence remains under `tmp/auth-otp-evidence`; it is excluded from Git.

## Local isolation and limits

Windows 11, Node 24.14.1, pnpm 11.28.5, PostgreSQL 18 in Docker Linux amd64; Chromium mobile 390×844 and desktop 1440×900. Manual acceptance remains mobile RU; Kazakh text is provisional under the existing localization boundary.

Disposable container `kaida-auth-otp-postgres`, volume `kaida-auth-otp-pg`, loopback port 55434. `kaida` / `kaida_test` are verification databases; `kaida_auth_acceptance` is for PO acceptance. The dev database, its volume/photos and port-3000 server are outside this stack. Acceptance uses a separate production server at `http://127.0.0.1:3200` and synthetic phones `+77009916601` (success/countdown) and `+77009916602` (exhaustion/recovery); fixed User UUIDs are `16600000-0000-4000-8000-000000000601` / `16600000-0000-4000-8000-000000000602`. No challenge is pre-issued for these fixtures, so each PO flow starts with a fresh request.

Migration 0025 follows the repository's handwritten SQL/journal convention. The pre-existing 0003–0008 malformed snapshots prevent `db:generate`; they are not repaired by this slice. Executable migration/upgrade proof validates the actual SQL instead.

No real SMS, external provider, natural traffic/load or public-hosting claim is made. Phone limits do not solve distributed many-phone traffic or targeted exhaustion of another person's allowance. No dependency patch or new security exception is introduced; existing R3 exceptions remain isolated-local-only.

## Manual checklist

1. Open the isolated URL, choose login and use `+77009916601`. See a disabled **Request a new code** action and a decreasing wait. Enter the displayed test code: login succeeds; reload retains the session. Log out afterward.
2. In a fresh login use `+77009916602`. Enter any six-digit code different from the displayed code five times. The first four report a wrong code; the fifth reports exhaustion and disables verification. The account has no permanent lock.
3. Wait for resend eligibility, request a new code and see the input clear and test code change. Enter the new displayed code: login succeeds in the original context. The old challenge's rejection is proved by automated HTTP/integration tests; using an old numerical code against a new challenge is not equivalent proof.

Avoid repeated use of real/dev phones. If a fixture reaches its five-request rolling budget, wait for the displayed recovery time; do not reset server limits. No implementation merge or checkpoint tag until PO manual acceptance.
