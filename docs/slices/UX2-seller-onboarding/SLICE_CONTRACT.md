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

- опциональное имя, которым к П2 могут обращаться покупатели;
- обязательное название первой торговой точки;
- обязательный тип Location из существующего закрытого списка;
- обязательный адрес;
- обязательный для завершения onboarding телефон покупателя;
- номер текущей Identity предзаполняет поля телефона и WhatsApp как editable convenience, но не публикуется и не сохраняется до явного submit;
- опциональные WhatsApp / Telegram / Instagram;
- все текстовые/контактные inputs имеют явную кнопку очистки при наличии значения; controlled select `Тип торговой точки` пустого состояния не имеет;
- обязательное для завершения onboarding явное сохранение текущего местоположения Location через browser geolocation;
- понятное состояние прогресса по фактически сохранённым данным;
- продолжение незавершённого onboarding после reload;
- после завершения — существующий Seller Input / управление Offers.

Новый persisted `onboarding_complete` / `published` flag не создаётся.

Готовность onboarding выводится из уже существующих данных:

`Seller + first Location + contactPhoneE164 + Location.geo`.

Это соответствует текущей buyer-facing eligibility UX1D, но не превращает phone/geo в обязательные DB-инварианты.

Если optional имя не заполнено, UX2 использует название торговой точки как `Seller.displayName`, чтобы сохранить закрытый S3 setup/API/DB contract без миграции.

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

### Approved manual-review refinement

После визуального review Product Owner утвердил следующие уточнения UX2:

- верхний технический eyebrow `Seller Input` отсутствует;
- H1 страницы — `Настройка торговой точки`;
- отдельная левая guide/progress колонка удаляется: onboarding занимает доступную рабочую ширину одной цельной панелью;
- первая секция называется `Ваша торговая точка` и имеет нормальный внутренний верхний отступ;
- `Название продавца` заменяется на опциональное поле `Имя` с helper `Как к вам будут обращаться покупатели`;
- обязательные onboarding-поля/шаги визуально отмечаются `*`;
- видимые обязательные labels включают `Название торговой точки`, `Тип торговой точки`, `Адрес`, `Телефон`; geo явно обозначается как обязательный шаг завершения;
- phone и WhatsApp предзаполняются Identity phone при доступности, но остаются независимыми редактируемыми полями после первоначального prefill и сохраняются только после явного submit;
- у всех text/contact inputs при непустом значении есть доступная inline-кнопка очистки с touch target не меньше 44x44; у `Тип торговой точки` кнопки очистки нет;
- у первой секции допускается только нейтральный декоративный store/location marker; загрузка реального avatar/photo не входит в UX2;
- Address остаётся честным ручным полем с browser autocomplete hint/helper text, но без собственного address autocomplete dataset/API;
- Address и Location geo не связываются автоматически: reverse geocoding требует отдельного provider/privacy slice;
- geo по-прежнему сохраняется только после отдельного явного действия П2;
- primary `Сохранить и продолжить` находится в нормальном padded action/footer flow: слева на desktop и full-width на узком mobile, а не прижимается к внешнему краю панели.

## Explicit out of scope

- изменение Seller / Location DB schema;
- новый onboarding-status в БД;
- изменение `/api/seller/setup`;
- объединение S3 setup, S10 contacts и S8 geo в одну серверную транзакцию;
- изменение закрытого S10 contract так, чтобы `phoneE164` стал глобально non-null и его нельзя было очистить вне onboarding;
- Seller/Location generic edit;
- изменение названия существующего Seller;
- изменение имени/type/address существующей Location;
- создание второй Location;
- address autocomplete / geocoding;
- reverse geocoding и автоматическое превращение browser geo в адрес;
- карта и ручная установка pin;
- ручной ввод latitude/longitude;
- автоматический запрос geolocation;
- реальный avatar/photo upload торговой точки;
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

