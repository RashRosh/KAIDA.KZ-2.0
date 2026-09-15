# UX1D — Buyer Offer actionability

Status: DESIGN APPROVED

Base checkpoint: `v0.0.19-ux1c`

Base main: `b55196412b8ab195ecb7e2e7ee4967e144cf9d5c`

## User task

П1 из любой показанной buyer-facing Offer card может сразу позвонить продавцу, построить маршрут до Location и открыть доступный WhatsApp / Telegram / Instagram. KAIDA.KZ не показывает П1 Offer, если обязательные действия `Позвонить` и `Маршрут` невозможны.

## Scope

- Единая buyer-facing eligibility для Search и Nearby: Offer active/fresh по существующему lifecycle, `Seller.contactPhoneE164` присутствует, `Location.latitude + Location.longitude` заполнены.
- Неполные Seller / Location остаются допустимыми seller-side; отдельный persisted publishability flag не создаётся.
- Существующие Search matching/ranking и Nearby radius/distance/ordering применяются после eligibility.
- OfferCard primary row: `Позвонить` + `Маршрут`.
- Secondary row: только доступные WhatsApp / Telegram / Instagram, отдельная строка без placeholders.
- `Позвонить` использует существующий E.164 contact contract.
- `Маршрут` использует координаты Location связанного Offer.
- MVP map provider: 2ГИС через официальный deeplink, без Routing API, SDK, API key или server-side вызова 2ГИС API.
- OfferCard route href остаётся same-origin и содержит Offer id, не raw coordinates.
- Route endpoint повторно проверяет текущую buyer eligibility и только затем redirect-ит в 2ГИС.
- KAIDA.KZ не передаёт buyer coordinates в 2ГИС; при отсутствии `from` 2ГИС использует текущее местоположение пользователя, если оно доступно.
- Deterministic seed обновляется только настолько, чтобы существующий buyer Search scenario оставался buyer-eligible.

## Explicit out of scope

- UX-011 и отображение distance в обычном Search.
- Изменение UX1C buyer geolocation intent/persistence.
- DB/schema migration.
- Обязательность phone/geo на уровне seller-side DB/domain.
- Отдельный publication entity/status/flag.
- Seller onboarding redesign.
- Изменение owner contacts API.
- Geocoding.
- Собственная карта/routing/ETA/traffic KAIDA.KZ.
- Map-provider chooser.
- Media, ratings/reviews, S14, monetization, cart/order/payment/delivery.

## Closed contracts used

- S0 Search query/empty state/deterministic buyer flow.
- S1 Offer lifecycle/freshness.
- S3 Seller/Location incomplete seller-side state.
- S6 Product/alias resolution.
- S9 Search ranking among eligible candidates.
- S10 structured contacts and contact-link generation.
- S11 Nearby radius/distance/order.
- S13 interests.
- UX1A shell/navigation/auth presentation boundaries.
- UX1B OfferCard/grid/media boundaries.
- UX1C Nearby geo intent.

## Approved closed-contract changes

- S7: confirmed active/fresh Offer becomes buyer-searchable only when Seller phone and Location geo are also present.
- S8: geo-less Location remains legal seller-side, but its Offer is not buyer-visible.
- S9: phone+geo become eligibility prerequisites before Search ranking; buyer location remains optional.
- S10: Seller contacts remain nullable seller-side, while `contactPhoneE164` becomes required for buyer visibility; WhatsApp/Telegram/Instagram remain optional.
- S11: Nearby adds phone requirement; existing geo/radius/distance/order semantics remain.
- UX1B: only OfferCard action area changes to two rows plus route action; grid/hierarchy/media boundaries remain.

## Risk flags

- DB migration: NO.
- Public API: YES. Search/Nearby DTO shape stays unchanged, but result membership semantics change and a same-origin route-action HTTP endpoint is added.
- Auth/security/privacy: YES. Raw seller Location coordinates must stay out of Search/Nearby DTO and card DOM; route resolution must not become a coordinate-exfiltration endpoint.
- Concurrency/atomicity: NO.
- Data loss: NO.
- External service: YES, 2ГИС only after explicit buyer route action. CI must not depend on 2ГИС availability.

