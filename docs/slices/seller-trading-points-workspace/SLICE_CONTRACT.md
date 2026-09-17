# Seller Trading Points Workspace — Slice Contract

**Issue:** #36 — Seller trading points: card-based edit and multiple locations

**Status:** DRAFT FOR CONTROLLER REVIEW

**Base main:** `4011dbc55b2229bb731d16d7f8fbff4f8c2626d0`

**Base product checkpoint:** `v0.0.24-seller-entry` / `28eae6d64fac92b71339b3ae2f5235040f75b447`

## 1. User task

Seller видит, добавляет и редактирует свои торговые точки как понятные карточки рабочего кабинета, а не проходит одноразовый технический onboarding flow.

## 2. Scope

- На `/seller` появляется постоянная область `Торговые точки` со всеми owned Locations текущего Seller.
- Каждая Location представлена карточкой с `name`, понятной меткой `type`, `address` и честным geo state. Активация карточки мышью или клавиатурой открывает редактирование этой точки.
- Рядом со списком есть доступная add-card / кнопка с плюсом для создания Location. Она не маскируется под существующую Location и имеет текстовое accessible name.
- Первый и последующие create flows используют один workspace-pattern:
  - User без Seller видит empty state той же области и создаёт Seller + первую Location через существующую атомарную S3 setup boundary;
  - owned Seller без Location создаёт первую Location через owner-scoped Location create;
  - owned Seller с Locations тем же действием создаёт дополнительную Location.
- Identity-поля Location создаются и редактируются одним строгим набором: `name`, `type`, `addressText`. Все три значения обязательны; строки trim-ятся и сохраняют закрытые S3 limits, а `type` остаётся controlled choice `market / shop / pavilion / home / other`.
- Identity update является атомарной полной заменой только этих трёх полей. Он не принимает Seller ownership, contacts или coordinates и не меняет `Location.id`.
- Geo остаётся отдельной S8 capability. Карточка показывает `не задано / сохранено` и даёт существующее explicit действие `Использовать / обновить моё местоположение`. Ручного ввода coordinates нет.
- Изменение `name`, `type` или `addressText` не очищает, не пересчитывает и не геокодирует сохранённый geo. После изменения адреса UI явно сообщает, что сохранённая геопозиция не изменилась и при фактическом переезде её нужно обновить отдельным действием.
- Seller contacts остаются отдельными Seller-level данными и могут продолжать редактироваться существующим owner flow. Они не входят в Location card payload и не дублируются при создании Location.
- First-run action `Торговая точка` из #35 открывает или фокусирует область `Торговые точки`; при отсутствии точки она показывает тот же add/empty-state flow. Product-first prerequisite также приводит в этот flow, сохраняя draft в рамках непрерывного #35 flow.
- Минимальная Offer compatibility adjustment применяется ко всем текущим seller UI paths, которые создают `create_offer` SellerChangeItem, включая single и batch create:
  - **offer-assignable owned Location** — persisted Location текущего Seller с valid required identity `name / type / addressText` по существующему contract;
  - geo этой Location и Seller public phone могут быть null: они влияют только на buyer-facing eligibility по UX1D и не блокируют выбор Location или создание SellerChangeSet;
  - `0` assignable Locations: SellerChangeSet не создаётся; Seller направляется в соответствующую карточку/add flow для создания точки, а #35 single product draft сохраняется в текущем непрерывном flow;
  - `1` assignable Location: UI может выбрать её автоматически и ясно показать выбранную точку до submit;
  - `2+` assignable Locations: каждый новый Offer требует явного выбора Location; первая Location не подставляется скрытым default;
  - backend перед созданием SellerChangeSet и повторно при confirm сохраняет существующую проверку `Location.seller_id == current Seller.id`.
- Geo-less Location и Seller без public phone остаются законными seller-side состояниями по S8/UX1D. Такая Location доступна для назначения новому Offer, но Offer не становится buyer-visible, пока не выполнены существующие UX1D eligibility conditions. Этот slice не меняет Search/Nearby policy и не вводит новый DB publishability flag.
- Редактирование Location не перепривязывает и не изменяет связанные Offer: их `location_id`, status, price, freshness и ChangeSet history сохраняются. Seller и buyer read models получают актуальные identity-данные Location через существующую связь.

## 3. Explicit out of scope

