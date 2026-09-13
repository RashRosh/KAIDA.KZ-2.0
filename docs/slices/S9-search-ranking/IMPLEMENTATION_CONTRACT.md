# S9 Implementation Contract — deterministic distance / freshness sorting

**Status:** CONTRACT REVIEW; IMPLEMENTATION BLOCKED  
**Feature Spec:** S9 DESIGN APPROVED CONDITIONALLY; contract clarifications incorporated  
**Base checkpoint:** `v0.0.9-s8`  
**Base main:** `23bda8d0c2ae83235ffe75257dd256227b070bc3`  
**Branch:** `slice/s9-search-ranking`

## 1. Objective and hard boundary

Implement exactly this existing-Search extension after explicit implementation approval:

```text
existing Buyer Search
+ optional current Buyer point
+ existing private Location.geo
→ deterministic ordering only
```

S9 must not introduce a second Search path with separate business semantics.

Canonical application flow remains:

```text
query
→ existing S6 Product resolver
→ canonical Product ID
→ existing S1 lifecycle cutoff/predicate
→ eligible Offers
→ optional S9 ranking by Buyer distance
→ existing public SearchResponse
```

Distance never changes Search eligibility.

S11 Nearby discovery remains separate and blocked.

## 2. Existing contracts preserved

S9 consumes these closed contracts unchanged:

### S1 Offer lifecycle

```text
visible Offer =
status = active
AND
last_confirmed_at > cutoff
```

The existing Offers lifecycle module continues to own status, cutoff, strict boundary and visibility predicate.

Search must continue to obtain the cutoff through the existing application flow and pass it to the repository. S9 must not duplicate the lifecycle formula in ranking code.

### S4/S5 Seller ChangeSet

Offer creation, update, activation and deactivation remain ChangeSet-only write flows.

S9 is read-only with respect to Seller/Offer state.

### S6 Product resolution

Both GET and POST Search continue to call the existing shared Product resolver.

No normalization, alias or canonical Product semantics may be changed.

### S7 canonical Offer read

Search continues to read the same ordinary `offers` table written by confirmed Seller flows.

No publish/index/shadow entity is introduced.

### S8 Location geo

Geo remains owned only by Location:

```text
Offer.locationId
→ Location
→ latitude + longitude OR both NULL
```

S9 does not change Seller geo capture, Location mutation, Location schema, validation or ownership.

Raw Seller coordinates remain private.

## 3. Buyer-location UI state machine

Implementation extends the existing Buyer `SearchForm` only.

State must be explicit and local to the mounted page component.

Recommended conceptual type:

```ts
type BuyerLocationState =
  | { kind: 'not_enabled' }
  | { kind: 'requesting' }
  | { kind: 'enabled'; point: BuyerLocation }
  | { kind: 'error' };
```

No persistent storage is allowed.

### 3.1 `not_enabled`

No ranking point exists.

Visible button label exactly:

```text
Учитывать моё местоположение
```

Click behavior:

```text
feature-detect navigator.geolocation
→ if unavailable: error
→ otherwise: requesting
→ issue exactly one getCurrentPosition()
```

### 3.2 `requesting`

No Buyer point is active yet.

Visible disabled button label exactly:

```text
Определяем местоположение…
```

A Search submitted in this state must use the no-location GET path. It must not wait for the geolocation callback and must not guess coordinates.

Success validates/captures only latitude and longitude and transitions to `enabled`.

Any browser-side failure transitions to `error` without calling Search automatically.

### 3.3 `enabled`

The valid point exists only in volatile page memory.

Visible status exactly:

```text
Местоположение будет учтено при следующем поиске.
```

Visible button label exactly:

```text
Не учитывать местоположение
```

Click behavior:

```text
discard point immediately
→ not_enabled
```

No network request is triggered by this transition.

### 3.4 `error`

No Buyer point is active.

Visible status exactly:

```text
Не удалось определить местоположение. Поиск работает без учёта расстояния.
```

