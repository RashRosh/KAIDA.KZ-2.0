# KAIDA.KZ 2.0 — Current Execution Plan

## Назначение

Этот документ является **каноническим источником текущей очередности работ**.

Он отвечает на вопросы:

- какой verified product checkpoint сейчас последний;
- что делаем следующим;
- какие этапы твёрдо включены в ближайшую очередь;
- где допускаются insertion decisions;
- какие future capabilities пока не имеют фиксированного места.

Он не заменяет:

- `docs/PROJECT_RULES.md` — процесс разработки и verification;
- `docs/product/FEATURE_MAP.md` — долгосрочную карту capabilities и зависимостей;
- `docs/DESIGN_SYSTEM.md` — визуальные и presentation rules;
- Slice Contracts — точное поведение конкретного slice;
- `docs/UX_BACKLOG.md` и GitHub Issues — наблюдения, gaps и future ideas.

Перед началом любой работы исполнитель обязан проверить фактический `main`, checkpoint/tag и CI evidence. SHA в этом документе являются зафиксированным состоянием на момент обновления, а не заменой проверки репозитория.

## Приоритет источников

Для планирования:

1. фактический repository state / verified checkpoint;
2. `docs/PROJECT_RULES.md`;
3. этот `EXECUTION_PLAN.md`;
4. `docs/product/FEATURE_MAP.md`;
5. `docs/UX_BACKLOG.md` и Issues.

Для UI/UX решений дополнительно действуют `docs/DESIGN_SYSTEM.md` и `docs/product/UX_REFERENCE_INDEX.md`. Внешние UX-материалы являются advisory evidence и не изменяют закрытые contracts автоматически.

## Текущее verified состояние

Последний verified product checkpoint:

- tag: `v0.0.23-mandatory-price`;
- commit: `6abc68ac7d67b368c91cc350f48829f839ecc76e`;
- Mandatory Offer Price — CLOSED;
- Issue #13 — CLOSED / completed.

Закрытый price contract:

- publishable Offer требует `price.amount`;
- `0` допустим, отрицательный amount недопустим;
- currency server-owned `KZT`;
- `unit = null` допустим и означает цену за Offer/лот/упаковку без `/unit` в buyer presentation;
- buyer-facing publishable Offer без цены невозможен;
- legacy no-price remediation не придумывает цену и не удаляет историю;
- SellerChangeSet boundary сохранён.

До этого закрыты `S0–S13`, `UX1A`, `UX1A.1`, `UX1A.2`, `UX1B`, `UX1C`, `UX1D`, `UX2`, `UX2A`.

## Правило очередности

Работа делится на три класса:

### COMMITTED

Твёрдая ближайшая очередь. Следующий этап берётся сверху вниз. Перескочить через него можно только после отдельного Product Owner decision и обновления этого файла.

### INSERTION CANDIDATE

Capability зафиксирована, но не имеет жёсткого номера. Для неё фиксируются earliest insertion point, trigger и latest useful point. Она рассматривается только на checkpoint boundary и не вклинивается внутрь уже открытого slice.

### LATER

Capability сознательно не участвует в ближайшем выборе до нового product signal/decision.

Если обнаружено утверждённое требование, которому нет места ни здесь, ни в Feature Map, оно считается `UNPLACED GAP` и должно быть явно разобрано, а не автоматически отправлено «после всего».

---

# NEXT — UX Reference Audit / Design System reconciliation

Связано с Issue #37.

Это **обязательный docs/research maintenance gate перед следующим UI/UX product slice**, а не продуктовая фича.

Причина: несколько последовательных manual walkthrough выявили системные UX gaps, которые не стоит исправлять по одному экрану без сверки общей системы: лишний Nearby hero, отдельный geo toggle в Search, тупиковый seller onboarding, технический Seller cabinet и перегруженный ChangeSet-facing manual flow.

## Что должен сделать audit

1. Прочитать текущий `docs/DESIGN_SYSTEM.md` и закрытые UI/product contracts.
2. Использовать `docs/product/UX_REFERENCE_INDEX.md` для выбора только релевантных материалов из Product Owner UX corpus в Google Drive.
3. Для каждого вывода использовать классификацию:
   - `KEEP` — правило KAIDA уже корректно;
   - `ADAPT` — внешняя практика полезна после адаптации под KAIDA;
   - `REJECT` — практика не подходит продуктовой модели или конфликтует с closed contract;
   - `GAP` — полезное правило отсутствует и требует Product Owner decision до реализации.
4. Обновить Design System минимально по утверждённым результатам.
5. Не менять production UI/API/DB в рамках audit.

UX corpus folder:

