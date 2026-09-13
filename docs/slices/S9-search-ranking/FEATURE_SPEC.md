# S9 Feature Spec — deterministic distance / freshness sorting

**Status:** CONTRACT REVIEW; IMPLEMENTATION BLOCKED  
**Base checkpoint:** `v0.0.9-s8`  
**Base main:** `23bda8d0c2ae83235ffe75257dd256227b070bc3`  
**Branch:** `slice/s9-search-ranking`

## 1. User task

Buyer searches for a Product through the existing Search flow and receives the same eligible Offers in a predictable order.

If Buyer explicitly enables current browser location for this page, Search ranks Offers with known `Location.geo` by distance first, then freshness, then a final deterministic tie-breaker.

If Buyer location is unavailable or not enabled, Search remains fully functional and uses deterministic freshness ordering.

Canonical flow with Buyer location:

```text
query
→ existing S6 Product resolver
→ canonical Product ID
→ existing S1 visible Offers only
→ read private Location.geo ranking metadata
→ Haversine distance
→ deterministic ranking
→ existing public SearchResponse
```

Canonical flow without Buyer location:

```text
query
→ existing S6 Product resolver
→ canonical Product ID
→ existing S1 visible Offers only
→ deterministic freshness ordering
→ existing public SearchResponse
```

S9 changes ordering only. It does not filter by distance and does not implement Nearby discovery.

## 2. Scope

S9 includes only:

- optional one-shot Buyer browser geolocation initiated by explicit Buyer action;
- volatile Buyer-location state for the current page only;
- additive geo-aware `POST /api/search` request path;
- preservation of existing `GET /api/search?q=...` for Search without Buyer location;
- one shared Search application use-case for GET and POST;
- Haversine distance calculation in Search application/ranking logic;
- rounded whole-meter ranking distance;
- deterministic distance/freshness/Offer-ID ordering;
- deterministic no-location fallback ordering;
- geoless Offers remaining searchable;
- internal Search projection containing private ranking metadata only;
- strict Buyer-location request validation;
- privacy protection for Seller and Buyer coordinates;
- automated unit, PostgreSQL integration and E2E proof after implementation is authorized.

## 3. Buyer-location UI state machine

Buyer location is never requested automatically.

Location state is held only in volatile React page state. It is not persisted in cookies, session, local storage, session storage, database or Buyer profile.

The exact states are:

### `not_enabled`

Meaning: no Buyer point is active for ranking.

Visible control:

```text
Учитывать моё местоположение
```

Action:

```text
click
→ requesting
```

### `requesting`

Meaning: one `navigator.geolocation.getCurrentPosition()` call is pending. No Buyer point is active until success.

Visible disabled control:

```text
Определяем местоположение…
```

If Buyer submits Search while this request is still pending, Search deterministically executes without Buyer location through the existing GET path.

Transitions:

```text
success → enabled
browser failure → error
```

### `enabled`

Meaning: one valid Buyer point exists only in page memory and will be used for the next explicit Search submit.

Visible status:

```text
Местоположение будет учтено при следующем поиске.
```

Visible control:

```text
Не учитывать местоположение
```

Action:

```text
click
→ discard Buyer point immediately
→ not_enabled
```

No reload and no storage clearing is required to stop using Buyer location.

### `error`

Meaning: browser geolocation is unsupported, denied, unavailable, timed out or otherwise failed. No Buyer point is active.

Visible status:

```text
Не удалось определить местоположение. Поиск работает без учёта расстояния.
```

Visible control:

```text
Попробовать снова
```

Action:

```text
click
→ requesting
```

Search remains available in this state and uses the existing no-location GET path.

### Reload semantics

Reload always starts in:

```text
not_enabled
```

A previously obtained Buyer point must not survive reload.

## 4. Search behavior after Buyer-location change

S9 deliberately chooses the smaller behavior:

```text
location enable/disable does NOT automatically repeat Search
```

Enabling location changes ranking input only for the next explicit Buyer Search submit.

Disabling location discards the Buyer point immediately but does not reorder already rendered results. The next explicit Search submit uses no-location ordering.

This applies identically whether Search is submitted by button or Enter.

S9 does not create background re-search, automatic network requests after geolocation success, or automatic network requests after disabling location.

## 5. Browser geolocation behavior

S9 uses only:

```text
navigator.geolocation.getCurrentPosition(...)
```

and only after explicit Buyer action.

Recommended call contract:

```text
enableHighAccuracy: false
timeout: 10000
maximumAge: 60000
```

S9 does not use:

- `watchPosition()`;
- polling;
- background location;
- continuous tracking;
- accuracy/altitude/heading/speed persistence or transmission.

Only `coords.latitude` and `coords.longitude` are used.

## 6. Deterministic ranking behavior

### With Buyer location

The complete ordering is:

```text
1. known Location.geo before geoless
2. rounded Haversine distanceMeters ASC
3. lastConfirmedAt DESC
4. Offer.id ASC
```

For geoless Offers:

```text
1. lastConfirmedAt DESC
2. Offer.id ASC
```

### Without Buyer location

All visible Offers, whether geo or geoless, are ordered by:

```text
1. lastConfirmedAt DESC
2. Offer.id ASC
```

Random ordering and database natural row order are not valid tie-breakers.

## 7. Distance semantics

Distance is calculated only when both are available:

- current transient Buyer point;
- complete existing `Location.geo`.

Formula: Haversine great-circle distance with Earth mean radius:

```text
R = 6 371 008.8 meters
```

Calculation uses JavaScript numeric double precision.

Ranking distance is:

```text
distanceMeters = Math.round(haversineDistanceMeters)
```

Sub-meter differences do not affect ranking.

Distance is an ordering input only. S9 never excludes an Offer because it is far away.

