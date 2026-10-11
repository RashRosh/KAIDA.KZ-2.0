# Unavailable favourites — unified final proposal, APPROVED PO 2026-10-12

Approval and implementation instruction, PO 2026-10-12. Supersedes expired-only and all-state tombstone proposals. Docs PR publication and separate-branch implementation authorized; STOP before implementation merge/tag. Legacy S13 Product-interest labels, star, API, data and login intent remain unchanged; no conversion/subscription/notifications.

## One policy

For the authenticated owner's already saved, previously public exact Offer+point, keep an identifying unavailable card after confirmation expiry (including derived actuality archive) or Seller switch-off. These are two causes of one presentation, not proof of stock or a promise of restoration.

Retain only current committed confirmed title, public Seller display name and point name. No drafts/unconfirmed edits or historical content copies. Show «Сейчас недоступно», normal text contrast, muted accents, no whole-card opacity. Omit price/basis, pack/comment/description, address/coordinates/distance, hours, actuality badge, contacts, route/purchase actions, detail/cover links and gallery. «Убрать из избранного» stays usable except during its own pending request; failure preserves the entry and permits retry. Service errors remain retryable errors.

| Saved exact Offer+point state | Private favourites presentation | Cover |
|---|---|---|
| Common buyer eligibility passes | Normal current price/actions | Existing public media rules |
| Active, confirmation expired, no operator removal | Identifying unavailable card | Currently attached, ordinarily authorized cover; otherwise existing neutral KAIDA placeholder |
| Seller-switched-off, no operator removal | Same identifying unavailable card | Existing neutral KAIDA placeholder; no photo URL/ID in row payload |
| Deleted or operator-removed | Entirely excluded: no row/count/content/identifier/reason | None |
| Draft/unpublished, unknown, missing/changed point or identity | Excluded; never infer replacement identity | None |

Inactive plus expired follows the switched-off media rule. Saving an unavailable Offer remains forbidden. A saved reference is necessary, never sufficient: validate ownership, exact Offer/point, committed origin and absence of removal on every read. No draft or arbitrary inactive-record access, no automatic retargeting to a replacement Offer/point/card.

Restore normal presentation on refresh only when the SAME Offer+point passes all ordinary buyer eligibility requirements again. Use current data and keep the saved heart. Operator return alone is insufficient. Removed/deleted takes precedence; recheck before response. Account switch/logout clears private content and pending intent; late responses cannot restore it. Private no-store list, no public/shared-cache projection.

## Exact approved contract revisions

1. **S1 offer-lifecycle FEATURE_SPEC, buyer visibility** (expired/inactive behaves as absent), **S5 offer-management FEATURE_SPEC §5 deactivate_offer**, **offer-actuality SLICE_CONTRACT §2 Buyer / AC3**: add this explicit exception without changing lifecycle transitions or shared eligibility:

   > Only the authenticated owner of an already saved, previously public exact Offer+point may receive current committed confirmed title, public Seller display name, point name, unavailable status and their own removal handle in their private favourites list after confirmation expiry or Seller switch-off. Deleted/operator-removed, drafts/unpublished and unknown identities remain excluded. This grants no Search, Nearby, ordinary Offer-detail or sales-action access.

   Seller switch-off still withdraws the sales Offer but, under this approval, no longer implies complete identifying-metadata concealment from existing favouriters. This is a NEW explicit disclosure rule, not inferred Seller consent/current permission. The seller-facing switch-off explanation must state that limited persistence. No new temporary/private status or consent toggle proposed; drafts stay private.

2. **offer-photos SLICE_CONTRACT §2 Buyer surfaces / §6 AC7**: ordinary unavailable detail continues to disclose no fields; cross-reference the private favourites metadata exception and specify the cover rule above. **§2 Storage remains unchanged: no inactive-photo exception is requested.** Current `photos.repository.ts/findPhotoAccess` allows an active attachment without operator removal and does not check confirmation age. Expired-active uses that ordinary authorization only. Switched-off returns no media locator and uses the placeholder, even if the same photo is public through another active point. Never add inactive status to public authorization or grant access via a favourite; no private/unattached/historical photo restoration or stale URL reuse.

3. **Buyer-screens composition; draft favourites §3/AC5/manual acceptance**: both non-navigable identifying unavailable variants, usable removal and exact-identity restoration are approved. Existing Search/Nearby/detail presentation stays unchanged. **operator-post-check §2/§4** and media removal remain intact; report-scoped operator evidence, R2 cleanup and backups unaffected.

Minimal internal-reference retention is separately approved: owner User ID, saved-entry ID, Offer/point IDs and savedAt until explicit removal/account erasure under owning policy; no historical content/photo copies. Hiding is not automatic deletion. Excluded rows never affect visible counts or expose retention details. Owned saved-entry DELETE remains idempotent if Offer no longer exists. No deleted-content recovery or backup-erasure promise.

## Future acceptance evidence

Both temporary causes must show identical readable identifying content/no price or sales/detail links. Switched-off DTO/DOM must contain no photo locator. Expired-active authorization failure uses placeholder. Expiry→switch-off removes cover; temporary→deleted/operator removal excludes row/count/content. Ownership/point changes must not disclose or retarget. Direct guessed inactive media URLs receive no NEW permission; legitimate existing owner/other-active-attachment permissions remain unchanged. Reactivation/reconfirmation restores same normally eligible identity/current price/actions. Removal/retry/concurrency/account-switch/late-response proof required; S13 unchanged. Static preview is not API/media/race/persistence proof.

## Preview / approval

[Static gallery](unavailable-preview.html): normal, expired, switched-off with existing neutral placeholder, excluded removed state. [Inline unavailable comparison](unavailable-policy.png). Existing accepted UI/CSS, synthetic text and illustrated expired cover only; not seller photos or media permission evidence. Buttons inert. Readability checks at 320/390px and doubled text recorded separately.

PO 2026-10-12 APPROVED the unified identifying-metadata exception, switch-off disclosure limitation, both compositions, exclusion, exact-identity restoration and minimal internal-reference retention. Implementation authorized separately; final-SHA CI and manual acceptance required before implementation merge/tag.
