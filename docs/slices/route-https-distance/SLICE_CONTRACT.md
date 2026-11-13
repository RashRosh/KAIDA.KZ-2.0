# Issue #223 — Route opens in 2GIS HTTPS; distance is explicitly straight-line

Status: PO DECIDED (2026-11-12 and 2026-11-13); implementation subject to exact-head verification and manual acceptance.

Base verified checkpoint: `v0.0.92-otp-session-221` at `41c302ccff7802abacde80ae711608753a7e74c6`.

## User task

Покупатель, увидев расстояние до товара, понимает, что это расстояние **по прямой**, и может открыть маршрут до Location продавца в 2ГИС, даже когда мобильное приложение 2ГИС не установлено.

## Scope

- Route action keeps the existing same-origin Offer-ID endpoint and server eligibility check, but redirects to **documented HTTPS 2GIS directions** with car mode and destination only, no explicit buyer origin.
- Visible `по прямой` qualifier beside/under computed distance in buyer Search results and Nearby; compact at 320px and with enlarged text.
- RU and KK language variants in the current i18n system. Use existing distance units and existing geolocation calculation.
- Directly related tests and narrow amendment to the existing UX1D route-link target contract.

## Explicit out of scope

- No new routing provider, provider chooser, 2GIS API/SDK/key, embedded map, in-app routing, driving distance or ETA.
- No geocoding, changes to geolocation consent, Search/Nearby ranking, Haversine metric, DTOs or database.
- No changes to seller input, auth, favourites/interest, D6 UI, any other design surface or marketing.
- No extra seller/buyer locations or personal coordinates supplied to 2GIS.

## Closed contract revision (STOP / PO decision already recorded)

UX1D `docs/slices/UX1D-buyer-offer-actionability/SLICE_CONTRACT.md` prescribed a custom `dgis://` deeplink. This fails user action in desktop environments without an installed scheme handler. PO explicitly approved replacing **only that external target** with the documented HTTPS 2GIS directions URL. Existing endpoint eligibility, privacy, same-origin pre-click href, seller destination and route action remain closed and unchanged.

## Risk flags

- DB migration: **NO**.
- Public API: **YES** (existing endpoint `Location` redirect destination format changes; same status and path).
- Auth/security/privacy: **YES** (only eligible seller coordinates post-click; no buyer coordinates or secret).
- Concurrency/atomicity: **NO**.
- Data loss: **NO**.
- External service: **YES** (2GIS navigation after explicit click; CI must not require its uptime).

## Acceptance criteria

1. Search with buyer geolocation displays existing Haversine distance and a **visible** `по прямой` qualifier; a hidden tooltip alone is not sufficient.
2. Nearby displays the same qualifier and unchanged distance; distance itself and sorting/ranking are not altered.
3. Without buyer location, Search action still displays `Маршрут`, with no invented distance.
4. Existing `/api/offers/{id}/route` responds 302 only for an eligible Offer, to an HTTPS 2GIS car directions URL with **destination longitude,latitude** and no explicit buyer origin.
5. For missing, expired, ineligible or no-geo Offer, existing non-disclosing responses remain unchanged; no coordinates leak before the explicit click.
6. RU/KK visible text and accessible route action remain intelligible, tap targets at least 44px, and 320/360/390 widths have no horizontal overflow, including enlarged text.
7. Regression E2E checks the route href still same-origin and new HTTPS Location, while not depending on external 2GIS availability.
8. Unit checks exact URL construction and coordinate validation (including rejected invalid/NaN values).
9. Full regression suite and branch CI pass; minimal diff stays in this user journey.
10. Manual desktop acceptance: buyer clicks a Search route action in a browser **without** 2GIS app; destination opens on the 2GIS web directions page. Mobile acceptance checks installed-app behavior or web fallback and records what actually happens. An automated URL assertion cannot substitute for this external smoke test.

## Manual acceptance scenario

Open buyer Search, enable geolocation, search `баранина`. Confirm the label `3,9 км · по прямой` (actual value varies by location), click route and check the destination in 2GIS web. Then open Nearby to inspect the same qualifier and test narrow/mobile viewport. Verify Search without location still says `Маршрут`. Record desktop/web behavior and mobile/app if available.

## External reference

2GIS official deeplink documentation (current HTTPS directions):
https://help.2gis.ru/question/razrabotchikam-zapusk-ideystviya-vmobilnom-prilozhenii-cherez-deeplink

Suggested current format:
`https://2gis.ru/directions/tab/car/points/|{longitude},{latitude}`

## PO browser acceptance finding and narrow URL revision (2026-11-13)

On the candidate `2gis.ru/directions/tab/car/points/|{lon},{lat}`, PO's actual desktop browser redirected to `2gis.ru/moscow/...` although the seeded Location and destination coordinates were in Almaty. PO tested `2gis.kz/almaty/directions/points/|76.9568,43.2636`: the **Almaty** map opened with the correct lon/lat still in the URL, but 2GIS automatically labeled the destination as the broader **Medeuskiy District**, not the fictional seller. The first screenshot is a real failure, not a PASS. The second confirms Kazakhstan map region but alone does not prove accurate entrance-by-entrance navigation.

For #223, use the official current **HTTPS destinations-only** route format at `https://2gis.kz/[known-city]/directions/points/|{lon},{lat}`. Derive `known-city` strictly from an **explicit city name in the existing Location address**, with a small mapping of supported and verified 2GIS city slugs; do not infer the buyer city or hardcode Almaty for every Seller. When a city is not recognized, use `https://2gis.kz/directions/points/|{lon},{lat}` (country entry) and retain source coordinates. No coordinates or private buyer data before explicit click; the city label is resolved server-side and is not sent as an arbitrary string.

**Known limitation:** free-form address does not reliably contain a canonical city, and 2GIS may map arbitrary coordinate destinations to a region/object label. Long-term Kazakhstan-wide reliability needs normalized city and/or verified 2GIS object/entrance ID; do not fabricate provider IDs. The buyer may need to select `Моё местоположение` inside 2GIS, since KAIDA does not pass their coordinates to the external provider. PO must re-check the exact candidate's car directions and map marker on desktop before approval.
