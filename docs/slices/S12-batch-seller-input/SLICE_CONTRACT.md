# S12 — Seller Input / Массовое ручное обновление

**Status:** DESIGN APPROVED CONDITIONALLY; IMPLEMENTATION BLOCKED  
**Verified product checkpoint:** `v0.0.12-s11` / `91244b6ebf3da3d2dea27dc71c83a47cdba4696e`  
**Current main after docs-only Feature Map sync:** `b25f69482172d0d0e578d69632a189eb5a4c0d0c`  
**Branch:** `slice/s12-batch-seller-input`

## 1. User task

Авторизованный П2 может вручную подготовить несколько изменений своего ассортимента как один `SellerChangeSet`, проверить весь пакет и одним подтверждением применить его целиком.

Canonical flow:

`Seller → несколько ручных изменений → один SellerChangeSet → несколько SellerChangeItems → preview → confirm → все изменения применены`

До confirmation buyer-facing состояние Offers не меняется.

## 2. Scope

В S12 входит:

- новый batch flow, создающий один `SellerChangeSet` минимум с двумя `SellerChangeItems`;
- существующие actions `create_offer`, `update_offer`, `deactivate_offer`, `activate_offer`;
- существующие S4/S5 semantics каждого отдельного action;
- возможность сочетать несколько допустимых actions в одном batch;
- persisted preview всего batch;
- reload proposed batch со всеми Items;
- одно explicit confirmation для всего batch;
- атомарное применение всего ChangeSet;
- server-side ownership validation для каждой Location и каждого target Offer;
- Product resolution через закрытый S6 Catalog contract;
- существующая optimistic concurrency через `Offer.revision` для Items, меняющих существующие Offers;
- idempotent repeated confirmation;
- concurrency proof для same batch и overlapping batches;
- минимальный seller UI для ручного формирования, review и confirmation пакета;
- additive public batch creation API без изменения существующих S4/S5 single-item API contracts.

## 3. Public API contract

### 3.1 Batch creation

S12 добавляет один endpoint:

`POST /api/seller/change-sets/batch`

Endpoint требует существующую S2 authentication.

Request body strict и содержит ровно один top-level key `items`.

`items` является массивом минимум из **2** элементов. Массив из 0 или 1 Item является invalid batch.

Поддерживаются четыре strict Item shapes.

### `create_offer`

```json
{
  "action": "create_offer",
  "productName": "Баранина",
  "locationId": "uuid",
  "price": {
    "amount": "4500.00",
    "unit": "кг"
  },
  "sellerComment": "Новая партия"
}
```

Для `create_offer` сохраняются закрытые S4 semantics:

- `productName` обязателен и разрешается через существующий S6 Catalog contract;
- `locationId` обязателен и Location должна принадлежать текущему Seller;
- `price` optional/nullable по существующим S4 price semantics;
- `sellerComment` optional/nullable по существующим S4 semantics;
- Seller не передаётся клиентом.

### `update_offer`

```json
{
  "action": "update_offer",
  "offerId": "uuid",
  "price": {
    "amount": "4800.00",
    "unit": "кг"
  },
  "sellerComment": "Свежая партия"
}
```

Для `update_offer` сохраняются закрытые S5 semantics:

- `offerId` обязателен;
- target Offer должен принадлежать текущему Seller;
- `price` обязателен как key и может быть `null`;
- `sellerComment` обязателен как key и может быть `null`;
- update остаётся full-state snapshot, не partial patch.

### `deactivate_offer`

```json
{
  "action": "deactivate_offer",
  "offerId": "uuid"
}
```

### `activate_offer`

```json
{
  "action": "activate_offer",
  "offerId": "uuid"
}
```

Unknown top-level fields, unknown Item fields, malformed action-specific shapes, malformed UUID, invalid price/comment data и `items.length < 2` возвращают:

```text
HTTP 400
{
  error: {
    code: "INVALID_BATCH_CHANGE_SET_INPUT",
    message: "Проверьте пакет изменений."
  }
}
```

