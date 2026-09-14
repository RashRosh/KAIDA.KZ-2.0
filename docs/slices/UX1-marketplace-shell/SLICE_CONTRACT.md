# UX1 — Marketplace shell / Buyer card layout — Slice Contract

**Status:** `DRAFT — PRODUCT OWNER APPROVAL REQUIRED`  
**Verified product checkpoint:** `v0.0.14-s13`  
**Verified main SHA:** `ff8bd7eed8406d35e469c8a0a4bc2f6332068361`  
**Working branch:** `slice/ux1-core-ux-cleanup`

UX1 is an inserted corrective UX slice before M1 and S14. It does not renumber or reopen S0-S13.

## 1. User task

П1 открывает KAIDA.KZ и в компактном marketplace-style интерфейсе может сразу начать Search или перейти в Nearby, видеть найденные Offers как легко сканируемые карточки и не проходить лишнее повторное подтверждение одного и того же намерения.

Из общего app shell также должен быть понятен вход в уже существующий seller flow, без изменения seller business behavior.

## 2. Scope

UX1 включает только presentation/navigation cleanup поверх закрытого поведения S0-S13:

- единый компактный app shell/header для buyer-facing экранов;
- заметный Search как основное действие покупателя;
- переход от landing-like композиции с большими пустотами к card-first marketplace layout;
- Search results и Nearby используют согласованную структуру Offer cards;
- responsive использование ширины: mobile остаётся легко сканируемым, desktop использует пространство под больше полезного контента, а не под искусственные пустоты;
- базовый радиус стандартных кнопок, input/select и обычных card surfaces приводится к `3px`; исключения допустимы только для элементов, где другая геометрия имеет явный смысл;
- Offer card получает стабильный visual/media slot с нейтральным fallback, чтобы будущие Product image/icon и Offer media не требовали нового layout rewrite;
- реальный приоритет будущего визуала фиксируется как: `Offer primary media`, если оно есть; иначе `Product image/icon`; пока данных нет — нейтральный fallback;
- существующие Product, price/unit, Seller, Location/address, seller comment, distance в Nearby, S10 contact actions и S13 interest control остаются доступны в новой карточке;
- действие `Что рядом?` из общего buyer shell считается явным намерением использовать Nearby и не должно требовать второго подтверждения `Показать товары рядом`;
- прямое открытие `/nearby` без предшествующего явного действия пользователя не должно автоматически запрашивать geolocation;
- в общем app shell появляется понятный переход в существующий `/seller` flow;
- loading / empty / error states сохраняются и визуально приводятся к новой системе.

## 3. Explicit out of scope

UX1 не включает:

- объединение seller setup и seller contacts в один проход (`UX-004`);
- системную замену seller form inputs на selects/autocomplete (`UX-002`), включая address autocomplete;
- изменение Seller / Location / Contacts API или persistence;
- реальные Product image/icon поля, таблицы, API или загрузку списка изображений;
- реальные Offer photos/video, Media entity/module, upload/storage, lifecycle, moderation, thumbnails или video processing;
- M1 Offer Media Foundation и M2 video/media extension;
- S14 `Для вас`;
- изменение Search matching, ranking, lifecycle, Nearby radius/filtering/order;
- изменение Interest semantics;
- изменение Seller contact formats/link generation;
- новый auth flow;
- внешний design system/package или копирование Ozon UI один в один.

`UX-004` и seller-side часть `UX-002` должны остаться отдельной user task. Если их решать, нужен следующий небольшой UX slice, а не scope creep внутри UX1.

## 4. Closed contracts used

### S0 / S7 — Search

UX1 использует существующий Search и его Buyer Offer projection. Matching, eligibility, response DTO и result ordering не меняются.

### S2 — Auth

Existing login/session/current-user behavior остаётся неизменным. App shell может отображать текущий auth status и навигацию, но не меняет Identity semantics.

### S10 — Buyer contact actions

Offer card продолжает показывать только существующие доступные phone / WhatsApp / Telegram / Instagram actions и использовать уже закрытую link-generation semantics.

### S11 — Discovery / Nearby

UX1 использует существующий Nearby API, lifecycle/radius/order semantics и transient buyer location boundary.

### S13 — Interests

Существующий interest control остаётся связан только с canonical `Product.id`; UX1 меняет только его presentation/placement внутри карточки.

## 5. Closed contracts potentially touched

UX1 обязан сохранить:

- S0/S7 Search request/response semantics, eligibility и ordering;
- S2 auth/session semantics;
- S3 существующий `/seller` business flow и ownership behavior; UX1 добавляет только понятный navigation entry;
- S10 contact visibility/order/targets;
- S11 privacy rule: buyer location не сохраняется, raw Seller geo не публикуется;
- S11 explicit-user-action rule для browser geolocation;
- S13 interest add/remove/persistence semantics;
- все остальные closed S0-S13 contracts.

Особая граница S11: клик `Что рядом?` в app shell может быть тем самым явным действием пользователя. Но обычная загрузка `/nearby` напрямую не является согласием и не должна сама вызывать browser location prompt.