- Issue #27 Seller Offer Workspace, Offer cards или перестройка Offer editor;
- изменение Location у существующего Offer;
- freshness policy, degradation или reminders;
- media, AI seller input, monetization, Reviews/Rating;
- Market scheme, MarketPlace model и Issue #10 internal market navigation;
- per-location phone, WhatsApp, Telegram, Instagram или другие contact overrides;
- hard delete, archive, soft-delete, history/version log или restore Location;
- manual coordinate entry, clearing geo, map pin, geocoding/reverse geocoding или address autocomplete provider;
- новый auth flow, roles/RBAC или изменение S2 session semantics;
- redesign buyer Search/Nearby, sorting, ranking или buyer visibility;
- Location deduplication, idempotency-key framework и запрет двух похожих Locations;
- новый persisted onboarding/publication status.

## 4. Closed contracts used

- **S2 Auth / S3 Seller ownership:** current User определяется server-side; один owned Seller принадлежит User; client не задаёт Seller/User ownership.
- **S3 Seller / first Location:** Seller + первая Location для User без Seller создаются атомарно; required identity fields, limits, type set и DB constraints сохраняются.
- **S8 Location Geo:** geo принадлежит Location, может быть null, сохраняется complete pair, меняется только owner-only explicit browser action и не публикуется как raw coordinates.
- **S10 Seller contacts / UX1D buyer eligibility:** structured contacts принадлежат Seller; geo-less Location, Seller без public phone и связанный Offer допустимы seller-side; phone + geo являются только buyer-facing eligibility conditions Search/Nearby и не блокируют Location assignment или SellerChangeSet creation.
- **UX2 Seller onboarding:** first setup остаётся resumable по фактически сохранённым Seller / first Location / contacts / geo, без persisted completion flag.
- **#35 Seller Entry:** contextual auth, first-run workspace actions и сохранение product-first draft в одном непрерывном prerequisite flow сохраняются; prerequisite для SellerChangeSet требует Seller и owned Location, но не создаёт seller-side обязательность geo/contact.
- **S4 / S5 / S12 SellerChangeSet:** новый Offer создаётся только через SellerChangeSet; Location принадлежит Seller; confirmation atomic; batch остаётся all-or-nothing.
- **Mandatory Offer Price:** create/update publishable Offer требует valid amount; currency остаётся server-owned `KZT`.
- **Offer–Location relation:** каждый Offer хранит конкретный `location_id`; current Seller и Location ownership повторно проверяются на write/apply boundaries.

## 5. Closed contracts legitimately extended

- **UX2:** generic Seller/Location edit и создание второй Location переходят из out of scope в постоянный card-based workspace flow. Одноразовая presentation-модель onboarding больше не является единственным способом работать с Location.
- **#35:** action `Торговая точка` теперь ведёт в постоянную workspace area, а product-first prerequisite использует тот же first/add Location flow.
- **S3 application surface:** неизменная атомарная setup boundary продолжает создавать Seller + first Location, но после неё добавляются отдельные owner capabilities create additional Location и edit Location identity.
- **S4/S12 seller product presentation:** скрытый выбор `locations[0]` допустим только при одной offer-assignable Location; при нескольких новый Offer требует explicit Location choice. SellerChangeSet domain и apply semantics не меняются.

Другие закрытые public/business contracts этим slice не пересматриваются.

## 6. Risk flags

| Risk | Status | Contract consequence |
|---|---|---|
| DB migration | **NO** | Текущая schema уже поддерживает many Locations per Seller и все требуемые identity/geo fields. Если implementation обнаружит реальный model gap, STOP до migration design. |
| Public API | **YES** | Нужны owner-scoped create Location и identity update semantics; current owner Location list остаётся source для workspace. Requests strict, ownership не client-owned. |
| Auth / security / privacy | **YES** | Anonymous mutation запрещена; current User → owned Seller → owned Location проверяется server-side; foreign и nonexistent Location не различаются в edit/geo responses; raw coordinates не выводятся. |
| Concurrency / atomicity | **YES, bounded** | Identity update меняет три identity fields одним row update и не трогает geo. Concurrent identity + geo updates не должны терять изменения друг друга. Два concurrent identity updates используют last-committed complete payload без field mixing/partial state. Независимые concurrent creates могут создать две разные owned Locations; deduplication не обещается. |
| Data loss | **YES, bounded** | #35 product-first draft не должен терять различимые введённые значения при переходе `product-first → no Location → Trading Points flow → возврат` в одном непрерывном flow. Новый persisted draft/API/DB не вводится. Location edit не удаляет geo, Offer links или ChangeSet history; failed update не оставляет partial identity state. |
| External service | **NO** | Existing browser Geolocation API остаётся client capability; backend providers/geocoding не добавляются. |