- **S2 Auth:** current User определяется существующей Identity; anonymous Seller setup запрещён; `/api/auth/me` уже может отдать current User phone owner-side.
- **S3 Seller / Location:** один owned Seller на User в текущей модели; Seller + первая Location создаются существующей транзакцией; `Seller.displayName` остаётся non-blank; `/api/seller/setup` request/atomicity/repeat semantics неизменны.
- **S8 Location Geo:** geo принадлежит Location; browser geolocation только после явного действия П2; setup не принимает coordinates; owner-only geo update остаётся отдельным API.
- **S10 Contacts:** контакты принадлежат Seller; существующие owner-only GET/PUT semantics и canonical identifiers сохраняются; Identity phone может только предзаполнить editable UI и не считается опубликованным до явного save.
- **UX1D:** неполные Seller/Location допустимы seller-side; buyer visibility требует phone + geo; persisted publishability flag отсутствует.
- **UX1A / Design System:** app shell, Roboto, tokens, responsive/touch-target rules сохраняются.
- **S4/S5/S12:** Seller Input продолжает идти через SellerChangeSet; UX2 не изменяет Offer напрямую.

## Closed contracts potentially touched

Планово никакие closed public/business contracts не изменяются. UX2 — UI/orchestration slice.

Если реализация потребует расширить `/api/seller/setup`, менять S3 atomicity, передавать geo во время setup или делать S10 phone глобально non-null/неудаляемым — STOP до такого изменения.

## Risk flags

- **DB migration:** NO
- **Public API:** NO
- **Auth / security / privacy:** YES — используются существующие owner-sensitive Identity, Seller, Contacts и Location Geo boundaries.
- **Concurrency / atomicity:** NO new risk — S3 transaction остаётся неизменной; весь onboarding намеренно не является одной DB transaction.
- **Data loss:** NO — partial onboarding является допустимым resumable состоянием.
- **External service:** NO — browser Geolocation API не является внешним backend service; geocoding не входит.

## Expected modules

- Seller onboarding UI/composition;
- orchestration state `/seller`;
- Seller page presentation/styles;
- shared clearable text/contact input control;
- reuse существующих auth-me / setup / contacts / geo client flows;
- UX2 E2E;
- directly affected seller E2E regressions;
- slice/backlog documentation.

Не ожидаются изменения migrations/schema, Identity implementation, Search/Discovery, Offers business logic, Catalog, SellerChangeSet application/domain logic или buyer Offer cards.

## Acceptance criteria

1. Anonymous User на `/seller` по-прежнему получает существующий login gate.
2. Авторизованный User без Seller видит один onboarding-flow, а не отдельную первичную форму и появляющуюся после неё несвязанную форму контактов.
3. В onboarding доступны: optional `Имя`, обязательные название торговой точки / тип / адрес / телефон, а также optional WhatsApp / Telegram / Instagram.
4. `Имя` подписано как способ обращения покупателей и может быть пустым; при пустом имени S3 получает непустой `Seller.displayName`, равный названию торговой точки.
5. `Location.type` остаётся controlled choice из `market / shop / pavilion / home / other` и не имеет empty/clear state.
6. Название торговой точки и адрес обязательны для initial submit; существующая S3 server validation сохраняется.
7. Телефон необходим, чтобы UI считал onboarding завершённым; WhatsApp / Telegram / Instagram опциональны; canonical validation остаётся S10.
8. Для нового/partial Seller при отсутствии сохранённого public phone UI предзаполняет current Identity phone одновременно в `Телефон` и `WhatsApp`; оба значения можно изменить до сохранения, WhatsApp можно очистить полностью.
9. После первоначального prefill `Телефон` и `WhatsApp` независимы: изменение одного поля не переписывает другое.
10. Любой непустой text/contact input показывает доступную кнопку очистки; очистка обязательного поля допустима, но submit затем блокируется существующей validation до повторного заполнения.
11. Identity phone не записывается в Seller Contacts автоматически: public contacts меняются только существующим явным S10 PUT после submit пользователя.
12. Создание Seller + первой Location использует неизменённый S3 setup contract и сохраняет atomicity.
13. Contacts сохраняются через существующий S10 owner contacts resource; UX2 не добавляет contacts в setup API.
14. Если Seller + Location созданы, а contacts save завершился ошибкой, Seller/Location не удаляются и не создаются повторно; пользователь может продолжить onboarding.
15. Geo является обязательной частью завершения логического onboarding, но запрашивается только отдельным явным действием П2 после существования Location; автоматического permission prompt нет.
16. Ошибка/отказ browser geolocation оставляет Seller, Location и Contacts сохранёнными; geo step можно повторить позже.
17. Reload на любом незавершённом состоянии продолжает onboarding с фактического server state, не предлагает создать второго Seller и не теряет уже сохранённые данные.
18. После наличия Seller + Location + phone + geo UI показывает onboarding как завершённый и открывает существующий Seller Input / Offer-management путь без дополнительного технического setup.
19. Raw Location coordinates не показываются пользователю как текст и не становятся buyer-facing DTO из-за UX2.
20. Композиция onboarding следует Bolt reference и Design System: одна полноширинная рабочая панель без отдельной guide/sidebar, логические группы без ощущения технических экранов, рациональная desktop плотность и mobile-first hierarchy.
21. H1 страницы — `Настройка торговой точки`; первая секция — `Ваша торговая точка`; address остаётся manual input без fake provider autocomplete/reverse geocoding; geo остаётся отдельным explicit action.
22. Primary save action имеет собственный внутренний отступ от границ панели, выровнен слева на desktop и занимает доступную ширину на mobile.
23. UI не имеет horizontal overflow на `320 / 360 / 390 / 768 / 1024 / 1440 px`; interactive targets, включая clear buttons, минимум `44x44px`.

