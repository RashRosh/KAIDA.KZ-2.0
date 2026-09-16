# KAIDA.KZ 2.0 — Current Execution Plan

Этот документ — **единственный источник текущей очередности работ**.

Он не заменяет:

- `docs/PROJECT_RULES.md` — process/stable architecture rules;
- `docs/product/FEATURE_MAP.md` — long-range capability/dependency map;
- GitHub Issues — подробные требования незакрытой работы;
- Slice Contracts — точное поведение конкретного slice;
- `docs/DESIGN_SYSTEM.md` — presentation rules.

Перед началом любой работы проверить фактический `main`, latest checkpoint/tag и CI. SHA здесь — reference point, а не замена repository inspection.

## Current verified product checkpoint

- tag: `v0.0.23-mandatory-offer-price`;
- checkpoint commit: `6abc68ac7d67b368c91cc350f48829f839ecc76e`;
- Mandatory Offer Price — CLOSED;
- до него закрыты `S0–S13`, `UX1A`, `UX1A.1`, `UX1A.2`, `UX1B`, `UX1C`, `UX1D`, `UX2`, `UX2A`.

`main` может быть впереди checkpoint на docs/tooling maintenance без изменения product behavior; это проверяется по фактическому diff/CI.

## Классы работы

### COMMITTED

Твёрдая ближайшая очередь. Следующий этап берётся сверху вниз.

### INSERTION CANDIDATE

Capability зафиксирована, но не имеет постоянного номера. Она оценивается только на checkpoint/re-evaluation boundary по trigger и dependency, не вклиниваясь внутрь открытого slice.

### LATER

Capability сознательно не участвует в ближайшем выборе до нового product signal/decision.

Если утверждённое требование не имеет места ни здесь, ни в Feature Map/Issue, это `UNPLACED GAP`, а не автоматическое «когда-нибудь потом».

---

# NEXT — Issue #37

**UX reference audit and Design System reconciliation** — обязательный docs/research maintenance gate до следующего UI/UX product slice.

Phase 0:

- нормализовать источники истины;
- убрать stale current-state/order duplication;
- актуализировать README/project overview;
- оставить `EXECUTION_PLAN` единственным current roadmap;
- превратить `UX_BACKLOG` в маленький observation inbox;
- привести Project Rules / Controller / agent router к одной терминологии.

Phase 1:

- сопоставить Design System с релевантным UX corpus через `UX_REFERENCE_INDEX.md`;
- классифицировать findings как `KEEP / ADAPT / REJECT / GAP`;
- обновить Design System только по утверждённым выводам;
- разрешённую Product Owner временную demo/placeholder media presentation до M1 сформулировать без двусмысленности;
- не менять production UI/API/DB в рамках audit.

Пока #37 не закрыт и maintenance не merged в `main`, следующий UI/UX product slice не начинается.

---

# COMMITTED — после #37

1. **Seller Entry / contextual auth — Issue #35**  
   `Продавцу` открывает auth modal для anonymous User и после successful seller-intent auth ведёт прямо в seller workspace; authenticated User попадает туда сразу.

2. **Seller Trading Points Workspace — Issue #36**  
   Card-based просмотр/создание/редактирование нескольких owned Locations; Seller-level contacts не дублируются по Location без отдельного product decision.

3. **Seller Offer Workspace — Issue #27**  
   Marketplace-style Offer cards + простой manual add/edit/deactivate/reconfirm; ordinary UI не выставляет технические ChangeSet pages наружу, но SellerChangeSet boundary сохраняется.

4. **Seller Freshness Policy — Issue #31**  
   Утверждённая `2 / 7 / 14` lifecycle degradation policy, deterministic boundary semantics, no hard delete.

5. **Seller Freshness Reminder — Issue #32**  
   Proactive reconfirmation loop; channel/scheduler выбираются минимально необходимым Slice Contract.

6. **Nearby result-first correction — Issue #34**  
   Убрать explanatory hero; normal `Рядом` intent ведёт к geo/result flow, deep-link без intent остаётся privacy-safe.

7. **Search Sorting A — Issue #12**  
   `Актуальнее / Ближе`, где выбор `Ближе` сам запрашивает browser geolocation; отдельного geo-toggle нет; visible distance после successful geo.

8. **Search Sorting B — Issue #12**  
   Price ordering после явного решения comparability для `unit = null` и разных units; freshness eligibility/tier остаётся сильнее sort.

9. **M1 — real Offer media**  
   Seller-provided Offer photos end-to-end: model, upload/storage/lifecycle, multiple media, cover/primary semantics, buyer/seller presentation.

10. **S14 — Discovery / `Для вас`**  
    Явные Buyer interests → deterministic discovery без ML.

11. **S15 — Search learning**  
    Query Log / matched / unmatched / zero-result → controlled catalog evolution; query не создаёт Product автоматически.

12. **S16 — Operations + MVP/public-beta boundary review**  
    После закрытия core contour отдельно решить, какие insertion candidates обязательны до запуска.

---

# INSERTION CANDIDATES

## Market internal navigation — Issue #10

- dependency: stable Seller/Location/Search foundation + понятный seller workspace;
- trigger: пилот на крупных рынках показывает, что route до generic Location недостаточен;
- direction: Market directory → MarketPlace/scheme → Location binding → buyer internal navigation;
- не превращать generic Location в набор nullable `market/row/stall/x/y` полей.

## Additional Search filters

- earliest: после Sorting A/B и достаточной плотности реальной выдачи;
- trigger: пользователи не могут сузить большие result sets одной сортировкой;
- возможные filters только при наличии данных: radius, price range, rating после Reviews, media после M1, location type/Market по реальному use case;
- не добавлять giant filter drawer заранее.

## M2 — Offer video

- earliest: после M1;
- trigger: подтверждённый use case, который фотографии не решают;
- не смешивать Offer video presentation с AI video input.

---

# LATER / dependency-gated

- S17+ AI seller input — после устойчивого non-AI seller loop;
- Telegram seller input — поверх общей Seller Input business logic, не отдельное ядро;
- Recommendations/behavioral ranking — после накопления достаточных данных;
- Monetization/promotion — отдельные volume/convenience/reach mechanisms;
- advanced automation/ML — только после измеримого product signal.

---

## Re-evaluation rule

После каждого product checkpoint:

1. проверить фактический `main`/tag/CI;
2. закрыть completed Issue, если он больше не владеет работой;
3. посмотреть insertion candidates и новые `UNPLACED GAP`;
4. если Product Owner меняет порядок — сначала обновить этот файл;
5. только затем готовить следующий Slice Contract.

Новая идея проходит путь:

`observation → Issue / UX inbox → Product Owner decision → EXECUTION_PLAN (если меняет очередь) → Slice Contract → implementation`

Не поддерживать параллельный roadmap в README, Feature Map, UX Backlog или Issues.
