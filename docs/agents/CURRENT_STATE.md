# Current verified state

## Verified base

- Remote main: 9ff2f7a1f505fc46713f90d7a2df0b28a010bb83. Docs PR #162 merged after green PR/main CI.
- Last product checkpoint: v0.0.72-pre-publication-buyer-preview, 1d6891ef58e6b74e26d13778a953366a6bddfa22.
- Queue: docs/product/EXECUTION_PLAN.md. Approved scope: docs/slices/r3-deployment-preparation/SLICE_CONTRACT.md.

## Current task

R3 implementation and acceptance handoff, branch feat/r3-deployment-preparation, PR #163. Executable code SHA 412d2a9a2f3657f50cfd70e83b2bd1b6cddb9eff passed full branch/PR CI. Final documentation/handoff commit must also pass full current-head CI; its exact SHA and final image/report IDs are recorded in PR evidence and the acceptance message.

Implementation merge and checkpoint tag are prohibited before PO manual acceptance. No other workstream is authorized.

## Completed evidence

- Clean-clone frozen install, lint/types and 18 targeted health/preflight tests passed. Tools/runtime clean builds passed without OOM; routine build settings 1536MiB JS heap, two reported CPUs, sequential targets. Docker Desktop resources unchanged.
- Full regression: 505 unit, 285 integration, 248 E2E passed; 54 E2E skipped. CodeQL and dependency review green. Final-head results: https://github.com/RashRosh/KAIDA.KZ-2.0/pull/163/checks.
- Supported fresh/repeated deploy:up passed; 25 migrations and Production KB 682 products / 210 aliases / 35 categories, no seed. Offline/online refusal cases passed.
- TLS smoke: all three tests passed, Seller/Buyer/Operator, Secure + HttpOnly, ordinary HTTP refusal, valid large upload and 15MiB limit. Initial browser resource failure passed unchanged when serialized after scans.
- Persistence passed: offer/photo rows and all file hashes survived down/up without deleting volumes. R2 create/clean restore/verify passed: 29 tables, 2 photo rows, 4 files; restored search and public WebP bytes match. Disposable restore project removed.
- Runtime/tools Trivy vulnerability and secret scans plus explicit image-config scans completed; Dockerfile 27 checks passed, Hadolint []. Runtime 43 HIGH / tools 44 HIGH, zero CRITICAL/secrets; no supplied HIGH/CRITICAL fix remains. See ops/deployment/verification.md and dependency-patches.md.
- PO approved E-R3-OS, E-R3-GO and E-R3-BRACES for isolated local R3 only on 2026-10-09. Additional tools-only LOW DS-0026 exception approved by PO on 2026-10-09 (one-off CLI has no service healthcheck); see security-exceptions.md.

## Next action / stop boundary

Finish final-head rebuild/verification/CI and PR full-report evidence; then STOP with the acceptance package. Once current-head gates are green, next action is PO manual acceptance only. Do not merge or tag without acceptance.

Manual path: https://localhost:8443, accept expected local certificate warning, Seller test OTP, create photo card, Buyer private-window search/photo, then ask for an R3-only restart and confirm persistence. No OS CA was installed.

## Local handoff

- Reference stack: kaida-deploy-check; app loopback 3400, TLS loopback 8443, DB unpublished; named volumes kaida-deploy-check_pg_data / kaida-deploy-check_photos. One source app process. No external push delivery configured/tested.
- Verification clone/evidence: tmp/r3-clean and tmp/r3-evidence (untracked). External env and confidential backup staging: C:/Users/RoboRash/AppData/Local/Temp/kaida-r3-codex-check. Never publish secrets/bundles.
- Preserve dev DB kaida/kaida_test, kaidakz-20-postgres-1 (82a3a1b991062bc1cbef29ddb60f8c756fff18d67ab3116770a08ccdb1387772, started 2026-10-05T08:59:06.038744639Z), kaidakz-20_postgres_data, port 5432, .data/photos and PID 26500 on port 3000. Ports 3100/3101 untouched.
- Personal/unrelated files remain untracked: .mimosa/, .pnpm-store/, .vscode/, scripts/, tmp/, e2e.pid, docs/reviews/localization-foundation-kk-review.docx, nested .mimosa/. Never stage them.
- Verified host: Windows 11 / Git Bash / Docker Linux amd64. Other OS/architecture, provider TLS/network, real auth, traffic/load, public launch, organic/purge scheduler, multiple replicas and off-host/encrypted/scheduled backup remain unverified/out of scope. Follow-ups stay in the plan, including OpenCorpora public-distribution license evidence.
