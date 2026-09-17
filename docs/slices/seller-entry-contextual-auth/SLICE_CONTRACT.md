# Issue #35 — Seller Entry / contextual auth and workspace landing

**Status:** DRAFT FOR PRODUCT OWNER / CONTROLLER REVIEW

**Base product checkpoint:** `v0.0.23-mandatory-offer-price`

**Checkpoint commit:** `6abc68ac7d67b368c91cc350f48829f839ecc76e`

**Repository main at contract preparation:** `0dd2bf9d28a2a4447e465fa903a02d75999d1300`

## 1. User task

Пользователь выбирает `Продавцу` и попадает в seller workspace с минимальным трением: anonymous проходит shared phone/OTP Auth поверх текущей buyer page, authenticated открывает `/seller` напрямую, а новый продавец видит понятный first-run landing с направлениями `Торговая точка` и `Добавить товар`.

## 2. Scope

- primary navigation `Продавцу` является seller intent, а не обычной безусловной ссылкой;
- anonymous User по seller intent остаётся на текущей buyer route и получает существующий shared phone/OTP Auth modal;
- успешный Auth, начатый из seller intent, сразу завершает переходом на `/seller`;
- cancel/close Auth modal отменяет seller intent и сохраняет исходную buyer route/context;
- authenticated User по `Продавцу` открывает `/seller` напрямую без повторного Auth modal;
- ordinary login из `Войти` и `/login` сохраняет закрытое поведение и не получает глобальный seller redirect;
- authenticated User без завершённого seller setup видит seller workspace empty/first-run landing, а не сразу линейную техническую форму;
- landing содержит две понятные actions: `Торговая точка` и `Добавить товар`;
- `Торговая точка` открывает существующий UX2 first-location setup/resume flow;
- `Добавить товар` является реальным product-first направлением: User может начать вводить product/Offer data до завершения Seller/Location setup;
- отсутствие required Seller/owned Location проверяется не перед началом ввода, а на границе продолжения к SellerChangeSet creation/apply; до выполнения prerequisite SellerChangeSet/Offer mutation не происходит;
- если prerequisite отсутствует, User получает понятный переход к существующему trading-point setup; уже введённые product data сохраняются в рамках этого непрерывного flow и после setup возвращаются без неожиданной потери;
- после выполнения prerequisite User продолжает существующий `Добавить товар` / SellerChangeSet flow без изменения Offer mutation semantics; contract требует observable continuity данных, но не предписывает internal orchestration или persistence architecture;
- direct anonymous deep link `/seller` может сохранить существующий login-required fallback; запрет относится к переходу через primary seller intent, который не должен сначала вести anonymous User на `/seller`.

## 3. Explicit out of scope

- multiple Trading Points CRUD, cards и управление точками из Issue #36;
- полноценный Seller Offer Workspace, Offer cards/list/edit из Issue #27;
- persisted product draft, cross-session/cross-device recovery и новый draft API/DB/domain contract;
- создание Seller/Location/Offer новых API или изменение существующих API;
- изменение Seller setup, contacts, geo, ownership или atomicity semantics;
- прямой write в Offer или обход SellerChangeSet/SellerChangeItem;
- изменение mandatory Offer price, freshness, Search, Discovery или buyer flows;
- новые auth methods, roles, permissions, SMS, cookie/session или OTP semantics;
- глобальный post-login redirect в `/seller`;
- DB/schema/migrations;
- новый UI framework, app-wide navigation redesign или refactor соседних seller flows.

## 4. Closed contracts used

