# KAIDA.KZ — Commercial Entitlements Model

**Версия:** 0.1
**Дата:** 2026-09-30
**Статус:** Product Owner direction / parent product source for future planning

Этот документ задаёт целевую коммерческую domain model. Он **не является Slice Contract** и не разрешает создавать
Billing UI, payment integration, subscriptions, billing tables, Boost, Business или seller-facing paid Demand.

## 1. Product packaging

```text
KAIDA Free
→ KAIDA Pro
→ KAIDA Business

+ KAIDA Boost как отдельная разовая покупка
```

- **Free** — полноценное ручное присутствие продавца: правдивый ассортимент, точки, Offers, actuality, organic
  visibility и базовый результат. Коммерческого hard assortment cap нет.
- **Pro** — один понятный продавцу пакет `AI + full Demand + Performance`. Его внутренние capabilities и readiness
  gates остаются раздельными, но продавать Pro можно только после готовности минимально полезных версий всех трёх
  частей. Внутренние feature flags допустимы; продукт «Pro только с AI» не запускается.
- **Boost** — one-off purchase дополнительного релевантного охвата конкретного buyer-visible Offer. Boost не является
  Plan и может быть доступен независимо от Pro.
- **Business** — организационный масштаб: сотрудники и роли, несколько точек, bulk operations, XLS/CSV import,
  cross-location analytics, aggregated Demand, audit/history и повышенные квоты. Public API, 1C/ERP и другие
  integrations — следующий этап, а не условие первого sellable Business.
- Для П1 платного tier на этом этапе нет; core Search/Discovery не ограничиваются paywall без нового решения PO.

Оплата не даёт преимуществ в organic relevance и не обходит actuality, moderation, buyer visibility, privacy или
иные domain/safety rules.

## 2. Conceptual domain model

```text
CommercialAccount
→ Plan
→ Entitlements
→ Limits
→ Usage
→ Overrides
→ BillingState
→ Purchases / PromotionCampaigns
→ EffectiveEntitlements
```

Это conceptual planning model, а не требование создать по таблице на каждое понятие. Конкретный slice материализует
только минимальную модель, которая нужна его user task.

### CommercialAccount

Коммерческий субъект, к которому относятся plan, purchases, limits, usage и billing lifecycle. В первой версии
действует однозначная связь `1 Seller = 1 CommercialAccount`; все Locations этого Seller используют общий
коммерческий статус. `CommercialAccount` не равен `User`.

`Organization` и polymorphic owner сейчас не вводятся. Если появится подтверждённая необходимость объединять
нескольких Sellers, сотрудников, общий billing или сеть, Organization проектируется отдельным Business slice.

### Plan

Versionable/configurable baseline долгоживущих capabilities: `FREE`, `PRO`, `BUSINESS`. Boost не является Plan.
Plan definition не хранится набором frontend-констант.

### Entitlement

Именованное право на класс действия, например AI input, full Demand, advanced analytics, team management, bulk import,
API access или право купить Boost. Entitlement отвечает «можно ли», но не «сколько».

Финальные keys определяются owning Product Specs и Slice Contracts; generic framework заранее не строится.

### Limit и Usage

`Limit` задаёт квоту с metric, scope, value/unit, периодом/reset semantics, source и effective dates. Различаются:

1. commercial limits по plan/purchase;
2. technical, anti-abuse и fair-use limits, которые могут действовать на всех планах.

Оплата не обязана снимать safety ceiling. `Usage` учитывается server-side, идемпотентно и аудируемо; product analytics
events не являются billing ledger.

Коммерческие квоты направлены на стоимость и масштаб операций, а не на сокрытие реального ассортимента:

- Free сохраняет ручное ведение витрины и может получить небольшой trial/basic AI allowance;
- Pro получает AI/batch quota;
- Business получает повышенные или индивидуальные квоты, import/API capability по мере готовности;
- add-ons/overage возможны только как отдельное позднее решение.

