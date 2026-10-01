# KAIDA address directory — Almaty pilot

**Status:** `IMPLEMENTED — REAL-DATA AND MANUAL ACCEPTANCE PENDING`

**Approved:** 2026-10-01 by direct Product Owner instruction: «Утверждают контракт реализуй».

**Prepared:** 2026-10-01 after repository, data-source, licence and coverage preflight.

**Base checkpoint:** `v0.0.43-seller-location-geo-fallback`

**Base commit:** `762e1700d8efa661d5e95cb7c72bec26070409e6`

This is stage 1a from `docs/product/EXECUTION_PLAN.md`. It is one vertical slice: a Seller can search the
KAIDA-owned directory while entering a trading-point address, select a result, review it and save the address plus
geo point. The directory is an accelerator. Manual address entry and the already closed browser/map-link geo paths
remain fully usable when the directory has no result or is unavailable.

## 0. Approved closed-contract revision

Two current contracts deliberately separate Location identity from geo:

- `docs/slices/seller-trading-points-workspace/SLICE_CONTRACT.md` says identity edit changes only
  `name / type / addressText`, never geo;
- S3 and the current create/edit APIs reject coordinates and other unknown fields supplied by the client.

An address-directory selection is different from an arbitrary text edit: the selected server-owned directory entry
contains one canonical address and one coordinate pair. Saving its address but not its point would violate the
accepted stage-1a scenario; saving them in two client requests could leave a truthful address paired with old or
missing geo after a partial failure.

**Proposed revision:** current create/setup/edit mutations may accept only an optional opaque
`addressDirectoryEntryId`, never client-supplied coordinates. The backend resolves the active directory entry and
atomically writes its `addressText + latitude + longitude` with the rest of the Location mutation. Manual text
continues to use the old semantics and never changes saved geo.

Consequences:

- selecting a directory result is an explicit Seller action that may replace existing geo;
- editing the selected text invalidates the selection and returns the form to manual mode;
- a missing/stale entry rejects the whole mutation without partial identity or geo changes;
- owner scoping, coordinate constraints and buyer-facing raw-geo privacy remain unchanged;
- this revision does not allow arbitrary coordinates in Location identity payloads and does not weaken the existing
  owner-scoped geo endpoint.

Affected closed contracts/modules: S3 setup/create semantics, Seller Trading Points identity update, the embedded
new-point path in the seller card editor, S8 coordinate invariants and Search privacy regression coverage.

Product Owner approved this revision together with the contract on 2026-10-01 before implementation started.

## 1. Preflight decision and evidence

### Coverage — sufficient for an Almaty pilot, not an official completeness claim

Read-only audit on 2026-10-01 used the current OSM administrative boundary for Almaty (relation `2465058`) and the
Overpass dataset timestamp `2026-10-01T04:46:09Z`:

| Metric inside the Almaty boundary | Objects |
|---|---:|
| `addr:housenumber` | 134,066 |
| `addr:housenumber + addr:street` | 129,026 |
| Share with both house and street | 96.24% |

Target seller landmarks are also present in OSM: for example, Зелёный Базар is marketplace relation `20040804`,
and Алтын Орда is represented as marketplace objects. This is enough to test a useful directory over houses,
streets and seller-relevant markets/retail places. It does **not** prove that every address, market entrance,
pavilion, row or informal landmark is present or correct. Manual entry therefore remains a permanent first-class
path, not a temporary error state.

The audit used Overpass only as read-only planning evidence. Production does not call Overpass.

### Source and update cadence