## Expected modules

- Search read-side eligibility.
- Discovery/Nearby read-side eligibility.
- Shared buyer visibility policy.
- Buyer route resolver/endpoint and 2ГИС deeplink builder.
- OfferCard action area, responsive styles, accessibility and service iconography.
- Deterministic seed/fixtures.
- Directly affected S7-S11/UX1B regressions and UX1D tests.
- Slice/backlog documentation.

No expected changes to DB schema/migrations, SellerChangeSet write flow, Identity, Catalog resolution or Interests domain.

## Acceptance criteria

1. Search and Nearby include an active/fresh Offer only when Seller phone and complete Location geo are present.
2. Incomplete Seller/Location/Offer records remain legal/manageable seller-side and are not auto-deleted/deactivated.
3. Eligible Search preserves S6/S9 semantics and does not expose Search distance.
4. Eligible Nearby preserves S11 radius, Haversine whole-meter distance and ordering.
5. Search/Nearby DTO and OfferCard DOM do not expose raw Location coordinates; pre-click route href is same-origin and Offer-based.
6. Every shown buyer OfferCard has primary actions `Позвонить` and `Маршрут`.
7. `Позвонить` uses the canonical E.164 `tel:` target.
8. Route endpoint resolves the currently eligible Offer and redirects to 2ГИС using the exact associated Location destination; missing/inactive/stale/ineligible Offers do not reveal destination.
9. Secondary row contains only available WhatsApp/Telegram/Instagram actions: 1 = 100%, 2 = 50/50, 3 = equal thirds; one row, no placeholders. Service iconography uses canonical brand assets/glyphs; icon-only presentation has an accessible name; tap target is at least 44x44px.
10. Existing S10 channel target rules remain unchanged.
11. Deterministic seed still supports existing S0 buyer Search scenarios while the seeded Seller/Location satisfy UX1D eligibility.
12. UX1C buyer-location persistence/intent remains unchanged.
13. KAIDA.KZ does not pass buyer origin coordinates to the 2ГИС route action.
14. No horizontal overflow at 320 / 360 / 390 / 768 / 1024 / 1440 px.

## Automated test plan

### Integration

- Eligibility matrix for Search and Nearby: phone+geo included; no-phone+geo, phone+no-geo and neither excluded.
- Incomplete records remain seller-side.
- Lifecycle remains required.
- Search/Nearby response privacy remains unchanged.
- Route resolver returns exact eligible Location destination and returns no destination for missing/inactive/stale/ineligible Offer.
- Existing S6/S9/S11 behavior remains after eligibility.
- Historical S7-S11 assertions are adapted only where the approved UX1D contract supersedes them.

### Unit

Only pure 2ГИС route-target transformation: destination order/encoding, no buyer-origin coordinates, invalid coordinates rejected.

### E2E

- Search/Nearby buyer cards on mobile and desktop.
- `Позвонить` + `Маршрут`, correct tel target, same-origin route href and 2ГИС redirect target without actually opening 2ГИС in CI.
- Secondary row for 1/2/3 channels, accessible names and >=44px targets.
- Buyer-ineligible Offers absent.
- Nearby distance and UX1C intent preserved.
- No raw coordinates in buyer card DOM.
- No horizontal overflow on required widths.

After targeted verification: full regression suite and branch CI on final executable SHA.

## Manual acceptance

1. Clean seed: Search `баранина`.
2. Card contains `Позвонить` and `Маршрут`; phone target is correct.
3. `Маршрут` opens 2ГИС at the real associated Location.
4. Cards with 1/2/3 optional channels render one equal-width secondary row.
5. Nearby keeps the same actions plus distance and unchanged UX1C geo flow.
6. Seller missing phone and/or Location missing geo remains seller-side but its Offer is absent from Search/Nearby.
7. Mobile and desktop have no horizontal overflow.
