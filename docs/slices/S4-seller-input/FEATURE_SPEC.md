# S4 Feature Spec — First Seller Change Set

**Status:** APPROVED  
**Base checkpoint:** `v0.0.4-s3` / `80d97bebd5e3427cdae96441df64dad23efdbb30`

## 1. User task

Authenticated User, который уже владеет Seller и Location, может вручную сообщить об одном существующем Product.

Система не создаёт Offer сразу.

Canonical flow:

```text
authenticated User
→ owned Seller
→ owned Location
→ manual seller input
→ proposed SellerChangeSet
→ one SellerChangeItem
→ review
→ explicit confirmation
→ one active Offer
```

До confirmation новый Offer отсутствует.

После confirmation новый Offer принадлежит Seller текущего User, использует принадлежащую этому Seller Location и существующий Product.

## 2. Definition of User Value

После S4 Seller впервые может самостоятельно создать реальное предложение товара, не имея прямого write-доступа к Offer.

S4 закрепляет правило:

```text
Seller Input никогда не изменяет Offer напрямую.
```

## 3. Scope

В S4 входят:

- существующая S2 authentication;
- существующий owned Seller из S3;
- принадлежащая Seller Location;
- новый доменный слой Seller Input;
- persisted `SellerChangeSet`;
- persisted `SellerChangeItem`;
- ровно один Change Item в пользовательском сценарии S4;
- ручной ввод одного Product;
- сопоставление только с уже существующим Product;
- preview/review proposed change;
- explicit confirmation;
- создание нового Offer только при confirmation;
- persisted read конкретного Change Set по ID с ownership-проверкой;
- reload proposed и confirmed состояний из PostgreSQL;
- server-side Seller ownership checks;
- server-side Location ownership checks;
- application invariant `Offer.seller_id == Location.seller_id` для S4-created Offer;
- existing S1 Offer Lifecycle;
- optional price;
- optional unit при наличии price;
- optional seller comment;
- минимальное расширение `/seller` и узкая addressable review surface;
- API, migration, automated tests, concurrency/atomicity tests, regression S0-S3, manual acceptance.

## 4. Product resolution

S4 не создаёт Product.

Seller вводит название товара вручную. Система выполняет только:

```text
trim
+
case-insensitive exact match
```

по существующему `Product.name`.

`баранина`, `Баранина`, `БАРАНИНА`, `  баранина  ` относятся к существующему Product `Баранина`.

Если Product не найден:

- Product не создаётся;
- SellerChangeSet не создаётся;
- SellerChangeItem не создаётся;
- Offer не создаётся;
- UI показывает понятный отказ.

Aliases, synonyms, fuzzy matching, Category и создание Product относятся к S6.

Если фактические данные Catalog содержат более одного case-insensitive exact match, S4 должен отказать как ambiguous match и не создавать никаких S4 rows. S4 не исправляет Catalog uniqueness semantics.

## 5. Seller Change Set model

Концептуально S4 вводит:

### SellerChangeSet

- `id`
- `seller_id`
- `status`
- `created_at`
- `confirmed_at`, nullable

### SellerChangeItem

- `id`
- `change_set_id`
- `action`
- `product_id`
- `location_id`
- `price_amount`, nullable
- `price_currency`, nullable
- `price_unit`, nullable
- `seller_comment`, nullable
- `result_offer_id`, nullable до confirmation

В S4 поддерживается только:

```text
action = create_offer
```

Один S4 use case создаёт ровно один Change Item.

Database model не запрещает несколько Items на Change Set, поскольку S12 расширит тот же агрегат до batch input.

## 6. Change Set lifecycle

Минимальная state machine:

```text
proposed
→ confirmed
```

`proposed` означает:

- Change Set и обязательный Item persisted;
- Seller может снова загрузить Change Set по его ID;
- Offer ещё не существует как результат этого Change Set.

`confirmed` означает:

- изменение применено;
- S4 Item связан с result Offer;
- тот же confirmed result повторно загружается по Change Set ID.

В S4 нет edit, partial confirmation, cancel state или workflow engine. Proposed Change Set после создания не редактируется.

## 7. Confirmation semantics

Confirmation является отдельным явным пользовательским действием.

Только authenticated User, владеющий Seller данного Change Set, может его подтвердить.

Confirmation выполняется атомарно:

```text
valid owned proposed Change Set
+
valid owned Location
+
existing Product
→
create Offer
+
record result Offer on Item
+
mark Change Set confirmed
```

Допустимые committed states:

```text
proposed Change Set + Item + no result Offer
```

или:

```text
confirmed Change Set + Item + valid result Offer
```

Запрещены committed states `confirmed + no valid result Offer` и `proposed + applied result Offer`.

## 8. Repeated and concurrent confirmation

Idempotency действует только относительно **одного и того же Change Set**.

Повторный confirm уже подтверждённого Change Set не создаёт второй Offer, если persisted confirmed state целостен. Он возвращает тот же Change Set, тот же `result_offer_id`, тот же Offer и тот же `confirmed_at`.