- **S2 Auth:** существующие phone normalization, dynamic test OTP, Auth API, opaque DB session, cookie, current-user и logout semantics.
- **UX1A App Shell:** единый shell, navigation labels, stable responsive geometry и accessibility baseline.
- **UX1A.2 Auth modal:** shared modal поверх текущей page, реальные S2 endpoints, close/Escape/backdrop semantics, `/login` fallback и focus return.
- **S3 Seller / Location:** Seller принадлежит current User; первая Location создаётся существующим atomic setup; client не выбирает ownership.
- **S4/S5/S12 Seller Input:** Offer изменяется только через owned SellerChangeSet; Location должна принадлежать Seller.
- **UX2 Seller onboarding:** существующие setup/contacts/geo flows, resumable partial state и server-derived completion сохраняются.
- **Mandatory Offer Price:** существующий `Добавить товар` не может создавать publishable Offer без допустимого price amount.

## 5. Approved closed-contract revision

Issue #35 пересматривает только presentation/navigation assumptions:

- **UX1A:** для anonymous User seller entry больше не выполняет немедленный route transition в `/seller`; сначала открывается shared Auth modal на текущей buyer page;
- **UX1A.2:** успешный Auth получает caller-specific destination только для seller intent; ordinary login по-прежнему возвращает в существующий buyer context;
- **UX2:** first-run `/seller` получает workspace landing перед существующим линейным setup; anonymous gate на `/seller` перестаёт быть промежуточным шагом primary navigation, но может оставаться direct-link fallback.

Auth API/security, Seller ownership, setup atomicity и SellerChangeSet contracts не пересматриваются.

## 6. Risk flags

- **DB migration:** NO.
- **Public API:** NO.
- **Auth / security / privacy:** YES — меняются caller intent и post-auth navigation вокруг существующего Auth modal; S2 API/session/security semantics должны остаться неизменными.
- **Concurrency / atomicity:** NO new risk — OTP и Seller setup guarantees не меняются.
- **Data loss:** YES — product data вводится до prerequisite completion и может быть потеряна при переходе через trading-point setup. Targeted proof должен подтвердить сохранение введённых значений в рамках одного непрерывного product-first flow; persistence после deliberate reload, tab close или abandonment не входит в этот slice.
- **External service:** NO.

## 7. Expected modules / boundaries

- shared app-shell seller navigation trigger;
- shared auth-state/modal orchestration с caller intent и destination;
- `/seller` first-run/empty landing composition;
- thin orchestration между product-first input, существующим UX2 Seller setup и существующим SellerChangeSet create flow, сохраняющая введённые значения в рамках одного flow без нового public persistence contract;
- targeted seller-entry/auth E2E и непосредственно затронутые shell/onboarding regressions;
- slice documentation.

Не ожидаются изменения Identity application/storage, auth/seller API routes, DB/migrations, Seller/Location repositories, SellerChangeSet domain/application logic, Offers, Search или Catalog.

## 8. Acceptance criteria

1. Anonymous User нажимает `Продавцу` на buyer page: shared Auth modal открывается поверх этой page, URL не меняется на `/seller`.
2. Закрытие seller-intent Auth через X, Escape или backdrop оставляет исходный URL/context, не создаёт session и возвращает keyboard focus к seller trigger.
3. Successful phone/OTP Auth из seller intent использует существующие S2 endpoints/session и переводит User напрямую на `/seller` без второго login gate.
4. Authenticated User нажимает `Продавцу` и открывает `/seller` напрямую без Auth modal.
5. Ordinary `Войти` и direct `/login` сохраняют существующее post-auth buyer behavior; seller destination не становится глобальным Auth default.
6. Authenticated User без Seller видит first-run seller workspace landing с двумя доступными actions: `Торговая точка` и `Добавить товар`; линейная setup form не является единственным немедленным содержимым страницы.
7. `Торговая точка` открывает существующий UX2 setup, а partial setup после reload/resume продолжает использовать фактический server state и не создаёт второго Seller.
8. `Добавить товар` без owned Location открывает product/Offer input и позволяет ввести данные до завершения prerequisite; User не получает немедленное требование сначала создать Location.
9. Попытка продолжить к SellerChangeSet creation/apply при отсутствующем prerequisite не создаёт и не применяет SellerChangeSet, не записывает Offer и переводит User в понятный flow заполнения required trading-point data.
10. После завершения prerequisite в том же непрерывном flow ранее введённые product/Offer значения доступны без неожиданной потери; затем User явно продолжает существующий SellerChangeSet flow, и Offer не применяется автоматически.
11. После завершённого seller setup `/seller` сохраняет существующий доступ к `Добавить товар`, batch entry, contacts и Offer management; создание/confirm Offer продолжает идти через SellerChangeSet.
12. Direct anonymous `/seller` остаётся безопасным login-required fallback и не позволяет читать/изменять seller data.
13. Seller entry, Auth modal и first-run landing работают keyboard-accessibly, сохраняют minimum `44x44px` targets и не создают horizontal overflow на `320 / 360 / 390 / 768 / 1024 / 1440px`.
14. Diff не содержит нового persisted draft/API/DB contract или изменений Auth/Seller public API, Identity/SellerChangeSet business logic, schema/migrations, mandatory price и других закрытых contracts сверх явно разрешённой navigation/presentation revision.