Если validation/resolution любого Item завершается ошибкой, **ни SellerChangeSet, ни один SellerChangeItem не создаётся**.

Существующие domain errors переиспользуются без изменения их semantics, включая минимум:

- `SELLER_REQUIRED`;
- `PRODUCT_NOT_FOUND`;
- `PRODUCT_AMBIGUOUS`;
- `LOCATION_NOT_FOUND`;
- `OFFER_NOT_FOUND`;
- `OFFER_UPDATE_NO_CHANGES`;
- `OFFER_ALREADY_INACTIVE`.

Successful creation:

```text
HTTP 201
{
  changeSet: {
    id,
    status: "proposed",
    createdAt,
    confirmedAt: null,
    seller: { id, displayName },
    items: [
      {
        id,
        action,
        product: { id, name },
        location: { id, name, addressText, type },
        price: { amount, currency: "KZT", unit } | null,
        sellerComment: string | null,
        resultOffer: null
      }
    ]
  }
}
```

Response использует существующий `SellerChangeSetView`; для S12 `items.length >= 2`.

### 3.2 Read/reload

Существующий owner-only endpoint чтения конкретного ChangeSet продолжает использоваться без изменения публичной формы:

`GET /api/seller/change-sets/{id}`

Он должен возвращать все Items S12 batch через тот же `SellerChangeSetView`.

### 3.3 Confirmation

Новый confirmation endpoint **не создаётся**.

S12 переиспользует существующий endpoint:

`POST /api/seller/change-sets/{id}/confirm`

Его публичная request/response форма S4/S5 не меняется. Внутренняя confirmation logic расширяется так, чтобы тот же endpoint умел атомарно подтвердить ChangeSet с несколькими Items.

Successful confirmation остаётся:

```text
HTTP 200
{
  changeSet: existing SellerChangeSetView
}
```

Если хотя бы один management Item stale относительно сохранённой `expected_offer_revision`, confirmation всего batch завершается:

```text
HTTP 409
{
  error: {
    code: "OFFER_CHANGED",
    message: existing S5 message
  }
}
```

ChangeSet остаётся `proposed`, ни один Item не применяется.

Existing S4/S5 single-item API contracts не меняются.

## 4. Intra-batch conflict semantics

Минимальное правило S12:

**один batch не может содержать более одного management Item для одного и того же существующего Offer.**

То есть любые две записи `update_offer` / `deactivate_offer` / `activate_offer` с одинаковым `offerId` запрещены независимо от сочетания actions.

Такой batch отклоняется при proposal creation до любой persistence:

```text
HTTP 409
{
  error: {
    code: "BATCH_OFFER_CONFLICT",
    message: "В одном пакете нельзя изменять одно предложение несколько раз."
  }
}
```

S12 не вводит tuple deduplication для `create_offer`. Два create Items не считаются конфликтом только потому, что имеют одинаковые Seller + Product + Location; закрытая S4 semantics глобальной уникальности Offer не меняется.

Таким образом, результат batch не зависит от случайного порядка SQL/application calls внутри одного target Offer.

## 5. Explicit out of scope

Не входят:

- AI;
- голос, фото, видео;
- Telegram-бот;
- CSV/Excel import;
- background processing/queue;
- partial confirmation;
- применение только валидных Items из частично ошибочного batch;
- редактирование уже созданного proposed ChangeSet;
- undo/rollback уже confirmed ChangeSet;
- пользовательская история/audit UI;
- создание Product;
- автоматическое изменение Catalog;
- новые Offer actions;
- тарифы/entitlements;
- Search redesign;
- Discovery redesign;
- ranking changes;
- Offer lifecycle changes;
- Seller contact changes.

## 6. Закрытые contracts, которые S12 использует

**S2 Auth:** seller mutations доступны только authenticated User.

**S3 Seller / Location:** Seller определяется server-side через текущего User; Location должна принадлежать этому Seller.

