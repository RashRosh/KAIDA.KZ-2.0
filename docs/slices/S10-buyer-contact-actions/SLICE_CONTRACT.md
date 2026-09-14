# S10 — Buyer contact actions

**Status:** CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED  
**Base:** `c3ef0f52685221b488a15404902412f552624400`  
**Branch:** `slice/s10-buyer-contact-actions`

## User task

Buyer finds an existing real Offer in normal Search and can contact that Offer's Seller through one of the Seller's explicitly published contact channels: phone, WhatsApp, Telegram, or Instagram.

Canonical flow:

`Seller public contacts → existing Search Offer → Buyer contact action`

## Scope

- Public contacts belong to `Seller`, not `Offer` or `Location`.
- Four independent optional contact identifiers: phone, WhatsApp phone, Telegram username, Instagram username.
- Owner-only contact read/write in the existing `/seller` area through a narrow authenticated contacts resource.
- Additive `seller.contacts?` projection in existing Search Offer.
- KAIDA.KZ builds contact targets from canonical structured identifiers.
- Existing OfferCard shows only available actions in order: `Позвонить → WhatsApp → Telegram → Instagram`.
- Removing one contact removes only that action.

## Public Search contract

Existing closed shape:

```text
seller: { id, displayName }
```

is explicitly allowed to become:

```text
seller: {
  id,
  displayName,
  contacts?: {
    phoneE164?: string
    whatsappPhoneE164?: string
    telegramUsername?: string
    instagramUsername?: string
  }
}
```

Rules:

- a missing individual contact is omitted, never returned as `null`;
- if no public contacts exist, the entire `contacts` field is omitted;
- `{ contacts: {} }` is not public output;
- values are canonical structured identifiers only;
- Seller-controlled URL/href/redirect/query target is never returned;
- all existing Search Offer fields remain unchanged;
- contacts do not affect Search eligibility, matching, lifecycle, freshness, geo, or ordering.

## Canonical contact formats

Phone and WhatsApp use full canonical E.164, not the KZ-specific Identity normalizer:

```text
^\+[1-9][0-9]{1,14}$
```

Identity login phone is never copied or published automatically as a Seller contact.

Telegram canonical value is lowercase username matching:

```text
^[a-z0-9_]{1,64}$
```

Instagram canonical value is lowercase username matching:

```text
^[a-z0-9._]{1,64}$
```

Stored usernames contain no `@`, protocol, URL, slash, query string, or fragment. S10 does not verify external-account existence.

## Owner-side contacts API

Existing `/api/seller/setup` and `/api/seller/me` semantics remain unchanged.

S10 adds only:

```text
GET /api/seller/contacts
PUT /api/seller/contacts
```

Seller ID is never client-selected. Owner is resolved only server-side:

`authenticated User → owned Seller`

Successful GET response:

```text
{
  contacts: {
    phoneE164: string | null,
    whatsappPhoneE164: string | null,
    telegramUsername: string | null,
    instagramUsername: string | null
  }
}
```

PUT is **full replacement**, not PATCH. Request body contains the complete new state:

```text
{
  phoneE164: string | null,
  whatsappPhoneE164: string | null,
  telegramUsername: string | null,
  instagramUsername: string | null
}
```

`null` removes that contact. Successful PUT response is the same owner-side representation as GET.

Authorization:

- anonymous → `401`;
- authenticated User without owned Seller → `404 SELLER_NOT_FOUND`;
- client cannot select or spoof Seller ownership;
- mutation always applies only to the current User's owned Seller.

## Buyer link construction

KAIDA.KZ constructs targets itself:

```text
phoneE164 → tel:<E164>
whatsappPhoneE164 → https://wa.me/<digits without +>
telegramUsername → https://t.me/<encoded username>
instagramUsername → https://www.instagram.com/<encoded username>/
```

Seller cannot store or control a target URL.

## Explicit out of scope

