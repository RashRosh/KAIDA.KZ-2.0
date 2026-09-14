# S10 Implementation Contract — Contact Actions

**Status:** CONTRACT REVIEW; IMPLEMENTATION BLOCKED  
**Feature Spec:** S10 DESIGN APPROVED; mandatory Controller corrections incorporated  
**Base checkpoint:** `v0.0.10-s9`  
**Base main / parent:** `928d20be60ed17601323b4c491eaa2817a07c928`  
**Branch:** `slice/s10-contact-actions`  
**Planned checkpoint after full DoD:** `v0.0.11-s10`

## 1. Hard boundary

After separate explicit implementation authorization, S10 may implement only:

```text
owned Seller
→ structured public contact settings
→ canonical Seller persistence
→ existing Seller-created Offer flow
→ existing Buyer Search
→ optional safe seller.contacts projection
→ existing OfferCard
→ fixed contact actions
```

Contacts belong to Seller.

S10 must not introduce a separate public Seller contacts endpoint for Buyers, a public Seller profile, Seller-controlled URLs, or any contact mutation through Seller ChangeSet.

## 2. Closed contracts preserved

S10 consumes these existing contracts without semantic modification:

### S1 Offer lifecycle

Eligibility remains exactly the existing S1 contract.

Contacts do not affect active/inactive state, freshness cutoff or visibility.

### S2 Identity

Identity remains closed.

S10 may use only the existing current-user/session boundary exposed by Identity.

Identity `User.phone_e164` is authentication data and is never automatically copied into Seller public contacts.

`src/modules/identity/**` is closed.

### S3 Seller / Location

Existing Seller ownership remains:

```text
CurrentUser
→ owned Seller
```

Existing Seller setup request/response remains unchanged.

S10 does not add contacts to `POST /api/seller/setup` or `GET /api/seller/me`.

### S4/S5 Seller ChangeSet

Offer creation and management remain ChangeSet-only.

Contacts are Seller profile/action data and never enter `seller_change_sets` or `seller_change_items`.

### S6 Catalog

Product resolution is unchanged.

### S7 Search source

Confirmed Seller Offers remain ordinary rows in the existing `offers` table and are read by the existing Search path.

### S8 geo/privacy

Location geo ownership and raw-coordinate privacy remain unchanged.

### S9 deterministic ranking

Contacts are not ranking input.

The exact S9 ordering semantics, Buyer-location contract, GET/POST Search behavior and private ranking metadata remain unchanged.

## 3. Approved additive Search exception

The Controller approved exactly this public Seller projection extension:

```ts
seller: {
  id: string;
  displayName: string;
  contacts?: {
    phoneE164?: string;
    whatsappPhoneE164?: string;
    telegramUsername?: string;
    instagramUsername?: string;
  };
}
```

No other Search contract expansion is authorized.

The following remain forbidden:

- Search endpoint changes;
- request query/body semantic changes;
- changes to `buyer-location.contract.ts`;
- changes to Product resolution;
- changes to Offer eligibility;
- changes to ranking algorithm;
- public distance/rank/freshness metadata;
- public raw coordinates;
- Offer DTO fields outside `seller.contacts`.

## 4. Backward-compatible property omission contract

This is a hard S10 invariant.

When no valid contact remains after public sanitization, Search must construct Seller without any `contacts` property at all.

Required construction semantics are equivalent to:

```ts
const contactProperty = projectSellerContactProperty(rawSellerContacts);

const seller = {
  id: row.sellerId,
  displayName: row.sellerName,
  ...contactProperty,
};
```

where:

```ts
projectSellerContactProperty(...)
→ {}
```

when no valid channel exists, and:

```ts
projectSellerContactProperty(...)
→ { contacts: nonEmptyContacts }
```

when at least one valid channel exists.

Forbidden implementation patterns include:

```ts
contacts: undefined
```

and:

```ts
contacts: {}
```

for the no-contact case.

Required proof:

- unit: `Object.prototype.hasOwnProperty.call(result, 'contacts') === false` for no valid channels;
- unit: JSON serialization contains no `contacts` key for no valid channels;
- PostgreSQL integration: a real searchable Seller without contacts returns the same legacy Seller JSON shape and has no own `contacts` property;
- PostgreSQL integration: a Seller whose public projection has no surviving valid channels also omits the property.

The public contacts schema, when present, must reject an empty object so an emitted `{}` cannot silently pass contract validation.