Visible button label exactly:

```text
Попробовать снова
```

Click retries the same one-shot geolocation flow.

Search remains functional and uses GET.

### 3.5 Reload

A normal page reload remounts `SearchForm` in `not_enabled`.

S9 must not restore any previous Buyer point from browser or server storage.

## 4. Browser geolocation contract

Location access must never happen on page load, Search submit, login or any background event.

It may happen only after the explicit location-control click in `not_enabled` or `error`.

Use one call semantically equivalent to:

```ts
navigator.geolocation.getCurrentPosition(success, error, {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
});
```

Rationale:

- S9 needs coarse ranking, not Seller-point capture precision;
- high-accuracy GPS is unnecessary for the current slice;
- bounded timeout prevents indefinite waiting;
- a recent cached position is acceptable for one explicit Search-ranking session.

Do not use:

- `watchPosition()`;
- polling;
- background tracking;
- geolocation permission probing APIs;
- manual coordinate fields.

Do not transmit browser geolocation metadata such as accuracy, altitude, altitudeAccuracy, heading or speed.

## 5. Search behavior after location change

S9 explicitly chooses behavior B:

```text
enabling/disabling Buyer location only changes input for the next explicit Search submit
```

No automatic Search repeat occurs after:

- successful geolocation;
- geolocation failure;
- disabling location.

Already rendered results remain unchanged until the Buyer explicitly submits Search again.

This avoids hidden requests and keeps Search actions deterministic and user-driven.

## 6. Buyer-location validation contract

Add:

```text
src/modules/search/contracts/buyer-location.contract.ts
```

It owns only the S9 Buyer-point request validation required by Search.

Canonical point schema is strict and equivalent to:

```ts
{
  latitude: finite JSON number in [-90, 90],
  longitude: finite JSON number in [-180, 180]
}
```

Required rejection cases:

- missing latitude;
- missing longitude;
- string coordinate;
- `null`;
- arrays/objects instead of numbers;
- `NaN` when schema is invoked programmatically;
- `Infinity` and `-Infinity` when schema is invoked programmatically;
- latitude outside `[-90, 90]`;
- longitude outside `[-180, 180]`;
- unknown nested fields.

No generic validation framework is introduced.

## 7. Exact POST request contract

Existing GET remains unchanged:

```text
GET /api/search?q=<query>
```

S9 adds to the same route module:

```text
POST /api/search
Content-Type: application/json
```

Strict canonical body:

```json
{
  "q": "баранина",
  "buyerLocation": {
    "latitude": 43.238949,
    "longitude": 76.889709
  }
}
```

Root object is strict.

Required fields:

```text
q
buyerLocation
buyerLocation.latitude
buyerLocation.longitude
```

`q` must use the existing `searchQuerySchema` semantics rather than a duplicate query validator.

POST must reject:

- missing `q`;
- blank/invalid `q` under existing Search query rules;
- missing `buyerLocation`;
- partial coordinate pair;
- non-number coordinates;
- nested unknown fields;
- root unknown fields;
- out-of-range coordinates;
- programmatic non-finite values at schema level;
- malformed/non-JSON request body.

HTTP invalid POST response:

```text
400 INVALID_SEARCH_REQUEST
```

with a short stable message equivalent to:

```text
Проверьте поисковый запрос и местоположение.
```

This does not change the existing GET invalid-query contract:

```text
400 INVALID_QUERY
```

Infrastructure/Search failure for either method remains:

```text
503 SEARCH_UNAVAILABLE
```

with the existing user-safe Search message.

Both methods set:

```text
Cache-Control: no-store
```

No Buyer authentication is required by S9.

## 8. Shared Search application use-case

There must be one Search use-case only:

```text
searchOffers(...)
```

The existing function remains the canonical application entry point.

The current public call shape used by existing tests/callers must remain source-compatible where practical.

Approved minimal direction:

