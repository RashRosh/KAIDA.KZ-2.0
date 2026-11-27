# Current state — post S-WHOLESALE slice 1 closure (2026-11-26)

This file is a concise handoff, not the canonical queue. Queue and decisions: `docs/product/EXECUTION_PLAN.md`; approved visual authority: `docs/product/DESIGN_BASELINE.md`. Check GitHub SHA and CI directly before acting.

## Verified main checkpoint

- **Latest verified checkpoint:** annotated tag `v0.0.94-wholesale-price` at `6d121b4222ff3b9ade19eef951fcc124c0750de2` (`Merge pull request #233 from RashRosh/slice/wholesale-price`).
- **Merged-main CI on `6d121b4`:** `KAIDA verify` `45884779691` PASS, `CodeQL` `45884779613` PASS.
- **Recently closed work:**
  - `S-WHOLESALE` slice 1 («Оптовая цена рядом с розницей», item 15) — CLOSED at `v0.0.94-wholesale-price` (PR #231 contract + PR #233 implementation; Controller PASS WITH NOTE; PO visual acceptance 2026-11-26 on 390×844 mobile screenshots).
  - Test-only E2E maintenance PR #234 (`b98ab4b`, merged-main CI `45878614280` / `45878614302` PASS) — closed Issue #224 (`seller-text-switch-on.spec.ts` alert locator) and fixed sub-pixel touch-target flake (`offer-favourites.spec.ts`).
  - Maintenance PR #232 (`25f2a46`) — rounded search card photo geometry check.
  - CJM contract-review process PR #229 (`26981b6`) — recorded 24.11 PO decisions and §3.1 CJM review rule.
  - `v0.0.93-route-https-223` (PR #225, Issue #223), `v0.0.92-otp-session-221` (PR #222, Issue #221), `v0.0.91-windows-e2e-219` (PR #220), `v0.0.90-design-nearby` (D5), `v0.0.89-design-favourites` (D4), `v0.0.88-design-offer` (D3), `v0.0.87-design-search` (D2).

## Current task & next action

- **Current task:** none (no next product slice is scheduled or authorized).
- **Next action:** await PO choice of the next slice before preparing a Slice Contract or touching product code.
- **Main open candidate PRs / directions:**
  - **D6 Search Home (B02):** contract PR #215 and implementation PR #216 (both `CONFLICTING` with `main`, need rebase/reconciliation before closure).
  - **S-WHOLESALE slice 2 («Только опт» + sorting):** next step of 24.11 wholesale decision (requires `mandatory-offer-price` and `search-sort-rev3` contract revision).
  - **OSRM road distance pilot:** draft PR #230 (`slice/road-distance-osrm`), pending browser acceptance on live stand and graph-build peak memory measurement.
  - **Deferred UI polish (PO 2026-11-26):** old seller no-photo placeholder logo (`kaida.css`) and unstyled favourites error rows in `SearchScreen.tsx` (lines 553–555) — deferred to design migration.
  - **Other open docs PRs / issues:** CJM 24.11 follow-ups (visit outcome, unified saved list, minimal seller return signal), B08 polish Issues #226 / #227, stale docs PRs (#186, #187, #203–#206, #218).

## Local constraints

- Cloud container: start `docker compose up -d --wait`, then `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:test:prepare`; E2E runs on production build (`pnpm build`, then `pnpm test:e2e`).
- Never commit personal/untracked `tmp/`, `scripts/`, `.vscode/`, `docs/reviews/localization-foundation-kk-review.docx`, or model identifiers.
- No product implementation, commit, push, PR, or tag without PO instruction; preserve all closed contracts unless explicitly revised (§4).
