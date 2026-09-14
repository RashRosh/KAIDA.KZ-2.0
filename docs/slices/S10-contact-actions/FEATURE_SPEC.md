# S10 Feature Spec — Contact Actions

**Status:** DESIGN APPROVED; CONTRACT REVIEW; IMPLEMENTATION BLOCKED  
**Base checkpoint:** `v0.0.10-s9`  
**Base main:** `928d20be60ed17601323b4c491eaa2817a07c928`  
**Branch:** `slice/s10-contact-actions`

## 1. User task

Buyer finds an existing visible Offer through the existing Search flow and can contact that Offer's Seller through one of the public contact channels that the Seller explicitly configured.

Canonical vertical flow:

```text
authenticated Seller
→ owner-only public contact settings UI
→ validation / normalization
→ Seller-owned persisted contacts
→ existing Seller ChangeSet Offer flow
→ existing visible Offer
→ existing Buyer Search
→ optional safe seller.contacts public projection
→ OfferCard contact actions
→ fixed KAIDA-built external destination
```

Contacts belong to `Seller`, not to `Offer` and not to `Location`.

Seller ChangeSet is not used for contacts.

## 2. User value

S10 closes the first complete Buyer action after finding an Offer:

```text
find product
→ identify Seller / Location
→ contact Seller
```

The Buyer does not need a separate public Seller profile or a second request per Offer card.

The Seller controls only structured contact values. The Seller never supplies a public URL or redirect target.

## 3. Scope

S10 includes only:

- four optional Seller public contact channels:
  - phone;
  - WhatsApp phone;
  - Telegram username;
  - Instagram username;
- separate ordinary public phone and WhatsApp phone;
- owner-only Seller contacts read/edit flow inside the existing `/seller` surface;
- explicit Seller notice that saved contacts are visible to Buyers;
- generic canonical E.164 storage for phone values;
- KZ-friendly phone input normalization as a convenience for the current launch market;
- safe handle normalization for Telegram and Instagram;
- PostgreSQL persistence on the existing `sellers` table;
- one forward migration planned as `0008_s10_seller_contacts.sql`;
- additive-only public `seller.contacts` projection inside the existing Search read model;
- physical omission of `seller.contacts` when there is no valid public contact;
- fail-safe per-channel public projection for malformed persisted data;
- Buyer contact actions inside the existing `OfferCard`;
- fixed KAIDA-built destinations for phone, WhatsApp, Telegram and Instagram;
- unit, migration, integration and mobile/desktop E2E proof after implementation authorization;
- full S0-S9 regression verification.

## 4. Explicit out of scope

S10 excludes:

- public Seller profile page;
- arbitrary Seller website URL;
- arbitrary external URL fields;
- Seller-controlled `url`, `href`, `link` or `redirect` values;
- Seller-controlled URI schemes;
- internal KAIDA chat;
- orders, cart, checkout, payments or delivery;
- reviews or rating;
- contact click analytics or conversion attribution;
- notifications;
- Discovery or Nearby;
- maps/geocoding;
- Favorites;
- AI/voice/photo/video Seller Input;
- Telegram bot;
- multiple phone numbers of the same channel type;
- multiple Telegram or Instagram accounts;
- account ownership verification against Telegram/Instagram/WhatsApp;
- external API checks that a handle or phone account actually exists;
- exact third-party platform username syntax beyond the safe KAIDA input contract defined in S10;
- Seller contact history;
- Seller contact revision/optimistic locking;
- Offer-specific contacts;
- Location-specific contacts;
- Seller ChangeSet actions for contacts;
- changes to existing S3 Seller setup;
- S11 or later slices.

## 5. Approved Search contract exception

S0-S9 remain closed.

For S10, the Controller explicitly approved one narrow additive exception to the closed Search public contract.

Existing:

```ts
seller: {
  id: string;
  displayName: string;
}
```

S10 may become:

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

This exception applies only to the public Seller projection inside the existing Search read model.

S10 must not change:

- Search query semantics;
- GET Search behavior;
- POST Search behavior;
- Search endpoint;
- S6 Product resolver;
- S1 eligibility/lifecycle;
- S8 geo ownership/privacy;
- S9 distance/freshness ranking;
- Buyer-location contract;
- ranking metadata;
- Offer public shape outside `seller.contacts`.

