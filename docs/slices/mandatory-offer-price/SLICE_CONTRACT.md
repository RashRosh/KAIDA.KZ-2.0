# Mandatory Offer Price - Slice Contract

**Status:** READY FOR CONTROLLER REVIEW  
**Implementation:** NOT STARTED

## 1. User task

Продавец может опубликовать или повторно опубликовать Offer только с указанной реальной ценой, а покупатель никогда не получает publishable Offer с неизвестной ценой.

## 2. Scope

В slice входит только необходимое для обязательной цены Offer:

- `price.amount` обязателен для нового или изменяемого publishable Offer;
- `0` является допустимым amount, отрицательный amount недопустим;
- currency остаётся server-owned `KZT`;
- `unit = null` остаётся допустимым и означает цену за Offer/лот/упаковку в том виде, как его представляет продавец; buyer presentation не добавляет `/unit`;
- single create и single update через Seller ChangeSet подчиняются этому правилу;
- S12 batch create/update подчиняется тому же правилу без ослабления all-or-nothing semantics;
- activation/republication legacy Offer без цены запрещена до исправления цены продавцом;
- legacy active Offer без цены переводится миграцией в безопасное inactive/remediation состояние;
- legacy inactive Offer без цены может временно храниться до seller remediation;
- migration и runtime invariants не должны придумывать цену, подставлять `0`, придумывать unit или удалять legacy Offer;
- buyer-facing Search, Nearby и Offer presentation выдают publishable Offer только с ценой;
- seller UI/API дают возможность исправить legacy Offer через существующий ChangeSet flow;
- persistence/API/UI contracts меняются только в объёме, необходимом для этих правил.

## 3. Explicit out of scope

Не входят:

- canonical unit taxonomy, unit aliases, conversions и price comparability model;
- price sorting, filters, ranges или сравнение цен;
- multiple currencies и currency conversion;
- discounts, promotions, taxes, inventory и price history;
- redesign Seller Offer Workspace или Seller ChangeSet flow;
- новые ChangeSet statuses, partial confirmation или новые Offer actions;
- AI input, media или Catalog redesign;
- полная физическая очистка всех legacy inactive Offers без цены;
- общий рефакторинг Offers, Seller Input, Search или Discovery.

## 4. Closed contracts revised

Этот slice сознательно пересматривает только следующие закрытые contracts.

### S4 - create Offer

Было: `price` мог отсутствовать или быть `null`.

Становится: create Offer требует price с валидным `amount`. `0` допустим. Отрицательное значение недопустимо. Currency остаётся server-owned `KZT`. `unit` остаётся optional/nullable.

Seller Input по-прежнему не изменяет Offer напрямую: proposal должен пройти `SellerChangeSet -> SellerChangeItem -> confirmation -> Offer`.

### S5 - update / activation

Было: `update_offer` мог очистить цену через `price = null`.

Становится: update Offer больше не может очистить цену. Изменяемый Offer должен сохранять или получать валидный amount. Legacy Offer без цены нельзя активировать или повторно публиковать, пока продавец не укажет реальную цену через существующий ChangeSet flow.

Revision, stale-proposal protection, idempotency и status-action semantics для валидно priced Offers не меняются.

### S12 - batch Seller Input

Batch `create_offer` и `update_offer` используют те же mandatory-price rules, что single-item S4/S5 flows.

Один invalid Item не должен приводить к частичному persistence/apply. Existing batch confirmation остаётся all-or-nothing.

### Buyer-facing Search / Nearby / Offer presentation

Текущая возможность buyer-facing price быть `null` для publishable Offer закрывается.

Search, Nearby и buyer Offer presentation должны возвращать и показывать publishable Offer только с валидным amount и server-owned `KZT`. При `unit = null` показывается цена без `/unit`.

Это меняет только price presence contract. Matching, lifecycle, ranking, contacts, routing и другие buyer semantics не пересматриваются.

## 5. Closed contracts preserved

Сохраняются без изменения:

- ChangeSet boundary: Seller UI/API не пишет Offer напрямую;
- explicit proposal/review/confirmation semantics;
- S12 all-or-nothing batch confirmation;
- ownership, server-side Seller/User resolution и foreign/not-found privacy boundaries;
- `Offer.revision`, expected revision, stale-proposal protection, repeated confirmation idempotency и существующие concurrency guarantees;
- S1 freshness/expiration и active/inactive lifecycle, кроме утверждённого migration transition legacy active no-price Offer в inactive remediation;
- S6 Product/alias resolution;
- S9 ranking и deterministic ordering;
- S10 buyer contact actions и routing;
- S13 Interests;
- optional Seller comment и его существующие semantics;
- anonymous buyer Search и существующие Auth/session contracts.

## 6. Risk flags

| Risk | Status | Что именно требуется доказать |
|---|---|---|
| DB migration | YES | legacy data безопасно переходит в новый invariant без invented prices или удаления Offers |
| public API / DTO | YES | seller create/update/batch становятся строже; buyer-facing publishable price становится non-null |
| closed contract revision | YES | ревизия ограничена S4, S5, S12 и price presence в buyer-facing Offer projection/presentation |
| legacy data / state transition | YES | active no-price -> inactive remediation; inactive no-price сохраняется до исправления |
| concurrency / atomicity | YES | новый price guard не ломает ChangeSet confirmation, stale protection и batch all-or-nothing |
| data loss | NO | destructive behavior не входит в slice; сохранность legacy rows доказывается как часть migration risk |
| auth / security / privacy | NO | ownership и privacy contracts не меняются; отдельный новый security layer не требуется |
| external service | NO | внешние сервисы не добавляются и не меняются |

## 7. Expected modules of change

Ожидаются только необходимые изменения в границах:

