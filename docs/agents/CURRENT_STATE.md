# Current verified state

## Verified base / active task

- Remote main 49fe8095d3d6fa1e1d12b52619fa0f087fb143b1: approved auth contract/plan/state docs PR #165 merged after green checks. Merged-main verify 37964923564 / CodeQL 37964923799 passed.
- Latest checkpoint: annotated v0.0.73-r3-deployment-preparation -> c2d9968efe24a4f93161eb9f0f387f7bc87886eb. R3 is closed; queue owner is docs/product/EXECUTION_PLAN.md.
- Auth-otp-protection implementation ACTIVE in tmp/auth-otp-implementation, branch slice/auth-otp-protection, based on the docs merge. Implementation PR #166 open. Prior candidate 0f9e54c exposed a migration-harness disconnect race in push CI and stale immediate re-login fixtures in local full E2E. Repair only those test prerequisites; publish a new final candidate and run full exact-head CI. No product code changes are needed.
- Approved policy: 60s request interval, 5 accepted requests/rolling 15min per normalized phone, 5 wrong guesses/challenge; recovery through fresh code under the same request limits, no permanent lock. Scope/revisions: docs/slices/auth-otp-protection/SLICE_CONTRACT.md.

## Last completed / verification

- Atomic persisted admission/failure counters, additive migration 0025, shared modal resend/countdown/terminal recovery and stale-response guards implemented. Existing login entry points use the same enforcement.
- Local targeted proof: 25 unit; 15 original+new integration, expanded 9 migration/race cases; typecheck/lint and production build passed. Focused Chromium E2E: 30 passed. Full unit: 508 passed. Full integration: 294 passed after clean isolated fixture preparation and required test-secret configuration. Final lint/typecheck/production build passed. Initial full browser run:262 passed/54 skipped/4 stale-fixture failures; failure traces retained. Repair regression and final-SHA CI/manual acceptance pending.
- Verification/fixtures/manual checklist: docs/slices/auth-otp-protection/VERIFICATION.md. Historical malformed migration snapshots remain unchanged; handwritten SQL/journal matches the existing convention and has executable upgrade/fresh-chain proof.
- No dependency changes, new security exception, real SMS/provider or purchase. Phone-based protection does not close wider O-AUTH/O-ABUSE or public-launch gates.

## Isolated resources / protected environment

- Docker container kaida-auth-otp-postgres ID 092d1a60b81011710c464aea28526da970e5fb059ff2f09f6a149172b22f0072, loopback 55434, volume kaida-auth-otp-pg. Verification DBs kaida / kaida_test; acceptance DB kaida_auth_acceptance migrated/seeded. Planned manual server loopback 3200; synthetic phones +77009916601 / +77009916602 with User IDs 16600000-0000-4000-8000-000000000601 / 16600000-0000-4000-8000-000000000602. Manual server running on loopback3200 PID18812; use http://auth-otp.localhost:3200/login for separate dev cookies. Separate smoke phone+77009916603/challenge356771c2-209a-416e-9858-f52c51d3fc63 proves real runtime restart preserves failure count1 and request429 (acceptance-restart.json). PO fixtures have no pre-issued challenges.
- Evidence tmp/auth-otp-evidence; dev-photo-baseline.json seals all 1648 dev photo sizes/SHA256s. Preserve dev container kaidakz-20-postgres-1 ID 82a3a1b991062bc1cbef29ddb60f8c756fff18d67ab3116770a08ccdb1387772, start 2026-10-05T08:59:06.038744639Z, volume kaidakz-20_postgres_data, port5432; port3000 PID26500; .data/photos and personal files. Final read-only preservation proof: tmp/auth-otp-evidence/preservation-final.json; all1648 photo hashes, dev container identity/start/mounts and port3000 PID26500 unchanged. No dev DB command issued; Docker/resource settings unchanged.
- Root checkout docs/r3-closure at 9303db1 has unrelated voice research staged locally; no recordings are committed/pushed in auth PRs. Its index and personal files are untouched. Do not stage .mimosa/, .pnpm-store/, .vscode/, scripts/, tmp/, e2e.pid, docs/reviews/localization-foundation-kk-review.docx or nested .mimosa/.

## Voice pause / launch boundaries

- Voice feasibility study PAUSED at PO request. Evidence docs/research/voice-input/local-feasibility-2026-10-09/README.md and small-comparison/REPORT.md; raw results/prompts/schema/licences, 18 synthetic WAVs and memory evidence retained locally/staged. Weights/caches/confidential audio excluded; no small download/inference/parser benchmark ran.
- PO audition gate passed: intelligible with wrong word stress in places, no content mismatch; synthetic benchmark only. Memory blocker: final physical available 460MiB vs planned ~2GiB; commit headroom19382.9MiB. Detailed consumers in small-comparison/memory-followup.json. Docker memory unchanged3962191872B.
- Resume ONLY on explicit PO instruction followed by fresh physical/commit headroom preflight (~2GiB planned); stop if insufficient. AI still required for launch, implementation order deferred. Manual/voice/photo/video unchanged; no typed-AI/manual-editor AI. First voice implementation must include safe retries, late results and approved private-audio lifecycle.
- AI moderation deferred; public launch unauthorized. R3 E-R3-OS / E-R3-GO and other approved exceptions stay isolated-local-only, with review triggers in ops/deployment/security-exceptions.md. R3 evidence links/cleanup retained; confidential backup stays outside Git under C:/Users/RoboRash/AppData/Local/Temp/kaida-r3-codex-check.

## Next action / stop

Finish full regression and branch CI on the final executable SHA, prepare/record isolated fixtures, preserve environment evidence, and STOP with English acceptance package. No implementation merge/tag, new task, SMS purchase or voice-study resume.
