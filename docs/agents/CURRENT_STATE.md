# Current state — post S-WHOLESALE slice 2 closure (2026-11-27)

This file is a concise handoff, not the canonical queue. Queue and decisions: `docs/product/EXECUTION_PLAN.md`; approved visual authority: `docs/product/DESIGN_BASELINE.md`. Check GitHub SHA and CI directly before acting.

## Verified main checkpoint

- **Latest verified checkpoint:** annotated tag `v0.0.96-wholesale-only` at `aa9493afacbbb3d0bc2fc7bb084e41c3b9c331b1` (`Merge pull request #237 from RashRosh/slice/wholesale-only`).
- **Merged-main CI on `aa9493a`:** `KAIDA verify` `46001171537` PASS, `CodeQL` `46001171574` PASS.
- **Recently closed work:**
  - `S-WHOLESALE` slice 2 («Только опт», item 16) — CLOSED at `v0.0.96-wholesale-only` (PR #237, final head `ab2db17`, merge `aa9493a`; migration `0033_wholesale_only.sql`; PO visual acceptance 2026-11-27 on 360×780 2x screenshots + confirm summary `.kv` alignment and removal of photo count row).
  - `D6` Search Home (B02) — CLOSED at `v0.0.95-design-search-home` (`4ae5543`, PR #215 + PR #216 + closure PR #236; buyer visual migration D2–D6 complete).
  - `S-WHOLESALE` slice 1 («Оптовая цена рядом с розницей», item 15) — CLOSED at `v0.0.94-wholesale-price` (`6d121b4`, PR #231 + PR #233 + closure PR #235).
  - Test-only E2E maintenance PR #234 (`b98ab4b`) — closed Issue #224 and rounded touch-target check in `offer-favourites.spec.ts`.
  - Earlier checkpoints: `v0.0.93-route-https-223`, `v0.0.92-otp-session-221`, `v0.0.91-windows-e2e-219`, `v0.0.90-design-nearby` (D5), `v0.0.89-design-favourites` (D4), `v0.0.88-design-offer` (D3), `v0.0.87-design-search` (D2).

## Current task & next action

- **Current task:** none active — `S-WHOLESALE` slice 2 is closed and tagged.
- **Next action:** await PO selection of the next priority slice/task from `docs/product/EXECUTION_PLAN.md`.
- **Open candidate PRs / directions:**
  - **OSRM road distance pilot:** draft PR #230 (`slice/road-distance-osrm`), pending live stand browser acceptance and graph-build peak memory measurement.
  - **CJM 24.11 follow-ups:** visit outcome («Всё совпало» / «Есть проблема»), unified «Сохранённое», minimal seller return signal.
  - **Buyer/Seller visual polish & open issues:** B08 polish Issues #226 / #227; seller visual migration (deferred PO 2026-11-26 items: old seller no-photo placeholder logo in `kaida.css` and unstyled favourites error rows in `SearchScreen.tsx` lines 553–555); stale docs PRs (#186, #187, #203–#206, #218).

## Local constraints

- Cloud container: start `docker compose up -d --wait`, then `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:test:prepare`; E2E runs on production build (`pnpm build`, then `pnpm test:e2e`).
- Never commit personal/untracked `tmp/`, `scripts/`, `.vscode/`, `docs/reviews/localization-foundation-kk-review.docx`, or model identifiers.
- No product implementation, commit, push, PR, or tag without PO instruction; preserve all closed contracts unless explicitly revised (§4).
