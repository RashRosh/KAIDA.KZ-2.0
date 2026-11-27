# Current state — post D6 Search Home closure (2026-11-26)

This file is a concise handoff, not the canonical queue. Queue and decisions: `docs/product/EXECUTION_PLAN.md`; approved visual authority: `docs/product/DESIGN_BASELINE.md`. Check GitHub SHA and CI directly before acting.

## Verified main checkpoint

- **Latest verified checkpoint:** annotated tag `v0.0.95-design-search-home` at `4ae55430e7eb9fdc2734b521d8026973c027aab9` (`Merge pull request #216 from RashRosh/slice/design-search-home`).
- **Merged-main CI on `4ae5543`:** `KAIDA verify` `45947949585` PASS, `CodeQL` `45947949529` PASS.
- **Recently closed work:**
  - `D6` Search Home (B02) — CLOSED at `v0.0.95-design-search-home` (PR #215 contract + PR #216 implementation; PO visual acceptance 2026-11-26 on 360×780 2x screenshots; buyer visual migration D2–D6 complete).
  - `S-WHOLESALE` slice 1 («Оптовая цена рядом с розницей», item 15) — CLOSED at `v0.0.94-wholesale-price` (`6d121b4`, PR #231 + PR #233 + closure PR #235).
  - Test-only E2E maintenance PR #234 (`b98ab4b`) — closed Issue #224 and rounded touch-target check in `offer-favourites.spec.ts`.
  - Earlier checkpoints: `v0.0.93-route-https-223`, `v0.0.92-otp-session-221`, `v0.0.91-windows-e2e-219`, `v0.0.90-design-nearby` (D5), `v0.0.89-design-favourites` (D4), `v0.0.88-design-offer` (D3), `v0.0.87-design-search` (D2).

## Current task & next action

- **Current task:** `S-WHOLESALE` slice 2 («Только опт») — approved PO 2026-11-26 (contract `docs/slices/wholesale-only/SLICE_CONTRACT.md` + CJM sync); implemented on `slice/wholesale-only` with migration `0033_wholesale_only.sql`, domain/API/UI changes, unit + integration + mobile E2E tests, and 360×780 acceptance screenshots.
- **Next action:** complete branch CI + KAIDA Controller audit on the `slice/wholesale-only` PR and await PO visual acceptance before merge and checkpoint tag `v0.0.96-wholesale-only`.
- **Other open candidate PRs / directions:**
  - **OSRM road distance pilot:** draft PR #230 (`slice/road-distance-osrm`), pending live stand browser acceptance and graph-build peak memory measurement.
  - **Deferred UI polish (PO 2026-11-26):** old seller no-photo placeholder logo (`kaida.css`) and unstyled favourites error rows in `SearchScreen.tsx` (lines 553–555) — deferred to design migration.
  - **CJM 24.11 follow-ups & open issues:** visit outcome («Всё совпало» / «Есть проблема»), unified «Сохранённое», minimal seller return signal, B08 polish Issues #226 / #227, stale docs PRs (#186, #187, #203–#206, #218).

## Local constraints

- Cloud container: start `docker compose up -d --wait`, then `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:test:prepare`; E2E runs on production build (`pnpm build`, then `pnpm test:e2e`).
- Never commit personal/untracked `tmp/`, `scripts/`, `.vscode/`, `docs/reviews/localization-foundation-kk-review.docx`, or model identifiers.
- No product implementation, commit, push, PR, or tag without PO instruction; preserve all closed contracts unless explicitly revised (§4).
