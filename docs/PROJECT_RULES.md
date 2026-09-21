# KAIDA.KZ 2.0 — Project Rules / Process v2

Этот документ владеет **процессом разработки, verification и устойчивыми product/architecture boundaries**. Он не является roadmap и не определяет текущую очередность — за неё отвечает `docs/product/EXECUTION_PLAN.md`.

## 1. Общий принцип

KAIDA.KZ 2.0 развивается с нуля. Старый KAIDA.KZ не является архитектурной базой и не переносится автоматически.

Разработка идёт маленькими независимыми vertical slices. Каждый product slice решает **одну конкретную пользовательскую задачу полностью**:

```text
UI → API → business logic → DB → tests → manual acceptance
```

Следующий product slice начинается только после закрытия предыдущего checkpoint, если Product Owner явно не согласовал отдельную независимую maintenance-задачу.

Главный критерий прогресса — количество реально работающих и проверенных функций, а не объём кода.

## 2. Источники истины

Роли документов разделены:

- `AGENTS.md` — маршрутизатор: что читать;
- `PROJECT_RULES.md` — процесс и устойчивые boundaries;
- `docs/product/EXECUTION_PLAN.md` — единственный текущий execution order;
- `docs/product/FEATURE_MAP.md` — долгосрочные capabilities и зависимости;
- `docs/DESIGN_SYSTEM.md` — visual/presentation rules;
- GitHub Issues — подробные требования к незакрытой работе;
- `docs/slices/**/SLICE_CONTRACT.md` — точное поведение конкретного slice.

Фактический repository state, tags и CI всегда проверяются напрямую. Исторический статус внутри README, Feature Map, старого issue или чата не заменяет текущий evidence.

## 3. Slice Contract

До реализации каждого product slice подготовить компактный Slice Contract. Он должен содержать:

1. одну user task;
2. scope;
3. explicit out of scope;
4. затрагиваемые закрытые contracts;
5. ожидаемые модули/границы изменения без лишней фиксации внутренних имён файлов и типов;
6. реальные risk flags;
7. 5–12 acceptance criteria;
8. automated verification plan только для нужных уровней;
9. короткий manual acceptance scenario.

Не создавать второй большой Implementation Contract, если Slice Contract уже однозначно определяет поведение.

Slice Contract фиксирует **поведение и архитектурные границы**, а не каждую внутреннюю функцию, имя файла или исторический test helper.

## 4. Закрытые contracts

После verified checkpoint закрытым считается проверенное обещанное поведение, например:

- пользовательский flow;
- public API и его semantics;
- business/data invariant;
- ownership/privacy boundary;
- migration guarantee;
- lifecycle/ranking rule;
- межмодульная архитектурная граница.

Закрытым contract не является каждый старый test file, helper, internal type или implementation detail.

Если новый slice действительно требует изменить закрытый contract, **STOP до реализации** и объяснить:

- какой contract мешает;
- почему без изменения нельзя;
- какое изменение предлагается;
- последствия;
- какие slices/modules будут затронуты.

Старый тест можно менять, если его assumption устарел из-за легитимного развития системы и реальное закрытое поведение сохраняется.

## 5. Risk flags

Для каждого slice явно проверить наличие следующих рисков:

- DB migration;
- public API;
- auth/security/privacy;
- concurrency/atomicity;
- data loss;
- external service.

Дополнительные проверки добавлять только для реально присутствующих рисков.

Не требовать migration proof, concurrency stress или external-service verification просто потому, что такие проверки существуют в проекте.

## 6. Реализация

После утверждения Slice Contract:

1. сделать минимальный необходимый diff;
2. не рефакторить соседние области без необходимости;
3. выполнить targeted verification для изменённого поведения и рисков;
4. получить один актуальный full regression proof на финальном executable head;
5. выполнить branch CI;
6. выполнить manual acceptance пользовательского сценария;
7. проверить diff на scope creep и closed-contract changes;
8. merge в `main`;
9. дождаться merged-main CI;
10. создать annotated checkpoint tag;
11. только после этого начинать следующий product slice.

## 7. Verification

Verification выбирается по риску, а не по максимальному количеству прогонов.