## 5. Resulting database model

Modify only the existing `sellers` table with four nullable columns:

```text
contact_phone_e164   TEXT NULL
whatsapp_phone_e164  TEXT NULL
telegram_username    TEXT NULL
instagram_username   TEXT NULL
```

No separate contacts table is created.

No timestamps, verification flags, source metadata, URLs, revisions or history fields are added.

### 5.1 Phone canonical constraint

For both phone columns, canonical stored value is generic E.164 structural form:

```regex
^\+[1-9][0-9]{1,14}$
```

Required DB check is logically equivalent to:

```sql
contact_phone_e164 IS NULL
OR contact_phone_e164 ~ '^\+[1-9][0-9]{1,14}$'
```

and equivalently for `whatsapp_phone_e164`.

Because the regex contains no whitespace, canonical stored values cannot contain formatting spaces, parentheses or hyphens.

### 5.2 Telegram canonical constraint

S10 KAIDA safe token, not an assertion of complete Telegram platform syntax:

```regex
^[a-z0-9_]{1,64}$
```

Required DB check:

```text
NULL or exact canonical safe token
```

### 5.3 Instagram canonical constraint

S10 KAIDA safe token, not an assertion of complete Instagram platform syntax:

```regex
^[a-z0-9._]{1,64}$
```

Required DB check:

```text
NULL or exact canonical safe token
```

Do not add DB rules for:

- double dots;
- leading dot;
- trailing dot;
- unverified third-party account existence.

These rules are not required for S10 security and have not been approved as platform syntax constraints.

## 6. Migration contract

Planned implementation adds exactly one forward migration:

```text
drizzle/migrations/0008_s10_seller_contacts.sql
```

Historical migrations are immutable:

```text
0000_s0_first_search.sql
0001_s1_offer_lifecycle.sql
0002_s2_auth.sql
0003_s3_seller_location.sql
0004_s4_seller_change_set.sql
0005_s5_offer_management.sql
0006_s6_product_aliases.sql
0007_s8_location_coordinates.sql
```

Migration semantics:

- add only the four nullable contact columns and named narrow CHECK constraints;
- no data backfill;
- no Identity lookup/copy;
- no Seller row rewrite beyond PostgreSQL adding nullable columns;
- no Offer/Location/Product/User change;
- no index is required for S10 because Search already joins Seller by existing Seller identity and S10 does not search/filter by contact values.

Legacy upgrade proof must show:

- existing IDs/data preserved;
- every pre-S10 Seller has all four contact columns `NULL`;
- existing Search remains functional;
- no Identity phone becomes public contact.

## 7. Canonical Sellers-owned contact contract

Create one Sellers-owned contact contract module that owns both:

1. write-input normalization into canonical values;
2. validation of canonical persisted values used by safe public projection.

Recommended file:

```text
src/modules/sellers/contracts/seller-contact.contract.ts
```

The implementation may split pure normalization helpers into the approved contact helper file, but there must be one canonical set of channel schemas/constants so write and public read rules cannot drift.

### 7.1 Canonical types

Conceptual owner view:

```ts
type SellerContacts = {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};
```

Conceptual public non-empty view:

```ts
type SellerPublicContacts = {
  phoneE164?: string;
  whatsappPhoneE164?: string;
  telegramUsername?: string;
  instagramUsername?: string;
};
```

When `SellerPublicContacts` is used publicly it must contain at least one property.

## 8. Phone normalization algorithm

S10 phone normalization is Seller-owned and country-neutral at storage level.

Do not import or refactor Identity `normalize-phone.ts`.

### 8.1 Null/blank

For owner edit input:

```text
null
→ null
```

```text
trimmed empty string
→ null
```

### 8.2 Already canonical international E.164

After trim, if input matches:

```regex
^\+[1-9][0-9]{1,14}$
```

return it unchanged as canonical.

This path supports non-KZ international numbers without schema or migration changes.

### 8.3 KZ-friendly convenience path

Only if the value is not already canonical E.164, S10 may apply the current KZ convenience normalization.

Allowed formatting characters for this KZ convenience path are only:

```text
digits
+
space
(
)
-
```

Remove spaces, parentheses and hyphens, then accept only these complete KZ candidates:

```text
+7XXXXXXXXXX
7XXXXXXXXXX
8XXXXXXXXXX
```

Normalization:

```text
+7XXXXXXXXXX → unchanged
7XXXXXXXXXX  → +7XXXXXXXXXX
8XXXXXXXXXX  → replace leading 8 with +7
```

