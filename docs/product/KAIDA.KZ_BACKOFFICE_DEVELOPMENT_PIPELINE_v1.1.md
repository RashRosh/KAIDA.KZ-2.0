# KAIDA.KZ — Backoffice Development Pipeline

**Версия:** 1.1
**Дата:** 2026-09-30
**Статус:** Product Owner direction / parent planning source

Backoffice — внутренний административный клиент общего backend/domain KAIDA.KZ. Документ не является разрешением на
реализацию Backoffice, Billing, Boost или иных перечисленных capabilities.

## 1. Stable boundary

Штатные операции команды должны со временем выполняться без PostgreSQL, SSH и ручных API-запросов. При этом
Backoffice:

- не является отдельным backend;
- не хранит копии Products, Sellers, Locations, Offers, Demand или commercial state;
- не содержит собственную business/commercial logic;
- вызывает общие domain operations и подчиняется тем же validation, permissions, audit, security и data-residency;
- не получает скрытые admin write paths, обходящие обычные invariants.

## 2. Planning pipeline before implementation

```text
0. Source synchronization / Requirement Inventory
1. Backoffice Operations Map
2. Roles & Permissions Model
3. Domain Operations, States & Invariants
4. Commercial & Monetization Readiness
5. MVP / Later prioritization
6. Information Architecture
7. UX / Designer Brief
8. UX/UI Design
9. API / DB / Backend Capability Gap Analysis
10. Slice Decomposition & Dependency Graph
11. Feature Map / Execution Plan update
12. One ordinary KAIDA vertical-slice loop per approved workflow
13. Operational Acceptance
14. Production operation and iteration
```

Stages 0–11 — planning/readiness. Они не создают production tables или UI автоматически.

## 3. Required planning artifacts

### Requirement Inventory

Для каждой потенциальной операции фиксируются source, domain entity, actor, current path, server capability, UI,
audit, stage и dependency. Области включают Catalog, Sellers, Locations, Offers, moderation, reports, Editorial
Featured, Demand, analytics, audit, configuration и commercial entities.

Целевое Backoffice coverage включает Catalog; Sellers; Locations; Offers; reviews/moderation; reports; media
moderation; Editorial Featured; users/roles; configuration; Demand operations; позднее commercial operations. Это
inventory, а не один Backoffice MVP/slice: каждая область входит только через собственный operational workflow и
готовые shared-domain dependencies.

### Operations Map

Описывает business actions, а не generic CRUD. Например: «оператор исправляет canonical Product с сохранением
истории и связей», а не `PATCH /products/:id`.

### Roles & Permissions

Не строится generic enterprise RBAC заранее. Минимальная ролевая модель:

- `operator` — Catalog, Seller, Location и Offer operations;
- `moderator` — reviews и media moderation;
- `admin` — роли, configuration и critical operations;
- privileged commercial scope/role — позже, только для subscriptions, Overrides и billing support.

Для каждой операции нужны явные read/execute permission, scope, reason/confirmation, reversibility, audit и
sensitive-data visibility. Неявных разрешений нет; sensitive actions аудируются.

### Domain operations, states and invariants

До экранов описываются lifecycle, допустимые transitions, ownership/scope, idempotency/concurrency, side effects,
visibility, audit и recovery. Backoffice вызывает domain command, а не воспроизводит эту логику локально.

### Commercial & Monetization Readiness

Обязательный gate **до Backoffice IA и UX**. Parent source:
`docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`.

На gate определяются будущие read/controlled-write needs для CommercialAccount, Plan, Entitlements, Limits, Usage,
Overrides, BillingState, Purchases, PromotionCampaigns и EffectiveEntitlements. Не выбираются provider/prices и не
строятся Billing UI/tables/subscription engine.

### MVP/Later → IA/UX → capability gaps

Сначала операция получает статус `MVP`, `Later`, `Not needed`, `Blocked by Product Decision` или
`Blocked by Domain/Foundation`. IA строится по workflow, а не по таблицам. UX проектируется только для approved
workflows. Затем каждый workflow получает classification `REUSE`, `EXTEND`, `NEW DOMAIN OPERATION`, `NEW READ MODEL`,
`PRODUCT DECISION BLOCKED` или `NOT REQUIRED`.

### Slice decomposition

Один slice завершает один operational workflow end-to-end. Нельзя сначала сделать все таблицы, потом все API, а
потом весь UI.