```ts
searchOffers(
  input: string,
  database?: Database,
  options?: {
    clock?: Clock;
    validityPeriodHours?: number;
    buyerLocation?: BuyerLocation;
  },
): Promise<SearchResponse>
```

The exact internal type name may differ, but these rules are mandatory:

- existing `searchOffers(query, db)` calls continue to work;
- existing S1 clock/validity test overrides continue to work;
- optional Buyer location is the only S9 addition to application input;
- GET invokes the same use-case without Buyer location;
- POST invokes the same use-case with validated Buyer location;
- Product resolution is not duplicated in route handlers;
- lifecycle filtering is not duplicated in route handlers;
- ranking business logic is not duplicated in route handlers.

## 9. Internal Search repository projection

Do not add any private S9 field to the public `SearchOffer` schema.

The existing file:

```text
src/modules/search/contracts/search.contract.ts
```

remains closed and unchanged.

Modify only the Search repository's internal return shape.

Recommended internal contract:

```ts
type SearchOfferCandidate = {
  offer: SearchOffer;
  lastConfirmedAt: Date;
  locationGeo: {
    latitude: number;
    longitude: number;
  } | null;
};
```

The repository query may select the existing public payload plus exactly these private ranking inputs:

```text
offers.lastConfirmedAt
locations.latitude
locations.longitude
```

No other private Seller/Location/Offer data should be added merely because the join exists.

The database S8 constraint guarantees only these persisted geo states:

```text
latitude NULL + longitude NULL
```

or

```text
latitude non-NULL + longitude non-NULL
```

Repository mapping must convert the first state to `locationGeo: null` and the second to a complete point.

Raw coordinates must not be nested into `offer.location` even temporarily.

The Search application layer receives candidates, ranks them, then maps:

```text
candidate.offer
```

into the existing `SearchResponse`.

Thus these values are discarded before the public boundary:

- `lastConfirmedAt`;
- latitude;
- longitude;
- calculated distance.

## 10. Repository and lifecycle ordering boundary

The existing Search repository must continue to use:

```text
visibleOffersPredicate(cutoff)
```

in the PostgreSQL WHERE clause.

Inactive/expired Offers therefore do not become ranking candidates.

S9 ranking must never fetch forbidden S1 Offers and then remove them in application code as a replacement for the existing SQL predicate.

The repository may retain its existing deterministic `offers.id ASC` SQL ordering as an internal read order, but S9 application ranking becomes the authoritative returned ordering.

Do not rely on repository row order, JavaScript stable sort, insertion order or database natural order as a tie-breaker. Final `Offer.id ASC` must be encoded explicitly in the comparator.

## 11. Distance calculation contract

Add:

```text
src/modules/search/ranking/search-ranking.ts
```

This module owns only deterministic S9 ranking mechanics.

### 11.1 Haversine

Given Buyer point `(lat1, lon1)` and Location point `(lat2, lon2)`:

```text
φ1 = lat1 in radians
φ2 = lat2 in radians
Δφ = (lat2 - lat1) in radians
Δλ = (lon2 - lon1) in radians

a = sin²(Δφ/2)
    + cos(φ1) * cos(φ2) * sin²(Δλ/2)
```

Because floating-point operations can produce a tiny boundary overshoot, clamp:

```text
a = min(1, max(0, a))
```

Then:

```text
c = 2 * atan2(sqrt(a), sqrt(1-a))
rawDistanceMeters = 6_371_008.8 * c
rankingDistanceMeters = round(rawDistanceMeters)
```

Internal unit is meters.

No distance is persisted.

### 11.2 With Buyer location

Comparator is exactly:

```text
1. has known Location.geo: known before geoless
2. known-known: rankingDistanceMeters ASC
3. lastConfirmedAt DESC
4. Offer.id ASC
```

If both candidates are geoless, skip distance and use:

```text
lastConfirmedAt DESC
Offer.id ASC
```

### 11.3 Without Buyer location

Ignore Location geo entirely and sort all candidates by:

```text
lastConfirmedAt DESC
Offer.id ASC
```

