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
- `Добавить товар` при незавершённом setup открывает внутри `/seller` честный prerequisite-state: для создания SellerChangeSet нужна owned Location; из этого state пользователь может перейти к существующему setup;
- до появления owned Location product action не показывает фиктивно работающую product form, не собирает product draft и не вызывает SellerChangeSet API; поэтому slice не вводит новый draft persistence/data-loss contract;
- после завершённого setup используется существующий `Добавить товар` / SellerChangeSet flow без изменения Offer mutation semantics;
- direct anonymous deep link `/seller` может сохранить существующий login-required fallback; запрет относится к переходу через primary seller intent, который не должен сначала вести anonymous User на `/seller`.

## 3. Explicit out of scope

- multiple Trading Points CRUD, cards и управление точками из Issue #36;
- полноценный Seller Offer Workspace, Offer cards/list/edit из Issue #27;
- product-first draft до появления owned Location, его session/server persistence или автоматическое восстановление;
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
- **Data loss:** NO — до prerequisite completion product draft не собирается и не сохраняется.
- **External service:** NO.

## 7. Expected modules / boundaries

- shared app-shell seller navigation trigger;
- shared auth-state/modal orchestration с caller intent и destination;
- `/seller` first-run/empty landing composition;
- thin orchestration к существующему UX2 Seller setup и существующему SellerChangeSet create flow;
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
8. `Добавить товар` без owned Location показывает понятный prerequisite-state внутри `/seller` и action перехода к setup; SellerChangeSet/Offer API при этом не вызываются и product data не притворяется сохранённой.
9. После завершённого seller setup `/seller` сохраняет существующий доступ к `Добавить товар`, batch entry, contacts и Offer management; создание/confirm Offer продолжает идти через SellerChangeSet.
10. Direct anonymous `/seller` остаётся безопасным login-required fallback и не позволяет читать/изменять seller data.
11. Seller entry, Auth modal и first-run landing работают keyboard-accessibly, сохраняют minimum `44x44px` targets и не создают horizontal overflow на `320 / 360 / 390 / 768 / 1024 / 1440px`.
12. Diff не содержит изменений Auth/Seller public API, Identity/SellerChangeSet business logic, schema/migrations, mandatory price или других закрытых contracts сверх явно разрешённой navigation/presentation revision.

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
- `Добавить товар` без Location показывает prerequisite-state и не отправляет seller/change-set mutations;
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
4. Выбрать `Добавить товар`: увидеть честное объяснение prerequisite и переход к настройке точки без fake product save/API mutation.
5. Открыть `Торговая точка` и убедиться, что используется существующий resumable UX2 setup.
6. Вернуться на buyer page уже authenticated и нажать `Продавцу`: `/seller` открывается напрямую без modal.
7. Выйти, выполнить ordinary `Войти` и убедиться, что вход не отправляет пользователя в `/seller` без seller intent.
8. Повторить ключевой flow на mobile и desktop, включая keyboard close/focus и отсутствие overflow.

## Review gate

Этот документ не разрешает implementation. Следующий gate: Product Owner / Controller review и явное approval Slice Contract.