## 4. Future Backoffice slice families

Первый vertical зафиксирован; порядок после него назначается по Operations Map/dependency audit. Это не готовые
contracts:

1. **Catalog Operations — первый operational vertical:** find Product → open → create/edit → Category/Alias →
   deactivate → see relations/duplicates → audit;
2. Seller / Location / Offer operations;
3. moderation queues and decisions;
4. reports and support workflows;
5. Editorial Featured operations;
6. CommercialAccount + EffectiveEntitlements visibility;
7. audited commercial Overrides;
8. PromotionCampaign operations;
9. Billing/support operations позже;
10. system configuration/maintenance — только по доказанной operational need.

Каждая family раскладывается дальше, если один проход ручной приёмки не проверяет её однозначно.

## 5. Dependency chains

```text
Operations Map + Permissions + Domain invariants
→ Commercial & Monetization Readiness
→ MVP/Later split
→ IA/UX only for approved workflows
→ backend/API/DB gap analysis
→ slice dependency graph
→ individual Slice Contracts and ordinary implementation loop
```

Commercial Backoffice surfaces имеют дополнительные dependencies:

```text
commercial parent model
→ owning domain capability exists
→ shared server-side command/read model
→ permission + audit contract
→ Backoffice workflow slice
```

Demand operations появляются только после Demand foundation/readiness; Backoffice не получает raw-query surveillance
screen. Promotion operations появляются только после отдельного PromotionCampaign domain и не переиспользуют
Editorial Featured как paid state.

Editorial Featured управляется командой KAIDA через Backoffice, не продаётся Seller и может появляться в «Интересное
сегодня», на главной и на market/discovery pages. Оно не изменяет обычную Search sorting.

Commercial Override относится только к entitlement/limit, выдаётся `admin` или будущей privileged commercial role,
имеет reason, actor, start/expiry и audit. Default maximum duration — 30 дней; бессрочного режима и обхода moderation,
visibility, actuality, organic relevance или policy нет.

## 6. Vertical-slice execution loop

Каждый approved Backoffice slice проходит тот же процесс, что П1/П2:

```text
parent product source
→ Feature Map / Execution Plan position
→ Slice Contract
→ implementation
→ targeted proof + full branch CI
→ manual and operational acceptance
→ diff audit
→ explicit merge authorization
→ merge
→ merged-main CI
→ annotated checkpoint tag
```

Внутренний UI не получает упрощённый bypass.

## 7. Operational acceptance additions

Кроме обычной функциональной приёмки проверяется:

- workflow проходит без DB/SSH/manual API;
- server-side permission реально блокирует чужое действие;
- audit содержит actor/action/reason/result;
- UI не обещает то, чего backend не гарантирует;
- опасные действия показывают scope/consequences;
- Backoffice не обходит domain invariants;
- overrides объяснимы и трассируемы;
- editorial и paid states не смешаны;
- для critical workflow есть operational runbook.

## 8. Explicit non-goals of this planning stage

- giant Backoffice implementation;
- отдельный admin backend;
- generic CRUD ради будущего;
- Billing UI, payment provider и subscription engine;
- новые billing tables;
- Boost/Business implementation;
- seller-facing paid Demand;
- hard active-Offer commercial cap;
- generic enterprise RBAC, финальные menu/IA или полный permission matrix до Operations Map/readiness.

## 9. Remaining planning outputs

Новых открытых PO decisions этот pipeline не создаёт. До соответствующих future slices Operations Map и contracts
должны определить:

1. exact permission matrix внутри фиксированных minimum roles и separation of duties;
2. какие конкретные actions требуют mandatory reason, second confirmation или approval другого сотрудника;
3. порядок slices после Catalog Operations по результатам dependency audit;
4. когда commercial read-only visibility, Promotion operations и Billing support становятся доказанной operational
   need.

IA/menu, детальный permission matrix и API/DB shape не придумываются до Requirement Inventory/Operations Map. Если
при этом обнаружится настоящий product trade-off, он выносится PO отдельно, а не записывается заранее как решение.

## 10. Planning Definition of Done

До первого крупного Backoffice UI slice должны быть согласованы Requirement Inventory, Operations Map, permissions,
domain states/invariants, Commercial & Monetization Readiness, MVP/Later split, IA/UX brief, capability gap analysis и
slice dependency graph. Затем реализация идёт operational vertical slices, а не единым Backoffice-релизом.