### 11.4 Offer ID comparison

Final tie-breaker must be deterministic lexical comparison of UUID strings.

Do not use locale-dependent random collation behavior.

A direct code-point lexical comparison is sufficient for canonical UUID strings.

## 12. Distance/freshness priority semantics

With Buyer location, distance is intentionally stronger than freshness.

Therefore:

```text
nearer old-but-still-visible Offer
before
farther newer Offer
```

Freshness only resolves equal rounded-distance ties and ordering inside the geoless group.

S9 does not define a weighted score such as `distance * freshnessCoefficient`.

This keeps ranking explainable and deterministic.

## 13. S9 / S11 boundary

S9 is ranking of an already eligible Product Search result set.

S9 must not add predicates such as:

```text
distance <= radius
```

or:

```text
has geo only
```

or:

```text
same city only
```

S11 may later own geographic discovery/filtering and may justify database-side spatial capabilities based on measured needs.

S9 is not authorization for PostGIS or spatial indexes.

## 14. Buyer-location privacy contract

Buyer coordinates are ephemeral Search input.

They may exist only:

- in the browser Geolocation callback;
- in volatile React state while the page is mounted;
- in the POST request body;
- in local server memory for the duration of request handling/ranking.

They must not be written to:

- PostgreSQL;
- User/Seller/Location/Offer records;
- sessions;
- cookies;
- localStorage;
- sessionStorage;
- analytics;
- Search query history;
- application logs.

Do not include the POST body or coordinates in `console.*` calls.

Existing generic logging such as:

```text
Search request failed
```

may remain only if it contains no request body or coordinate values.

Precise Buyer coordinates must never be placed in GET query parameters or another URL.

Production transport relies on HTTPS.

## 15. Public response privacy contract

The public response remains the exact existing `SearchResponse` / `SearchOffer` DTO.

S9 does not modify:

```text
src/modules/search/contracts/search.contract.ts
```

Forbidden public keys include at minimum:

```text
geo
latitude
longitude
buyerLocation
distance
distanceMeters
lastConfirmedAt
rank
score
```

Automated proof is required for both GET and POST.

Raw Seller Location coordinates must never be returned even though Search reads them internally for POST ranking.

Buyer coordinates must never be echoed.

## 16. Exact DB impact

No DB/schema work is authorized.

```text
migration: none
columns: none
indexes: none
extensions: none
PostGIS: none
spatial index: none
seed change: none
schema change: none
```

Historical migrations are immutable:

```text
drizzle/migrations/0000_s0_first_search.sql
drizzle/migrations/0001_s1_offer_lifecycle.sql
drizzle/migrations/0002_s2_auth.sql
drizzle/migrations/0003_s3_seller_location.sql
drizzle/migrations/0004_s4_seller_change_set.sql
drizzle/migrations/0005_s5_offer_management.sql
drizzle/migrations/0006_s6_product_aliases.sql
drizzle/migrations/0007_s8_location_coordinates.sql
```

`drizzle/migrations/meta/**` is closed.

## 17. Exact implementation whitelist

No implementation begins until explicit contract approval.

After that gate, only the following are pre-authorized.

### Production — modify

```text
src/app/_components/SearchForm.tsx
src/app/api/search/route.ts
src/app/page.module.css
src/modules/search/application/search-offers.ts
src/modules/search/infrastructure/search.repository.ts
```

`page.module.css` may receive only minimal styles needed for the location control/status in the existing Search UI. No redesign is authorized.

### Production — new

```text
src/modules/search/contracts/buyer-location.contract.ts
src/modules/search/ranking/search-ranking.ts
```

### Tests — new

```text
tests/unit/s9-buyer-location-validation.test.ts
tests/unit/s9-search-ranking.test.ts
tests/integration/s9-search-ranking.test.ts
tests/e2e/s9-search-ranking.spec.ts
```

### Contract docs — current authorized stage