Final result must match the canonical generic E.164 schema.

S10 does not strip formatting from arbitrary non-KZ international values because country-specific dialing conventions are outside this slice.

### 8.4 Rejection

Reject any non-null/nonblank value that cannot become canonical through the two paths above.

No extensions, letters or URI syntax are accepted.

The exact same normalizer is used for ordinary public phone and WhatsApp phone.

## 9. Telegram normalization algorithm

Owner write input:

```text
null / blank
→ null
```

Otherwise:

```text
trim
→ remove exactly one optional leading @
→ lowercase
→ validate against ^[a-z0-9_]{1,64}$
```

Values containing URL/scheme/path/query/hash syntax fail validation rather than being parsed as URLs.

Examples rejected:

```text
https://t.me/example
t.me/example
javascript:alert(1)
/example
example?x=1
example#x
```

## 10. Instagram normalization algorithm

Owner write input:

```text
null / blank
→ null
```

Otherwise:

```text
trim
→ remove exactly one optional leading @
→ lowercase
→ validate against ^[a-z0-9._]{1,64}$
```

Do not introduce unapproved dot-placement rules.

Examples rejected by the alphabet contract:

```text
https://instagram.com/example
instagram.com/example
javascript:alert(1)
/example
example?x=1
example#x
```

Account existence is not checked.

## 11. Owner API contract

Add exactly one route module:

```text
src/app/api/seller/contacts/route.ts
```

with:

```text
GET /api/seller/contacts
PUT /api/seller/contacts
```

Both are owner-only and `Cache-Control: no-store`.

Both resolve authentication only through the existing Identity current-user path.

### 11.1 GET

Authenticated User with owned Seller:

```json
{
  "contacts": {
    "phoneE164": "+77001234567",
    "whatsappPhoneE164": "+447911123456",
    "telegramUsername": "kaida_shop",
    "instagramUsername": "kaida.shop"
  }
}
```

Each value may be `null`.

Owner GET returns canonical stored values, not generated links.

Authenticated User without Seller:

```text
404 SELLER_NOT_FOUND
```

Anonymous:

```text
401 AUTH_REQUIRED
```

Identity resolution failure:

```text
503 AUTH_UNAVAILABLE
```

Repository/application failure:

```text
503 SELLER_UNAVAILABLE
```

### 11.2 PUT request

Full replacement body. Exact logical shape:

```json
{
  "phone": "8 (700) 123-45-67",
  "whatsappPhone": "+447911123456",
  "telegramUsername": "@kaida_shop",
  "instagramUsername": "@kaida.shop"
}
```

All four keys are required.

Each value is exactly:

```text
string | null
```

Blank strings normalize to `null`.

Root object is strict. Unknown fields are rejected.

Forbidden fields include, without limitation:

```text
sellerId
userId
ownerUserId
url
href
link
redirect
```

Invalid request:

```text
400 INVALID_SELLER_CONTACTS
```

### 11.3 PUT response

Successful response returns canonical owner view:

```json
{
  "contacts": {
    "phoneE164": "+77001234567",
    "whatsappPhoneE164": "+447911123456",
    "telegramUsername": "kaida_shop",
    "instagramUsername": "kaida.shop"
  }
}
```

### 11.4 Atomicity / concurrency

A PUT is one full-state Seller contact replacement and must update the four fields atomically in one Seller row mutation.

Allowed committed states are complete results of one PUT only; a partially updated set of four fields is not allowed.

S10 introduces no contact revision and no optimistic locking.

Two valid concurrent PUTs may use normal PostgreSQL last-committed-writer semantics. Each individual update remains atomic.

## 12. Seller contact repository/application contract

Add a narrow Sellers-owned repository dedicated to contacts rather than expanding the closed S3 Seller repository contract.

Recommended file:

```text
src/modules/sellers/infrastructure/seller-contacts.repository.ts
```

Required repository semantics:

```text
get by owner_user_id
update all four fields by owner_user_id
```

No API/client-supplied Seller ID is required.

Application use cases:

```text
getOwnedSellerContacts(currentUserId)
updateOwnedSellerContacts(currentUserId, rawInput)
```

The update use case:

```text
validate/normalize complete body
→ update current User's owned Seller only
→ return canonical owner contacts
```

No SellerChangeSet dependency.

## 13. Safe public projection contract

