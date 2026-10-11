# B-FAV-OFFER — Offer favourites

Status: APPROVED — PO 2026-10-12. Contract, previews, narrow unavailable metadata exceptions and minimal-reference retention approved; implementation authorized in a separate branch after docs PR publication. STOP for exact-SHA manual acceptance before implementation merge/tag.

Verified base 2026-10-11: main `f1fda1880546ff9dc27955df14cc6b6f6a2227ca`, checkpoint `v0.0.76-auth-otp-source-protection` (`f99dfe982e1098ffb0b6aa16454a882499f27663`), main verify38111727140/CodeQL38111727129 green.

> Latest PO preview direction: [Unavailable proposal](UNAVAILABLE_PROPOSAL.md) owns the replacement temporary/removed UX and required closed-contract exceptions. Prior all-state neutral tombstones and legacy-star relabelling are superseded proposals, not approved scope. Current S13 action stays unchanged. Approval recorded 2026-10-12; legacy S13 unchanged.

## 1. One user task and authority

Buyer saves a specific Offer at its trading point with a heart, revisits its current price/availability in a private favourites list, and removes it when no longer needed. [Feature Map approved direction](../../product/FEATURE_MAP.md#offer-favourites--approved-scope-po-2026-10-12), [B-FAV-OFFER plan](../../product/EXECUTION_PLAN.md), [Buyer Journey](../../product/BUYER_JOURNEY.md). Unlike a Product selection/subscription, this identity is Offer.id + its trading point, not card_id, Product, query or seller. Different points of the same card can be saved independently. No inferred city filter on favourites: the saved point stays the point the buyer chose.

## 2. Approved behaviour and focused UI

- Add «Избранное» entry to existing buyer «Ещё» without moving existing rows/navigation. New list reuses accepted BuyerScreen/Bar/ResultCard, existing loading/error/button patterns. Order: savedAt descending, stable saved-entry ID tie-break; all saved entries reachable through incremental loading if needed, no new arbitrary quota.
- Heart action on actual buyer Offer detail: «В избранное» / active «В избранном», aria-pressed, independent of the existing Product-interest star. Do not add result-card hearts in this slice; preserve current cards. This narrow addition to buyer-screens composition and the new heart glyph are approved. No heart/mutations in seller preview (`preview=1`) or private pre-publication preview.
- Saving requires authenticated current user and an Offer currently buyer-visible at the captured point; adding twice/concurrently is idempotent and leaves one entry. Re-read visibility when committing, not only in UI. Never accept client userId/point substitution. If the Offer disappeared meanwhile, fail truthfully without creating an entry or exposing hidden fields.
- Available list entries hydrate current public Offer data and exact price basis/point/hours/actions from the common buyer read model. No frozen price/title/photo snapshot; current price is not a price-change notification. Favourites do not guarantee physical stock beyond existing buyer visibility/confirmation semantics.
- Remove via active heart on detail or a separately labelled list action «Убрать из избранного». Removing affects only this user's saved entry, never the Offer/Product/S13 data. Idempotent DELETE works even if Offer no longer exists; pending disabled/announced, error preserves entry and permits retry. No confirmation dialog for this reversible operation; user can save an available Offer again.
- Existing guest modal preserves intent for the exact Offer+point after explicit heart click; no save before login. Successful login revalidates and performs that one save automatically, then returns to same Offer/list context; cancel leaves original screen, no write. If unavailable after login, show unavailable, no save. Direct favourites visit signed out shows sign-in action; successful login loads only that account's list, never auto-adds an Offer.
- Empty list: «Пока нет избранных предложений» / «Сохраняйте предложения сердечком на странице товара.» / existing Search action. Loading uses card-shaped skeletons; service failure is a retryable error, never converted into unavailable/deleted/empty. Logout/account switch immediately clears private list and pending intent; late responses cannot restore old-account data.

## 3. Approved unavailable exception

[UNAVAILABLE_PROPOSAL.md](UNAVAILABLE_PROPOSAL.md) supersedes the previous universal neutral-tombstone draft. Use one recognisable private saved card for an existing non-operator-removed Offer at the same point after confirmation expiry OR Seller switch-off. Expired-active uses only ordinarily authorized current attached cover; switched-off always uses existing neutral KAIDA placeholder and exposes no photo locator. Retain confirmed title, public seller display name and point name; no price, address/comment, contact/route/purchase actions, detail link or actuality badge. Explicit unavailable status, muted accents, full text contrast; removal usable. Restore normal presentation only when exact same Offer+point passes common buyer eligibility again.

Deleted/operator-removed records excluded entirely from visible list/count/content; no reasons or identifiers leaked. Draft/unpublished/unknown/missing-or-changed-point states remain excluded. Seller switch-off requires an explicit owner-only identifying-metadata exception, never an inactive-media grant. This boundary is approved.

Minimal internal saved reference retention until buyer removes it is approved independently of visible-card policy: owner User ID, saved-entry ID, Offer/point IDs and savedAt only, no historical content/photo copies. No automatic deletion/retargeting is implied by hiding. Erasure/backups remain owning-policy gates. Ordinary media authorization must be rechecked; no new private/historical photo grant, R2 cleanup or report permission expansion. The favourites-only metadata disclosure exception to lifecycle/management/actuality/offer-photos contracts is explicitly approved for this slice, without weakening shared Search/Nearby/detail eligibility. See owning proposal for exact revisions and races.

## 4. Safe return and independent Product operations

Detail opened from list returns to that list, preserving position when practical; unavailable after opening offers a safe «Назад в избранное». Internal return routes validated, no arbitrary external redirect/history navigation. Direct Offer visits preserve existing safe Search fallback; existing seller preview returns unchanged.

Legacy S13 selections/API/auth intent, current labels, star and behaviour remain unchanged and accessible through the existing control. No migration/conversion/deletion or notification activation. Prior proposed Product-star relabelling withdrawn for this transition despite current overlapping wording. Future independent Product tracking requires its own explicit consent and contract; no fake tracking action is added. Free-title Offers may be favourited without a fabricated Product link.

## 5. Closed contracts, modules and actual risks

Reuse [S13](../S13-interests/SLICE_CONTRACT.md) + guest-interest semantics (unchanged Product identity), Identity/Auth modal and auth-otp protections (no real SMS), [buyer-screens](../buyer-screens-mockup/SLICE_CONTRACT.md)/result cards, [offer-actuality](../offer-actuality/SLICE_CONTRACT.md)/common visibility, [operator-post-check](../operator-post-check/SLICE_CONTRACT.md)/buyer reports, current price basis/[photos](../offer-photos/SLICE_CONTRACT.md), buyer preview privacy and safe-return contracts. Approved revisions limited to new More entry, buyer-detail heart, favourites-specific Back context  (buyer-screens §2/§8 currently promises same texts); existing guarantees remain. If implementation requires broader revision, STOP with concrete reason before code.

Expected: one private favourites module/table with additive migration and unique owner/Offer/point invariant; authenticated own-list/idempotent add/remove boundary with no-store responses; common Offer read hydration, buyer UI and caller-specific auth intent. No direct session parsing, client identity trust, public favourites profile or seller access. Risk flags: migration/data preservation YES; private auth/cache/IDOR/late-results YES; concurrent add/remove and save versus moderation/delete YES; stale return/visibility YES. No external service, historical evidence store, destructive migration, Offer mutation or new abuse policy.

## 6. Acceptance and verification

1. Exact Offer+point identity; two points saved separately; unknown/hidden/private target cannot be saved or expose fields.
2. Unique/idempotent concurrent adds and removes; captured point validated server-side, no replacement retargeting.
3. Private owner isolation/no userId override, anonymous reads/writes rejected; no seller access; no-store; account-switch/late-result proof.
4. Current available price/availability/card actions; price edit does not create a notification or alter saved identity.
5. Temporary entry follows explicitly approved disclosure boundary with safe authorized cover/no price or sales actions; deleted/operator-removed entries excluded without leaks; minimal internal retention approved. Same identity returns only through normal eligibility.
6. Guest login intent completes once for exact target after revalidation; cancel/session change/unavailable never writes incorrectly.
7. Safe favourites return for available/unavailable detail, direct Search fallback and both seller preview modes preserved.
8. S13 selections/interest API/guest intent unchanged; no subscriptions/events from any favourite action, no fake tracking control.
9. Additive clean/upgrade migration preserves all existing data including S13 and photos; recorded isolated fixtures only, dev/private port3000 untouched.
10. Approved composition, keyboard/44px targets/status/focus, narrow widths/large text; mobile/RU acceptance and provisional KK per PROJECT_RULES.

Targeted integration: owner/API/privacy, current visibility/moderation/deletion/point change, idempotency/concurrent add/remove, save-vs-removal and restart persistence. Unit only for reference/return/late-result logic not already covered. Migration upgrade/clean chain required. E2E: guest heart→login→same detail, two point saves→list→current price→unavailable→remove, existing S13/auth/preview regression. Full required regression and final-SHA branch CI before exact-SHA isolated browser manual acceptance; record fixture/resource IDs. No merge/tag before PASS.

## 7. Simple manual acceptance

On isolated synthetic fixtures: open Offer A at point1 signed out, heart→cancel (unchanged), repeat/login (saved once). Save same card's Offer at point2; «Ещё»→«Избранное» shows both current point-specific prices. Open one and Back; observe independent S13 selection unchanged. Change price in isolated seller fixture, refresh list: current price, no notifications. Switch off one saved fixture: same unavailable variant with neutral placeholder and no photo locator; activate and refresh: exact same eligible identity restored. Expire confirmation of one active fixture: recognisable unavailable variant, safe cover/title/public seller, no price/sales actions, remove usable. Operator removes other card: entry excluded, no fields leaked; restore same public identity: returns normally if retained. Delete recorded fixture: excluded from list, no tombstone content. Verify fallback for inaccessible/replaced photo. Direct URL fallback and seller preview have no new mutation/control. Fixture IDs recorded before use; no dev data/photo/resource changes.

## 8. Approval / STOP gate

PO 2026-10-12 approves this contract, entry/heart/private-list previews and both unavailable variants; explicit S1/S5, actuality and offer-photos metadata revisions are recorded in UNAVAILABLE_PROPOSAL.md and their owning contracts. Minimal internal references retained until user removal; public access and S13 unchanged. Publish docs PR, implement separately, use isolated recorded fixtures, run final-SHA regression/CI, then STOP for manual acceptance. Do not merge implementation/tag yet. Voice/translation paused; tracking, paid services and public launch unauthorized.
