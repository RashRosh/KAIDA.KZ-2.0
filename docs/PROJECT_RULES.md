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
- принятые макеты по §18.1 — визуальный стиль и композиция; обязательные UI-правила — §18.4 этого файла;
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

### 10.1 Внешние зависимости — граница (Product Owner decision, 2026-09-23)

Core-сценарии KAIDA обязаны работать при полной недоступности любого внешнего SaaS: картографического API, геокодера, переводчика, AI-сервиса и любого другого платного провайдера.

- новые **обязательные** платные внешние зависимости на текущем этапе не вводятся;
- внешний сервис допустим только как улучшение UX поверх работающего без него пути, а не как условие работоспособности ядра;
- если сценарий нельзя пройти при отключённом внешнем сервисе, это не улучшение, а новая точка отказа — такой вариант требует отдельного Product Owner decision с оценкой стоимости и деградации;
- предпочтительная замена внешнему провайдеру — собственные данные на открытых источниках, размещённые внутри системы.

Это правило действует наравне с §4: попытка сделать внешний сервис обязательным для закрытого сценария — это ревизия закрытого contract со всеми требованиями §4, а не деталь реализации.

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

Модерация, когда она есть, стоит между явным подтверждением продавца и публикацией Offer и не отменяет это
подтверждение. Недоступность модерации (ИИ или человека) не блокирует продавца: по решению Product Owner
(2026-09-25) карточка публикуется сразу после подтверждения, а оператор может снять её по факту. Точная модель —
`FEATURE_MAP.md`, «Seller AI-first model».

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

Целевая модель (Product Owner decision, 2026-09-25): контакты принадлежат торговой точке, а не продавцу; все
необязательны. Переход с текущей seller-level модели — contract revision S10 по §4.

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

Визуальный стиль задают принятые макеты (§18.1) и дизайн-система, на которой они собраны; отдельного документа
дизайн-системы в репозитории нет (удалён решением Product Owner, 2026-09-25). Макет не имеет права менять business
contract самостоятельно. Обязательные UI-правила, которые не зависят от стиля, — §18.4.

Перед UI/UX slice можно использовать релевантные материалы из `docs/product/UX_REFERENCE_INDEX.md`.

Внешние UX references — advisory evidence. Их findings классифицируются `KEEP / ADAPT / REJECT / GAP`.

### 18.1 UX artifacts — authority lifecycle (Product Owner decisions, 2026-09-22–25)

Текущий продуктовый UI признан неудовлетворительным. Ранние наборы вайрфреймов (42 кадра `1a`–`5e`, media pass
поверх Pass 3) — только история в Git, не implementation target.

Текущая рабочая UX-цель — две цепочки.

**Продавец (AI-first, с 2026-09-25):**

1. `docs/product/SELLER_AI_FIRST_DESIGN_BRIEF.md` — ТЗ дизайнеру;
2. `docs/product/SELLER_AI_FIRST_DESIGN_REVISION_1.md` — решения PO и правки поверх первого макета; при расхождении
   с brief побеждает ревизия;
3. макет https://claude.ai/artifact/3z2pznybpsJAJbWGTxgwE4 — только после Product Owner visual acceptance ревизии 1 и
   фиксации его устойчивого locator/copy в репозитории.

Seller-части Pass 3 и `UX_NAVIGATION_STATE_SPEC.md` для продавца заменены этой цепочкой.

**Покупатель (Pass 3, принят 2026-09-23):**

1. `docs/product/UX_NAVIGATION_STATE_SPEC.md` — surfaces, navigation, states, actions и data boundaries;
2. `docs/product/WIREFRAME_TASK_PASS3.md` — ТЗ на прототип;
3. `docs/product/WIREFRAME_PASS3_REVIEW.md` — принятые части и обязательные исправления;
4. прототип https://claude.ai/artifact/B5PDSyednY4pNtmhAtC9tN.

Где целевой макет продавца затрагивает покупателя (карточка в выдаче, детальная карточка, иконки связи), побеждает
seller-цепочка после её visual acceptance.

Каждая цепочка является главным источником истины для пользовательского слоя в части:

- information architecture, маршруты и переходы между экранами;
- визуальная композиция, иерархия, layout и responsive-направление;
- user-facing interaction patterns, состояния и последовательность действий;
- vocabulary и presentation технических сущностей пользователю.

Покрытый UX-reset экран разрешено пересобрать целиком, а не ретрофитить поверх прежней component/page-композиции. Существующий UI не является ограничением для нового presentation layer.

До visual acceptance макета production UI branch по нему не начинается. После acceptance уже реализованные поверхности приводятся к принятому макету через отдельные компактные UI slices. Slice Contract фиксирует конкретные surfaces/states в scope; макет не заменяет контракт и не разрешает один большой diff.

### 18.2 Граница между UX target и product core