Если Change Set имеет `status = confirmed`, но S4 Item не имеет валидного `result_offer_id` либо соответствующий Offer отсутствует, это internal invariant failure, а не успешная idempotency. Такой запрос должен завершаться как server-side failure.

Два concurrent confirm requests одного Change Set создают максимум один Offer. Гарантия DB-backed и не зависит от disabled UI button.

## 9. Distinct Change Sets and duplicate tuples

S4 гарантирует:

```text
one Change Set → maximum one result Offer
```

S4 **не** вводит глобальный invariant:

```text
Seller + Product + Location → one Offer
```

Не добавляется unique constraint/index на `offers(seller_id, product_id, location_id)` и не создаётся deduplication framework.

Два разных, явно созданных и отдельно подтверждённых Change Sets являются двумя независимыми proposals и технически могут создать два Offer даже при одинаковых Seller, Product и Location.

Причина: Product semantics пока слишком грубая. У одного Seller в одной Location потенциально могут существовать отдельные Offers одного Product, отличающиеся ценой, unit или comment.

Необходимость deduplication будет отдельно решаться в S5/S7 или после более точной Catalog semantics.

## 10. Ownership invariant

Seller не передаётся клиентом как доверенное значение.

Seller определяется через:

```text
authenticated User
→ owned Seller
```

Location должна принадлежать именно этому Seller:

```text
Location.seller_id == Seller.id
```

Новый Offer создаётся только как:

```text
Offer.seller_id = Seller.id
Offer.location_id = owned Location.id
```

Следовательно, для всех S4-created Offers:

```text
Offer.seller_id == Location.seller_id
```

Нельзя создать Offer от имени другого Seller, для Location другого Seller, для ownerless seed Seller или через spoofed seller/user IDs.

S4 не вводит RBAC, roles или generic permission framework.

## 11. Offer and price semantics

При successful confirmation создаётся новый Offer:

- `product_id` из SellerChangeItem;
- `seller_id` из owned Seller;
- `location_id` из validated owned Location;
- `price_amount` из Change Item либо `NULL`;
- `price_currency = KZT`, если price указана, иначе `NULL`;
- `price_unit` из Change Item либо `NULL`;
- `seller_comment` из Change Item либо `NULL`;
- `status = active`;
- `last_confirmed_at = confirmation time`.

Цена необязательна.

Если `priceAmount` отсутствует:

```text
priceCurrency = NULL
priceUnit = NULL
```

Состояние `цены нет, unit = кг` запрещено.

Если price присутствует:

- currency всегда `KZT` и задаётся server-side;
- unit может присутствовать или отсутствовать.

`sellerComment` полностью optional.

Отдельный currency/unit catalog не создаётся.

Existing S1 lifecycle автоматически применяется к новому Offer. Новая freshness policy не создаётся.

## 12. Persisted resource and UI

S4 эволюционно расширяет `/seller`. Seller dashboard не создаётся.

### Anonymous

Сохраняется S3 login-required state.

### Authenticated User without Seller

Сохраняется S3 Seller setup.

### Authenticated User with Seller + Location

Показываются Seller/Location данные и минимальный блок добавления одного товара.

Input:

- Product name;
- optional price;
- optional unit внутри price semantics;
- optional seller comment.

Seller не вводится вручную. Location показывается явно и backend повторно проверяет ownership.

После submit создаётся persisted proposed Change Set и UI переходит к addressable resource, семантически:

```text
/seller/change-sets/{id}
```

Минимальная возможность снова загрузить **конкретный Change Set по ID** обязательна.

Reload proposed/confirmed состояния не зависит от React state, localStorage, sessionStorage или cached POST response.

Proposed preview показывает минимум Product, Seller, Location, price/unit/comment и явно говорит, что Offer ещё не применён.

После Confirm UI показывает confirmed result и созданный Offer. Reload снова показывает тот же result.

Не создаются list/history Change Sets, Offer management dashboard или management UI.

## 13. Search boundary and regression semantics

S4 не изменяет Search module и публичный Search API.

Не добавляются `published`, `searchable`, `source` или иной artificial state ради формальной границы S4/S7.

Из-за существующей generic Search projection новый active Seller-created Offer для известного Product может технически быть видим сразу после confirmation. Это допустимо.

После S4 seller flow поиск `баранина` может вернуть:

- старый S0 seed Offer;
- новый Seller-created Offer.

Regression invariant:

- Search продолжает работать;
- исходный seed Offer по-прежнему присутствует;
- ID и данные seed Offer не изменены;
- дополнительный S4 Offer не считается regression;
- S4 не устанавливает ranking/order этих результатов;
- S4 tests после seller flow не ожидают `offers.length === 1`.

Существующий S0 regression в чистом seed state может по-прежнему ожидать один seed Offer.

S7 остаётся владельцем гарантированного buyer flow:

```text
Seller-created Offer
→ Search
→ Buyer
```

## 14. Out of Scope

В S4 не входят:

