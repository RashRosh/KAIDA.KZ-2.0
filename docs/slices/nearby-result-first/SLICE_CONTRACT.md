# Nearby result-first correction (Issue #34)

**Status:** APPROVED — IMPLEMENTATION AUTHORIZED  
**Base checkpoint:** `v0.0.44-address-directory`  
**Base main:** `18f6ecf`  
**Branch:** `slice/nearby-result-first`  

## 1. User task

П1 нажимает «Рядом» в основной навигации и сразу видит результат Nearby (определение местоположения → карточки Offers), без большого intro/hero-блока. При прямом открытии `/nearby` (deep-link) вместо hero показывается компактный явный элемент запуска.

## 2. Scope (строго относительно текущего `src/app/(buyer)/nearby/NearbyFeed.tsx`)

В main уже реализована UX1C one-click semantics: navigation intent автоматически запускает Nearby. **Повторная реализация auto-start в #34 не входит — этот код не меняется.** Существующий одноразовый navigation intent и его auto-start consumption, а также privacy boundary UX1C сохраняются без изменения.

Реальный remaining scope — presentation-only, без изменения data-loading:

- Удалить существующий большой intro/hero-блок из presentation состояния без результатов (`!hasResults`): заголовок «Что есть рядом?», пояснение-описание, ссылку «Искать конкретный товар» и текст о приватности местоположения.
- Существующий одноразовый navigation intent и auto-start оставить без изменений.
- `locating` / `loading` показывать без hero, компактно.
- Direct `/nearby` без intent: не запрашивать geolocation автоматически (существующее поведение), но вместо hero показать компактный явный action (кнопка запуска Nearby), без большого блока.
- `geo_error` / `request_error` показать компактно с доступным retry (повторный запуск Nearby).
- Empty result (состояние успеха с нулём Offers) показать без старого hero.
- Success cards / header / refresh сохранить как есть: при наличии результатов — заголовок «Рядом (N)» с кнопкой обновления и сетка Offer cards (UX1B).
- API, radius, ordering, privacy, intent-marker semantics не менять.

## 3. Explicit out of scope

- Любые изменения `POST /api/discovery/nearby` API, DTO, radius policy, eligibility, ordering, privacy.
- Изменение UX1C navigation-intent marker, его consumption или auto-start логики.
- Изменение `requestNearby()` geolocation/loading/error flow.
- Search sorting, Search geo trigger, Search filters, radius control на клиенте.
- Карты, маршруты, гео-маркеры.
- Изменение Seller/Location/Offer data model или DB schema.
- Изменение закрытых S10 contact semantics или S13 Interest controls.
- Seller UX, onboarding, seller-side изменения.
- Тёмная тема или новые стили, не связанные с удалением hero-блока.
- Перенос Nearby логики на главный экран (это отдельная более крупная задача, `EXECUTION_PLAN.md`).
- Существующие i18n-строки Nearby (`nearby.locating` / `nearby.loading` / `nearby.show` / `nearby.refresh` / `nearby.empty` / `nearby.found` / `nearby.area` / `nearby.eyebrow` / `nearby.title` / `nearby.description` / `nearby.searchSpecific` / `nearby.privacy` / `nearby.geoError` / `nearby.requestError`) в этом slice **не удаляются и не меняются**.

## 4. Closed contracts used / potentially touched

- **UX1C**: one-click geolocation intent после клика «Рядом» и его consumption сохраняются без изменений. Меняется только presentation `!hasResults`.
- **UX1C/S9 privacy**: transient coordinates, без сохранения — без изменений; intent marker остаётся non-location.
- **S11 Discovery**: API, radius, eligibility, ordering, privacy, error/empty states — без изменений.
- **UX1B**: marketplace Offer card и header/refresh при `hasResults` сохраняются.
- **S10 Buyer actions**: contact semantics — без изменений.
- **UX1A/UX1A.1 shell**: заголовок страницы/навигация — без изменений.

## 5. Risk flags