```text
docs/slices/S9-search-ranking/FEATURE_SPEC.md
docs/slices/S9-search-ranking/IMPLEMENTATION_CONTRACT.md
```

No other file is automatically authorized.

If implementation needs another production/test/config/migration file, STOP and request whitelist extension before touching it.

## 18. Closed files and contracts

### Search public DTO

Closed:

```text
src/modules/search/contracts/search.contract.ts
src/app/_components/OfferCard.tsx
```

Public DTO shape and Buyer Offer card do not change in S9.

### Offers/S1

Closed:

```text
src/modules/offers/lifecycle/offer-lifecycle.ts
src/modules/offers/config/offer-lifecycle.config.ts
src/modules/offers/db/offers.table.ts
```

Closed semantics:

- active/inactive;
- `lastConfirmedAt` meaning;
- cutoff formula;
- strict `>` freshness boundary;
- validity-period configuration.

### Catalog/S6

Closed:

```text
src/modules/catalog/**
```

Closed semantics:

- query normalization;
- aliases;
- canonical Product identity;
- shared resolver.

### Locations/S8

Closed:

```text
src/modules/locations/**
src/app/api/seller/locations/[id]/geo/route.ts
```

Closed semantics:

- geo belongs only to Location;
- complete pair/null pair;
- coordinate ranges;
- Seller explicit geo flow;
- owner-only Location mutation;
- no raw public Seller coordinates.

S9 may only read existing Location geo inside the Search repository projection.

### Seller Input / Sellers

Closed:

```text
src/modules/seller-input/**
src/modules/sellers/**
```

Closed semantics:

- ChangeSet-only Offer writes;
- confirmation;
- revision/concurrency;
- ownership.

### Identity

Closed:

```text
src/modules/identity/**
```

Search remains anonymous-capable.

### Project/infrastructure

Closed:

```text
src/db/schema.ts
src/db/seed.ts
package.json
pnpm-lock.yaml
playwright.config.ts
.github/**
drizzle/migrations/**
```

No dependency, package, workflow or migration change is authorized.

## 19. Required unit tests

Authorized future file:

```text
tests/unit/s9-buyer-location-validation.test.ts
```

Must cover:

- valid ordinary point;
- exact latitude boundaries `-90`, `90`;
- exact longitude boundaries `-180`, `180`;
- below/above latitude range rejected;
- below/above longitude range rejected;
- missing latitude rejected;
- missing longitude rejected;
- string rejected;
- null rejected;
- unknown nested field rejected;
- strict POST root unknown field rejected at the POST-contract schema level if that schema is colocated/reused;
- programmatic `NaN`, `Infinity`, `-Infinity` rejected.

Authorized future file:

```text
tests/unit/s9-search-ranking.test.ts
```

Must cover Haversine mechanics:

- identical point rounds to `0` meters;
- distance symmetry;
- known fixture within a small documented numeric tolerance before rounding;
- ranking result uses whole meters.

Must cover comparator/order:

- two geo Offers at different distances;
- closer first;
- nearer older visible Offer beats farther newer Offer;
- same distance -> fresher first;
- same distance + same freshness -> Offer ID ASC;
- geo before geoless;
- geoless group freshness then ID;
- no Buyer location -> freshness then ID regardless of geo presence;
- permutations of input candidate order produce identical ranked Offer-ID order.

## 20. Required PostgreSQL integration tests

Authorized future file:

```text
tests/integration/s9-search-ranking.test.ts
```

Use PostgreSQL 18 and controlled clocks where freshness matters.

The test must prove through the real Search application flow:

### 20.1 Different distance

At least two active fresh Offers for the same canonical Product with Locations at different distances from one Buyer point.

Expected:

```text
nearer Offer before farther Offer
```

### 20.2 Equal distance

Use equal Location coordinates or another unambiguous equal rounded-distance fixture.

Expected:

```text
newer lastConfirmedAt first
```

### 20.3 Full ranking tie

Equal rounded distance and equal `lastConfirmedAt`.

