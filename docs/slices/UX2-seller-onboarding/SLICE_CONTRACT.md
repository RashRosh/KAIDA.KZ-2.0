# UX2 — Seller onboarding / единая первичная настройка

**Status:** APPROVED → IMPLEMENTATION AUTHORIZED  
**Base checkpoint:** `v0.0.20-ux1d`  
**Base main:** `d3d44ae580b12c6c9c57d57c866cd4c22bd1facc`  
**Branch:** `slice/ux2-seller-onboarding`

## User task

Авторизованный П2 впервые настраивает себя как продавца одним понятным пользовательским сценарием:

`Seller → первая Location → контакты покупателей → geo Location → готов к Seller Input`

П2 не должен разбираться, что Seller, Location, Contacts и Geo технически принадлежат разным API/contracts.

## Scope

UX2 объединяет существующие возможности в один onboarding-flow на `/seller`:

- название продавца;
- название первой точки;
- тип Location из существующего закрытого списка;
- адрес;
- обязательный для завершения onboarding телефон покупателя;
- опциональные WhatsApp / Telegram / Instagram;
- явное сохранение текущего местоположения Location через browser geolocation;
- понятное состояние прогресса: что уже сохранено и чего не хватает;
- продолжение незавершённого onboarding после reload;
- после завершения — существующий Seller Input / управление Offers.

Новый persisted `onboarding_complete` / `published` flag не создаётся.

Готовность onboarding выводится из уже существующих данных:

`Seller + first Location + contactPhoneE164 + Location.geo`.

Это соответствует текущей buyer-facing eligibility UX1D, но не превращает эти поля в обязательные DB-инварианты.

### Visual / Bolt alignment

`boltkaida2` остаётся утверждённым UX/UI composition reference.

UX2 должен повторять присущие образцу Bolt композицию, взаимное расположение элементов, плотность, размеры, отступы, ритм и визуальную иерархию настолько близко, насколько это не конфликтует с закрытыми product contracts и `docs/DESIGN_SYSTEM.md`.

В частности:

- onboarding воспринимается как одна цельная рабочая панель/форма, а не как набор технически раздельных карточек;
- поля логически группируются, но остаются в одном визуальном потоке;
- основное действие находится в ожидаемом месте и визуально доминирует только в текущем decision context;
- mobile-first layout не превращается в длинную последовательность визуально несвязанных блоков;
- desktop использует доступную ширину рационально, без лендинговой пустоты;
- существующие Roboto, spacing/radius tokens, 44px touch targets и responsive rules Design System сохраняются.

Bolt reference не переопределяет S3/S8/S10 semantics и не разрешает fake controls/data.

## Explicit out of scope

- изменение Seller / Location DB schema;
- новый onboarding-status в БД;
- изменение `/api/seller/setup`;
- объединение S3 setup, S10 contacts и S8 geo в одну серверную транзакцию;
- Seller/Location generic edit;
- изменение названия существующего Seller;
- изменение имени/type/address существующей Location;
- создание второй Location;
- address autocomplete / geocoding;
- карта и ручная установка pin;
- ручной ввод latitude/longitude;
- автоматический запрос geolocation;
- изменение контактов через SellerChangeSet;
- Offer business logic;
- правило обязательной цены Offer;
- M1 media;
- S14 / recommendations;
- reviews/rating;
- AI Input;
- monetization.

Address autocomplete остаётся отдельным будущим решением: он потребует отдельного выбора geocoding provider и external-service/privacy review.

## Closed contracts used

- **S2 Auth:** current User определяется существующей Identity; anonymous Seller setup запрещён.
- **S3 Seller / Location:** один owned Seller на User в текущей модели; Seller + первая Location создаются существующей транзакцией; `/api/seller/setup` request/atomicity/repeat semantics неизменны.
- **S8 Location Geo:** geo принадлежит Location; browser geolocation только после явного действия П2; setup не принимает coordinates; owner-only geo update остаётся отдельным API.
- **S10 Contacts:** контакты принадлежат Seller; существующие owner-only GET/PUT semantics и canonical identifiers сохраняются; Identity phone не публикуется автоматически.
- **UX1D:** неполные Seller/Location допустимы seller-side; buyer visibility требует phone + geo; persisted publishability flag отсутствует.
- **UX1A / Design System:** app shell, Roboto, tokens, responsive/touch-target rules сохраняются.
- **S4/S5/S12:** Seller Input продолжает идти через SellerChangeSet; UX2 не изменяет Offer напрямую.

## Closed contracts potentially touched

Планово никакие closed public/business contracts не изменяются. UX2 — UI/orchestration slice.

