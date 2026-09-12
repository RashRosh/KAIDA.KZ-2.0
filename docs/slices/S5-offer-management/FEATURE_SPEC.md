# S5 Feature Spec — Offer management through ChangeSet

**Status:** DRAFT, NOT APPROVED  
**Implementation Contract:** APPROVED  
**Base checkpoint:** `v0.0.5-s4`  
**Base main:** `773ff9225c865d4721494fef74bdfce01569f174`

## 1. User task

Authenticated User, владеющий Seller, может управлять существующим Offer своего Seller только через SellerChangeSet.

Canonical flow:

```text
authenticated User
→ owned Seller
→ existing owned Offer
→ proposed SellerChangeSet
→ preview
→ explicit confirmation
→ existing Offer changes atomically
```

До confirmation существующий Offer остаётся buyer-facing truth без изменений.

После confirmation изменение применяется целиком.

S5 поддерживает три действия:

```text
update_offer
deactivate_offer
activate_offer
```

Существующее S4-действие:

```text
create_offer
```

остаётся рабочим с прежней семантикой и прежним публичным контрактом.

SellerChangeSet остаётся единственным seller-facing путём изменения Offer.

## 2. Scope

В S5 входят:

- минимальный список Offers текущего Seller;
- выбор собственного существующего Offer;
- предложение изменения через новый SellerChangeSet;
- ровно один SellerChangeItem в одном S5 user flow;
- изменение цены;
- удаление цены;
- изменение seller comment;
- удаление seller comment;
- деактивация Offer;
- повторная активация Offer;
- явное повторное подтверждение актуальности active Offer;
- preview до применения;
- persisted proposal;
- reload preview;
- explicit confirmation;
- атомарное применение;
- server-side ownership validation;
- защита от stale proposals через monotonic `Offer.revision`;
- repeated confirmation;
- same-ChangeSet concurrency;
- different-ChangeSet concurrency;
- S4 `create_offer` regression;
- Search regression;
- migration verification;
- automated tests;
- manual acceptance.

## 3. Offer revision

S5 вводит у Offer monotonic revision:

```text
revision integer NOT NULL DEFAULT 1
```

Правила:

- каждый существующий Offer после migration получает `revision = 1`;
- новый Offer, созданный существующим S4 `create_offer`, получает `revision = 1` через DB default;
- каждый успешно применённый S5 action увеличивает revision ровно на 1;
- revision никогда не уменьшается;
- неуспешная confirmation revision не меняет;
- repeated confirmation уже confirmed ChangeSet revision повторно не увеличивает.

SellerChangeItem для S5 сохраняет:

```text
target_offer_id
expected_offer_revision
```

Semantics:

```text
create_offer:
target_offer_id = NULL
expected_offer_revision = NULL

S5 action:
target_offer_id = existing Offer.id
expected_offer_revision = Offer.revision
```

`expected_offer_revision` фиксируется в момент создания proposal.

При confirmation текущее значение target Offer сравнивается с `expected_offer_revision`.

Если:

```text
Offer.revision != expected_offer_revision
```

confirmation завершается ошибкой:

```text
409 OFFER_CHANGED
```

Offer не меняется.

ChangeSet остаётся `proposed`.

Пользователь должен создать новое изменение на основе актуального Offer.

### Concurrent proposals

Если два разных ChangeSet созданы от одной исходной revision N, успешно примениться может только один.

Первый successful confirmation:

```text
N → N + 1
```

Второй получает:

```text
409 OFFER_CHANGED
```

Итоговая revision остаётся `N + 1`.

## 4. `update_offer`

`update_offer` является **full-state snapshot** для управляемых полей.

Request обязан содержать оба ключа:

```json
{
  "action": "update_offer",
  "price": {
    "amount": "4500.00",
    "unit": "кг"
  },
  "sellerComment": "Новая партия"
}
```

Допустимо:

```json
{
  "action": "update_offer",
  "price": null,
  "sellerComment": null
}
```

Значения:

```text
price = null
→ убрать цену

sellerComment = null
→ убрать комментарий
```

Оба ключа обязательны.

Отсутствие `price` или `sellerComment` является invalid input.

Partial patch semantics отсутствует.