**S4 Seller Input:** Seller Input не изменяет Offer напрямую. `create_offer` проходит через proposed ChangeSet → review → confirmation. Product resolution, price/comment semantics и ownership invariants сохраняются.

**S5 Offer management:** `update_offer`, `deactivate_offer`, `activate_offer`, full-state update semantics, `Offer.revision`, stale-proposal protection, repeated confirmation и ownership rules сохраняются.

**S6 Catalog:** Product должен существовать и разрешаться через существующий Catalog/Product aliases contract. Product не принадлежит Seller и не создаётся из seller input.

**S1/S7:** buyer-facing truth меняется только после committed confirmation и затем подчиняется обычным Offer lifecycle/search rules.

## 7. Закрытые contracts, которые потенциально затрагиваются

**S4 confirmation:** существующий single-item `create_offer` должен продолжить работать без изменения поведения.

**S5 concurrency:** batch не может обходить `expected_offer_revision` или stale protection.

**S4/S5 public API:** существующие single-item creation/management endpoints и accepted/rejected request shapes остаются неизменными.

**S7 buyer-facing truth:** до confirmation batch покупатель не видит ни одного изменения из пакета.

Обязательного изменения closed contract S0-S11 не требуется.

## 8. Risk flags

- **DB migration: NO.** Существующая model уже поддерживает `SellerChangeSet → many SellerChangeItems`; S12 не требует нового schema state.
- **Public API: YES.** Новый additive `POST /api/seller/change-sets/batch`; existing read/confirm endpoints переиспользуются без изменения публичной формы.
- **Auth/security/privacy: YES.** Product должен существовать/разрешаться через S6; Location должна принадлежать текущему Seller; target Offer должен принадлежать текущему Seller; `sellerId` не является доверенным client field.
- **Concurrency/atomicity: YES.** Batch должен применяться all-or-nothing, stale Item откатывает весь batch, same-batch и overlapping-batch concurrency должны быть детерминированы observable semantics.
- **Data loss: NO.** Новых destructive migrations/delete semantics нет.
- **External service: NO.**

## 9. Ожидаемые модули изменения

Ожидаются только необходимые границы:

- `Seller Input`: batch validation, proposal creation, persisted multi-item view и atomic confirmation;
- seller API boundary: новый additive batch creation route, существующие read/confirm routes только в необходимой степени для multi-item support;
- seller UI: ручное формирование batch, review и confirmation;
- `Offers`: использование существующих create/update/activate/deactivate primitives и revision semantics без нового direct CRUD contract;
- `Catalog`, `Identity`, `Sellers`, `Locations`: только через существующие contracts/repositories, без изменения их публичного поведения;
- automated tests S12.

Search, Discovery, ranking, contacts и Offer lifecycle менять не ожидается.

## 10. Acceptance criteria

1. Authenticated Seller может создать один proposed ChangeSet минимум с двумя валидными SellerChangeItems через `POST /api/seller/change-sets/batch`.

2. `items.length < 2`, malformed body или нарушение strict action-specific shape даёт `400 INVALID_BATCH_CHANGE_SET_INPUT` и не создаёт batch rows.

3. Если любой Item не проходит Product resolution, Location ownership, target Offer ownership или существующие S4/S5 domain rules, весь proposal creation завершается без persistence ChangeSet/Items.

4. Один batch не может содержать два management Items с одинаковым `offerId`; такой запрос даёт `409 BATCH_OFFER_CONFLICT` без persistence.

5. Proposed batch сохраняется в PostgreSQL; existing `GET /api/seller/change-sets/{id}` после reload возвращает тот же ChangeSet со всеми Items. До confirmation никакой Offer не изменён.

6. Existing `POST /api/seller/change-sets/{id}/confirm` одним действием либо успешно применяет **все** Items и переводит ChangeSet в `confirmed`, либо не применяет **ни одного**.

