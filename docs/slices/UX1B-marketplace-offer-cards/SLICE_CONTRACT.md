# UX1B — Marketplace Offer cards

## 1. User task

П1 после поиска должен быстро сравнить реальные предложения и понять, у какого продавца и в какой точке купить товар, а затем перейти к существующему способу связи.

## 2. Scope

- Перестроить buyer Search results в плотную marketplace-композицию по `boltkaida2` как UX/UI reference.
- Использовать Bolt не только как reference отдельных controls, но и как reference взаимного расположения: секция результатов, сетка, размеры карточек, внутренний ритм, выравнивание, порядок блоков и responsive density.
- Перестроить существующий shared `OfferCard` без изменения его доменных данных и actions.
- Сохранить реальный Search API, Interest behavior и Seller contact actions.
- Показать результаты как адаптивную сетку: одна колонка на узких экранах, две на medium, три на desktop, без horizontal overflow.
- В карточке визуально приоритизировать: Product → price → Location/address/distance when provided → Seller → Seller comment → Interest/contact actions.
- Для Search results использовать Bolt-like section heading + result count while preserving existing live status semantics.
- Shared OfferCard visual presentation может измениться и в существующем Nearby result list, но Nearby geolocation/user-flow behavior не меняется.

## 3. Explicit out of scope

- Любые DB migrations, schema/data-model changes или новые API fields.
- Media/photos/video, media placeholder, reserved media column or fake thumbnail до M1.
- Rating/reviews/stars.
- Freshness badge/timer, если Search/Discovery contracts не предоставляют такие данные.
- Route/detail modal и новые buyer actions, которых нет в текущих closed contracts.
- Initial “Актуальные предложения / Показать все” на пустом query: текущий Search contract не предоставляет feed без запроса.
- Изменение Search matching/ranking, aliases, geo logic, Interests business logic или Seller contact URL generation.
- UX1C Nearby geo-intent cleanup.
- UX2 seller onboarding.

## 4. Closed contracts used

- S0/S7 Search: существующий query validation, submit/Enter, API response и real seller Offers.
- S9/S11 Geo/Discovery: distance показывается только когда приходит из server-side Nearby contract; buyer coordinates не показываются и не сохраняются.
- S10 Seller contacts: structured contacts и существующий `buildContactActions` остаются источником contact actions.
- S13 Interests: существующие строки, `aria-pressed`, persistence и add/remove semantics сохраняются.
- UX1A/UX1A.1 shell: `80rem` container, Roboto, 84/104 header, стабильный header Search.
- UX1A.2 auth modal: не меняется.

## 5. Closed contracts potentially touched

- Shared presentation of `OfferCard` used by Search and Nearby.
- Search results DOM hierarchy and responsive layout.
- Historical E2E selectors that assume a linear list or old visual grouping may need legitimate harness adaptation; user-visible/domain behavior must remain unchanged.

## 6. Risk flags

- DB migration: NO.
- Public API: NO.
- Auth/security/privacy: NO new risk; existing S13/S9 behavior must be preserved.
- Concurrency/atomicity: NO.
- Data loss: NO.
- External service: NO.

## 7. Expected modules

- Buyer Offer card presentation.
- Buyer Search results presentation.
- Shared buyer page styles.
- Nearby result presentation only insofar as it reuses the same OfferCard/grid styles.
- E2E coverage for responsive result composition and closed Search/Interest/Nearby guarantees.
- UX backlog/status documentation.

## 8. Acceptance criteria

1. Search result section visually follows Bolt marketplace hierarchy: heading/count above a dense responsive card grid rather than a vertical technical list.
2. At >=1024px three Offer cards can occupy one row when there are enough results; at 768–1023px two columns; below 768px one column.
3. No page-level horizontal overflow at 320/360/390/768/1024/1440 widths.
4. OfferCard contains no fake media area, placeholder image, rating/review UI or invented freshness.
5. Each card preserves real Product name, price/`Цена не указана`, Location name/address, Seller name, Seller comment when present and server-provided distance when present.
6. Existing Interest control keeps the closed S13 strings and `aria-pressed` semantics and still persists through the existing API.
7. Existing contact actions keep the same labels/hrefs generated from structured Seller contacts; no arbitrary URLs or new contact behavior is introduced.
8. Search validation/loading/error/live-status strings and Enter/submit semantics remain unchanged.
9. Nearby still requests geolocation only through its existing explicit action; UX1B does not alter Nearby geo-intent flow.
10. Bolt is followed for card spacing, hierarchy, action grouping and grid composition wherever this does not conflict with KAIDA.KZ closed contracts or missing capabilities.

## 9. Automated test plan

- E2E: Search returns real Offer cards and existing product/seller/location/price/comment/contact/Interest behavior remains available.
- E2E: desktop/medium/mobile grid column geometry and no horizontal overflow.
- E2E regression: S13 Interest add/remove/persistence remains green.
- E2E regression: Nearby still requires explicit geo action and can render the shared OfferCard with distance.
- Full existing regression suite through branch CI.

No new DB/unit/integration tests are required because UX1B changes presentation only and introduces no business/API logic.

## 10. Manual acceptance scenario

Desktop and mobile:

1. Open Search and search `баранина`.
2. Compare the whole results area with `boltkaida2`: section heading/count, grid density, card hierarchy, padding, action placement and overall rhythm.
3. Confirm that cards show only real KAIDA.KZ data and have no media/rating/freshness placeholders.
4. Use one available contact action and toggle Interest for an authenticated user.
5. Open Nearby only to confirm that the shared card still looks consistent and that geolocation behavior itself has not changed.