Обычные уровни:

- unit — чистая бизнес-логика/validation;
- integration — API, repository, DB constraints, transactions;
- migration upgrade proof — если реально меняется schema/migration;
- E2E — пользовательский flow и UI/API wiring;
- lint/typecheck/build — compilation/runtime boundary.

Один green full branch CI на финальном executable head может одновременно быть full regression proof.

Повторные exact-SHA runs нужны только при реальной причине:

- flaky/nondeterministic failure;
- concurrency/race;
- teardown instability;
- environment-specific failure;
- повторяемость является частью доказываемого contract.

Manual acceptance проверяет продукт глазами пользователя и не должен дублировать SQL/API/CI проверки.

Для docs-only/test-infrastructure/tooling maintenance manual UI acceptance не требуется, если production behavior не менялся.

## 8. Failure classification

Новый failure сначала классифицируется как:

1. `PRODUCT DEFECT`;
2. `STALE REGRESSION ASSUMPTION`;
3. `TEST IMPLEMENTATION / TEST HARNESS DEFECT`;
4. `ENVIRONMENT / PROCEDURE / TOOLING`.

Production нельзя менять только ради stale assertion. Тест нельзя ослаблять только ради зелёного CI.

Общую повторяющуюся test-DB/pool teardown/`pg_stat_activity`/cleanup/drop-database логику выносить в deterministic harness, если это уменьшает race и дублирование.

## 9. Роль KAIDA Controller

Controller не проектирует slice заново и не пишет product code.

Он отвечает только на четыре вопроса:

1. соответствует ли diff утверждённому Slice Contract;
2. не нарушены ли closed contracts;
3. покрыты ли реальные risk flags достаточным evidence;
4. можно ли конкретный SHA пропустить через текущий gate / считать checkpoint.

Подробная процедура: `docs/agents/KAIDA_CONTROLLER.md`.

## 10. Архитектура MVP

Базовая архитектура — **modular monolith**.

Не использовать микросервисы, Kafka, отдельный search cluster, vector DB, event bus или Kubernetes без измеримой необходимости.

Функциональные области появляются по мере реальных требований: Identity, Sellers, Locations, Catalog, Offers, Search, Discovery, Seller Input, AI Processing, Media, Reviews, Moderation, Notifications, Monetization, Analytics.

Не создавать пустые модули «на будущее».

## 11. Суть продукта

KAIDA.KZ не является интернет-магазином и не является путеводителем по рынкам.

Главная задача: помочь покупателю понять, **где сейчас купить нужный товар**, а также показать товары, которые могут его заинтересовать.

Центральная сущность — **Offer**, актуальное предложение продавца.

`Location` описывает конкретную физическую точку продажи. Магазин, павильон, киоск, домашняя точка, место на рынке и другие варианты — формы Location или будущих специализированных spatial relations. Рынок не становится архитектурным центром.

Базовая цепочка:

```text
Seller Input
→ Normalization / Processing
→ Offer
→ Search / Matching / Discovery
→ Buyer Action
```

П1 = покупатель.
П2 = продавец.

## 12. Seller Input и ChangeSet

Все seller-input каналы в перспективе используют одну бизнес-логику: web, text, voice, photo, video, Telegram и т. п.

AI никогда не изменяет Offer напрямую.

Обязательная архитектурная граница:

```text
Seller Input
→ SellerChangeSet
→ SellerChangeItem(s)
→ confirmation / apply
→ Offer
```

Один SellerChangeSet может содержать несколько SellerChangeItems.

UI может скрывать техническую сущность ChangeSet от продавца, но не обходить её business guarantees без отдельного contract revision.

## 13. Offer freshness

Свежесть — часть core product value. Seller должен иметь возможность регулярно подтверждать, что Offer всё ещё актуален, или обновлять его.

Точные thresholds, ranking degradation, buyer visibility и reminder cadence принадлежат отдельным Slice Contracts / current Issues и не дублируются здесь. `EXECUTION_PLAN.md` определяет, когда эти revisions выполняются.

## 14. Каталог и Search learning

`Product` и пользовательский поисковый термин — не одно и то же.

