# Current verified state

- Last closed: **S-TEXT-AVAILABILITY** CLOSED (PO 2026-10-27, «принято»): «… нет» in the text list → candidates at the selected point (pack-aware) → one existing deactivate change set → existing confirm. Contract `docs/slices/text-availability/SLICE_CONTRACT.md` §13, evidence `ACCEPTANCE.md` (PO / agent / automated / not verified kept apart). PR #196 merged `04fcf9395b6012460c12c3c9b3deb387af94f582`.
- Verified checkpoint: annotated `v0.0.83-text-availability` at `04fcf9395b6012460c12c3c9b3deb387af94f582`; main KAIDA verify 40499935657 and CodeQL 40499935654 GREEN. Prior checkpoint `v0.0.82-buyer-readability` at `7175479f0c6255ce64466b6d0cf0722a754078ab`.
- Known limitations (S-TEXT-AVAILABILITY): pack wording the size/unit patterns do not know counts as «no pack»; live-model statements verified by replay only; KK strings provisional. Outside the slice: React #418 on the first home-page load; the buyer report form calls `crypto.randomUUID` (fails over plain http).
- Maintenance: O-CI-FLAKE-TYPO (EXECUTION_PLAN §5.12) unchanged. Local typecheck/build in this checkout need a temporary tsconfig exclude of `tmp/` (stale worktrees; never commit it).
- Infrastructure: acceptance stand (port 3400) stopped; DB `kaida_ta_accept` dropped, dump and diagnostics in `C:\dev\KAIDA-backups\text-availability-2026-10-27\` (outside Git). Seller AI text input production `off`.
- Open decisions: D-2 model licence; D-4 Kazakhstan deployment.
- PO direction 2026-10-27: features first, then release; no redesign phase; pilot prep not moved ahead; priority = seller offer creation/maintenance via text, voice, photo, video (voice/photo/video order not approved).
- Preserved, not to be changed: voice research branch `research/voice-input-local-feasibility-2026-10-09` @ `63623363`; local-only `wip/local-leftovers-2026-10-09` @ `335205de`; stashes and old worktrees kept.
- Current task: prepare the Slice Contract of `S-TEXT-DUPLICATES` (PO 2026-10-27) — contract only, no implementation, no model runs.
- Next action: contract on a docs branch from `main`; PO review. Implementation only after approval and a direct PO instruction.