- Primary source: the daily Kazakhstan OSM PBF extract from
  [Geofabrik](https://download.geofabrik.de/asia/kazakhstan.html). At preflight it was about 213 MB and included an
  upstream data timestamp on the download page.
- Initial operational cadence: one reproducible refresh each week. Daily upstream availability does not require a
  daily KAIDA import during the pilot.
- Every import records source URL, upstream timestamp, checksum, importer version, start/finish time and counts.
- The import is idempotent for the same source checksum and activates a complete validated snapshot atomically.
  Failed or incomplete imports leave the previous active snapshot searchable.
- OSM data, generated extracts and database dumps are not committed to Git.

### Licence and attribution

OSM data is licensed under ODbL. The
[OSM copyright page](https://www.openstreetmap.org/copyright) requires attribution and identification of the licence;
the [OSMF attribution guideline](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) explicitly covers
geocoding/search. The
[OSMF legal FAQ](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ) also explains public-use and
Derivative Database share-alike obligations.

KAIDA therefore:

- keeps OSM-derived directory data isolated from Seller/Location business data;
- shows a legible `© OpenStreetMap contributors · ODbL` link whenever directory suggestions/results are shown;
- preserves source/provenance metadata and a reproducible transformation path;
- treats the derived address index as ODbL-derived data and completes the required public-use/share-alike compliance
  mechanism before public production launch. This contract is not legal advice; any uncertainty at that launch gate
  goes to legal review rather than silently removing attribution or mixing proprietary data into the index.

### Hosting/index decision

For this pilot, use the existing KAIDA PostgreSQL deployment with a separate address-directory schema/table boundary
and PostgreSQL `pg_trgm` indexes. Do not deploy Nominatim, PostGIS, Elasticsearch or a second runtime service.

Reasoning:

- the directory needs bounded Almaty suggestions, not a general-purpose global geocoder;
- official Nominatim documentation describes a substantially larger Python/PostGIS/osm2pgsql operational stack;
- the public Nominatim policy explicitly forbids client-side autocomplete and is not a runtime option;
- a filtered address/market/street index in the existing database keeps the request path internal and lets current
  migration, backup and observability procedures own it.

The real import verification must report row count, table/index size, import duration and representative query
latency before activation. If that evidence makes the shared database unsafe, implementation stops for a revised
hosting decision; it does not silently add another service.

## 2. User task

A Seller entering or changing a trading-point address can find a likely Almaty address, street or relevant market in
KAIDA's own directory, explicitly select it, review the resolved address and save it together with its geo point;
if it is absent or search is unavailable, the Seller can still save the address manually and use the existing geo
methods.

## 3. Scope

- Almaty-only pilot dataset cut by the current OSM administrative boundary, with deterministic handling if the
  boundary object is unavailable in a future source snapshot;
- repeatable OSM PBF import/update path for address objects, deduplicated named streets and seller-relevant
  market/retail places; generic transit stops, routes and unrelated named objects are not imported merely because
  they have a name;
- source provenance, import metadata, active-snapshot semantics and safe failed-import rollback;
- typo-tolerant, case-insensitive matching across available OSM name variants and address components, including
  `ё/е` normalization; no machine translation of source data;
- authenticated Seller suggestions API with strict query validation, a small bounded result set and no bulk export;
- shared address-input behavior in the persistent trading-point editor and the embedded new-point path in the card
  editor, so current ways to create a Location do not drift;
- explicit result selection and review; selection is invalidated if the Seller edits the returned address;
- atomic server-side resolution of an optional directory entry during first setup, additional Location create and
  Location identity edit;
- visible OSM/ODbL attribution with directory results;
- graceful empty/error/unavailable behavior that preserves the typed value and manual save path.

The current Russian UI and existing responsive frame are used. This slice adds no Kazakh proofreading/localization
pass and no separate desktop redesign, per Product Owner direction. It also does not remove currently working locale
or responsive behavior.

## 4. Explicit out of scope

- external paid geocoder, public Nominatim/Overpass runtime calls, map SDK, tiles, embedded map or draggable pin;
- Kazakhstan-wide rollout, other cities, cross-border addresses or official-state-address-registry claims;
- reverse geocoding, routing, distance calculation or buyer address search;
- collecting/copying data from 2GIS, Google Maps or Yandex Maps;
- arbitrary client-supplied coordinates in setup/create/edit identity payloads;
- changing the existing explicit browser geolocation or map-link parser flows;
- automatic address correction after save, silent movement of a Location or background overwriting of Seller data;
- importing every OSM POI, transit stop, route or business;
- Backoffice address editor, crowd corrections, OSM editing or moderation workflow;
- Kazakh UI copy review and desktop redesign;
- automated production scheduler if the reproducible weekly operator run is sufficient for the pilot.

## 5. Data and request boundaries

The address directory is a read-only reference domain. It does not own Seller or Location data.

Conceptual minimum:

```text
AddressDirectoryImport
  source URL / timestamp / checksum / importer version / counts / status

AddressDirectoryEntry
  active snapshot / stable source key / kind
  display name / address text / searchable variants
  latitude / longitude / source provenance
```

Implementation may choose exact table/type names, but must preserve these boundaries:

- source keys are deterministic and unique within an import; street segments and duplicate POI representations do
  not create visibly repeated suggestions;
- only a fully validated import becomes active, in one atomic switch;
- search reads only the active snapshot;
- Location rows copy selected `addressText + geo`; they do not retain a live FK whose later OSM refresh could mutate
  seller data;
- API selection sends an opaque directory entry id/key. The backend re-resolves the active entry and ignores any
  client attempt to pair it with different coordinates;
- an address typed or changed without a valid selection remains manual input and follows existing Location rules.

## 6. Search and UI behavior

- No request for blank/one-character input. Search begins after at least 3 trimmed characters and is debounced.
- Return at most 8 results. Ranking favors normalized prefix/word matches, then indexed trigram similarity, with
  sensible kind priority; ranking must be deterministic for equal scores.
- Each result has one clear primary label and a secondary Almaty/address context. Exact internal OSM ids and raw tag
  bags are not rendered.
- Selecting a result fills the address and marks it as directory-backed. Before the final Location save, the Seller
  sees the resolved address and explicitly confirms it.
- Editing the filled address clears the directory selection immediately; a subsequent save is manual and cannot
  move geo implicitly.
- Empty results, API errors, stale data or no network never clear the typed address and never disable manual save.
  The already translated helper `Сохраним так, как вы написали` / its existing locale equivalent remains the manual
  path; no new localization pass is introduced.
- OSM attribution is visible with the results, keyboard reachable and linked to the OSM copyright/licence page.

## 7. Risk flags

| Risk | Status | Contract consequence |
|---|---|---|
| DB migration | **YES** | New isolated directory/import storage and `pg_trgm`; migration upgrade and clean-install proof required. No PostGIS. |
| Public API | **YES** | New authenticated Seller suggestion read endpoint and optional directory-entry selection on existing Location mutations. Strict inputs and bounded outputs. |
| Auth/security/privacy | **YES** | Suggestions require a valid User session; no bulk endpoint. Seller ownership remains server-derived. Buyer APIs still expose no raw coordinates. |
| Concurrency/atomicity | **YES** | Snapshot activation and selected address+geo Location writes are atomic. Concurrent import cannot expose a partial dataset. |
| Data loss | **YES, bounded** | Failed import preserves the old snapshot; manual identity edits preserve geo; directory selection replaces geo only after explicit confirmation. |
| External service | **YES, offline only** | Import downloads a checksummed Geofabrik PBF. Runtime search has no external service dependency and must work from the last active local snapshot. |
| Licence/compliance | **YES** | ODbL attribution/provenance/share-alike gate is part of acceptance, not a later cosmetic task. |

## 8. Acceptance criteria

1. A reproducible import consumes a checksummed Kazakhstan OSM PBF, cuts Almaty, creates only the contracted address,
   street and seller-relevant market/retail entries, records provenance/counts and activates the complete snapshot
   atomically; the same checksum is an idempotent no-op.
2. A failed, cancelled or invalid import leaves the previous active snapshot and runtime search fully usable; removed
   upstream entries disappear only after a later successful complete snapshot activation.
3. Authenticated Seller search accepts only a strict trimmed query of contracted length, begins at 3 characters,
   returns at most 8 deterministic suggestions and rejects anonymous, malformed and bulk-shaped requests without
   exposing raw tag bags or the whole directory.
4. Search finds representative Almaty house/street and marketplace fixtures by exact, prefix, case-insensitive,
   `ё/е` and one realistic typo variant through an index-backed plan; unrelated named OSM objects are absent.
5. Both current Location creation surfaces use the same suggestion behavior. Empty/error/unavailable search keeps the
   typed value and manual Location creation/edit fully usable.
6. A selected result is visibly reviewable and saved only after explicit Seller confirmation. OSM attribution is
   legible and linked wherever suggestions/results are shown.
7. First setup, additional Location create and identity edit with a selected directory entry resolve that entry on
   the server and atomically save its current address plus valid coordinate pair; arbitrary client coordinates remain
   rejected.
8. Editing a selected address clears selection. Manual create stores no inferred geo; manual edit preserves existing
   geo and the current address/geo warning behavior.
9. A foreign, missing, stale or malformed directory entry cannot cause a partial Location update. Existing Seller
   ownership/non-disclosure semantics and DB coordinate constraints remain green.
10. Buyer Search/Nearby and offer APIs expose no raw `latitude`/`longitude` after a directory-backed save; Location
    keeps copied values and is not silently changed by a later directory refresh.
11. Runtime code makes no request to Geofabrik, OSM, Overpass, Nominatim or a map provider. With the directory empty
    or unavailable, manual address plus existing browser/map-link geo flows still complete.
12. Real Almaty import evidence records rows, DB/index size, import duration and representative query latency;
    targeted tests, migration proof, full regression and branch CI pass on the final executable SHA.

## 9. Automated and operational verification

### Unit

- normalization (`trim`, case, punctuation/spacing, `ё/е`) without destructive transliteration;
- deterministic result ranking and tie-break;
- OSM entry filtering, kind assignment, street/POI deduplication and display-address construction;
- selected-entry state invalidation when address text changes.

### Integration

- clean migration plus upgrade from the previous checkpoint; `pg_trgm` and indexes exist without PostGIS;
- import provenance, same-checksum idempotency, complete snapshot replacement and rollback on injected failure;
- indexed exact/prefix/typo queries, deterministic limit and query validation;
- suggestion API authentication and bounded response;
- setup/create/edit with selected entry, stale entry rejection, atomic address+geo write, manual semantics and
  concurrent snapshot switch;
- S8 public Search raw-geo privacy regression.

### E2E

- persistent point editor: type → suggestions → choose → review → save → reload;
- embedded new-point editor uses the same behavior;
- no result and simulated API failure preserve typed manual address and allow save;
- edit after selection becomes manual and does not silently replace geo;
- keyboard selection/focus/attribution and no horizontal overflow at the existing representative mobile viewport.
  No separate desktop redesign or KK proofreading is part of this proof.

### Real-data operational proof

Run the pinned importer on the current Geofabrik Kazakhstan extract into a disposable/local database, then record:

- source timestamp/checksum and exact Almaty boundary;
- raw/accepted/deduplicated/rejected counts by kind;
- final table and index sizes;
- import duration and peak operational requirements available from the runner;
- representative exact/prefix/typo queries for a house, street, Зелёный Базар and Алтын Орда;
- `EXPLAIN` evidence that the intended indexes are used.

Generated OSM data and dumps remain outside Git. After targeted proof, run one full `pnpm verify` and branch CI.

## 10. Manual acceptance scenario

1. Open an existing trading point, start typing an Almaty street/house and see a small attributed suggestion list.
2. Select a result, review the resolved address, confirm and save; reopen the point and verify the address and saved
   location state.
3. Search for `Зеленый базар` without `ё`, select the marketplace result and confirm it resolves to Зелёный Базар.
4. Type an address that is not in the directory and save it manually without being blocked.
5. Simulate directory failure/offline, confirm the typed text remains and use the existing browser or map-link geo
   path successfully.
6. After selecting a result, alter the address text and confirm the save is treated as manual rather than silently
   keeping the selected result's coordinates.

## 11. Approval gate

Approval of this contract approves the closed-contract revision in Section 0 and authorizes only this Almaty pilot
slice. It does not authorize another city, an external geocoder, a map SDK, Kazakh proofreading, desktop redesign or
any later queue stage.