Пользовательский запрос не создаёт Product автоматически.

Правильный цикл:

```text
Search Query Log
→ matched / unmatched / zero-result analysis
→ controlled Product / alias / Category changes
```

## 15. Контакты продавца

Не хранить произвольные внешние URL там, где достаточно структурированного identifier/handle. Для Telegram, Instagram и похожих сервисов предпочтительно хранить username/handle и строить ссылку внутри KAIDA.KZ.

## 16. Авторизация

Для закрытого теста допустим flow `phone → test OTP → session`.

Identity должен позволять заменить test delivery реальным SMS provider без переписывания остальной системы.

Public-launch security requirements определяются отдельными launch-stage contracts; test OTP не является production-ready механизмом.

## 17. Монетизация

Архитектурно учитывать три независимых направления:

- **объём** — лимит активных Offers по policy/tariff;
- **удобство** — более быстрые/массовые способы seller input;
- **охват** — отдельное продвижение Offer.

Не смешивать subscription Seller и promotion Offer. Promotion не должен обходить organic relevance/freshness eligibility.

## 18. UI / UX

Mobile-first, полноценный responsive.

Design System развивается вместе со slices, но не имеет права менять business contract самостоятельно.

Перед UI/UX slice использовать `docs/DESIGN_SYSTEM.md` и релевантные материалы из `docs/product/UX_REFERENCE_INDEX.md`.

Внешние UX references — advisory evidence. Их findings классифицируются `KEEP / ADAPT / REJECT / GAP`.

### 18.1 Bundled wireframe artifact — authoritative UX target (Product Owner decision, 2026-09-22)

Текущий продуктовый UI признан неудовлетворительным. Bundled wireframe artifact (42 экрана, `1a`–`5e`, Tier 0–4, зафиксирован в `docs/product/WIREFRAME_BRIEF.md` и `docs/product/UX_REFERENCE_INDEX.md`, «Follow-up spot-check (2026-09-22)») перестаёт быть advisory evidence уровня внешнего UX reference и становится **authoritative текущей UX-целью** для presentation-слоя продукта:

- уже реализованные экраны, которые он покрывает, приводятся к нему как к целевому UI (визуальная композиция, layout, states) в рамках обычных Slice Contracts соответствующих областей;
- ещё не реализованные экраны проектируются по нему напрямую, без прохождения `KEEP/ADAPT/REJECT/GAP` фильтра как для стороннего материала;
- это revision presentation/UX-приоритета, не business/data contract: auth, ownership, persistence, pricing, ChangeSet-архитектура и другие закрытые business/data contracts (раздел 4 выше) этим решением не пересматриваются и требуют обычной STOP-процедуры, если конкретный экран вайрфрейма явно требует новой бизнес-механики, которой сейчас нет ни в одном closed contract;
- такая новая механика (например: paste-and-parse geo fallback, cross-cutting loading/offline/error states) не реализуется молча «потому что она есть в вайрфрейме» — по ней задаётся explicit вопрос Product Owner, и реализация идёт только после ответа;
- Slice Contract каждой затронутой области отдельно фиксирует, какие экраны вайрфрейма входят в её scope — сам факт существования артефакта не заменяет Slice Contract и не отменяет `PROJECT_RULES.md` §3.

## 19. Git и checkpoints

`main` содержит только проверенное состояние.

Product slice разрабатывается в отдельной ветке. Небольшие осмысленные commits предпочтительнее одного большого.

После завершения product slice:

```text
targeted proof
→ full branch CI
→ manual acceptance
→ diff audit
→ merge main
→ merged-main CI
→ annotated checkpoint tag
```

Всегда должна сохраняться возможность быстро вернуться к последнему verified checkpoint.

## 20. Главный запрет

Не писать весь MVP одним заходом по большому ТЗ.

Большие документы — источник требований, а не прямой prompt для генерации приложения.

Правильная цепочка:

```text
Product vision
→ Feature Map / Execution Plan
→ Slice Contract
→ Acceptance / verification
→ Implementation
→ Checkpoint
```

Если Slice Contract нельзя однозначно проверить человеком за один проход, его нужно разделить.