При создании proposal SellerChangeItem сохраняет полное желаемое конечное состояние:

- `price_amount`;
- `price_currency`;
- `price_unit`;
- `seller_comment`.

Presence flags не добавляются.

### Normalization

Цена использует существующие S4 semantics.

Если price указан:

```text
currency = KZT
```

задаётся server-side.

Unit и seller comment trim-ятся.

Blank optional text нормализуется в `NULL`.

### No-op

После нормализации desired state сравнивается с текущим Offer.

Сравниваются:

- price presence;
- numeric amount по значению, а не сырому форматированию строки;
- currency;
- unit;
- seller comment.

Если desired price и sellerComment полностью совпадают с Offer:

- SellerChangeSet не создаётся;
- SellerChangeItem не создаётся;
- Offer не меняется;
- freshness не обновляется.

Stable domain contract:

```text
409 OFFER_UPDATE_NO_CHANGES
```

Сообщение:

```text
Изменения совпадают с текущим предложением.
```

Если Seller просто хочет подтвердить актуальность неизменившегося Offer, используется `activate_offer`.

### Successful update

При confirmation:

```text
price = desired full state
seller_comment = desired full state
status = unchanged
last_confirmed_at = confirmation time
updated_at = confirmation time
revision = revision + 1
```

Product, Seller и Location не меняются.

Если Offer inactive, update не активирует его.

## 5. `deactivate_offer`

Разрешено только для:

```text
Offer.status = active
```

При уже inactive Offer proposal не создаётся.

Stable domain contract:

```text
409 OFFER_ALREADY_INACTIVE
```

Сообщение:

```text
Предложение уже выключено.
```

При успешном confirmation:

```text
status = inactive
updated_at = confirmation time
revision = revision + 1
```

Не меняются:

- Product;
- Seller;
- Location;
- price;
- seller comment;
- `last_confirmed_at`;
- Offer ID.

До confirmation Offer продолжает вести себя для покупателя по прежнему committed состоянию.

## 6. `activate_offer`

`activate_offer` является явным подтверждением, что Offer снова или всё ещё актуален.

Разрешено для трёх случаев.

### Inactive Offer

```text
inactive
→ active
→ freshness refreshed
```

### Active expired Offer

```text
active expired
→ active
→ freshness refreshed
```

### Active fresh Offer

Тоже разрешено как явное повторное подтверждение актуальности Seller.

При успешном confirmation:

```text
status = active
last_confirmed_at = confirmation time
updated_at = confirmation time
revision = revision + 1
```

Не меняются:

- Product;
- Seller;
- Location;
- price;
- seller comment;
- Offer ID.

Во всех случаях используется тот же existing Offer.

Новый Offer не создаётся.

## 7. Seller ChangeSet lifecycle

Existing lifecycle сохраняется:

```text
proposed
→ confirmed
```

Новые состояния не вводятся.

Нет:

- cancelled;
- failed;
- stale;
- rejected;
- superseded;
- partially_confirmed.

Stale proposal остаётся:

```text
status = proposed
```

и получает `OFFER_CHANGED` при попытке confirmation.

## 8. Ownership

Все seller operations строятся через:

```text
authenticated User
→ owned Seller
→ owned Offer
```

Клиент не может задавать Seller ownership.

Target Offer обязан удовлетворять:

```text
Offer.seller_id == current Seller.id
```

И дополнительно:

```text
Location.seller_id == Offer.seller_id
```

Нельзя:

- изменить Offer другого Seller;
- изменить ownerless seed Offer;
- передать spoofed seller ID;
- использовать Location другого Seller.

Foreign и nonexistent Offer через seller management surface не различаются:

```text
404 OFFER_NOT_FOUND
```

## 9. Buyer-facing truth

Proposal никогда сам по себе не меняет buyer-facing Offer.

До confirmation Search использует старое committed состояние.

После успешного confirmation Search использует новое committed состояние.

Не допускается промежуточное видимое состояние.

Search module для S5 не меняется.

Существующая S1 lifecycle-логика остаётся единственной логикой видимости:

```text
status = active
AND
last_confirmed_at > cutoff
```

## 10. Migration / schema description

S5 добавляет только одно новое forward migration:

```text
drizzle/migrations/0005_s5_offer_management.sql
```

Historical migrations:

```text
0000
0001
0002
0003
0004
```

immutable и не изменяются.

Additive schema changes:

### `offers`

```text
revision integer NOT NULL DEFAULT 1
```

Никакие существующие Offer fields, lifecycle semantics или S1 contracts не меняются.

### `seller_change_items`

Добавляются:

```text
target_offer_id uuid NULL
expected_offer_revision integer NULL
```

Semantics:

```text
create_offer:
target_offer_id = NULL
expected_offer_revision = NULL

update_offer / deactivate_offer / activate_offer:
target_offer_id IS NOT NULL
expected_offer_revision IS NOT NULL
```

Существующие S4 rows остаются валидными.

## 11. Offer management surfaces

S5 добавляет отдельный seller-facing список Offers:

```text
GET /api/seller/offers
```

Он возвращает собственные active, inactive и expired Offers Seller.

Existing:

```text
GET /api/seller/me
```

не расширяется.

Создание S5 proposal выполняется через отдельный seller Offer management surface:

```text
POST /api/seller/offers/{offerId}/change-sets
```

Existing S4:

```text
POST /api/seller/change-sets
```

не меняет public contract или semantics.

Direct Offer CRUD отсутствует.

## 12. Concurrency semantics

### Repeated confirmation одного ChangeSet

Первый successful confirm:

```text
revision N
→ N + 1
```

Повторный confirm того же confirmed ChangeSet:

- возвращает тот же результат;
- не меняет Offer;
- не меняет `confirmed_at`;
- не меняет `updated_at`;
- не меняет `last_confirmed_at`;
- не увеличивает revision повторно.

### Два ChangeSets одной revision

Если A и B созданы от:

```text
Offer.revision = N
```

оба сохраняют:

```text
expected_offer_revision = N
```

После подтверждения A:

```text
Offer.revision = N + 1
```

Подтверждение B получает:

```text
409 OFFER_CHANGED
```

### Concurrent different ChangeSets

Если A и B одновременно пытаются изменить revision N:

- ровно один ChangeSet применяет изменение;
- winner получает `N + 1`;
- loser видит revision mismatch;
- loser получает `409 OFFER_CHANGED`;
- loser не меняет Offer;
- loser остаётся proposed.

## 13. Explicit Out of Scope

В S5 не входят:

- direct Offer CRUD;
- PATCH Offer;
- DELETE Offer;
- hard delete;
- изменение Product;
- изменение Location;
- изменение Seller;
- перенос Offer;
- Product creation;
- Catalog aliases;
- Catalog synonyms;
- geo;
- buyer location;
- ranking;
- Discovery;
- notifications;
- Reviews;
- moderation;
- AI;
- voice;
- photo;
- video;
- Telegram;
- batch ChangeSet;
- несколько Items в S5 flow;
- partial confirmation;
- edit proposed ChangeSet;
- buyer-facing price history;
- audit UI;
- workflow engine;
- generic state machine framework;
- event sourcing;
- monetization;
- subscriptions;
- promotion;
- seller analytics;
- Offer tuple deduplication;
- Search redesign;
- Auth redesign;
- RBAC.

## 14. Acceptance Criteria

S5 принимается только если одновременно выполняется следующее.

### Revision

1. У каждого Offer есть `revision integer NOT NULL DEFAULT 1`.
2. Historical migrations `0000-0004` не изменены.
3. Existing Offers после S4 → S5 upgrade получают revision 1.
4. Existing S4 `create_offer` создаёт Offer с revision 1 через DB default.
5. Public S4 create contract не меняется.
6. Каждый successful S5 action увеличивает revision ровно на 1.
7. Failed S5 action revision не меняет.
8. Repeated confirm одного ChangeSet revision повторно не увеличивает.

### Proposal isolation

9. Создание S5 proposal не изменяет Offer.
10. До confirmation buyer-facing state остаётся прежним.
11. Proposal переживает reload.
12. Client не задаёт `expected_offer_revision`.
13. Client не задаёт `target_offer_id` в body.
14. Оба значения определяются server-side.

### Ownership