Create a Sellers-owned pure projector/helper that receives raw persisted Seller contact values and evaluates each channel independently against canonical channel schemas.

Recommended location:

```text
src/modules/sellers/contact/project-seller-public-contacts.ts
```

Required behavior:

```text
raw channel null
→ omit channel
```

```text
raw channel canonical valid
→ include canonical channel
```

```text
raw channel malformed
→ omit that channel only
```

Do not throw for malformed persisted contact data.

Do not normalize malformed legacy storage into a different public value on the read path. The public read path validates canonical persisted representation and drops values that are not already canonical.

This distinction keeps legacy corruption fail-safe:

```text
write path
→ accepts friendly input
→ normalizes
→ persists canonical

public read path
→ accepts only already-canonical persisted value
→ invalid stored value is omitted
```

Both paths use the same canonical channel schemas/constants from the Sellers contact contract.

### 13.1 Optional property helper

The helper exposed to Search must produce either:

```ts
{}
```

or:

```ts
{ contacts: SellerPublicContacts }
```

where `SellerPublicContacts` is guaranteed non-empty.

This helper is the single implementation point for physical property omission.

## 14. Search repository changes

Only the existing Search Seller projection may change.

`src/modules/search/infrastructure/search.repository.ts` may additionally select the four Seller contact columns already present in the joined Seller row.

No new join is required.

The mapper must call the Sellers-owned safe projector and spread the optional contact property into the existing Seller object.

Search repository must not:

- build contact hrefs;
- validate Buyer input differently;
- change Offer eligibility SQL;
- change ordering SQL/application metadata;
- add a public Seller endpoint;
- read Identity phone;
- expose `owner_user_id`;
- expose geo/ranking metadata.

Malformed contacts must not change whether the Offer row is returned.

## 15. Search contract schema

`src/modules/search/contracts/search.contract.ts` may change only enough to represent the approved optional `seller.contacts` field.

Required public contact keys:

```text
phoneE164
whatsappPhoneE164
telegramUsername
instagramUsername
```

All are optional inside `contacts`.

But when `contacts` itself is present, at least one key must be present with a valid canonical value.

An empty `contacts: {}` must fail Search contract validation.

No generated URL is part of Search DTO.

No other `SearchOffer` field changes.

## 16. Fixed contact action builder

Create one pure KAIDA builder for Buyer actions, recommended:

```text
src/modules/sellers/contact/build-contact-actions.ts
```

It accepts only the already-safe public structured contact object.

It does not accept arbitrary URL input.

Required destinations:

### Phone

```text
phoneE164 = +77001234567
→ tel:+77001234567
```

### WhatsApp

```text
whatsappPhoneE164 = +447911123456
→ https://wa.me/447911123456
```

Only the leading `+` is removed after canonical validation.

### Telegram

```text
telegramUsername = kaida_shop
→ https://t.me/kaida_shop
```

The path segment is constructed from the validated token and may additionally pass through `encodeURIComponent`.

### Instagram

```text
instagramUsername = kaida.shop
→ https://www.instagram.com/kaida.shop/
```

The path segment is constructed from the validated token and may additionally pass through `encodeURIComponent`.

Fixed scheme/host values are source-code constants, never Seller data.

The builder must not accept or concatenate Seller-supplied scheme, hostname, path prefix, query string or fragment.

## 17. Seller UI contract

Add:

```text
src/app/seller/_components/SellerContactSettings.tsx
```

The existing `SellerSetup` component may render it only in the already-existing `seller` state, without changing the S3 setup form contract.

The contact component:

- fetches owner contacts from `GET /api/seller/contacts`;
- displays four optional editable fields;
- sends all four fields in each `PUT`;
- clearly states that contacts are public to Buyers;
- supports clearing any channel with blank input;
- displays server validation errors;
- displays success state after save;
- does not accept Seller ID or URLs.

Existing Seller page CSS utilities should be reused. No redesign is authorized.

## 18. Buyer OfferCard contract

Modify only the existing `OfferCard` presentation to render actions from `offer.seller.contacts` when present.

Fixed action order:

```text
Позвонить
WhatsApp
Telegram
Instagram
```

Missing channel means no element for that channel.

No contacts property means no contacts wrapper/action block.

HTTPS external actions may open a new browsing context only with `rel="noopener noreferrer"` when `target="_blank"` is used.

Phone uses `tel:`.

The UI must not parse or trust arbitrary URLs because none exist in the Search DTO.

## 19. Fail-safe malformed-storage proof