Если реализация потребует расширить `/api/seller/setup`, менять S3 atomicity, передавать geo во время setup или менять S10 contacts semantics — STOP до такого изменения.

## Risk flags

- **DB migration:** NO
- **Public API:** NO
- **Auth / security / privacy:** YES — используются существующие owner-sensitive Seller, Contacts и Location Geo boundaries.
- **Concurrency / atomicity:** NO new risk — S3 transaction остаётся неизменной; весь onboarding намеренно не является одной DB transaction.
- **Data loss:** NO — partial onboarding является допустимым resumable состоянием.
- **External service:** NO — browser Geolocation API не является внешним backend service; geocoding не входит.

## Expected modules

- Seller onboarding UI/composition;
- orchestration state `/seller`;
- Seller page presentation/styles;
- reuse существующих setup / contacts / geo client flows;
- UX2 E2E;
- directly affected seller E2E regressions;
- slice/backlog documentation.

Не ожидаются изменения migrations/schema, Identity, Search/Discovery, Offers business logic, Catalog, SellerChangeSet application/domain logic или buyer Offer cards.

## Acceptance criteria

1. Anonymous User на `/seller` по-прежнему получает существующий login gate.
2. Авторизованный User без Seller видит один onboarding-flow, а не отдельную первичную форму и появляющуюся после неё несвязанную форму контактов.
3. В onboarding доступны: название продавца, название точки, тип точки, адрес, телефон, WhatsApp, Telegram, Instagram.
4. `Location.type` остаётся controlled choice из `market / shop / pavilion / home / other`.
5. Телефон необходим, чтобы UI считал onboarding завершённым; WhatsApp / Telegram / Instagram опциональны; canonical validation остаётся S10.
6. Создание Seller + первой Location использует неизменённый S3 setup contract и сохраняет atomicity.
7. Contacts сохраняются через существующий S10 owner contacts resource; UX2 не добавляет contacts в setup API.
8. Если Seller + Location созданы, а contacts save завершился ошибкой, Seller/Location не удаляются и не создаются повторно; пользователь может продолжить onboarding.
9. Geo является частью того же логического onboarding, но запрашивается только отдельным явным действием П2 после существования Location; автоматического permission prompt нет.
10. Ошибка/отказ browser geolocation оставляет Seller, Location и Contacts сохранёнными; geo step можно повторить позже.
11. Reload на любом незавершённом состоянии продолжает onboarding с фактического server state, не предлагает создать второго Seller и не теряет уже сохранённые данные.
12. После наличия Seller + Location + phone + geo UI показывает onboarding как завершённый и открывает существующий Seller Input / Offer-management путь без дополнительного технического setup.
13. Identity phone автоматически не копируется в public Seller contact.
14. Raw Location coordinates не показываются пользователю как текст и не становятся buyer-facing DTO из-за UX2.
15. Композиция onboarding следует Bolt reference и Design System: один цельный визуальный flow, логические группы без ощущения отдельных технических экранов, рациональная desktop плотность и mobile-first hierarchy.
16. UI не имеет horizontal overflow на `320 / 360 / 390 / 768 / 1024 / 1440 px`; interactive targets минимум `44x44px`.

## Automated test plan

### E2E — основной targeted proof

Mobile + desktop:

- anonymous login gate;
- новый User проходит единый Seller onboarding;
- Seller/Location создаются;
- contacts сохраняются;
- geo запрашивается только по явному действию;
- denied geo оставляет setup resumable;
- successful geo завершает onboarding;
- reload после существенных partial states продолжает правильный этап;
- после completion доступны существующие Seller Input controls;
- layout остаётся цельным и без horizontal overflow.

### Integration

Новой backend-логики не планируется. Новый integration suite не нужен. Targeted regression подтверждает существующие S3/S8/S10 contracts только если их implementation modules фактически затронуты.

### Unit

Не обязателен. Добавляется только если реализация выделит нетривиальную чистую функцию вычисления onboarding state.

После targeted proof — один полный branch CI на финальном executable SHA.

## Manual acceptance

1. Войти новым тестовым User.
2. Открыть `Продавцу`.
3. В одном onboarding-flow заполнить Seller, Location, type, address, phone и при желании мессенджеры.
4. Сохранить и убедиться, что интерфейс не превращается во «вторую настройку».
5. Явно определить местоположение и разрешить browser geolocation.
6. Убедиться, что onboarding показывает состояние «готово».
7. Перезагрузить страницу и убедиться, что настройка не начинается заново, а П2 видит существующий Seller Input / управление предложениями.
8. Проверить mobile и desktop визуально, в том числе Bolt-like composition/rhythm.
