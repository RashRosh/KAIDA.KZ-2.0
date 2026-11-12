# Current state — Issue #221 OTP/session maintenance (2026-11-12)

## Current task

- Fix repeated OTP authorization when a buyer authenticates through the Offer favourite control, then tracks the product without navigating.
- Independent branch `maintenance/issue-221-otp-session`, based on verified main/checkpoint `v0.0.91-windows-e2e-219` at `2ccaacc1abcc974049c4bfb5df75e42b4b57826f`.
- D6 PRs #215 (`99bb0f65`) and #216 (`632e6fd8`) remain active and unmerged; they are not being changed.

## Last completed / verification

- Main CI at the checkpoint: KAIDA verify 43243565884, CodeQL 43243565727, OpenSSF Scorecard 43243565916 — success.
- Red E2E reproduced the exact symptom twice on the unmodified checkpoint build: after favourite OTP login, tracking opened a second auth dialog; expected none, received one. Favourite save succeeded, confirming the session was valid. Classify as `PRODUCT DEFECT`.
- Compared `useInterest` and `useFavourites`: only favourites subscribes to the existing session-change signal, focus and visibility; interests fetches only on product/locale changes.
- Final targeted run: both flows pass on mobile and desktop (4/4); the stale authenticated read cannot restore interest after cross-tab logout.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, unit 731/731 and integration 435/435 pass locally; unit/integration ran before the final failed-submit revalidation adjustment. Branch CI will verify the exact final head.

## Ranked hypotheses

1. **Confirmed:** `useInterest` keeps `anonymous` state after same-tab OTP login because it misses the session-change event; the same-mounted Offer E2E reproducibly opens another auth dialog.
2. **Confirmed and fixed:** a delayed authenticated `/api/interests` response after logout is ignored; the anonymous revalidation clears private state.
3. **Ruled out for the reproduced path:** favourite save succeeded after OTP and interest revalidation observed the same session; no server cookie/API change was needed.
4. **Ruled out:** interest-first login also leaves favourites usable without another OTP.
5. **Confirmed and fixed:** cross-tab logout clears the mounted Offer's interest/favourite state, and a delayed prior response does not restore it.

## Next action

- Commit and push only this maintenance diff to run branch CI on the final SHA; keep D6 PRs, main, and checkpoint tag untouched.

## Local constraints

- Do not stage `tmp/`, `scripts/`, `.vscode/`, local evidence or personal review files. Preserve the untracked `tmp/` in this worktree.
- Integration uses the prepared test database; run integration before E2E. Do not run DB-sharing checks in parallel.
- No merge or checkpoint tag without explicit PO approval.