Вайрфрейм **не изменяет сам по себе** business/data/security contracts: auth, ownership/privacy, persistence, pricing invariants, Offer lifecycle, `SellerChangeSet → SellerChangeItem → confirmation/apply → Offer`, атомарность и public API semantics.

- Если показанное взаимодействие можно реализовать новой композицией поверх существующего API/core, UI пересобирается без сохранения старой presentation-структуры.
- Если экран требует новых данных, mutation semantics или изменения закрытого business contract, применяется обычный STOP из раздела 4 и готовится явная contract revision до production-кода.
- Нельзя выдумывать отсутствующие данные или различия состояний только ради буквального визуального совпадения. Такой разрыв фиксируется как data/contract gap.
- При неоднозначности экран сначала переводится в route/state/action/data specification. Трактовка должна сохранять видимый пользовательский замысел вайрфрейма и проверенные гарантии core.
- Внешние UX references остаются advisory. Особый authoritative-статус относится только к актуальной принятой цепочке внутренних UX-reset artifacts из §18.1, а не к любому старому экспорту вайрфреймов.

### 18.3 UX acceptance до production wiring

Для существенной пересборки UI сначала подготавливаются navigation/state specification и статический либо fixture-driven prototype ключевого user flow. Product Owner принимает композицию, переходы и основные состояния до подключения production mutations.

После визуальной приёмки реализация подключает существующие API/core небольшими vertical slices. Каждый slice отдельно проходит automated proof и manual acceptance. Зелёные тесты без UX acceptance не делают интерфейс готовым к merge; визуальное сходство без проверки business guarantees также недостаточно.

Русский и казахский — обязательные поддерживаемые языки продукта. Каждый новый или переработанный user-facing flow принимается в обеих локалях; односторонний перевод не считается завершённым slice. Полный localization boundary определён `FEATURE_MAP.md`, правила переключателя языка — §18.4, текущий gate — `EXECUTION_PLAN.md`. Исключение только для концепт-дизайна: макеты могут временно рисоваться на одном русском языке; production slice всё равно принимается в обеих локалях.

### 18.4 Обязательные UI-правила

Правила ниже не зависят от визуального стиля и действуют для каждого UI slice. Перенесены из удалённого
`DESIGN_SYSTEM.md` (2026-09-25); ссылки на его разделы в коде и закрытых контрактах читать как ссылки сюда.

**Доступность** (WCAG 2.1 AA):

- видимый `:focus-visible`; порядок клавиатуры совпадает с порядком задачи;
- видимые подписи у полей формы; ошибка поля привязана к нему (`aria-invalid`, `aria-describedby`), наверху формы —
  сводка для экранного диктора;
- зона нажатия любого действия — не меньше `44×44 px`; icon-only действие имеет `aria-label`;
- состояние не передаётся только цветом;
- `<html lang>` соответствует активному `ru` / `kk`; уважается `prefers-reduced-motion`;
- существующие `role=status`, `role=alert`, `aria-live` не ослабляются.

**Overlay (модалка, bottom sheet, меню):** фокус переводится внутрь **один раз** при открытии и возвращается на
открывший элемент при закрытии; пока overlay открыт, фокус не перезахватывается при изменениях состояния; обработчик
клавиатуры и ловушка фокуса живут всю открытую сессию, а не пересоздаются на каждый рендер (колбэк закрытия держать в
ref). Причина: в отклонённой ветке #27 ввод в поле внутри sheet каждый раз возвращал фокус на первый элемент.

**Системные состояния:**

- loading — skeleton той же формы, что и контент; голый spinner только там, где формы ещё нет;
- offline / устаревшие данные — показать сохранённое с пометкой и действием `Обновить`, а не пустой экран;
- ошибка сервера — на весь экран, только если без данных экран бесполезен; иначе локальный блок с повтором или toast
  для фонового действия;
- текст ошибки содержит ровно две вещи: что не получилось и что можно сделать; без технических кодов;
- ввод продавца не теряется при ошибке сети или отправки, пока продавец сам не покинул сценарий.

**Язык:** переключатель `РУ / ҚАЗ` (на desktop — `Русский / Қазақша`) доступен на всех buyer и seller маршрутах, в том
числе без входа; меняет язык одним нажатием, без меню; без флагов; полные названия в `aria-label`; смена языка не
сбрасывает маршрут и введённые данные; текст на обоих языках помещается без обрезки и горизонтальной прокрутки от
320 px.

**Честность:** не показывать корзину, заказ, оплату, доставку, внутренний чат, выдуманные рейтинги и отзывы,
выдуманную срочность или остатки; не публиковать сырые координаты; не запрашивать геолокацию без явного действия
пользователя; demo-фото не выдавать за фото продавца. Цена показывается как `4 200 ₸ / кг`; вместо отсутствующей цены
не подставлять `0`, прочерк или «по запросу».

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