`https://drive.google.com/drive/folders/1Yb8ZWU5JnyzL4nj_7LS1SxRiW7tTEjk-?usp=sharing`

## Explicit Product Owner media decision

Предыдущий абсолютный запрет Design System на media slots до M1 больше не является целевым правилом.

Product Owner разрешил **временную demo/placeholder media presentation во время pre-MVP разработки, включая этапы до M1**, если она помогает честно спроектировать карточки и layout.

Граница решения:

- demo/placeholder media нельзя выдавать за реальные seller-uploaded Offer media;
- нельзя вводить seller upload/storage/API/lifecycle/media business semantics до соответствующего M1 contract;
- production behavior не должен зависеть от demo media;
- M1 по-прежнему владеет реальными seller-provided Offer photos end-to-end;
- audit обязан убрать противоречие из `docs/DESIGN_SYSTEM.md` до начала следующего UI product slice.

Пока Issue #37 не закрыт и audit docs не merged в `main`, **следующий UI/UX product slice не начинается**.

---

# COMMITTED — после UX audit

## 1. Seller Entry / contextual auth

Issue #35.

User task: нажатие `Продавцу` должно вести к seller intent без тупиковой anonymous setup page.

Утверждённое направление:

- anonymous User: `Продавцу` -> существующий phone/OTP Auth modal;
- successful auth из seller intent -> сразу `/seller`;
- cancel -> остаётся на исходной buyer page;
- authenticated User -> `/seller` напрямую;
- S2 auth/session/security contracts сохраняются.

Это отдельный маленький slice перед перестройкой Seller Workspace.

## 2. Seller Trading Points Workspace

Issue #36.

User task: Seller видит торговые точки как понятные cards, может открыть карточку для редактирования и добавить ещё одну через соседний add-card/`+`.

Правила:

- multiple Locations разрешены;
- Seller contacts остаются Seller-level data;
- Location хранит собственные name/type/address/geo;
- не дублировать глобальные контакты по каждой Location без отдельного product decision;
- при нескольких Locations Offer creation/edit обязан давать понятный Location choice;
- Market internal navigation остаётся отдельной capability #10.

## 3. Seller Offer Workspace

Issue #27.

User task: Seller управляет товарами как marketplace cards, а не как технической таблицей/ChangeSet console.

Утверждённое направление:

- `Мои товары` — card/grid layout;
- рядом add-card / `Добавить товар`;
- card показывает buyer-relevant core state: Product, mandatory price/unit semantics, Location, freshness/status и media presentation согласно актуальному Design System;
- click card -> direct manual edit on seller workspace surface;
- один понятный primary action завершает точное manual add/edit;
- после success Seller остаётся в workspace;
- ordinary UI не показывает `SellerChangeSet`, `ChangeItem`, `proposed`, `confirmed` и technical IDs как пользовательские понятия;
- если first-time Seller начал с товара, финальный publish при нехватке Seller/Location data запрашивает их и продолжает намерение без потери заполненной формы.

Архитектура не меняется скрытно:

`Seller Input -> SellerChangeSet -> SellerChangeItem -> confirmation/apply -> Offer`

S4/S5 presentation/confirmation contract revision должен быть явным в Slice Contract. Batch S12 не редизайнится автоматически.

## 4. Seller Freshness Policy — 2 / 7 / 14

Issue #31.

Core rule:

- `< 2d` — fresh;
- `2d <= age < 7d` — ageing, buyer-visible, но ниже fresh tier; buyer видит понятную age label;
- `age >= 7d` — Offer полностью исключён из Search / Nearby / Discovery;
- `age >= 14d` — Offer исчезает из обычного Seller working list через archive/hidden lifecycle без hard delete;
- `Всё без изменений` и successful edit обновляют `last_confirmed_at`;
- thresholds задаются policy/configuration;
- boundary tests на ровно 2d/7d/14d deterministic, без sleep.

Freshness tier сильнее обычной сортировки: fresh eligible Offers идут выше ageing eligible Offers; внутри tier применяется выбранный sort и deterministic tie-breakers.

## 5. Seller Freshness Reminder

Issue #32.

Target flow:

`Offer due -> reminder -> Seller Workspace -> Всё без изменений / Что-то изменилось -> confirmation/apply -> freshness reset`

Направление:

- target cadence примерно daily, но cadence отдельна от 2/7/14 thresholds и задаётся policy/configuration;
- reminder ведёт в нормальный Seller Workspace, не на technical ChangeSet page;
- transport выбирается отдельным Slice Contract;
- scheduler/background job, external service, privacy и duplicate-delivery/idempotency доказываются только если реально присутствуют.

## 6. Nearby result-first correction

Issue #34.

