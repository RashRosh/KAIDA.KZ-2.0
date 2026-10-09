# Current verified state

## Verified base

- Verified 2026-10-09: remote main 9ff2f7a1f505fc46713f90d7a2df0b28a010bb83; docs PR #162 merged, PR and merged-main CI successful.
- Last product checkpoint: v0.0.72-pre-publication-buyer-preview, 1d6891ef58e6b74e26d13778a953366a6bddfa22.
- Queue owner: docs/product/EXECUTION_PLAN.md. Scope: docs/slices/r3-deployment-preparation/SLICE_CONTRACT.md.

## Current task

R3 implementation authorized. Branch feat/r3-deployment-preparation has unfinished uncommitted implementation. Audit: correcting photo bind mount to named volume and adapting R1 smoke in a separate R3 spec. Implementation merge and checkpoint prohibited until PO manual acceptance.

## Last completed

Verified docs PR, main CI and isolated stack inventory. Prior trial build succeeded with 1536 MiB heap/two workers, but does not prove final SHA.

## Verification

Pending final build, preflight negatives, TLS smoke, persistence, R2 restore, Hadolint/Trivy and branch full CI. Docker Desktop 4.91.0 / Engine 29.8.0, Linux amd64 VM, 3,962,191,872 bytes available. Resources unchanged.

## Next action

Complete R3 audit and verification; commit/push approved files, open implementation PR, obtain exact-head CI and fresh-checkout evidence. Record security findings and required exceptions. Stop with acceptance package.

## Local constraints

- Preserve dev DB kaida/kaida_test, kaidakz-20-postgres-1, kaidakz-20_postgres_data, port 5432, .data/photos, PID 26500 on port 3000, ports 3100/3101.
- Dev container baseline: 82a3a1b991062bc1cbef29ddb60f8c756fff18d67ab3116770a08ccdb1387772, started 2026-10-05T08:59:06.038744639Z.
- Only isolated deployment resources may change. No Docker Desktop resource changes without approval; no hosting/public exposure/organic.
- Never stage personal/unrelated files: .mimosa/, .pnpm-store/, .vscode/, scripts/, tmp/, e2e.pid, docs/reviews/localization-foundation-kk-review.docx, nested .mimosa/.
- Known follow-ups remain in the plan: KK proofreading, OpenCorpora license evidence, old-device timezone behavior, typo-correction performance limits.
