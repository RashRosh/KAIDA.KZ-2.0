# Current state — Windows E2E maintenance #219 (2026-11-12)

## Current task

- PO authorized investigation/fix, targeted/full regression and branch CI for #219. Branch `maintenance/219-windows-e2e`.
- No merge/checkpoint tag without PO approval. No D6, unrelated product/closed-contract edits, OS network changes or arbitrary retries. Raw auth traces stay local.

## Verified base

- Fetched main `e1b4d93d35b5b043913f68cec500e88699a18156`; KAIDA verify 42966213173 and CodeQL 42966213209 success.
- Annotated checkpoint `v0.0.90-design-nearby` → `7cfed6fcd40496a5e4505b7089a2db4125dbbdcd`.

## Last completed / verification

- Upgraded only Playwright 1.63 → 1.65 and lockfile; installed matching Chromium 158.0.8127.18 (revision 1254), built-in TcpPortRandomizationWin mitigation confirmed. No custom launch flags; workers 2 / retries 0 unchanged.
- Baseline seven network specs: 32 pass / 6 expected skips; 38 local traces, 420 ERR_ABORTED, zero buffer/address errors. Original network instability not reproduced in this bounded baseline.
- Baseline geometry repeats: 28 pass / 2 float failures / 10 expected skips; address 18 ±0.000015258789062. Heart 8 additional runs: all pass, frame measurements 43.99998474121094–44.00001525878906 at exact computed 44px. Both TEST IMPLEMENTATION float comparisons; narrow tolerances added, exact CSS and both 44px target dimensions retained.
- CI artifact paths exclude raw trace ZIP and HTML-report ZIP copies to honor privacy boundary.
- Unit 731 pass; lint/typecheck/build completed without reported errors. Integration in progress; a failure appeared in seller-text-real-parser and requires classification. Targeted 1.65 run stopped before tests to avoid sharing DB with integration; no pass claim.

## Next action

- Finish/classify integration, then targeted 1.65 E2E, geometry repeats and normal full 2-worker E2E sequentially on the test DB. Commit/push scoped changes for branch CI, report exact SHA/results.

## Local constraints / hypotheses

- Use pnpm.cmd (PowerShell blocks pnpm.ps1); sandbox escalation required for network and Git metadata outside worktree.
- Local evidence in tmp/219-*.log and tmp/219-baseline-network; never stage tmp/, scripts/, .vscode/ or personal review DOCX.
- Network hypothesis: upstream Windows TCP randomization defect; if errors survive upgrade, inspect TCP state read-only before rerun. Float geometry hypothesis confirmed independently; no production fix needed.