7. Если хотя бы один target Offer при confirmation stale относительно сохранённой revision, весь batch откатывается, возвращается `409 OFFER_CHANGED`, ChangeSet остаётся `proposed`, все остальные Offers остаются неизменными.

8. Если batch содержит `create_offer`, а другой Item не может быть применён при confirmation, созданный в этой транзакции Offer также не остаётся в БД.

9. Repeated confirm confirmed batch idempotent: Offers не создаются повторно, revisions повторно не увеличиваются, возвращается тот же persisted result.

10. Два concurrent confirm одного batch не применяют пакет дважды. Два overlapping ChangeSets, созданные от одинаковых revisions и затрагивающие хотя бы один общий existing Offer, дают максимум одного successful winner для конфликтующего состояния; loser получает `OFFER_CHANGED` и его batch не применяется частично.

11. Existing S4/S5 single-item flows и их public API продолжают работать с прежней семантикой.

12. После successful batch confirmation Search/Discovery видят только обычное committed Offer state через существующие S1/S7/S11 contracts; до confirmation они видят прежнее состояние.

## 11. Automated test plan

### Unit

Только для новой pure batch validation, если она выделена как самостоятельная логика:

- strict top-level/body shape;
- `items.length >= 2`;
- strict discriminated Item shapes;
- malformed/unknown fields.

Не создавать unit tests ради дублирования integration semantics.

### Integration

Основной proof S12:

- persisted multi-item proposal + reload;
- mixed valid actions;
- Product resolution и Location/Offer ownership по каждому Item;
- invalid Item → zero batch persistence;
- duplicate management target → `BATCH_OFFER_CONFLICT` + zero persistence;
- successful atomic confirmation;
- failure одного Item → rollback всех mutations;
- stale revision одного Item → `OFFER_CHANGED` + rollback всего batch;
- `create_offer` + failed management Item → created Offer rollback;
- repeated confirmation;
- concurrent confirmation одного batch;
- concurrent overlapping batches: winner/loser semantics без partial commit;
- targeted S4/S5 single-item regression.

### E2E

Один сквозной пользовательский сценарий:

`Seller формирует несколько ручных изменений → общий preview → reload → buyer-facing state ещё старое → одно confirm → весь committed result доступен через обычные buyer flows`.

### Migration proof

Не требуется, пока S12 действительно не добавляет/не меняет schema migration. Если в implementation внезапно появляется необходимость migration, это новый risk flag и Slice Contract должен быть пересмотрен до такого изменения.

После targeted proof обязателен full branch CI на финальном executable S12 head.

## 12. Manual acceptance scenario и обязательный precondition

Manual acceptance нельзя начинать только по факту green tests/CI.

Обязательный gate S12:

`targeted proof PASS → full branch CI PASS → current exact-SHA S12 application launched and accessible in browser → manual acceptance → pre-merge diff audit`

До просьбы пользователю выполнять manual acceptance исполнитель обязан сам поднять приложение именно на **финальном executable S12 SHA** и обеспечить возможность открыть эту версию в браузере. Нельзя просить пользователя нажимать кнопки, открывать Seller pages или проверять Buyer result, пока exact-SHA версия фактически не запущена и недоступна.

Manual acceptance остаётся пользовательской проверкой и не дублирует SQL/API/concurrency proofs.

Короткий сценарий:

1. Войти как существующий Seller.
2. Подготовить одним batch, например:
   - изменить цену Offer A;
   - выключить Offer B;
   - создать Offer для уже существующего Product C.
3. Открыть preview и убедиться, что все три изменения находятся внутри одного ChangeSet.
4. Reload страницы: batch сохранился, buyer-facing Offers ещё не изменились.
5. Подтвердить ChangeSet одним действием.
6. Проверить в seller UI, что весь пакет применён.
7. Через обычный buyer-facing UI проверить: A имеет новую цену, B больше не показывается как active Offer, Offer для существующего Product C появился.

Concurrency, stale protection, atomic rollback, ownership spoofing и API validation проверяются автоматическими тестами, а не manual acceptance.
