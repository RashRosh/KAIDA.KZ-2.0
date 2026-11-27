# Current state — post B08 Opening Hours closure (2026-11-27)

This file is a concise handoff, not the canonical queue. Queue and decisions: `docs/product/EXECUTION_PLAN.md`; approved visual authority: `docs/product/DESIGN_BASELINE.md`. Check GitHub SHA and CI directly before acting.

## Verified main checkpoint

- **Latest verified checkpoint:** annotated tag `v0.0.97-b08-opening-hours` at `7ec8086f804315582870fa3f3352820b36c74de2` (`Merge pull request #239 from RashRosh/slice/b08-opening-hours-block`, closed Issue #226).
- **Merged-main CI on `7ec8086`:** `KAIDA verify` `46061590703` PASS, `CodeQL` `46061590662` PASS.
- **Recently closed work:**
  - `B08 Opening Hours Sub-Block` (Issue #226, item 17) — CLOSED at `v0.0.97-b08-opening-hours` (PR #239, final head `a785529`, merge `7ec8086`; unified clock+calendar sub-block aligned on point-card 24 px icon rail; 320 px + 200% header/stack fix; permanent layout-control & visual self-check rule added to `docs/PROJECT_RULES.md` §18.4).
  - `S-WHOLESALE` slice 2 («Только опт», item 16) — CLOSED at `v0.0.96-wholesale-only` (`aa9493a`, PR #237 + closure PR #238).
  - `D6` Search Home (B02) — CLOSED at `v0.0.95-design-search-home` (`4ae5543`, PR #215 + PR #216 + closure PR #236; buyer visual migration D2–D6 complete).
  - `S-WHOLESALE` slice 1 («Оптовая цена рядом с розницей», item 15) — CLOSED at `v0.0.94-wholesale-price` (`6d121b4`, PR #231 + PR #233 + closure PR #235).

## Current task & next action

- **Current task:** PO-delegated priority queue (2026-11-27):
  1. ~~B08 Opening Hours Sub-Block (Issue #226)~~ — **CLOSED (`v0.0.97-b08-opening-hours`)**.
  2. **Next:** CJM 24.11 #2 — **«Исход визита» (`Всё совпало` / `Есть проблема`)**, slice 1 (B08 two-button outcome block + guest/authenticated submission + operator `X-03` integration).
  3. CJM 24.11 #4 — **«Минимальный сигнал отдачи продавцу» (P2-18)** (routes, contacts, «Всё совпало», and problems per trading point).
  4. CJM 24.11 #3 + Issue #227 — **Единый список «Сохранённое»** (Favourites + Product tracking with explicit consent).
  5. Later separately: OSRM road distance pilot (draft PR #230) and Seller design migration (including deferred PO 2026-11-26 items: old seller no-photo placeholder logo in `kaida.css` and unstyled favourites error rows in `SearchScreen.tsx` lines 553–555).
- **Next action:** cut `slice/visit-outcome` from updated `main`, author `docs/slices/visit-outcome/SLICE_CONTRACT.md`, implement via TDD, verify locally + visually on 360 px and 320 px + 200%, open PR, pass CI + Controller audit, and present screenshots for PO visual acceptance.

## Local constraints

- Cloud container: start `docker compose up -d --wait`, then `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:test:prepare`; E2E runs on production build (`pnpm build`, then `pnpm test:e2e`).
- Never commit personal/untracked `tmp/`, `scripts/`, `.vscode/`, `docs/reviews/localization-foundation-kk-review.docx`, or model identifiers.
- Always visually inspect every screenshot (`360 px` and `320 px + 200%`) before showing PO (`docs/PROJECT_RULES.md` §18.4).
- No merge of any product slice without PO manual/visual acceptance and green branch CI on final head.