## 6. Backward-compatible Search shape

The absence rule is strict.

If the Seller has no valid public contact channel, `contacts` must physically not exist as a property of `SearchOffer.seller`.

Valid legacy-compatible result:

```json
{
  "seller": {
    "id": "uuid",
    "displayName": "Seller"
  }
}
```

Forbidden internal/public shapes for a Seller without contacts:

```ts
{ id, displayName, contacts: undefined }
```

```json
{ "id": "...", "displayName": "...", "contacts": {} }
```

The same rule applies after fail-safe sanitization: if every stored channel is invalid or null, `contacts` is omitted entirely.

S10 automated proof must include both unit and PostgreSQL integration assertions for physical property absence and backward-compatible JSON shape.

## 7. Seller contact model

Contacts are optional singleton fields owned by Seller.

Conceptual Seller extension:

```text
Seller
- id
- display_name
- owner_user_id
- contact_phone_e164 NULLABLE
- whatsapp_phone_e164 NULLABLE
- telegram_username NULLABLE
- instagram_username NULLABLE
```

S10 does not create a separate SellerContact aggregate/table because the slice has exactly four singleton fields and no history, verification state, ordering, metadata or multiple values per channel.

Existing Sellers upgrade with all four fields `NULL`.

No contact is backfilled from Identity.

## 8. Phone semantics

### 8.1 Storage

Both ordinary phone and WhatsApp phone are stored in generic canonical E.164 form:

```text
+<country code><subscriber number>
```

Canonical structural contract:

```regex
^\+[1-9][0-9]{1,14}$
```

This keeps storage and the public contract country-neutral and avoids a future database migration when KAIDA.KZ expands outside Kazakhstan.

### 8.2 Accepted input

The S10 application layer must accept at minimum:

1. an already canonical international E.164 value, for example:

```text
+447911123456
+12025550123
+77001234567
```

2. KZ-friendly convenience forms for the current market, including:

```text
+7 700 123 45 67
7 700 123 45 67
8 700 123 45 67
8 (700) 123-45-67
```

These normalize to:

```text
+77001234567
```

S10 does not invent generic formatting rules for all countries. A non-KZ international number with spaces/punctuation is not required in S10 unless it is already canonical E.164 after trim.

Identity phone normalization is not reused or refactored. Identity remains a closed bounded context.

### 8.3 Independence

`contact_phone_e164` and `whatsapp_phone_e164` are independent.

They may contain the same number or different numbers.

Identity `User.phone_e164` is never automatically copied to either field and is never automatically published.

## 9. Telegram and Instagram handle semantics

S10 deliberately defines a security-safe KAIDA token contract, not an asserted complete mirror of current third-party platform username rules.

No external platform syntax assumption beyond the safe token contract is encoded as a DB invariant.

### Telegram

Accepted Seller input:

```text
@kaida_shop
kaida_shop
```

Normalization:

```text
trim
→ remove one optional leading @
→ lowercase
```

Canonical KAIDA safe token:

```regex
^[a-z0-9_]{1,64}$
```

### Instagram

Accepted Seller input:

```text
@kaida.shop
kaida.shop
```

Normalization:

```text
trim
→ remove one optional leading @
→ lowercase
```

Canonical KAIDA safe token:

```regex
^[a-z0-9._]{1,64}$
```

S10 intentionally does not add assumptions such as:

- `..` forbidden;
- leading `.` forbidden;
- trailing `.` forbidden.

Those would require a separately verified platform-syntax decision and are not needed for the S10 security boundary.

The restricted alphabets already reject URL/scheme/path/query/hash syntax such as:

```text
https://...
javascript:...
data:...
t.me/name
/name
name?x=1
name#fragment
```

S10 does not verify that a third-party account exists.

## 10. Seller ownership and editing

Seller contact mutation boundary is:

```text
session
→ existing S2 CurrentUser
→ Seller owned by CurrentUser
→ full contact replacement
```

The client never supplies:

- `userId`;
- `ownerUserId`;
- `sellerId`.

S10 adds a small owner-only contact settings card only after an owned Seller exists.

Existing S3 setup remains unchanged:

```text
User
→ Seller
→ first Location
```