Cart, order, payment, delivery, internal chat, internal messages, phone/account verification, arbitrary external URLs, Offer/Location contacts, contacts through SellerChangeSet, automatic Identity-phone publication, Seller profile redesign, multiple contact sets, analytics, reviews/ratings, notifications, promotion, Search matching/filtering/ranking changes, Offer lifecycle changes, Geo/Discovery changes.

## Closed contracts touched

- **S2 Auth:** existing current-user semantics only.
- **S3 Seller / Location:** ownership and `/api/seller/setup` / `/api/seller/me` semantics unchanged; Seller storage is extended additively.
- **S4/S5 SellerChangeSet:** contacts never enter ChangeSet.
- **S6 Catalog:** Product resolution unchanged.
- **S7 Search:** only approved additive `seller.contacts?`; Seller-created Offer flow unchanged.
- **S8 Geo:** Seller raw coordinates remain private.
- **S9 Ranking:** contacts never influence eligibility, distance, freshness, tie-breakers, or ordering.

## Architectural boundaries

**Sellers** owns persistent contacts, validation/canonical representation, owner-only read/write, and public contact projection. **Identity** only resolves the authenticated User. **Search** joins the public Seller contact projection into the existing read model without owning contact business logic. **Buyer UI / OfferCard** renders fixed actions from structured public identifiers. **Offers, Catalog, Locations, Seller Input** gain no new business logic.

Persistent DB change is additive only; historical migrations remain immutable.

## Acceptance criteria

1. Seller may have zero public contacts and its Offers remain searchable.
2. Only authenticated owner can read/update its Seller contacts.
3. All four contacts can be independently stored or removed; PUT is full replacement and `null` removes only the corresponding contact.
4. Stored/public values satisfy the fixed canonical formats and arbitrary target URLs are rejected.
5. Identity phone is never automatically published.
6. Public Search omits missing individual contacts and omits `contacts` entirely when none exist.
7. Search returns the same eligible Offer IDs in the same S9 order regardless of contacts.
8. With all four contacts OfferCard shows `Позвонить`, `WhatsApp`, `Telegram`, `Instagram` in that order.
9. Every href is generated by KAIDA.KZ from canonical identifiers; Seller never controls the target URL.
10. Removing Telegram removes only Telegram action; other saved actions remain.
11. Contact changes do not alter Offer ID, lifecycle/freshness, Catalog resolution, geo, or ranking.
12. Buyer actions remain usable without horizontal overflow on mobile and desktop.

## Risk flags and verification

- **DB migration: YES** — migration-upgrade integration proof from existing S9 schema; old Seller rows remain valid and null contacts work.
- **Public API: YES** — unit/integration proof of exact public projection plus owner GET/PUT full-replacement semantics.
- **Auth/security/privacy: YES** — integration proof for owner-only access, `401`, no-Seller `404`, no client-selected Seller, no automatic Identity-phone publication, no arbitrary URLs.
- **Concurrency/atomicity: NO special risk** — no dedicated concurrency proof.
- **Data loss: LOW** — prove `null` clears only selected contact under full replacement state.
- **External service: NO** — no external API calls or external-service tests.

Targeted automated proof: contact validation/projection/link unit tests; migration upgrade; Seller contacts API integration; Search projection/order regression; mobile+desktop E2E. Then one full branch CI on final executable SHA. No repeated exact-SHA CI without a concrete flakiness/race/nondeterminism signal.

## Manual acceptance

1. Log in as a prepared Seller and save phone, WhatsApp, Telegram and Instagram on `/seller`.
2. As Buyer, Search an existing real Offer from that Seller and verify four actions in the required order with a visually intact card.
3. Return to Seller UI, remove Telegram and save.
4. Repeat Buyer Search and verify Telegram disappeared, the other three actions remain, and the same Offer is still found.

Manual acceptance does not require API, SQL, DevTools, internal IDs, or manual href inspection.

## Gate

Implementation is authorized by the Product Owner, but manual acceptance and merge remain blocked until implementation diff and automated proof are reviewed by the Controller.