The public projector must be unit-tested directly with synthetic raw persisted values so DB constraints do not make the failure case untestable.

Minimum cases:

```text
valid phone + malformed Telegram + valid Instagram
→ phone included
→ Telegram absent
→ Instagram included
```

```text
all malformed/null
→ optional property helper returns object with no contacts property
```

The integration suite must separately prove that the real Search path uses the projector for ordinary valid/null database state and preserves no-contact JSON shape.

If an isolated PostgreSQL test safely constructs a corrupted legacy state without mutating shared historical migrations or weakening production constraints, it may additionally prove the malformed-storage Search behavior end-to-end. Such a harness is optional; the mandatory behavioral proof is the pure projector unit coverage plus real Search integration coverage.

## 20. Test-first contract

No tests may be written until the Controller explicitly authorizes the test-first stage.

After that gate, S10 dedicated tests are limited to the whitelist below.

### 20.1 Unit

```text
tests/unit/s10-seller-contact-validation.test.ts
tests/unit/s10-public-contact-projection.test.ts
tests/unit/s10-contact-actions.test.ts
```

Required coverage:

- generic canonical E.164 acceptance;
- KZ-friendly normalization;
- rejection of malformed phone;
- independent ordinary/WhatsApp normalization;
- null/blank clearing;
- Telegram optional `@`, lowercase, safe alphabet/length;
- Instagram optional `@`, lowercase, safe alphabet/length;
- no unapproved Instagram dot-placement restrictions;
- URL/scheme/path/query/hash rejection;
- strict PUT object;
- forbidden/unknown field rejection;
- physical absence of `contacts` property when no valid channel;
- non-empty contacts when at least one channel valid;
- malformed channel isolation;
- exact fixed action destinations;
- no Seller-controlled scheme/host.

### 20.2 Integration

```text
tests/integration/s10-migration-upgrade.test.ts
tests/integration/s10-seller-contacts.test.ts
tests/integration/s10-search-contact-projection.test.ts
```

Required coverage:

- PostgreSQL 18 clean migration chain including planned `0008`;
- real S9→S10 upgrade;
- legacy data/IDs preserved;
- all legacy contacts NULL;
- DB CHECK constraints;
- Identity phone not backfilled;
- owner GET/PUT/save/update/clear;
- atomic four-field replacement;
- anonymous rejection;
- no-Seller behavior;
- owner isolation;
- strict invalid/spoof request behavior;
- valid contact projection on real Search;
- no-contact Seller has physically absent `contacts` property;
- serialized no-contact JSON has no `contacts` key;
- empty contacts object is never emitted;
- S1 visibility unchanged;
- S6 canonical/alias equivalence unchanged;
- exact S9 Offer-ID order unchanged before/after contact writes with and without Buyer location;
- no `ownerUserId`, Identity phone, raw geo or ranking metadata leak.

### 20.3 E2E

```text
tests/e2e/s10-contact-actions.spec.ts
```

Run on existing mobile and desktop Playwright projects.

Required real flow:

```text
Seller login
→ existing Seller setup if needed
→ save contacts through real Seller UI
→ existing create/confirm ChangeSet flow
→ Buyer Search
→ exact Seller-created Offer
→ correct actions and hrefs
→ clear one channel through Seller UI
→ Buyer Search again
→ only that action disappears
```

External third-party pages do not need to complete network loading in automated tests. Verify the exact generated destination boundary without depending on Telegram/Meta availability.

Existing tests are closed by default. If a new S10 proof exposes an objectively stale legacy assertion, implementation must stop and classify it before editing any existing test.

## 21. Exact production whitelist

After explicit implementation authorization, production changes are limited to exactly the following paths.

### Modify

```text
src/modules/sellers/db/sellers.table.ts
src/modules/search/contracts/search.contract.ts
src/modules/search/infrastructure/search.repository.ts
src/app/_components/OfferCard.tsx
src/app/page.module.css
src/app/seller/_components/SellerSetup.tsx
drizzle/migrations/meta/_journal.json
```

### Create

```text
drizzle/migrations/0008_s10_seller_contacts.sql
drizzle/migrations/meta/0008_snapshot.json

src/modules/sellers/contracts/seller-contact.contract.ts
src/modules/sellers/contact/normalize-seller-contacts.ts
src/modules/sellers/contact/project-seller-public-contacts.ts
src/modules/sellers/contact/build-contact-actions.ts
src/modules/sellers/infrastructure/seller-contacts.repository.ts
src/modules/sellers/application/get-owned-seller-contacts.ts
src/modules/sellers/application/update-owned-seller-contacts.ts

src/app/api/seller/contacts/route.ts
src/app/seller/_components/SellerContactSettings.tsx
```