Expected:

```text
Offer.id ASC
```

### 20.4 Geoless Offer

A fresh active Offer referencing a geoless Location remains present.

With Buyer location it appears after all known-distance Offers.

Within geoless candidates freshness/ID ordering applies.

### 20.5 No Buyer location

All visible candidates remain present and are ordered:

```text
lastConfirmedAt DESC
Offer.id ASC
```

Location geo presence must not change this fallback order.

### 20.6 S1 before ranking

Include at minimum:

- an inactive Offer that would otherwise be nearest;
- an expired Offer that would otherwise be nearest.

Neither may appear in Search candidates/output.

This proves existing S1 exclusion occurs before S9 ranking rather than ranking then filtering.

### 20.7 Canonical and alias S6 semantics

For canonical `Баранина` and existing alias `мясо барана`, with identical Buyer location and dataset:

```text
same canonical Product
same eligible Offer set
same exact ranked Offer-ID order
```

Without Buyer location, GET-equivalent application calls must likewise preserve the same S6 resolver semantics.

### 20.8 Repeated deterministic result

Repeated application calls with identical:

```text
query
Buyer point or no point
fixed clock
validity period
database state
```

must produce the exact same Offer-ID array.

### 20.9 Internal metadata privacy

Application `SearchResponse` must not contain:

```text
geo
latitude
longitude
buyerLocation
distance
distanceMeters
lastConfirmedAt
```

even when ranking depended on those values internally.

## 21. Required E2E / HTTP tests

Authorized future file:

```text
tests/e2e/s9-search-ranking.spec.ts
```

E2E must cover visible Buyer behavior and HTTP boundaries.

### 21.1 No implicit location request

Instrument/mock browser geolocation.

Before Buyer clicks the location action:

```text
getCurrentPosition call count = 0
```

Ordinary Search must work.

### 21.2 Enable location

After clicking:

```text
Учитывать моё местоположение
```

one location request occurs.

On controlled success UI reaches enabled state and shows:

```text
Местоположение будет учтено при следующем поиске.
Не учитывать местоположение
```

No Search request is automatically triggered by geolocation success.

Next explicit Search uses POST and visually renders nearer geo Offer before farther geo Offer while geoless Offer remains visible after them.

### 21.3 Disable location

Click:

```text
Не учитывать местоположение
```

No Search request is automatically triggered.

Next explicit Search uses GET and visible result order returns to deterministic no-location freshness/ID ordering.

### 21.4 Reload loses location state

After enabling location, reload.

UI must return to:

```text
Учитывать моё местоположение
```

Next Search without re-enabling uses GET.

### 21.5 Browser failure fallback

Automated only, not manual acceptance.

Permission denied/unavailable/timeout/unsupported representative paths must leave Search functional without Buyer location and must not issue geo-aware POST automatically.

At least unsupported plus one GeolocationPositionError path should be proven if Playwright mocking makes all named browser codes inexpensive to cover.

### 21.6 Strict POST validation

Direct HTTP coverage through Playwright request context or browser fetch must prove POST rejects:

- missing body/malformed JSON;
- missing `q`;
- blank `q`;
- missing `buyerLocation`;
- latitude only;
- longitude only;
- string coordinate;
- null coordinate;
- out-of-range latitude;
- out-of-range longitude;
- root unknown field;
- nested unknown field.

Because standard JSON cannot represent `NaN` or `Infinity` as numeric literals, non-finite numeric rejection is proved at schema/unit level; HTTP strings such as `"NaN"`/`"Infinity"` must be rejected as non-number values.

Invalid POST returns:

```text
400 INVALID_SEARCH_REQUEST
```

### 21.7 GET backward compatibility

Existing forms remain valid:

```text
GET /api/search?q=баранина
```

and existing missing/blank GET query semantics remain `400 INVALID_QUERY`.

### 21.8 GET/POST shared S6 semantics

For canonical and alias requests, GET and POST must resolve through the same S6 behavior and return the same canonical Product identity. POST may differ only in ordering because Buyer location is present.