15. Только authenticated Seller owner может управлять Offer.
16. Foreign Offer нельзя прочитать или изменить через S5 flow.
17. Nonexistent и foreign Offer дают одинаковый `OFFER_NOT_FOUND`.
18. Ownerless seed Offer нельзя изменить.
19. `Offer.seller_id == Location.seller_id` повторно проверяется перед apply.

### Update

20. Update body требует одновременно `price` и `sellerComment`.
21. Missing `price` является invalid input.
22. Missing `sellerComment` является invalid input.
23. `price = null` удаляет цену.
24. `sellerComment = null` удаляет комментарий.
25. Price и comment применяются как full final state.
26. Partial patch отсутствует.
27. No-op proposal не создаётся.
28. No-op возвращает `409 OFFER_UPDATE_NO_CHANGES`.
29. No-op не обновляет freshness.
30. Product не меняется.
31. Location не меняется.
32. Seller не меняется.
33. Offer ID не меняется.
34. Update inactive Offer не активирует его.
35. Successful update обновляет freshness.
36. Successful update увеличивает revision ровно на 1.

### Deactivate

37. Active Offer можно выключить.
38. Inactive Offer нельзя повторно deactivate.
39. Такой запрос даёт `409 OFFER_ALREADY_INACTIVE`.
40. Для already inactive ChangeSet не создаётся.
41. До confirmation active Offer остаётся видимым по обычным Search rules.
42. После confirmation status становится inactive.
43. Price/comment не меняются.
44. Offer ID не меняется.
45. Revision увеличивается ровно на 1.

### Activate

46. Inactive Offer можно activate.
47. Active expired Offer можно activate.
48. Active fresh Offer можно activate.
49. Во всех трёх случаях используется тот же Offer ID.
50. Status после confirmation active.
51. `last_confirmed_at` получает confirmation time.
52. Revision увеличивается ровно на 1.

### Revision conflicts

53. Два последовательных proposals могут быть созданы от revision N.
54. Первый successful confirm меняет revision N → N+1.
55. Второй получает `409 OFFER_CHANGED`.
56. Второй не изменяет Offer.
57. Второй остаётся proposed.
58. Два concurrent different ChangeSets одной revision дают ровно одного winner.
59. Winner увеличивает revision ровно один раз.
60. Loser получает `OFFER_CHANGED`.

### Same ChangeSet

61. Два concurrent confirm одного ChangeSet сходятся к одному результату.
62. Repeated confirm возвращает тот же Offer.
63. Repeated confirm не увеличивает revision второй раз.

### S4 regression

64. `create_offer` продолжает работать.
65. Его request contract не меняется.
66. Его confirmation semantics не меняются.
67. Его idempotency не меняется.
68. Его concurrency guarantee не меняется.
69. Новый S4 Offer получает revision 1 автоматически.

### Search regression

70. Search code не меняется.
71. Search API не меняется.
72. Active fresh managed Offer показывается.
73. Inactive managed Offer не показывается.
74. Expired Offer не показывается.
75. Activation возвращает Offer в выдачу при соблюдении S1 rules.
76. S0 seed Search остаётся рабочим.

## 15. Manual Acceptance

Один законченный пользовательский проход:

1. Открыть KAIDA.KZ на телефоне или в узком окне браузера, войти как продавец и создать предложение товара существующим способом.
2. Изменить у него цену и комментарий. На экране проверки убедиться, что новые данные указаны правильно, затем открыть обычный поиск и убедиться, что до подтверждения там всё ещё видны старые данные.
3. Вернуться к изменению, подтвердить его и убедиться, что в обычном поиске теперь отображаются новая цена и новый комментарий.
4. Перезагрузить страницу и убедиться, что подтверждённые данные сохранились.
5. Выключить это предложение. До подтверждения оно ещё должно находиться в поиске, после подтверждения должно исчезнуть.
6. Снова включить то же предложение и убедиться, что после подтверждения оно снова появилось в поиске.
7. Повторить быстрый просмотр ключевых экранов на desktop-размере и убедиться, что сценарий остаётся рабочим.
8. Выйти из аккаунта и убедиться, что обычный поиск продолжает работать.

Concurrency, stale conflicts, ownership protection, rollback и migration correctness проверяются автоматически и не входят в ручной пользовательский проход.