Contacts are not added to `POST /api/seller/setup` and are not added to `GET /api/seller/me`.

The contact flow is a separate owner-only surface.

## 11. Seller UX

Inside the existing authenticated `/seller` experience, after Seller exists, show a card:

```text
Контакты для покупателей

Телефон
[...]

WhatsApp
[...]

Telegram
[...]

Instagram
[...]

Эти контакты будут видны покупателям в ваших предложениях.

[Сохранить контакты]
```

Fields are optional.

Blank/whitespace input means remove that public channel.

After successful save the UI shows a clear success state such as:

```text
Контакты сохранены.
```

S10 does not redesign `/seller` and does not turn the page into a generic Seller profile editor.

## 12. Buyer UX

The existing `OfferCard` receives contact actions only when the corresponding structured channel exists in the Search public projection.

Fixed visual order:

```text
Позвонить
WhatsApp
Telegram
Instagram
```

Only available channels render.

Examples:

```text
only Telegram configured
→ only Telegram action
```

```text
no contacts configured
→ no contact action block
```

```text
all four configured
→ four actions
```

Mobile requirements:

- usable touch targets;
- actions may wrap;
- no horizontal overflow;
- keyboard focus reaches every rendered action.

S10 does not require icons, modal dialogs or a new Buyer page.

## 13. No Seller-controlled href

DB, Seller API and Search public projection contain only structured normalized values.

They must never contain Seller-controlled fields named or semantically equivalent to:

```text
url
href
link
redirect
```

External destinations are always constructed by KAIDA from fixed schemes/domains:

```text
phone
→ tel:<canonical E.164>

WhatsApp
→ https://wa.me/<canonical E.164 digits without leading +>

Telegram
→ https://t.me/<encoded validated username>

Instagram
→ https://www.instagram.com/<encoded validated username>/
```

A Seller value cannot choose another scheme or host.

## 14. Fail-safe public projection

Write validation is not the only public safety boundary.

Search must sanitize persisted Seller contact columns before exposing them.

Required behavior is per channel:

```text
valid Phone + invalid Telegram + valid Instagram
→ Phone published
→ Telegram omitted
→ Instagram published
→ Offer remains searchable
```

One malformed channel must not:

- fail Search;
- hide other valid channels;
- hide the Offer;
- produce an unsafe href.

If all channels are absent/invalid after safe projection:

```text
seller.contacts property is physically absent
```

Sellers owns one canonical contact validation/normalization contract. The write path normalizes input into canonical values using that contract. The public projection validates persisted canonical values against the same canonical channel schemas so write and read safety rules do not drift.

## 15. API product behavior

S10 adds owner-only endpoints:

```text
GET /api/seller/contacts
PUT /api/seller/contacts
```

No anonymous Buyer contacts endpoint is introduced.

Buyer continues to use the existing Search endpoint and receives the approved additive Seller projection.

`PUT` is full replacement for the four managed fields, not PATCH semantics.

No Seller ID is accepted in the URL or body.

## 16. Database impact

S10 requires one planned forward migration:

```text
0008_s10_seller_contacts.sql
```

It adds only four nullable Seller contact columns plus narrow canonical-value CHECK constraints.

It does not:

- modify Offer;
- modify Location;
- modify User/Identity;
- create new Product data;
- backfill contacts;
- add a contact table;
- add a URL column;
- add a migration for Search;
- add a revision column.

Historical migrations `0000-0007` remain immutable.

## 17. Search/ranking preservation

S10 contact data is presentation/action metadata only.

It must not affect:

- Product resolution;
- Offer visibility;
- Offer count;
- distance calculation;
- freshness calculation;
- geoless behavior;
- deterministic tie-breakers;
- GET/POST Search choice;
- Buyer location persistence/privacy.

For identical Offer/ranking data, adding/removing Seller contacts must leave the S9 Offer ID ordering exactly unchanged.

## 18. Acceptance criteria

S10 may be accepted only when all of the following are true:

