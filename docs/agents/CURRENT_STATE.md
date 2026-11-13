# Current state — buyer design migration and maintenance (2026-11-13)

This file is a concise handoff, not the canonical queue. Queue and decisions: `docs/product/EXECUTION_PLAN.md`; approved visual authority: `docs/product/DESIGN_BASELINE.md`. Check GitHub SHA and CI again before acting.

## Verified main checkpoint

- `main` at `2ccaacc1abcc974049c4bfb5df75e42b4b57826f` before Issue #221 merge; annotated checkpoint `v0.0.91-windows-e2e-219`.
- Windows E2E maintenance Issue #219 / PR #220 **merged and closed**, merged-main verification 43243565884 PASS; CodeQL and Scorecard PASS. See `docs/reviews/windows-e2e-219.md` for test evidence. The original nondeterministic network symptom was not proven permanently eliminated.
- Visual migration checkpoints: D2 Search results `v0.0.87-design-search` (closed); D3 Offer page `v0.0.88-design-offer` (closed); D4 Favourites `v0.0.89-design-favourites` (closed); D5 Nearby `v0.0.90-design-nearby` (closed).

## Independent active workstreams

1. **Issue #221 / draft PR #222**, repeated OTP when a signed-in buyer tracks a product after entering through Favourites. Branch `maintenance/issue-221-otp-session`, original implementation `b723eea0403754e6454e927b39c337fa98a7d403`. `useInterest` now consumes the existing session-change signal and invalidates stale in-flight reads on logout. Red E2E reproduced original symptom twice; post-fix targeted E2E 4/4 mobile/desktop. Exact `/favourites → OTP → existing Offer → tracking` targeted E2E 2/2 PASS. User manually reported the flow working during 2026-11-12 acceptance. Local lint/typecheck/build, unit 731, integration 435 PASS. Final-head (before this handoff edit) `fdfed590ceac1d7b8c4d27110a42a34740a93b6e`: push/PR verify, CodeQL, Dependency Review all PASS. **Merge, merged-main CI and checkpoint/tag are still release gates**; don't represent the feature as closed before they pass.
2. **Issue #223**, buyer 2GIS route opens an unusable `dgis://` custom-protocol deep link on desktop; PO approved documented HTTPS web/app fallback and a visible straight-line distance label in Search and Nearby. Requires a *narrow, explicit revision* of the closed UX1D route target contract, including RU/KZ copy, accessibility, eligible-only route checks, targeted tests and desktop manual acceptance. No code implementation yet; separate maintenance branch, do not bundle with #221 or D6.
3. **D6 Search Home (B02)**, contract PR #215 at `99bb0f65`, implementation PR #216 at `632e6fd8`; neither merged. D6 visuals reviewed positively by PO on 2026-11-12; independent OTP defect uncovered during acceptance and handled as #221. Before D6 closure re-evaluate/rebase over verified main and complete exact-head branch CI, PO manual acceptance, merged-main CI and annotated checkpoint. Do not treat #221 as a D6 code change.
4. **D1 First Entry `/welcome`** intentionally deferred by PO; buyer More/auth UI and later seller/operator design migration not yet sliced or scheduled as approved contracts.

## Next actions

- Complete #221 independent release workflow: verify latest PR head and required checks, obtain/record PO acceptance, merge, run CI on merged main, annotate checkpoint, close Issue #221.
- Then implement and close #223 in a new slice/branch, with documented UX1D revision and manual 2GIS fallback check.
- Then reconcile D6 PRs with verified main, close D6, and plan remaining buyer redesign before seller/operator UI, one vertical slice at a time.

## Local constraints

- Windows PowerShell uses `pnpm.cmd`. Prepare test DB and run integration before E2E to avoid shared-DB ordering conflicts. Do not parallelize DB-sharing tests.
- Never stage personal/untracked `tmp/`, `scripts/`, `.vscode/`, screenshot traces or private browser data.
- No merge/tag/checkpoint without PO approval and required verification. Preserve all closed contracts not explicitly revised.