## 7. Expected modules / architectural areas

- Seller workspace composition, responsive trading-point card list, add/empty/edit states and accessibility;
- Locations validation/application/repository boundary for owner-scoped create and identity update;
- seller Location API routes and existing owner read projection;
- orchestration of existing S3 first setup, Seller-level contacts and S8 geo action inside the persistent workspace;
- minimal single and batch `create_offer` UI adjustment for offer-assignable Location resolution and explicit choice;
- targeted integration/E2E regressions around S3, S8, #35, S4/S12 and Offer–Location ownership;
- slice documentation.

Не ожидаются schema/migrations, changes to Identity, contact storage, Offer persistence/lifecycle, SellerChangeSet apply architecture, Search/Nearby or Market modules.

## 8. Acceptance criteria

1. Authenticated Seller видит на `/seller` область `Торговые точки`: каждая owned Location показана отдельной truthful card, card открывает edit, а add-card создаёт новую точку; управление доступно клавиатурой и на mobile/desktop.
2. User без Seller создаёт Seller + first Location из empty state этой же области через существующую атомарную S3 setup boundary; owned Seller с `0` Locations и Seller с существующими Locations используют тот же workspace-pattern для create Location без повторного Seller setup.
3. Create/edit принимает только обязательные trimmed `name`, `type`, `addressText` в закрытых S3 limits; unknown/ownership/contact/coordinate fields отклоняются, а invalid request не создаёт и не изменяет Location.
4. Identity edit сохраняет тот же Location id и Seller ownership, атомарно заменяет только `name/type/addressText`, не очищает и не меняет geo; coordinates можно обновить независимо только существующим explicit S8 action.
5. Anonymous User не может читать/mutate owner workspace; User B не может изменить Location User A. Foreign, malformed и nonexistent Location не раскрывают ownership/existence через edit or geo mutation semantics.
6. Concurrent identity + geo updates сохраняют оба результата; concurrent identity updates не создают смешанного/частичного payload и завершаются одним из полных valid payloads. Два самостоятельных concurrent create requests создают две отдельные owned Locations и не нарушают Seller/Location constraints.
7. Seller-level phone/messengers нигде не копируются в Location cards, create/update payloads или rows; per-location contacts отсутствуют.
8. Existing Offer, привязанные к редактируемой Location, сохраняют ids, `location_id`, status, price, freshness и history; hard delete/archive/reassignment действия в UI/API отсутствуют, а актуальные identity-данные точки отражаются через существующую связь.
9. First-run action `Торговая точка` и product-first prerequisite #35 открывают новый workspace flow; различимые single-product values сохраняются без потери до возврата в SellerChangeSet creation в рамках одного непрерывного flow, без нового persisted draft/API/DB.
10. При `0 / 1 / 2+` offer-assignable owned Locations current single create flow соответственно блокирует ChangeSet и ведёт к созданию Location / автоматически показывает единственную точку / требует explicit choice без hidden first-location default. Те же правила выбора применяются к каждому batch `create_offer` item; update/activate/deactivate existing Offer не предлагают reassign Location.
11. Любой созданный SellerChangeSet хранит выбранную valid owned Location; geo и Seller public phone могут отсутствовать и не блокируют proposal/confirmation. Foreign/nonexistent Location отклоняется до proposal rows, confirmation повторно сохраняет ownership invariant, Offer не пишется напрямую и mandatory price остаётся обязательной. Geo/phone продолжают влиять только на buyer visibility по неизменной UX1D policy.
12. Cards/forms следуют Design System и релевантным UX references: mobile-first, без page-level overflow на `320 / 360 / 390 / 768 / 1024 / 1440px`, visible labels/focus/status/errors, targets минимум `44x44px`, без product-card ecommerce mechanics, fake data или раскрытия raw coordinates.

## 9. Automated test plan

### Integration — public API, ownership and persistence

