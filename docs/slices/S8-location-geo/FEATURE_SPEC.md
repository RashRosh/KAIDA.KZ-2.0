# S8 Feature Spec — Location Geo

**Status:** DESIGN APPROVED; CONTRACT STAGE AUTHORIZED; IMPLEMENTATION BLOCKED  
**Base checkpoint:** `v0.0.8-s7`  
**Base main:** `2ee23d35575d88c192d14e0ebfa57d542c7d0bbd`  
**Branch:** `slice/s8-location-geo`

## 1. User task

Authenticated Seller can save the current physical position of an existing owned Location from the Seller UI.

Canonical flow:

```text
authenticated Seller
→ existing owned Location
→ explicit "use my location" action
→ one browser getCurrentPosition() request
→ owner-only Location geo update
→ saved geographic point
→ reload
→ same point remains saved
```

Geo belongs to `Location`, not `Seller` and not `Offer`.

## 2. Scope

S8 adds only the minimum complete vertical slice required to persist a Location geographic point:

- nullable latitude/longitude on existing `Location`;
- one canonical Location geo validation contract;
- owner-only API to set or replace the complete point;
- browser/device geolocation initiated only by explicit Seller action;
- Seller UI state for geo absent / saved / browser error / server error;
- persistence after reload;
- authorization and foreign-Location protection;
- PostgreSQL 18 migration and constraints;
- unit, integration, migration and mobile/desktop E2E coverage;
- regression proof that existing Search and Seller ChangeSet/Offer flows remain unchanged.

## 3. Product behavior

Existing and newly created Locations may legally have no geo.

A new Seller setup remains:

```text
Seller + first Location with geo = null
```

Seller setup request is not extended with coordinates.

For an owned Location without geo, Seller sees that location is not set and may explicitly request browser geolocation. For an owned Location with geo, Seller may explicitly request geolocation again and replace the complete point.

S8 does not provide manual coordinate entry, map pin, address geocoding or geo clearing.

## 4. Browser geolocation

S8 uses one-shot browser/device geolocation only:

```text
navigator.geolocation.getCurrentPosition(...)
```

It is invoked only after explicit Seller action.

It is never requested:

- on page load;
- automatically after login;
- for Buyer;
- by polling or `watchPosition()`.

If geolocation is unsupported, permission is denied, position is unavailable, timeout occurs, or the browser/location service otherwise fails before a coordinate pair is obtained:

- no server mutation is attempted;
- existing `Location.geo` is unchanged;
- Seller sees a clear browser-side error.

Real deployment requires a secure context (`HTTPS`). Localhost is permitted for development and tests.

## 5. Data semantics

Conceptual Location shape becomes:

```text
Location
- id
- seller_id
- name
- address_text
- type
- latitude NULLABLE
- longitude NULLABLE
```

Allowed states are only:

```text
both coordinates NULL
```

or:

```text
both coordinates present and valid
```

Half-points are forbidden.

Legacy Locations are not backfilled. Their geo remains null after migration.

Existing Offers referencing geo-less Locations remain valid and searchable.

## 6. Ownership and privacy

Mutation boundary is:

```text
Current User
→ owned Seller
→ Location.id + Location.seller_id
→ geo update
```

Client-supplied ownership is never trusted.

Foreign and nonexistent Locations are indistinguishable through the owner mutation API.

`GET /api/seller/me` intentionally extends the owner-side Location representation with `geo`.

Buyer Search remains a separate closed public projection. It must not expose `geo`, `latitude` or `longitude`, including for `home` Locations.

Seller ChangeSet Location DTOs remain unchanged and do not gain geo fields.

## 7. Search and Offer boundary

S8 does not change Search visibility, ordering, ranking or result count.

Coordinates are not copied to `Offer`.

Canonical relationship remains:

```text
Offer.location_id
→ Location.id
→ Location.geo
```

Distance logic belongs to S9. Nearby discovery belongs to S11.

## 8. Explicit out of scope

S8 excludes:

- Buyer geo;
- distance calculation or display;
- distance/freshness sorting or ranking;
- Nearby/radius search;
- S9 or S11 implementation;
- PostGIS, spatial extensions or spatial indexes;
- map UI or map provider;
- geocoding/reverse geocoding/address autocomplete;
- manual latitude/longitude entry;
- `watchPosition()` or polling;
- geo history, accuracy, altitude, heading or speed;
- clearing/deleting geo;
- Location name/type/address editing;
- second Location creation or generic Location CRUD;
- Seller ChangeSet for Location;
- public raw coordinates;
- changes to Search schema/projection;
- changes to Offer lifecycle;
- redesign.

## 9. Acceptance criteria

S8 is acceptable only when all of the following are true:

1. Base remains exactly `2ee23d35575d88c192d14e0ebfa57d542c7d0bbd`.
2. Historical migrations `0000-0006` remain byte-for-byte unchanged.
3. Exactly one S8 migration is added: `0007_s8_location_coordinates.sql`.
4. Existing Seller, Location and Offer IDs survive upgrade.
5. Existing `Offer.location_id` values survive upgrade unchanged.
6. Every legacy Location has geo null after migration; no coordinate backfill occurs.
7. Existing Location without geo remains valid.
8. Existing Offer whose Location has no geo remains searchable under existing rules.
9. DB permits only complete valid point or complete null state.
10. DB range checks reject latitude outside `[-90, 90]` and longitude outside `[-180, 180]`.
11. PostgreSQL 18 tests explicitly prove rejection behavior for `NaN`, `Infinity` and `-Infinity` rather than assuming it.
12. API body requires exactly finite numeric `latitude` and `longitude`; half-point and unknown fields are rejected.
13. Seller can set geo for an existing owned Location.
14. Seller can replace geo with another complete valid point.
15. Repeating the same PUT returns `200 OK`; no `NO_CHANGES`, revision or optimistic locking is introduced.
16. Anonymous mutation receives `401 AUTH_REQUIRED`.
17. Authenticated User cannot mutate a foreign Location.
18. Foreign and nonexistent Location return the same `404 LOCATION_NOT_FOUND` semantics.
19. Browser geolocation is requested only after explicit Seller action.
20. Unsupported/denied/unavailable/timeout browser failures cause no API mutation and preserve existing geo.
21. Saved geo survives reload through `GET /api/seller/me`.
22. Seller setup request remains unchanged and new Location starts with geo null.
23. `/api/search` response contains no `geo`, `latitude` or `longitude` for shop or home Locations.
24. Search schema/projection, ordering and lifecycle behavior remain unchanged.
25. Seller ChangeSet Location projection remains unchanged.
26. Existing S0-S7 regression suite remains green.
27. Dedicated S8 unit, integration, migration and mobile/desktop E2E coverage passes on PostgreSQL 18.
28. Manual acceptance passes in one short Seller-to-Buyer scenario.

## 10. Manual acceptance

1. Login as Seller.
2. Open `/seller` with an existing Location.
3. Verify the Location shows that geographic position is not set.
4. Click `Использовать моё местоположение` while browser location permission is available.
5. Allow location access.
6. Verify UI reports that location is saved.
7. Reload `/seller` and verify the saved state remains.
8. Open normal Buyer Search and verify the existing Offer still behaves as before and no raw coordinates are displayed or exposed by Search.

Browser permission edge cases, malformed coordinates, DB constraints and cross-user isolation are automated-test responsibilities.

## 11. Gate

This document defines S8 product behavior only.

Implementation remains blocked until:

```text
S8 CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED
```