No other production file is pre-authorized.

If implementation proves another production file is objectively required, STOP and request scope expansion before changing it.

## 22. Exact test whitelist

After explicit test-first authorization, only these new test files are pre-authorized:

```text
tests/unit/s10-seller-contact-validation.test.ts
tests/unit/s10-public-contact-projection.test.ts
tests/unit/s10-contact-actions.test.ts

tests/integration/s10-migration-upgrade.test.ts
tests/integration/s10-seller-contacts.test.ts
tests/integration/s10-search-contact-projection.test.ts

tests/e2e/s10-contact-actions.spec.ts
```

Existing S0-S9 tests are closed by default.

No `playwright.config.ts`, workflow or test-runner change is pre-authorized.

## 23. Closed files and contracts

Unless the Controller separately approves a defect-driven scope expansion, S10 must not modify:

```text
drizzle/migrations/0000_s0_first_search.sql
drizzle/migrations/0001_s1_offer_lifecycle.sql
drizzle/migrations/0002_s2_auth.sql
drizzle/migrations/0003_s3_seller_location.sql
drizzle/migrations/0004_s4_seller_change_set.sql
drizzle/migrations/0005_s5_offer_management.sql
drizzle/migrations/0006_s6_product_aliases.sql
drizzle/migrations/0007_s8_location_coordinates.sql

drizzle/migrations/meta/0000_snapshot.json
drizzle/migrations/meta/0001_snapshot.json
drizzle/migrations/meta/0002_snapshot.json
drizzle/migrations/meta/0003_snapshot.json
drizzle/migrations/meta/0004_snapshot.json
drizzle/migrations/meta/0005_snapshot.json
drizzle/migrations/meta/0006_snapshot.json
drizzle/migrations/meta/0007_snapshot.json

src/db/schema.ts
src/db/seed.ts

src/modules/identity/**
src/modules/catalog/**
src/modules/offers/**
src/modules/seller-input/**
src/modules/locations/**

src/modules/sellers/contracts/seller.contract.ts
src/modules/sellers/application/setup-seller.ts
src/modules/sellers/application/get-owned-seller.ts
src/modules/sellers/infrastructure/sellers.repository.ts

src/modules/search/application/search-offers.ts
src/modules/search/contracts/buyer-location.contract.ts
src/modules/search/ranking/search-ranking.ts

src/app/api/search/route.ts
src/app/api/seller/setup/route.ts
src/app/api/seller/me/route.ts
src/app/seller/page.tsx
src/app/seller/page.module.css

package.json
pnpm-lock.yaml
playwright.config.ts
.github/**
```

Semantic contracts that remain closed:

```text
S1 lifecycle
S2 Identity
S3 Seller setup
S4/S5 Seller ChangeSet
S6 Catalog resolver
S7 ordinary Offer Search source
S8 geo ownership/privacy
S9 ranking and Buyer-location semantics
```

## 24. Verification boundary after future implementation

S10 cannot be declared ready on implementation alone.

Future DoD requires, in order:

```text
approved contract
→ authorized test-first commit
→ implementation within whitelist
→ new tests green
→ full pnpm verify green
→ actual GitHub Actions green
→ manual acceptance
→ Controller merge authorization
→ merge to main
→ merged-main CI green
→ annotated v0.0.11-s10 tag
→ tag-triggered CI green if the existing project gate requires it
```

No step in this contract authorizes any of those implementation/merge/tag actions yet.

## 25. Current gate

Current state after this docs-only contract package:

```text
S0-S9: CLOSED
S10 DESIGN: APPROVED
S10 SEARCH CONTRACT EXCEPTION: APPROVED, additive-only
S10 CONTRACT: PENDING CONTROLLER REVIEW
S10 TEST-FIRST: BLOCKED
S10 IMPLEMENTATION: BLOCKED
S10 AUTOMATED VERIFICATION: BLOCKED
S10 MANUAL ACCEPTANCE: BLOCKED
S10 MERGE: BLOCKED
S10 TAG: BLOCKED
S11: BLOCKED
```

Required next action:

```text
STOP
→ CONTROLLER CONTRACT REVIEW
```