- first S3 setup regression remains atomic; additional create returns a new Location for current Seller without creating another Seller;
- strict create/edit validation, trim/limits/type set and rejection of client ownership, contacts, coordinates and unknown fields;
- owner edit succeeds; anonymous is rejected; foreign and nonexistent ids share non-disclosing not-found semantics;
- identity update preserves Location id, seller id and geo; validation/failure leaves prior complete identity unchanged;
- existing Offer links and Offer fields survive Location identity edit unchanged;
- chosen owned Location is persisted in single/batch create proposal; foreign/nonexistent Location creates no ChangeSet/Item; existing confirmation ownership checks remain green;
- geo-less owned Location and Seller without public phone can be assigned to a new Offer through SellerChangeSet, while the resulting Offer remains absent from buyer Search/Nearby until existing UX1D eligibility conditions are met.

### Integration — bounded concurrency proof

- concurrent identity update and S8 geo update on one owned Location finish with the complete identity payload and complete geo pair both preserved;
- concurrent identity updates finish in one complete valid payload, never a mixed/partial identity;
- concurrent additional creates produce distinct valid Locations owned by the same Seller; no uniqueness/deduplication guarantee is asserted.

No repeated exact-SHA CI run is required unless these tests expose nondeterminism or a race investigation requires it.

### Unit

Targeted unit tests only for non-trivial pure logic introduced for `0 / 1 / 2+ offer-assignable Locations` selection and strict Location input validation. Do not add unit coverage for simple rendering/wiring already proven by integration/E2E.

### E2E — seller behavior

Mobile + desktop coverage:

- #35 `Торговая точка` → empty/add first point → persistent `Торговые точки` area;
- add second point, see two distinct cards, open one card, edit identity, reload and see persisted values plus unchanged geo state;
- browser geo prompt occurs only after explicit per-card action; raw coordinates are never rendered;
- product-first with `0` assignable Locations preserves distinguishable draft values through Location creation and return; one assignable Location is shown/selected automatically; two assignable Locations require an explicit selection before single ChangeSet create;
- representative batch `create_offer` item also requires explicit Location when multiple are assignable;
- Location без geo остаётся доступной для назначения новому Offer, Seller public phone не требуется для SellerChangeSet, а confirmed Offer сохраняет существующую UX1D invisibility в buyer Search/Nearby до появления phone + geo;
- no horizontal overflow, keyboard/focus usability and clear loading/error/status feedback at representative widths.

### Migration / external service

Not applicable. No migration is allowed by this contract, and CI does not depend on a geocoding/map/backend external service.

After targeted verification: one full regression run and branch CI on the final executable SHA.

## 10. Manual acceptance scenario

1. Войти новым Seller и открыть `Торговая точка`: в кабинете увидеть empty state `Торговые точки` и создать первую точку; geo можно оставить незаданным.
2. В той же области нажать add-card, создать вторую точку и увидеть обе карточки.
3. Открыть вторую карточку, изменить название/type/address, сохранить и убедиться, что geo state не сбросился; при необходимости отдельно обновить местоположение.
4. Вернуться в кабинет/reload и убедиться, что обе точки и изменения сохранились, а Seller contacts остались одним общим набором.
5. Начать добавление товара: при двух assignable Locations явно выбрать точку, в том числе точку без geo, создать proposal и на review увидеть именно её; отсутствие geo/public phone не блокирует SellerChangeSet, Offer до штатного confirm не применяется, а buyer visibility остаётся под существующей UX1D policy.
6. Убедиться, что в карточках нет delete/per-location contacts/Offer management и что flow usable на mobile и desktop.

## 11. UX reference application

- **KEEP:** distinct low-noise cards, only key truthful data, visible interaction feedback, readable mobile controls and immediate first-run task.
- **ADAPT:** generic whole-card click becomes an accessible edit action while geo and add remain explicit controls; onboarding guidance becomes persistent workspace empty/add flow, not tutorial screens.
- **REJECT:** ecommerce photo/cart/catalog/urgency mechanics, hover-only essential actions, onboarding carousel and any pattern that duplicates Seller contacts or weakens ownership/geo privacy.
- **GAP:** none for this contract.

## Review gate

Controller approval is required before implementation. No production code, migration, tests, CI, manual acceptance, merge, tag or Issue #27 work belongs to this contract-only pass.
