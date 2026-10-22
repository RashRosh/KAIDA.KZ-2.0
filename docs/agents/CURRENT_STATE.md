# Current verified state

- Last closed: **B-READABILITY** CLOSED (PO 2026-10-22): point, address · distance and seller lines on the result card, offer page and Favourites unavailable card at 14/20 px `--ink2`, in `rem` (browser font-size setting, 200 %); approved deviation from B01/B02. Contract `docs/slices/buyer-readability/SLICE_CONTRACT.md` §12, evidence `ACCEPTANCE.md` (PO / agent real-Chrome / automated / unverified kept apart). PR #193 merged `c4459abb0d7ff250060f8803ac9b3669a6bf2340`, PR #194 merged `7175479f0c6255ce64466b6d0cf0722a754078ab`.
- Verified checkpoint: annotated `v0.0.82-buyer-readability` at `7175479f0c6255ce64466b6d0cf0722a754078ab`; main KAIDA verify 39769092446 and CodeQL 39769092477 GREEN. Prior checkpoint `v0.0.81-seller-ai-text-real-parser` at `c70c2b77ff76670f9bdedb9f61c5e466555822c9`.
- Known limitations (B-READABILITY, accepted by PO): phone browsers, page zoom and phone system text size not verified; at 200 % long words in the narrow card column break mid-word; the browser font-size setting does not enlarge the px-sized product name and price. Earlier slices' limitations stay in their contracts (slice 2: §14 model limits; KK strings provisional).
- Maintenance: O-CI-FLAKE-TYPO (EXECUTION_PLAN §5.12) — intermittent `search-typo-correction` E2E failure, cause unconfirmed; investigate if it recurs.
- Infrastructure: previews stopped; acceptance DB `kaida_br_accept` dropped, dump in `C:\dev\KAIDA-backups\buyer-readability-2026-10-22\` (outside Git). Seller AI text input production `off`; Modal and the real-model stand stopped.
- Open decisions: D-2 model licence confirmation before production; D-4 Kazakhstan deployment. `S-TEXT-AVAILABILITY` (EXECUTION_PLAN §5.3) — planning only.
- Current task: none. The approved queue (EXECUTION_PLAN §2) is exhausted; no next slice is approved.
- Next action: PO chooses the next work from EXECUTION_PLAN; a contract and a PO instruction are required before any implementation.
