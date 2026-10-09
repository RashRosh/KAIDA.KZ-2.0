# Current verified state

## Verified base

- Remote main: 9ff2f7a1f505fc46713f90d7a2df0b28a010bb83. Docs PR #162 merged after green PR/main CI.
- Last product checkpoint: v0.0.72-pre-publication-buyer-preview, 1d6891ef58e6b74e26d13778a953366a6bddfa22.
- Queue: docs/product/EXECUTION_PLAN.md. Approved scope: docs/slices/r3-deployment-preparation/SLICE_CONTRACT.md.

## Current task

R3 implementation complete, branch feat/r3-deployment-preparation, PR #163. Full local verification and branch/PR CI passed at 9ab5e645e324bd13a110e7a2856805d3da83a047 (runs 37914716082 / 37914720560). This final handoff update changes only this snapshot, outside both images. Current-head full CI, rebuilt image labels and filesystem comparison are final gates; exact SHA/image/report IDs are recorded in PR evidence and the acceptance package.

Implementation merge and checkpoint tag are prohibited before PO manual acceptance. No other workstream is authorized.

## Completed evidence

- Clean-clone frozen install, lint/types and 18 targeted health/preflight tests passed. Tools/runtime clean builds passed without OOM; routine build settings 1536MiB JS heap, two reported CPUs, sequential targets. Docker Desktop resources unchanged.
- Full regression: 505 unit, 285 integration, 248 E2E passed; 54 E2E skipped. CodeQL and dependency review green. Final-head results: https://github.com/RashRosh/KAIDA.KZ-2.0/pull/163/checks.
- Supported fresh/repeated deploy:up passed; 25 migrations and Production KB 682 products / 210 aliases / 35 categories, no seed. Nine offline refusal cases and all online negatives passed again at the verified SHA, including a disposable empty DB and fully migrated DB missing KB.
- TLS smoke: all three tests passed, Seller/Buyer/Operator, Secure + HttpOnly, ordinary HTTP refusal, valid large upload and 15MiB limit. Final run passed in 34.5s; initial browser resource failure passed unchanged when serialized after scans.
- Persistence passed: offer/photo rows and all file hashes survived down/up without deleting volumes. R2 create/clean restore/verify passed: 29 tables, 2 photo rows, 4 files; restored search and public WebP bytes match. Disposable restore project removed.
- Runtime/tools Trivy vulnerability and secret scans plus explicit image-config scans completed; Dockerfile 27 checks passed, Hadolint []. Runtime 43 HIGH / tools 44 HIGH, zero CRITICAL/secrets; no supplied HIGH/CRITICAL fix remains. See ops/deployment/verification.md and dependency-patches.md.
- PO approved E-R3-OS, E-R3-GO and E-R3-BRACES for isolated local R3 only on 2026-10-09. Additional tools-only LOW DS-0026 exception approved by PO on 2026-10-09 (one-off CLI has no service healthcheck); see security-exceptions.md.

## Next action / stop boundary

Return the acceptance package once final current-head CI/image/report gates are green, then STOP. Next action is PO manual acceptance only. Do not merge or tag without acceptance.

Manual path: https://localhost:8443, accept expected local certificate warning, Seller test OTP, create photo card, Buyer private-window search/photo, then ask for an R3-only restart and confirm persistence. No OS CA was installed.

## Local handoff

- Reference stack: kaida-deploy-check; app loopback 3400, TLS loopback 8443, DB unpublished; named volumes kaida-deploy-check_pg_data / kaida-deploy-check_photos. One source app process. No external push delivery configured/tested.
- Verification clone/evidence: tmp/r3-clean and tmp/r3-evidence (untracked). External env and confidential backup staging: C:/Users/RoboRash/AppData/Local/Temp/kaida-r3-codex-check. Never publish secrets/bundles.
- Preserve dev DB kaida/kaida_test, kaidakz-20-postgres-1 (82a3a1b991062bc1cbef29ddb60f8c756fff18d67ab3116770a08ccdb1387772, started 2026-10-05T08:59:06.038744639Z), kaidakz-20_postgres_data, port 5432, .data/photos and PID 26500 on port 3000. Ports 3100/3101 untouched.
- Final dev preservation proof: same container ID/start time/volume; same port-3000 PID 26500; all 1,648 photo files/sizes/SHA256s unchanged; six non-loopback app/TLS probes refused. No dev DB command was issued.
- Personal/unrelated files remain untracked: .mimosa/, .pnpm-store/, .vscode/, scripts/, tmp/, e2e.pid, docs/reviews/localization-foundation-kk-review.docx, nested .mimosa/. Never stage them.
- Verified host: Windows 11 / Git Bash / Docker Linux amd64. Other OS/architecture, provider TLS/network, real auth, traffic/load, public launch, organic/purge scheduler, multiple replicas and off-host/encrypted/scheduled backup remain unverified/out of scope. Follow-ups stay in the plan, including OpenCorpora public-distribution license evidence.