- Offers: price invariant, publishability и seller-visible legacy remediation state;
- Seller Input: validation и confirmation для single и batch ChangeSets;
- Search: buyer Offer price contract/projection;
- Discovery: Nearby buyer Offer price contract/projection;
- persistence/schema migration: legacy transition и защита нового invariant;
- seller API/UI: обязательный amount и remediation legacy Offer;
- buyer Offer presentation: отсутствие no-price fallback для publishable Offer;
- deterministic fixtures/seed data только если они нарушают новый contract.

Конкретные production-файлы, function/type names, migration number/name и SQL constraint names определяются на implementation stage минимальным diff.

## 8. Acceptance criteria

1. Single create без valid `price.amount` отклоняется до создания publishable Offer; `0` принимается, отрицательный amount отклоняется, currency остаётся server-owned `KZT`.
2. Single update не может очистить цену или оставить изменяемый Offer без amount; `unit = null` остаётся валидным.
3. Batch create/update применяет те же правила; один invalid Item не создаёт частично применённый batch и confirmation остаётся all-or-nothing.
4. Migration переводит каждый legacy active Offer без amount в inactive/remediation state, но не удаляет Offer, не придумывает amount, не подставляет `0` и не придумывает unit.
5. Legacy inactive Offer без amount сохраняется и остаётся доступным продавцу для исправления, но не становится buyer-publishable.
6. Legacy Offer без amount нельзя активировать или повторно опубликовать до того, как Seller укажет реальную цену через Seller ChangeSet.
7. Mandatory-price rule проверяется не только на входе API, но и на confirmation/persistence boundary, поэтому старый persisted proposal не может создать или опубликовать no-price Offer.
8. Seller ChangeSet boundary сохраняется для create, update, remediation и activation; прямое изменение Offer в обход confirmation не вводится.
9. Search, Nearby и buyer Offer presentation не возвращают и не показывают publishable Offer без amount. Valid `unit = null` отображается без `/unit`.
10. Existing ownership/privacy, revision/stale protection, idempotency, concurrency, lifecycle, ranking, contacts и Interests behavior остаются неизменными за пределами явно перечисленной price contract revision.

## 9. Automated verification plan

Только проверки, соответствующие реальным risk flags.

### Migration / legacy-state integration proof

На upgrade from current schema доказать минимум три состояния: priced Offer, active legacy no-price Offer и inactive legacy no-price Offer.

После migration проверить, что:

- active no-price Offer стал inactive/remediation;
- inactive no-price Offer сохранён;
- priced Offer не потерял цену и не был произвольно изменён;
- количество/идентичность legacy Offers и их связи сохранены;
- ни amount, ни `0`, ни unit не были fabricated;
- новый persistence invariant не позволяет получить publishable no-price Offer.

### API / validation / DTO proof

Targeted unit/integration tests должны доказать:

- mandatory amount для S4 create, S5 update и S12 batch create/update;
- `0` valid, negative invalid;
- `unit = null` valid;
- currency остаётся `KZT` и не становится client-owned;
- invalid request не оставляет частично persisted ChangeSet/Items;
- buyer-facing publishable Offer price является non-null.

### ChangeSet atomicity / concurrency proof

Targeted integration tests должны доказать:

- persisted legacy no-price proposal не может опубликовать Offer без цены;
- invalid Item не приводит к частичному batch apply;
- existing stale-revision, repeated-confirmation и concurrent-confirmation semantics сохраняются.

Отдельные повторные exact-SHA runs не требуются, если нет признаков race/flakiness сверх уже проверяемой concurrency semantics.

### Buyer-facing E2E proof

Один сквозной пользовательский proof должен показать, что Seller создаёт/исправляет Offer через ChangeSet, а Buyer после confirmation видит в Search/Nearby числовую KZT цену. При `unit = null` `/unit` не показывается. Publishable no-price Offer в buyer flow отсутствует.

После targeted proof требуется один полный branch CI на финальном executable head по обычному Process v2.

Отдельные новые auth/security или external-service suites не требуются, так как соответствующие risk flags отсутствуют.

## 10. Manual acceptance scenario

1. Seller пытается создать Offer без amount и не может перейти к успешной публикации.
2. Seller указывает допустимый amount, оставляет unit пустым, проходит существующий preview/confirm ChangeSet flow.
3. Buyer находит Offer через Search или Nearby и видит числовую цену в KZT без `/unit`.
4. Seller открывает legacy inactive no-price Offer: Offer требует remediation и не может быть активирован без цены.
5. Seller указывает реальную цену через существующий ChangeSet flow, подтверждает изменение и только после этого может повторно опубликовать Offer; Buyer видит уже priced Offer.

Manual acceptance не дублирует SQL/migration checks: сохранность legacy rows и migration invariants доказываются automated integration proof.

## 11. STOP conditions

Нужна остановка и решение Product Owner только если implementation требует хотя бы одного из следующего:

- изменить утверждённые product semantics цены: запретить `0`, сделать unit обязательным, разрешить client-owned/multiple currency или иначе переопределить значение `unit = null`;
- удалить legacy Offer, придумать ему amount/unit или автоматически заменить неизвестную цену на `0`;
- изменить ChangeSet boundary, разрешить direct Offer write или ослабить S12 all-or-nothing semantics;
- пересмотреть соседний closed contract сверх перечисленных в разделе 4, включая ownership/privacy, matching/ranking, lifecycle или buyer action semantics;
- для безопасной migration потребовать новый product-visible legacy state или иную remediation policy вместо утверждённого active -> inactive перехода.

Технические решения, которые не меняют этот contract, включая имена файлов, migration/constraint names, расположение validation и детали SQL implementation, не являются Product Owner STOP conditions.