## 9. Automated test plan

### E2E — основной targeted proof

Mobile + desktop:

- anonymous buyer route → `Продавцу` → modal без URL change;
- X / Escape / backdrop cancel сохраняет buyer route и anonymous state;
- seller-intent OTP success → `/seller` → first-run landing;
- authenticated `Продавцу` → `/seller` без modal;
- ordinary `Войти` и `/login` сохраняют существующий buyer destination;
- first-run landing показывает обе actions;
- `Торговая точка` открывает существующий UX2 setup;
- `Добавить товар` без Location открывает product input и принимает различимые product/Offer values до prerequisite completion;
- продолжение из product input без Location открывает existing setup, не отправляя SellerChangeSet/Offer mutations;
- завершение setup в том же flow возвращает ранее введённые values без потери, после чего User может продолжить существующий SellerChangeSet create/review/confirm flow;
- partial UX2 state остаётся resumable;
- completed Seller сохраняет существующий Add Product / ChangeSet flow;
- representative widths, focus return и отсутствие horizontal overflow.

### Unit

Не обязателен. Добавляется только если implementation выделит нетривиальную pure state transition для auth caller intent/landing state.

### Integration / migration

Новые integration/migration tests не требуются: public API, DB и domain logic не меняются. Existing S2/S3/SellerChangeSet suites остаются regression proof.

После targeted proof требуется один полный branch CI на финальном executable SHA. Повторный exact-SHA run не нужен без признаков flakiness/nondeterminism.

## 10. Manual acceptance scenario

1. На buyer Search page anonymous User нажимает `Продавцу`, видит shared Auth modal поверх той же страницы и закрывает его; route/context сохраняются.
2. Повторно открыть seller intent, пройти phone/OTP Auth и убедиться, что сразу открыт `/seller` без промежуточного `Нужно войти → Войти`.
3. Увидеть first-run seller workspace с actions `Торговая точка` и `Добавить товар`.
4. Выбрать `Добавить товар`, до создания Location ввести различимые product/Offer values и продолжить; убедиться, что открывается существующий UX2 setup, а SellerChangeSet/Offer mutation ещё не отправлена.
5. Завершить required trading-point setup в том же непрерывном flow и убедиться, что введённые product/Offer values сохранились; затем явно продолжить существующий SellerChangeSet flow и проверить, что Offer не применяется до его штатного confirm/apply.
6. Отдельно открыть `Торговая точка` и убедиться, что используется существующий resumable UX2 setup.
7. Вернуться на buyer page уже authenticated и нажать `Продавцу`: `/seller` открывается напрямую без modal.
8. Выйти, выполнить ordinary `Войти` и убедиться, что вход не отправляет пользователя в `/seller` без seller intent.
9. Повторить ключевой flow на mobile и desktop, включая keyboard close/focus и отсутствие overflow.

## Review gate

Этот документ не разрешает implementation. Следующий gate: Product Owner / Controller review и явное approval Slice Contract.