Все значения конфигурируемые. Конкретные числа до unit economics и usage evidence не фиксируются.

### Override

Временное scoped commercial-исключение только для entitlement или limit. Оно содержит target, capability/limit,
effect, reason, actor, `starts_at`, обязательный `expires_at`, timestamps и audit. Выдать или отозвать Override может
`admin` либо будущая отдельная privileged commercial role.

Override не может обходить moderation, visibility, actuality, organic relevance, security, privacy, data residency
или policy. Бессрочных Overrides нет: технический default maximum duration — 30 дней; продление является новым
явным аудируемым изменением, а не permanent flag.

### BillingState

Provider-neutral lifecycle paid access. Финальные states/transitions принадлежат будущему Billing Product Spec; на
этом этапе не выбираются enum, payment provider или storage schema.

### Purchase и PromotionCampaign

`Purchase` фиксирует one-off commercial transaction/product; оплата не равна разрешению продолжать delivery.
`PromotionCampaign` — отдельная paid-promotion entity со ссылками на account, purchase/order и Offer, targeting,
state, eligibility reason, delivery accounting и audit.

Campaign не показывает Offer, который не buyer-visible, просрочен, снят оператором/moderation, нерелевантен или
нарушает policy. Paid placement маркируется и не меняет organic sorting.

### EffectiveEntitlements

Серверный read model/service фактического доступа на текущий момент. Он объясняет:

- разрешена ли capability;
- effective limit, usage и остаток;
- source/reason решения;
- срок изменения/истечения.

Frontend и Backoffice не вычисляют доступ самостоятельно из Plan, Overrides, Purchases и Usage.

## 3. Effective access precedence

```text
1. Domain/safety eligibility
2. Commercial account state
3. Baseline Plan entitlements/limits
4. Valid scoped Overrides
5. Applicable Purchases/credits
6. Usage against effective limits
7. EffectiveEntitlements result
```

Domain/safety restrictions всегда сильнее коммерческого источника. Временные права используют server-side time
semantics; конфликт источников возвращает объяснимый reason.

## 4. Free assortment and S25

Правдивый supply повышает ценность Search и Demand. Поэтому:

```text
hard commercial active-Offer cap = NOT A CURRENT MONETIZATION DIRECTION
```

Старый S25 `active Offers <= N` не implementation-ready. Модель «первые N бесплатно, дальше плати» удалена из
текущего направления монетизации: Free Seller может вручную поддерживать полный правдивый ассортимент. Допустимы
только technical, anti-abuse и fair-use limits. Вернуться к коммерческому assortment cap можно лишь по реальным
pilot evidence и новому явному решению PO с отдельным non-destructive contract.

## 5. Non-destructive downgrade

Потеря paid access не удаляет Offers, Locations, history, memberships, imports или audit. Organic visibility Free
сохраняется при обычной eligibility. Paid-only operations блокируются или переходят в read-only/grace behavior,
которое заранее определяет owning contract.

## 6. Dependency chains

### Pro

```text
AI Input ready + Demand paid-readiness + Performance instrumentation
→ Commercial entitlement foundation
→ Pro feature gates
→ provider-neutral Billing foundation
→ Pro lifecycle/purchase
```

Pro entitlement не делает неготовый Demand готовым и не разрешает AI писать Offer мимо `SellerChangeSet`.
Capabilities можно строить и включать внутренними flags независимо, но внешний Pro launch gate требует одновременно
минимально полезные `AI + full Demand + Performance`.

### Demand

```text
S15B Search System
→ S15C D0/D1 + D2 foundation
→ production-like accumulation/internal validation
→ D3 free seller pilot
→ seller reaction + buyer benefit proof
→ willingness-to-pay proof
→ D4 full Demand entitlement in Pro
→ D5 alerts / D6 Business Demand when separately ready
```

Privacy suppression сильнее paid entitlement.

