# Current state — Issue #221 exact acceptance flow (2026-11-12)

## Current task

- Complete PR #222 coverage for the exact PO journey: guest opens `/favourites`, completes OTP sign-in, opens an existing favourite Offer, and tracks its product.
- Independent branch `maintenance/issue-221-otp-session`, based on verified main/checkpoint `v0.0.91-windows-e2e-219` at `2ccaacc1abcc974049c4bfb5df75e42b4b57826f`.
- D6 PRs #215 (`99bb0f65`) and #216 (`632e6fd8`) remain active and untouched.

## Last completed / verification

- `useInterest` session invalidation fix: commit `b723eea0403754e6454e927b39c337fa98a7d403`; full verify passed on that implementation SHA (run 43271252892).
- Before the fix, same-mounted favourite-first E2E reproduced the second OTP dialog twice; after, the existing focused login/logout regressions passed 4/4 across mobile and desktop.
- Added exact PO-reported `/favourites` → OTP → existing saved Offer → tracking E2E with an isolated existing-favourite fixture. It asserts the session remains authenticated, no second dialog/OTP, and tracking succeeds.
- Exact-flow targeted run passed 2/2 (mobile and desktop). No production code change for this acceptance request.
- Local lint/typecheck/build, unit 731/731 and integration 435/435 had passed on the implementation before this test-only change.

## Next action

- Commit and push the focused E2E to draft PR #222; run full branch CI on the updated SHA.
- No merge or checkpoint tag without explicit PO approval.

## Local constraints

- Preserve untracked `tmp/`; never stage `tmp/`, `scripts/`, `.vscode/`, local evidence or personal review files.
- No merge or checkpoint tag without explicit PO approval.
