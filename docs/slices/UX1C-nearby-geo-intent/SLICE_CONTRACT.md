# UX1C — Nearby geo-intent cleanup

**Status:** DESIGN APPROVED  
**Base checkpoint:** `v0.0.18-ux1b`  
**Base main:** `f16703cb5c8057aa34db48b9700f01a22d676c57`  
**Branch:** `slice/ux1c-nearby-geo-intent`

## 1. User task

П1 нажимает `Рядом` в основной навигации один раз и сразу запускает сценарий поиска актуальных Offers поблизости через browser geolocation — без второго подтверждения `Показать товары рядом`.

## 2. Scope

- клик `Рядом` в desktop или mobile navigation является явным пользовательским намерением использовать Nearby;
- после перехода на `/nearby` это одноразовое намерение автоматически запускает существующий browser geolocation flow;
- одноразовый intent marker не содержит координат и удаляется до/при потреблении;
- при успешной геолокации выполняется существующий `POST /api/discovery/nearby` и отображается существующая marketplace-выдача;
- при отказе/ошибке geolocation сразу показывается существующий Nearby geo error state без второго клика;
- direct/deep-link открытие `/nearby` без предшествующего пользовательского клика `Рядом` не запрашивает местоположение автоматически и сохраняет существующую явную кнопку запуска;
- reload `/nearby` после auto-start не повторяет geolocation автоматически;
- ручное `Обновить товары рядом` после первого результата остаётся явным повторным действием пользователя;
- Bolt остаётся composition reference, но UX1C не переделывает закрытый UX1B Offer-card layout.

## 3. Explicit out of scope

- любые изменения `POST /api/discovery/nearby`, radius, distance, ordering или freshness;
- DB/schema/migrations;
- хранение Buyer coordinates в cookies, localStorage, sessionStorage, URL, профиле или БД;
- background location, `watchPosition`, polling;
- карты и построение маршрута;
- изменение Seller/Location completeness requirements;
- buyer-facing publishability rule `phone + coordinates`;
- новая структура contact actions (`Позвонить`/`Маршрут` + social row) из UX-010;
- изменение Search ranking или Search DTO;
- seller onboarding;
- media/rating/reviews.

UX-010 намеренно остаётся отдельным будущим slice, потому что требует изменения закрытых eligibility/contracts S8/S10/S11/Search.

## 4. Закрытые contracts, которые используются

- **S8 Location Geo:** raw Seller/Location coordinates не публикуются buyer-side.
- **S9 geo semantics:** Buyer point validation и privacy boundary сохраняются.
- **S11 Discovery:** browser geolocation только после явного действия П1; coordinates transient; существующий Discovery API/result/error behavior сохраняется.
- **S10 Buyer actions:** contact semantics не меняются.
- **UX1A/UX1A.1:** общий shell/navigation и desktop/mobile composition сохраняются.
- **UX1B:** marketplace Offer-card/result layout сохраняется.

## 5. Закрытые contracts, которые потенциально затрагиваются

**S11 explicit-intent boundary.** Меняется только трактовка UI-последовательности: первый клик `Рядом` уже является явным действием П1 и поэтому может сразу инициировать browser geolocation после navigation. Direct `/nearby` без такого действия не получает auto-start.

Других closed-contract changes не требуется.

## 6. Risk flags

- **DB migration: NO**
- **public API: NO**
- **auth/security/privacy: YES** — нельзя превратить Nearby в auto-location на page load/deep link и нельзя сохранять coordinates.
- **concurrency/atomicity: NO**
- **data loss: NO**
- **external service: NO** — browser geolocation остаётся существующим browser capability; новых integrations нет.

## 7. Ожидаемые модули изменения

- Buyer app shell/navigation — передача одноразового Nearby intent;
- Nearby client presentation/state — одноразовое потребление intent и запуск существующего flow;
- существующий Nearby E2E regression для новой UI-semantics;
- UX backlog / slice documentation.

Discovery API, DB и domain modules изменяться не должны.

## 8. Acceptance criteria

1. На desktop клик `Рядом` из другого основного route переводит на `/nearby` и без второго клика вызывает browser geolocation ровно один раз.
2. На mobile клик `Рядом` через navigation menu имеет ту же one-click semantics.
3. При успешной geolocation выполняется ровно один Nearby API request и показываются те же eligible Offers/расстояния, что по закрытому S11 contract.
4. При geolocation denial/ошибке показывается существующий error state; глобальная fallback-лента не появляется.
5. Direct/deep-link `GET /nearby` без navigation intent не вызывает geolocation автоматически и позволяет явно запустить Nearby существующей кнопкой.
6. После auto-start reload страницы не вызывает geolocation и Nearby API повторно без нового пользовательского действия.
7. Ни coordinates, ни Buyer point не сохраняются в localStorage/sessionStorage/cookies/URL; одноразовый intent marker не содержит location data и после потребления отсутствует.
8. Существующие S11 response/privacy/ordering semantics и UX1B Offer-card composition не меняются.
9. `Обновить товары рядом` после первого результата остаётся рабочим явным повторным запуском.
10. Shell geometry и остальные navigation routes не получают регрессий.

## 9. Automated test plan

Риск здесь browser/privacy/UI-only, поэтому отдельные DB/unit/API tests не добавляются.

Targeted E2E должен доказать:

- one-click navigation → exactly one geolocation call → exactly one Discovery request;
- desktop/mobile navigation path;
- denial/error path;
- direct `/nearby` без intent не auto-start;
- reload не повторяет auto-start;
- browser persistence не содержит coordinates;
- старые S11 filtering/privacy assertions остаются зелёными.

После targeted E2E — полный regression suite/branch CI.

## 10. Manual acceptance scenario

1. С главной нажать `Рядом` один раз.
2. Убедиться, что сразу появляется browser permission prompt / начинается определение местоположения; второй кнопки подтверждения нажимать не требуется.
3. Разрешить location и убедиться, что появляются Nearby cards.
4. Reload `/nearby`: location не запрашивается повторно автоматически.
5. Открыть `/nearby` как прямую ссылку в новой вкладке: до явного действия location не запрашивается.
6. Отдельно проверить отказ в permission: показывается понятная ошибка без глобальной выдачи.