Demand не продаётся отдельной подпиской: actionable signals входят в Free, full Demand — в Pro, multi-location и
aggregated Demand — в Business. Основная seller IA: `Ещё → Что ищут покупатели`; в витрине допустимы только
actionable teasers с CTA. Точная подача, периоды, радиусы и объём Free preview определяются после накопления данных.

### Boost

```text
Sponsored-surface/product policy
→ PromotionCampaign domain + eligibility
→ provider-neutral Purchase/payment foundation
→ marked paid delivery in Search / Nearby / relevant Discovery
→ campaign measurement/support operations
```

Boost не зависит от Pro. V1 использует product/category relevance, geography и ограниченный display period по модели
`fixed price → fixed period → estimated extra reach`. Auction, CPC и CPM в v1 не входят. Boost не гарантирует продажи
или покупателей. Exact packages, prices, frequency caps и inventory принадлежат будущему Boost Product Spec.

### Business

```text
employees + roles
→ safe multi-location management
→ bulk operations + XLS/CSV import
→ cross-location analytics + aggregated Demand
→ audit/history + higher/custom quotas
→ Business packaging and lifecycle
→ later API / 1C / ERP / integrations
```

Business использует общие Seller/Location/Offer/Change Set domains и не получает отдельный backend.

## 7. Editorial Featured is not Paid Promotion

```text
Editorial Featured: reason = KAIDA editorial/product decision
Paid Promotion:    reason = seller paid campaign
```

Даже на общей buyer surface они имеют разные entity/state, permissions, audit, metrics, removal semantics и reason of
display. Editorial Featured управляется командой KAIDA через Backoffice, не продаётся Seller и может использоваться в
«Интересное сегодня», на главной и на market/discovery pages. Оно не меняет normal Search sorting.

Существующий/будущий `Featured` нельзя использовать как shortcut для Boost; paid placement требует маркировки.

## 8. Performance boundary

Free отвечает на вопрос «приносит ли KAIDA внимание»: Offer views, card opens, route actions, contact actions и
базовые totals за ограниченный период. Pro добавляет product breakdown, trends/period comparisons, longer history,
Demand linkage, funnel-like metrics, Boost results и дополнительную аналитику.

Contact или route action нельзя называть продажей или покупкой: KAIDA не наблюдает факт сделки.

## 9. Backoffice boundary

Backoffice — административный клиент этой domain model. Он может читать CommercialAccount, Plan, BillingState,
EffectiveEntitlements, limits/usage, Overrides, Purchases, PromotionCampaigns и audit; controlled writes выполняются
только через server-side domain commands.

Backoffice не редактирует EffectiveEntitlements напрямую, не правит Usage произвольным числом и не становится
источником тарифной истины. Commercial UI проектируется только после Commercial & Monetization Readiness.

## 10. Future slice families, not implementation authorization

- commercial entitlement/effective-access foundation;
- usage accounting только для первой реально metered capability;
- Pro feature gates;
- provider-neutral Billing foundation и затем Pro lifecycle/purchase;
- PromotionCampaign domain;
- Boost purchase/delivery and measurement;
- Business minimum package;
- Backoffice commercial visibility, audited overrides, promotion operations и billing support — отдельными slices.

Каждый slice проходит обычный KAIDA vertical-slice loop. Один mega-slice `Monetization` запрещён.

## 11. Open Product Owner decisions

До соответствующих slices остаются открыты:

1. exact pricing;
2. численные AI/batch quotas и fair-use thresholds;
3. trial/grace/cancel rules;
4. refund rules;
5. payment provider и Kazakhstan-specific payment flow;
6. Boost prices/packages, frequency caps и inventory;
7. exact privacy minimum threshold для seller-facing Demand.

Эти решения принимаются в M6/M7 после AI unit economics, реальных Demand data, willingness-to-pay evidence, Boost
inventory model и исследования платежей в Казахстане. Архитектура не должна блокировать trial/grace/cancel/refund,
но сроки и правила до этого gate не придумываются.
