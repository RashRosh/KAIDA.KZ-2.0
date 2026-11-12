# Current state — Issue #221 OTP/session maintenance (2026-11-12)

## Current task

- Fix repeated OTP authorization when a buyer authenticates through the Offer favourite control, then tracks the product without navigating.
- Independent branch: `maintenance/issue-221-otp-session`, based on `main` and checkpoint `v0.0.91-windows-e2e-219` at `2ccaacc1abcc974049c4bfb5df75e42b4b57826f`.
- D6 PRs #215 (`99bb0f65`) and #216 (`632e6fd8`) remain active and unmerged; this maintenance branch does not change them.

## Last completed / verification

- Implementation commit `b723eea0403754e6454e927b39c337fa98a7d403`: `useInterest` now listens to existing session changes, clears stale private state, and ignores stale asynchronous responses.
- Red E2E reproduced the exact second-auth-dialog symptom twice on the unchanged checkpoint build. Favourite save succeeded, confirming the session was valid.
- Targeted E2Es pass 4/4 across mobile and desktop: favourite-first tracking, reverse interest-first flow, one OTP request, cross-tab logout while Offer remains open, and rejection of a delayed authenticated response after logout.
- Local lint, typecheck, build pass; unit 731/731 and integration 435/435 pass.
- Full branch CI on implementation SHA: KAIDA verify run 43271252892 — success (migrations, seed, lint, types, unit, integration, build, E2E).

## Next action

- PO review of the maintenance branch. No merge or checkpoint tag without explicit PO approval.

## Local constraints

- Preserve untracked `tmp/`; never stage `tmp/`, `scripts/`, `.vscode/`, local evidence or personal review files.
- No merge or checkpoint tag without explicit PO approval.