User task: `Рядом` сразу решает задачу просмотра nearby Offers, а не показывает большой explanatory landing block.

Направление:

- navigation `Рядом` является explicit geolocation intent;
- после permission/location primary content — nearby Offer cards;
- старый большой hero `Что есть рядом?` удаляется;
- direct `/nearby` без предшествующего user intent не должен автоматически запрашивать location: только компактный permission/action state;
- Nearby API/radius/privacy/eligibility не пересматриваются этим UI slice.

## 7. Search Sorting A — freshness / proximity

Issue #12.

- один компактный sorting control;
- `Актуальнее` — default;
- `Ближе` — выбор этого режима сам является explicit action для browser geolocation request;
- отдельного standalone geo pin/toggle нет;
- после успешной геолокации показывается понятное расстояние;
- denied/unavailable geo не ломает обычный Search;
- S9 Haversine/privacy/deterministic semantics сохраняются;
- Freshness Policy #31 остаётся верхним eligibility/tier rule.

## 8. Search Sorting B — price

Issue #12.

- `Дешевле`;
- `Дороже` только если Slice Contract подтверждает полезность;
- mandatory price уже закрыт checkpoint `v0.0.23-mandatory-price`;
- перед реализацией нужно отдельно определить коммерческую comparability единиц: `unit = null` и разные units нельзя автоматически считать сопоставимыми;
- price sort не обходит freshness eligibility/tier.

## 9. M1 — real Offer media

M1 вводит настоящие seller-provided Offer photos end-to-end: data model, upload/storage/lifecycle, multiple photos, primary/cover semantics и buyer/seller presentation.

Временные pre-MVP demo/placeholder visuals из Design System не являются заменой M1.

## 10. S14 — Discovery / `Для вас`

Начинать только после закрытия предыдущего core seller/search/media contour либо отдельного Product Owner reprioritization.

## 11. S15 — Search learning

Query Log -> matched / unmatched / zero-result analysis -> controlled Product/alias/Category evolution. Search queries не создают Product автоматически.

## 12. S16 — Operations / MVP boundary review

После S16 провести отдельную проверку готовности MVP/public beta и решить, какие INSERTION CANDIDATES должны быть подняты до запуска.

---

# INSERTION CANDIDATES

## Market internal navigation — Issue #10

- earliest dependency: stable Seller/Location/Search foundation уже существует; practical implementation лучше рассматривать после ближайшего seller workspace/freshness contour;
- trigger: пилот на крупных рынках показывает, что route только до Location/рынка недостаточен и buyer должен находить конкретный ряд/павильон/место;
- direction: Market directory -> scheme/MarketPlaces -> Location binding -> buyer internal navigation;
- не добавлять `market_id/row/stall/x/y` как набор nullable полей в generic Location.

## Additional Search filters

- earliest: после Sorting A/B и достаточной плотности выдачи;
- trigger: реальные result sets показывают, что sorting недостаточно для сужения выбора;
- possible filters только при наличии данных: radius, price range, rating после Reviews/Rating, media после M1, location type/Market when justified;
- не создавать giant filter drawer заранее.

## M2 — Offer video

- earliest: после M1;
- trigger: фото объективно недостаточно для подтверждённого seller/buyer use case;
- если signal отсутствует, M2 остаётся deferred.

---

# LATER / dependency-gated

AI input/processing S17+ не начинается автоматически только из-за номера в Feature Map. AI остаётся способом сформировать SellerChangeSet, а не прямым writer в Offer.

Reviews/Rating, Moderation expansion, monetization, advanced analytics и другие capabilities получают отдельное место только после явного product decision и достаточных prerequisites. Не создавать UI/data на будущее.

---

# Anti-drift rule for all agents

Перед подготовкой каждого следующего Slice Contract:

1. проверить текущий `main`, latest annotated checkpoint/tag и CI;
2. прочитать `docs/PROJECT_RULES.md`;
3. прочитать этот `EXECUTION_PLAN.md` и взять **первый незакрытый COMMITTED stage**;
4. прочитать релевантные Feature Map / closed contracts / Issues;
5. для UI/UX работы прочитать `docs/DESIGN_SYSTEM.md` и релевантные entries `docs/product/UX_REFERENCE_INDEX.md`;
6. не заменять очередь идеей из чата/backlog без Product Owner decision;
7. если внешний UX-reference предлагает contract-changing решение — `GAP/STOP`, а не silent adoption;
8. новый product idea проходит путь:

`observation -> Issue / UX Backlog -> Product Owner decision -> EXECUTION_PLAN insertion if needed -> Slice Contract -> Implementation`.

После закрытия каждого stage обновлять этот документ только если verified state или порядок действительно изменились. Не вести параллельный competing roadmap.