- **DB migration: NO**
- **public API: NO**
- **auth/security/privacy: YES** — slice находится на browser-geolocation/privacy boundary (существующий UX1C flow); нельзя случайно авто-захватывать геолокацию на deep-link и нельзя сохранять coordinates/intent-состояние. Отдельный security suite не нужен — достаточно targeted E2E.
- **concurrency/atomicity: NO**
- **data loss: NO**
- **external service: NO**

## 6. Expected modules/границы изменения

- `src/app/(buyer)/nearby/NearbyFeed.tsx` — presentation-only: сокращение состояния без результатов до компактного; locating/loading/error/empty без hero; retry-элемент для error-состояний.

API, DB, domain-модули не изменяются. Существующие i18n-строки Nearby не удаляются и не меняются.

## 7. Acceptance criteria

1. Нажатие «Рядом» из навигации → существующий одноразовый navigation intent автоматически запускает Nearby (один раз) → выдача карточек Offers. Большой hero-блок (заголовок «Что есть рядом?», пояснение, ссылка «Искать конкретный товар», текст приватности) не показывается.
2. Существующий одноразовый navigation intent и его auto-start consumption сохраняются без изменения; privacy semantics не затронуты.
3. После успешной геолокации выдача выглядит как сегодня: заголовок «Рядом (N)», кнопка обновления, сетка marketplace Offer cards (UX1B). Никакого hero-блока над/под заголовком.
4. Deep-link `/nearby` (новая вкладка / прямой URL) не запрашивает geolocation автоматически (существующее UX1C поведение сохраняется) и не показывает старый hero-блок. Показывается компактный явный action (кнопка «Показать товары рядом»), который запускает Nearby.
5. При геolocation denial/ошибке и request error показывается компактный error state с доступным retry (повторный запуск Nearby); глобальная fallback-лента не появляется; старый hero-блок не показывается.
6. Состояния определения местоположения и загрузки показываются компактно без hero, без воссоздания landing-блока.
7. Empty result (успешный ответ с нулём Offers) показывает существующее empty state без старого hero.
8. Reload страницы не повторяет geolocation автоматически (существующее поведение); hero-блок при reload не появляется.
9. Ни coordinates, ни Buyer point не сохраняются в localStorage/sessionStorage/cookies/URL (UX1C/S9); одноразовый intent marker после consumption отсутствует.
10. Существующие S11 radius/ordering/eligibility/privacy и UX1B Offer card / header / refresh semantics не меняются; существующий Nearby E2E (кнопка «Показать товары рядом», empty, счётчики geo-calls/requests) остаётся зелёным.

## 8. Automated test plan

Риск — UI/presentation/browser-only. Новые unit/API/интеграционные тесты не добавляются; data-loading не меняется.

Targeted E2E на production build доказать (адаптация existing `s11-nearby-discovery.spec.ts` presentation-ассершнов при необходимости):

- nav click → одна geolocation-call → одна Nearby request → выдача без hero-блока (нет `nearby.title`/`nearby.description`/`nearby.searchSpecific`/`nearby.privacy` на экране);
- direct `/nearby` deep-link → компактный `nearby.show` action, не hero, geolocation не запрашивается;
- после click по `nearby.show` / refresh/retry → выдаётся результат/empty;
- при denial → компактный `geo_error` с retry, без глобальной выдачи;
- reload не auto-start и не восстанавливает hero;
- browser persistence не содержит coordinates;
- старые S11 filtering/privacy assertions остаются зелёными (regression).

Полный regression suite через branch CI после targeted E2E.

## 9. Manual acceptance scenario

1. Открыть главную, нажать «Рядом».
2. Разрешить geolocation — увидеть карточки Offers. Убедиться, что hero-блок отсутствует (нет «Что есть рядом?», «Искать конкретный товар», privacy-текста).
3. Открыть `/nearby` в новой вкладке (без предшествующего клика «Рядом»). Убедиться, что нет автоматического запроса location и нет старого hero-блока — показан компактный control (`Показать товары рядом`).
4. Через этот compact control запустить Nearby (а также проверить retry из error-состояния) — увидеть выдачу/empty без героя.
5. Reload страницы — geolocation не запрашивается повторно; hero-блок не появляется.
6. Запретить geolocation (отказ в permission) — увидеть компактную ошибку с retry, без героя и без глобальной выдачи.