No distance value is returned in the public Search DTO in S9.

## 8. S1 freshness interaction

S1 visibility is applied before S9 ranking.

The existing visibility contract remains unchanged:

```text
status = active
AND
last_confirmed_at > cutoff
```

where cutoff continues to be calculated by the existing Offers lifecycle/config contract.

Therefore:

- inactive Offers are excluded before ranking;
- expired Offers are excluded before ranking;
- `last_confirmed_at == cutoff` remains expired;
- S9 does not create a new freshness score;
- among already-visible Offers, newer `lastConfirmedAt` is the freshness tie-breaker.

## 9. Geoless behavior

An Offer whose Location has no geo remains a valid Search result.

With Buyer location:

```text
all known-distance Offers
before
all geoless Offers
```

Without Buyer location, geo presence has no ranking effect.

This preserves the S8 contract that legacy and new geoless Locations remain valid and searchable.

## 10. API product behavior

Existing no-location Search remains:

```text
GET /api/search?q=<query>
```

Geo-aware Search is additive:

```text
POST /api/search
```

with strict body:

```json
{
  "q": "баранина",
  "buyerLocation": {
    "latitude": 43.238949,
    "longitude": 76.889709
  }
}
```

Both GET and POST invoke the same Search application use-case, same S6 resolver, same S1 lifecycle filtering and same public response DTO.

POST does not replace GET.

Buyer coordinates are intentionally not placed in URL query parameters.

## 11. Privacy behavior

Seller raw coordinates remain private internal ranking metadata.

Buyer coordinates are transient request input only.

S9 must not persist Buyer coordinates in:

- PostgreSQL;
- cookies;
- browser storage;
- auth/session state;
- analytics;
- Search history;
- Buyer profile;
- application logs.

The public Search response must not contain:

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

The existing public Location shape remains unchanged.

## 12. Exact DB impact

S9 requires no database change:

```text
new migration: NO
new column: NO
new index: NO
new extension: NO
PostGIS: NO
spatial index: NO
schema change: NO
```

Historical migrations `0000` through `0007` remain immutable.

## 13. Explicit out of scope

S9 excludes:

- S11 Nearby discovery;
- separate "Что есть рядом" output;
- radius filtering;
- maximum-distance filtering;
- maps;
- map UI;
- geocoder/reverse geocoder;
- address autocomplete;
- PostGIS;
- spatial extensions/indexes;
- seller geo editing changes;
- manual Buyer coordinates;
- Buyer home point;
- Buyer location history;
- background location;
- `watchPosition()`;
- continuous tracking;
- routing/travel time;
- distance display;
- personalization;
- interests/followed Products;
- notifications;
- promotion/sponsored ranking;
- subscriptions;
- ratings/reviews;
- AI/ML ranking;
- analytics-based ranking;
- discovery feed.

## 14. Acceptance criteria

S9 is acceptable only when all of the following are true:

1. S6 remains the single shared Product resolver for Search.
2. S1 lifecycle filtering remains unchanged and happens before ranking.
3. Inactive Offers never enter ranked output.
4. Expired Offers never enter ranked output.
5. With Buyer location, known geo ranks before geoless.
6. With Buyer location, rounded whole-meter distance sorts ascending.
7. Equal ranking distance is broken by `lastConfirmedAt DESC`.
8. Equal distance and freshness is broken by `Offer.id ASC`.
9. Geoless Offers remain searchable.
10. Geoless group sorts by freshness then Offer ID.
11. Without Buyer location, all visible Offers sort by freshness then Offer ID.
12. Same dataset plus same inputs returns exactly the same Offer-ID order repeatedly.
13. Browser location is never requested before explicit Buyer action.
14. Buyer can explicitly enable location for this page.
15. Buyer can explicitly disable location without reload or storage clearing.
16. Enable/disable does not automatically repeat Search.
17. Search submitted while geolocation is pending uses no-location ordering.
18. Browser geolocation failure does not block ordinary Search.
19. Reload loses Buyer-location state.
20. Existing GET Search remains backward compatible.
21. Geo-aware POST validates a strict complete Buyer point.
22. GET and POST use the same Search business logic and S6/S1 semantics.
23. Public Search response shape remains unchanged.
24. Seller coordinates never cross the public Search boundary.
25. Buyer coordinates never cross the public Search boundary.
26. Distance and `lastConfirmedAt` never cross the public Search boundary.
27. Buyer coordinates are not persisted or logged by application code.
28. No migration, dependency, package or workflow change is introduced.
29. Existing S0-S8 regression suite remains green.
30. Dedicated S9 unit, integration and E2E proof passes after implementation is authorized.

## 15. Manual acceptance

Acceptance environment should already contain three visible Offers for one test Product:

```text
A - Location with geo, nearer to controlled Buyer point
B - Location with geo, farther from controlled Buyer point
C - Location without geo
```

Visible manual scenario only:

1. Open Buyer Search with location not enabled.
2. Search for the test Product and verify Search works.
3. Click `Учитывать моё местоположение` and allow browser location.
4. Submit the same Search explicitly.
5. Verify visually that nearer Offer A appears above farther Offer B and geoless Offer C remains visible after the geo-ranked Offers.
6. Click `Не учитывать местоположение`.
7. Submit the same Search explicitly again and verify Search still works in no-location mode.
8. Reload the page and verify the control has returned to `Учитывать моё местоположение`, proving Buyer location was not persisted.

Manual acceptance does not require API inspection, SQL, database inspection, IDs, coordinates, CI checks or a browser-permission-error scenario.

## 16. Gate

This document defines S9 product behavior only.

Implementation remains blocked until the complete S9 contract package is explicitly approved:

```text
S9 CONTRACT APPROVED
→ IMPLEMENTATION AUTHORIZED
```