A controlled fixture where distance does not alter the relative order may additionally assert exact GET/POST order equality, but equality of order is not a universal API requirement because the methods intentionally select different ranking modes.

### 21.9 GET/POST response privacy

For Seller Locations with stored geo, both methods must prove public response contains none of:

```text
geo
latitude
longitude
buyerLocation
distance
distanceMeters
lastConfirmedAt
```

This is a direct HTTP privacy proof, not only a visual assertion.

### 21.10 Repeated HTTP ordering

Repeated identical GET requests must return the same Offer-ID order.

Repeated identical POST requests with the same body and unchanged dataset must return the same Offer-ID order.

## 22. Existing regression tests

Existing S0-S8 tests are closed and should not be edited merely to accommodate S9.

Full regression must pass after S9 implementation.

If implementation reveals an existing test whose assertion explicitly encodes the old `offers.id ASC` Search ordering and therefore conflicts with the newly approved S9 public ordering contract, STOP before modifying that test and request whitelist extension with:

- exact test file;
- exact stale assertion;
- why the assertion is superseded by S9;
- minimal proposed edit.

No legacy test file is silently writable under the S9 whitelist.

## 23. Manual acceptance contract

Manual acceptance tests visible user behavior only.

Environment contains three visible Offers for one test Product:

```text
A - geo, nearer
B - geo, farther
C - geoless
```

Procedure:

1. Open Buyer Search with location disabled.
2. Search the Product and confirm ordinary Search works.
3. Click `Учитывать моё местоположение` and allow location.
4. Explicitly submit the same Search.
5. Visually confirm A appears above B and C remains visible after geo-ranked results.
6. Click `Не учитывать местоположение`.
7. Explicitly submit Search again and confirm Search still works without location.
8. Reload and confirm the initial control is again `Учитывать моё местоположение`.

Do not ask the user to inspect:

- SQL;
- database;
- internal IDs;
- coordinate values;
- API JSON;
- CI;
- browser permission-error scenarios.

Those are automated proof responsibilities.

## 24. Explicit non-goals

S9 must not implement:

- Nearby / S11;
- radius filtering;
- geographic eligibility filtering;
- maps/geocoder;
- PostGIS/spatial index;
- Seller geo editing changes;
- distance display;
- Buyer geo persistence/history/profile;
- continuous/background tracking;
- personalization/interests;
- notifications;
- promotions/sponsored ranking;
- subscriptions;
- reviews/ratings;
- AI/ML ranking;
- analytics-based ranking;
- new discovery feed.

## 25. Technical decisions resolved at contract stage

The following are resolved engineering decisions and are not product blockers:

1. Haversine in Search application/ranking code is sufficient for S9.
2. Mean Earth radius is `6_371_008.8 m`.
3. Ranking distance uses `Math.round()` to whole meters.
4. `a` in Haversine is clamped to `[0,1]` before square roots.
5. Buyer geo-aware transport uses POST body, never URL coordinates.
6. Buyer point lives only in volatile page state.
7. Enable/disable does not auto-search.
8. Search submitted while geolocation is pending uses GET/no-location behavior.
9. Public Search DTO is unchanged.
10. No migration/PostGIS/index/dependency is necessary.

## 26. Remaining ambiguity

No blocking product ambiguity remains for S9 implementation under this contract.

If implementation discovers that a requirement cannot be satisfied inside the exact whitelist or requires changing a closed S0-S8 public contract beyond the approved Search ordering/API addition, implementation must STOP and return for controller review.

## 27. Gate

Current gate remains:

```text
S9 DESIGN: APPROVED CONDITIONALLY
S9 CONTRACT STAGE: AUTHORIZED
S9 IMPLEMENTATION: BLOCKED
```

Implementation may begin only after explicit controller response equivalent to:

```text
S9 CONTRACT APPROVED
→ IMPLEMENTATION AUTHORIZED
```