- update/deactivate/disable/refresh/return существующего Offer;
- изменение proposed Change Set;
- cancel state;
- partial confirmation;
- bulk input;
- несколько Change Items в одном S4 user flow;
- AI/free-form AI;
- voice/photo/video;
- Telegram;
- Product creation/edit;
- aliases/synonyms/fuzzy matching/Category;
- Geo/distance/Discovery;
- contacts;
- Reviews/Moderation/Media/Notifications;
- subscriptions/monetization/promotion;
- seller analytics;
- multi-location management;
- seller dashboard/admin;
- real SMS;
- roles/RBAC;
- Search redesign;
- offer tuple deduplication.

Offer modification/deactivation belongs to S5. Catalog semantics belong to S6. Guaranteed buyer discovery belongs to S7. Multi-item Change Set belongs to S12. AI input belongs to S17+.

## 15. Acceptance Criteria

S4 is accepted only if all are true:

1. Base is verified `v0.0.4-s3` / `80d97bebd5e3427cdae96441df64dad23efdbb30`.
2. Existing migrations `0000`-`0003` remain unchanged.
3. SellerChangeSet exists as persisted entity.
4. SellerChangeItem exists as separate persisted entity.
5. S4 create flow commits ChangeSet + exactly one Item in one DB transaction.
6. No successful S4 proposal may contain zero or more than one Item.
7. DB model does not impose a permanent one-item-per-ChangeSet constraint that blocks S12.
8. Anonymous User cannot create/read/confirm seller Change Sets.
9. Authenticated User without owned Seller cannot create a Change Set.
10. Current Seller is derived server-side from authenticated User.
11. Seller ownership cannot be spoofed.
12. Location belongs to current Seller; foreign/nonexistent Location is rejected without S4 rows.
13. Existing Product resolves by trim + case-insensitive exact name.
14. Unknown Product creates no Product/ChangeSet/Item/Offer.
15. Ambiguous Product match creates no ChangeSet/Item/Offer.
16. Creating a proposed Change Set does not change Offer count.
17. Proposed Change Set is reloadable by its ID for owning Seller.
18. Another User cannot read or confirm it and cannot distinguish foreign ID from nonexistent resource through S4 endpoints.
19. Confirmation creates one new Offer for that Change Set.
20. Created Offer uses Item Product, current Seller and owned Location.
21. `Offer.seller_id == Location.seller_id` for S4-created Offer.
22. Created Offer is `active` and receives `last_confirmed_at = confirmation time`.
23. Price may be absent; absent price implies currency/unit null.
24. Present price uses KZT server-side; unit remains optional.
25. Seller comment may be absent.
26. Repeat confirmation of the same intact confirmed Change Set returns the same result and creates no Offer.
27. Confirmed-state corruption is not returned as successful idempotency and becomes internal server failure.
28. Concurrent confirmation of one Change Set creates at most one Offer.
29. Confirmation is atomic: no confirmed-without-valid-result or applied-while-proposed committed state.
30. Two distinct confirmed Change Sets may create two separate Offers even for equal Seller/Product/Location; no tuple uniqueness/deduplication is introduced.
31. Existing S0 seed Product/Seller/Location/Offers remain unchanged.
32. Existing Search works; after S4 flow seed Offer remains unchanged and additional S4 Offer is allowed without ranking requirement.
33. Existing S1 lifecycle remains unchanged.
34. Existing phone login/session/logout remain unchanged.
35. Existing S3 Seller setup/ownership/Location ownership remain unchanged.
36. Clean PostgreSQL 18 migration chain passes.
37. Real S3 → S4 upgrade passes.
38. New integration/concurrency/atomicity tests pass on real PostgreSQL 18.
39. Playwright covers S4 on mobile and desktop.
40. All S0-S3 regression tests remain green.
41. Production build and full `pnpm verify` pass.
42. GitHub Actions branch verification passes.
43. Manual acceptance passes before merge.
44. Merge to `main` occurs only after separate manual acceptance approval.
45. CI on merged `main` passes before checkpoint tag.
46. Only then may annotated `v0.0.5-s4` be created.

## 16. Manual Acceptance

1. Verify anonymous Search for `баранина` and canonical seed Offer.
2. Open `/seller` and login through S2 flow.
3. Use/create owned Seller + Location.
4. Enter `Баранина` and optional price/unit/comment.
5. Create proposed Change Set.
6. See persisted preview and explicit not-yet-applied state.
7. Reload and see the same proposed Change Set from server.
8. Confirm.
9. See confirmed result and created Offer.
10. Reload and see the same confirmed Change Set/result Offer.
11. Search `баранина`.
12. Verify original seed Offer still exists unchanged; additional S4 Offer is allowed.
13. Do not judge result order.
14. Verify Seller/Location remain correct.
15. Logout and verify anonymous Search still works.
16. Verify responsive behavior on mobile and desktop.

Concurrency, ownership spoofing, rollback, confirmed-state corruption, DB constraints and migration upgrade are automated-test responsibilities.

## 17. Planned checkpoint

Only after full Definition of Done:

`v0.0.5-s4`