## Automated test plan

### E2E — основной targeted proof

Mobile + desktop:

- anonymous login gate;
- новый User проходит единый Seller onboarding;
- H1 / labels / required markers / no-sidebar composition соответствуют approved review;
- Identity phone предзаполняется одновременно в Phone + WhatsApp, поля можно независимо изменить/очистить перед save;
- clear controls появляются на непустых text/contact fields и действительно очищают значение;
- optional `Имя` можно оставить пустым, при этом S3 получает fallback displayName из названия торговой точки;
- пустые обязательные название торговой точки / адрес / телефон не проходят UI submit;
- Seller/Location создаются;
- contacts сохраняются только после explicit submit;
- geo запрашивается только по явному действию;
- denied geo оставляет setup resumable;
- successful geo завершает onboarding;
- reload после существенных partial states продолжает правильный этап;
- после completion доступны существующие Seller Input controls;
- save action alignment/touch target и layout без horizontal overflow подтверждены на representative widths.

### Integration

Новой backend-логики не планируется. Новый integration suite не нужен. Targeted regression подтверждает существующие S3/S8/S10 contracts только если их implementation modules фактически затронуты.

### Unit

Не обязателен. Добавляется только если реализация выделит нетривиальную чистую функцию вычисления onboarding state.

После targeted proof — один полный branch CI на финальном executable SHA.

## Manual acceptance

1. Войти новым тестовым User.
2. Открыть `Продавцу` и увидеть H1 `Настройка торговой точки` без `Seller Input` и без отдельной левой progress-колонки.
3. Убедиться, что `Имя` помечено как optional и объясняет, что это обращение покупателей.
4. Увидеть `*` у названия торговой точки, типа, адреса, телефона и шага местоположения.
5. Убедиться, что в `Телефон` и `WhatsApp` уже подставлен номер входа; изменить один из них и убедиться, что второй не меняется автоматически.
6. Нажать очистку у WhatsApp и любого другого заполненного text input; значение должно очиститься, а layout не прыгать/не переполняться.
7. В одной полноширинной панели заполнить обязательные данные точки и при желании мессенджеры; optional имя можно оставить пустым.
8. Проверить, что первая секция называется `Ваша торговая точка`, имеет визуальный marker и нормальные внутренние отступы, а `Сохранить и продолжить` не прижат к краю.
9. Сохранить и убедиться, что интерфейс не превращается во «вторую настройку» и registration phone/WhatsApp не считались публичными до save.
10. Явно определить местоположение и разрешить browser geolocation; адрес при этом не подменяется автоматически.
11. Убедиться, что onboarding показывает состояние «готово».
12. Перезагрузить страницу и убедиться, что настройка не начинается заново, а П2 видит существующий Seller Input / управление предложениями.
13. Проверить mobile и desktop визуально, в том числе Bolt-like composition/rhythm.