Если для UX1 потребуется изменить public API, DB schema или закрытую business semantics, implementation должен STOP до такого изменения.

## 6. Risk flags

- **DB migration:** NO.
- **Public API:** NO.
- **Auth/security/privacy:** YES, ограниченно — из-за изменения UX точки запуска browser geolocation и общего auth/navigation shell. S2/S11 privacy semantics должны остаться неизменными.
- **Concurrency/atomicity:** NO.
- **Data loss:** NO.
- **External service:** NO.

## 7. Expected modules / boundaries of change

Ожидаются изменения только в presentation layer:

- shared app shell/header/navigation;
- Buyer home/Search UI;
- Nearby UI orchestration вокруг уже существующего API;
- shared Offer card presentation;
- responsive/global and page-level styles;
- E2E tests, необходимые для изменённого пользовательского пути;
- UX1 documentation.

Не ожидаются изменения в `src/db`, migrations, domain repositories/services, Search/Discovery/Sellers/Identity/Interests business modules или API contracts.

## 8. Acceptance criteria

1. Главная Buyer-страница и Nearby используют одну визуально согласованную компактную систему header/app shell; различия между экранами являются функциональными, а не случайными.
2. Search остаётся заметным главным действием и не вытесняется крупным декоративным intro-блоком.
3. Search results и Nearby Offers отображаются card-first и используют доступную ширину экрана без большого постоянного пустого полуполя на desktop.
4. На mobile карточки читаемы без horizontal overflow; на desktop layout повышает информационную плотность, а не просто увеличивает отступы.
5. Стандартные controls и обычные card surfaces в затронутом UI используют базовый radius `3px`, кроме явно обоснованных shape-specific элементов.
6. Каждая Buyer Offer card имеет стабильный visual/media slot. Пока Media/Product image data отсутствуют, отображается нейтральный fallback без нового публичного поля и без fake URL/data.
7. Новая карточка сохраняет существующие Product, price/unit, Seller, Location/address, optional comment, Nearby distance, S10 contact actions и S13 interest control; ни один закрытый Buyer capability не пропадает из-за уплотнения layout.
8. Клик по `Что рядом?` из app shell запускает существующий Nearby user journey без второго подтверждающего действия `Показать товары рядом`.
9. Прямое открытие `/nearby` не вызывает browser geolocation автоматически; для такого входа требуется явное действие пользователя на странице.
10. App shell содержит понятный seller entry, который ведёт в существующий `/seller` flow и не меняет auth/Seller setup behavior.
11. Search и Nearby продолжают возвращать те же eligible Offers в тех же закрытых порядках; UX1 не меняет request/response contracts, lifecycle, ranking или radius logic.
12. Loading, empty, geolocation-denied/request-error states остаются доступны, понятны и не ломают responsive layout.

## 9. Automated test plan

### Unit

Новые unit tests не обязательны по умолчанию: UX1 не вводит новую чистую business logic. Existing unit tests остаются regression proof для закрытых helpers/contracts.

### Integration / DB

Новые DB/migration/API integration tests не нужны, потому что UX1 не меняет DB или API. Если implementation начинает требовать такие изменения, это признак выхода за contract и требует STOP/review.

### E2E — targeted proof

Нужны E2E проверки только изменённых пользовательских границ:

- Search отображает реальные Offers в новом card layout и сохраняет S10/S13 действия;
- переход `Что рядом?` из app shell приводит к одному geo-intent flow без второго подтверждения;
- прямой вход `/nearby` не инициирует location request до явного действия;
- denied geolocation остаётся корректным error state;
- seller entry ведёт в существующий seller flow;
- mobile и desktop representative viewports не имеют horizontal overflow и сохраняют основные действия.

После targeted proof: lint/typecheck/build по необходимости и один полный branch CI на финальном executable head. Повторный exact-SHA full run не нужен без признаков flaky/nondeterminism.

## 10. Manual acceptance scenario

1. На mobile открыть главную: увидеть компактный shell, заметный Search, `Что рядом?` и seller entry без ощущения landing-page с крупными пустотами.
2. Найти тестовый/реальный Offer: проверить card-first представление, media fallback, цену, место, contacts и interest control.
3. Вернуться и нажать `Что рядом?`: разрешить location один раз и получить Nearby results без промежуточной кнопки с повторным подтверждением.
4. Открыть `/nearby` напрямую в новом контексте: убедиться, что location prompt не появляется сам до явного действия.
5. Проверить тот же Buyer UI на desktop: полезный контент занимает основную рабочую область, карточки используют ширину, horizontal overflow нет.
6. Нажать seller entry и убедиться, что открывается существующий seller flow без изменения его business behavior.

## Gate

Этот документ только фиксирует предлагаемый UX1 contract. Production implementation пока не авторизована.

После Product Owner approval: перевести соответствующие backlog items в `IN_SLICE`, затем реализовывать минимальный diff строго в границах UX1.