1. Implementation base is exactly `928d20be60ed17601323b4c491eaa2817a07c928` unless the Controller separately rebases the slice.
2. Historical migrations `0000-0007` remain unchanged.
3. Exactly one forward S10 migration adds the four nullable Seller contact columns.
4. Existing Sellers upgrade with all four contacts `NULL`.
5. Existing User/Seller/Location/Offer/Product identities survive upgrade.
6. Identity phone is not copied into Seller contacts.
7. Generic canonical international E.164 input is accepted for phone and WhatsApp.
8. Required KZ-friendly convenience phone forms normalize to canonical `+7...`.
9. Phone and WhatsApp may differ.
10. Telegram input accepts an optional leading `@`, normalizes to lowercase safe token and rejects URL/scheme/path/query/hash syntax.
11. Instagram input accepts an optional leading `@`, normalizes to lowercase safe token and rejects URL/scheme/path/query/hash syntax.
12. No unverified dot-placement rule is introduced for Instagram.
13. Seller can read, save, change and clear own contacts through the real `/seller` UI/API flow.
14. Anonymous contact read/write is rejected.
15. A User cannot edit another Seller's contacts through the S10 API surface.
16. Existing S3 Seller setup request/response semantics remain unchanged.
17. Contacts do not enter Seller ChangeSet.
18. A Seller-created Offer continues to use the existing ChangeSet confirmation flow.
19. Buyer finds that Offer through the existing Search flow.
20. Search adds only the approved optional `seller.contacts` projection.
21. Seller with zero valid public channels has no own `contacts` property in the in-memory Search result.
22. Seller with zero valid public channels has no `contacts` key in serialized Search JSON.
23. Empty `{}` contacts are never emitted.
24. `contacts: undefined` is never constructed/emitted for the no-contact case.
25. Unit proof explicitly checks physical property absence.
26. PostgreSQL integration proof explicitly checks physical property absence/backward-compatible JSON shape.
27. Each malformed persisted contact channel is independently dropped by the safe public projection.
28. One malformed persisted channel does not suppress other valid channels.
29. Malformed persisted contacts do not make the Offer unsearchable.
30. Search never publishes `owner_user_id`.
31. Search never publishes Identity `User.phone_e164` automatically.
32. Search continues to hide raw Seller geo and Buyer geo.
33. DB/API/Search do not contain Seller-controlled URL/href/link/redirect fields.
34. Phone action uses only the fixed `tel:` construction.
35. WhatsApp action uses only `https://wa.me/`.
36. Telegram action uses only `https://t.me/`.
37. Instagram action uses only `https://www.instagram.com/`.
38. Missing channel produces no action.
39. No contacts produces no contact action block.
40. Adding/removing contacts does not change S1 eligibility.
41. Adding/removing contacts does not change S6 resolution.
42. Adding/removing contacts does not change S9 deterministic Offer ordering with or without Buyer location.
43. Existing GET and POST Search request behavior remains unchanged.
44. Full S0-S9 regression remains green.
45. Dedicated S10 unit/migration/integration/mobile+desktop E2E proof passes.
46. Manual acceptance passes through the browser only.

## 19. Manual acceptance

One short browser scenario:

1. Login through the existing S2 test auth flow.
2. Ensure the current User owns a Seller and Location through the existing flow.
3. Open `/seller`.
4. In `Контакты для покупателей`, enter:
   - an ordinary public phone;
   - a WhatsApp phone;
   - a Telegram username;
   - an Instagram username.
5. Save and see `Контакты сохранены.`
6. Create and explicitly confirm an Offer through the existing Seller ChangeSet flow.
7. Logout.
8. Search for that Product through the normal Buyer Search.
9. Find the exact Seller-created Offer.
10. Verify visible actions `Позвонить`, `WhatsApp`, `Telegram`, `Instagram`.
11. Activate the Telegram action and verify it opens the fixed `t.me/<username>` destination for the entered handle.
12. Return to Seller contacts, clear one channel, save, then search again and verify only that action disappeared while the Offer and remaining actions still work.
13. Check the primary action layout on mobile and desktop without horizontal overflow.

Manual acceptance does not require SQL, DevTools, exact internal IDs, migration inspection or third-party account existence verification.

## 20. Gate

This Feature Spec records the conditionally approved S10 design plus Controller corrections.

Implementation is still blocked.

The next required gate is:

```text
CONTROLLER CONTRACT REVIEW
→ explicit S10 CONTRACT APPROVED
→ only then test-first stage may be authorized
```
