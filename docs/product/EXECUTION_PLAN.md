# KAIDA.KZ 2.0 — Current Execution Plan

## Назначение

Этот документ является **каноническим источником текущей очередности работ**.

Он отвечает на вопросы:

- какой verified product checkpoint сейчас последний;
- какой executable slice идёт следующим;
- какие этапы уже твёрдо включены в ближайшую очередь;
- какие future capabilities могут быть вставлены раньше при наступлении понятного trigger;
- какие вещи сознательно оставлены на более поздний этап.

Он **не заменяет**:

- `docs/PROJECT_RULES.md` — правила разработки и verification;
- `docs/product/FEATURE_MAP.md` — долгосрочную карту capabilities и зависимостей;
- Slice Contracts — точное поведение конкретного slice;
- `docs/UX_BACKLOG.md` и GitHub Issues — наблюдения, product gaps и будущие идеи.

Новая идея сначала попадает в backlog / issue. Она не меняет уже открытый executable slice. Положение в очереди меняется только отдельным product decision и обновлением этого файла на checkpoint boundary.

## Приоритет источников для планирования

1. фактический repository state / verified checkpoint;
2. `docs/PROJECT_RULES.md`;
3. **этот `EXECUTION_PLAN.md` — для текущей очередности и insertion decisions**;
4. `docs/product/FEATURE_MAP.md` — для общей карты и зависимостей;
5. `docs/UX_BACKLOG.md` и Issues — для ещё не включённых наблюдений и требований.

Если Feature Map или UX Backlog содержат устаревший статус, это не должно автоматически менять очередь. Сначала синхронизируется документация.

## Текущее состояние

Последний ранее зафиксированный product checkpoint:

- tag: `v0.0.21-ux2`;
- commit: `819063ba005b6c51e3ff42129e79530ab2dc31cc`;
- UX2 — Seller onboarding — CLOSED.

UX2A — post-UX2 Search / App Shell responsive correction — уже merged в `main`:

- merge commit: `66fb1def48b59f9321b2c3eb21cb0320ac3071ce`;
- branch CI и manual acceptance были PASS до merge.

Перед началом следующего executable slice исполнитель обязан заново проверить фактический `main`, latest verified checkpoint/tag и CI evidence. Не доверять SHA из этого документа, если repository state уже изменился.

Закрытые product / UX capabilities до UX2:

`S0–S13 → UX1A → UX1A.1 → UX1A.2 → UX1B → UX1C → UX1D → UX2`

UX2A product behavior считается реализованным в `main`; его окончательный checkpoint evidence проверяется по repository state перед следующим slice.

## Три класса будущей работы

### A. COMMITTED

Твёрдая ближайшая очередь. Следующий executable slice выбирается сверху вниз.

Перескочить через пункт можно только после отдельного решения Product Owner и изменения этого документа.

### B. INSERTION CANDIDATE

Зафиксированная capability, которая **не означает «после всего»**.

Для неё должны быть понятны:

- `earliest insertion point` — раньше какого состояния её нельзя разумно начинать;
- `trigger` — какое наблюдение или условие делает её актуальной сейчас;
- `latest useful point` — до какого рубежа желательно принять решение, если capability нужна конкретному пилоту / запуску.

Insertion candidate не вклинивается внутрь уже открытого executable slice. Он рассматривается только на checkpoint boundary.

### C. LATER

Capability сознательно не нужна текущему MVP-контуру или ещё не имеет достаточных данных / product signal.

Она остаётся в Feature Map / issue, но не участвует в выборе следующего slice до отдельного product decision.

## Gate R1 decision — CLOSED

После UX2A ручная product walkthrough выявила критичный seller-loop UX gap: обычное добавление и редактирование товара требуют лишних переходов и выставляют внутреннюю механику SellerChangeSet наружу.

Product Owner решил не оставлять этот gap до конца roadmap.

Первое R1 decision:

1. сначала закрыть **Mandatory Offer Price** как бизнес-инвариант;
2. затем выполнить отдельный **Seller Offer Workspace** slice по Issue #27;
3. только после этого продолжить Search Sorting.

После дополнительного walkthrough seller loop обнаружен ещё один core product gap: KAIDA.KZ должен не только хранить freshness, но и регулярно заставлять продавца подтверждать, что Offer всё ещё актуален. Product Owner утвердил отдельный **Seller Freshness Loop** до Search Sorting.

Итоговый R1 / post-R1 committed order зафиксирован ниже.

## Core product rule — Seller Freshness Loop

Freshness Offer определяется от `last_confirmed_at`. Утверждена начальная policy `2 / 7 / 14` суток; thresholds должны задаваться policy/configuration, а не размазываться hard-coded constants по коду.

### Buyer semantics

- `< 2 days` — Offer fresh, обычная buyer-facing выдача;
- `>= 2 days and < 7 days` — Offer ageing, остаётся buyer-visible, но попадает в более низкий deterministic freshness tier; buyer видит понятный возраст вроде `Обновлено 3 дня назад`;
- `>= 7 days` — Offer исключён из всех buyer-facing выдач: Search, Nearby, Discovery;
- buyer-facing Offer с возрастом актуальности `>= 7 days` существовать не должен.

Freshness tier сильнее обычной сортировки: fresh eligible Offers идут выше ageing eligible Offers. Внутри одного tier применяются актуальные правила Search sorting / ranking и deterministic tie-breakers.

### Seller semantics

- успешное `Всё без изменений` обновляет freshness до времени confirmation;
- успешное изменение Offer также обновляет freshness до времени confirmation;
- `>= 14 days` без актуализации — Offer исчезает из обычного рабочего списка Seller через archive/hidden lifecycle;
- это **не hard delete**: Offer, ChangeSets и история остаются сохранены; physical deletion не является частью этой policy.

### Reminder semantics

Продавец должен регулярно получать prompt на reconfirmation активных Offers. Целевое направление — примерно ежедневный cadence, но reminder cadence является отдельной policy/configuration и не совпадает автоматически с 2/7/14 thresholds.

Notification transport не фиксируется заранее как SMS / Telegram / Web Push. Отдельный reminder slice обязан выбрать минимальный реальный канал для текущей стадии и явно доказать scheduler/external-service/privacy/idempotency risks, если они действительно возникают.

SellerChangeSet остаётся обязательной архитектурной границей. Ни reconfirmation, ни reminder не дают прямой write в Offer.

## COMMITTED — текущая твёрдая очередь

### 1. NEXT — Mandatory Offer Price

Связано с Issue #13.

Product decision:

- Seller не может создать/подтвердить publishable Offer без цены;
- Seller не может удалить цену и оставить Offer publishable;
- buyer-facing Offer всегда имеет цену.

Это не UI-fix. Изменение конфликтует с закрытыми S4/S5 contracts и требует отдельного STOP/review и Slice Contract.

До реализации определить semantics `unit` и безопасную forward migration. Исторические migrations не переписывать.

### 2. Seller Offer Workspace — simplified manual seller loop

Связано с Issue #27.

User task: P2 может добавить, изменить, выключить или подтвердить актуальность товара без технического путешествия по SellerChangeSet screens.

Утверждённое UX-направление:

- использовать Bolt seller flow как **UX/composition reference**, но не как архитектурную базу;
- обычная работа происходит на одной seller workspace surface;
- `Мои товары` видны в одном месте;
- `+ Добавить товар` открывает короткую inline/local форму;
- один понятный primary action завершает точное ручное действие;
- после успеха Seller остаётся на seller workspace и сразу видит актуальный Offer;
- edit выполняется in-place / inline без обязательного перехода на техническую review page;
- freshness interaction должен поддерживать понятные seller actions вроде `Всё без изменений` и `Что-то изменилось`;
- deactivate/reactivate/refresh не должны заставлять пользователя думать терминами ChangeSet, если отдельный safety confirmation не нужен по реальному риску;
- ordinary seller UI не показывает `SellerChangeSet`, `ChangeItem`, `proposed`, `confirmed` или технические Offer IDs как пользовательские понятия.

Архитектурные invariants сохраняются:

`Seller Input -> SellerChangeSet -> SellerChangeItem -> confirmation/apply -> Offer`

Нельзя обходить SellerChangeSet или давать Seller Input прямой write в Offer.

Сохраняются ownership, persisted server state, atomicity, idempotency/concurrency guarantees и S12 aggregate semantics.

Slice Contract обязан явно пересмотреть закрытые S4/S5 presentation/confirmation semantics: текущий contract требует отдельной addressable review surface и отдельного confirm action. Для точного manual input допускается сделать финальный submit формы тем самым explicit confirmation/apply action, если архитектурная граница ChangeSet остаётся доказанной.

Batch S12 не редизайнить автоматически; только проверить, не нарушает ли новый single-item UX общий закрытый contract.

### 3. Seller Freshness Policy — lifecycle degradation 2 / 7 / 14

Связано с Issue #31.

User task: Buyer понимает степень свежести предложения и никогда не видит Offer старше 7 суток; Seller не держит бесконечно заброшенные Offers в рабочем кабинете.

Минимальное направление:

- `< 2d` — fresh;
- `2d <= age < 7d` — ageing, buyer-visible, ниже fresh tier, с понятной age label;
- `age >= 7d` — исключение из Search / Nearby / Discovery;
- `age >= 14d` — скрытие/архив из обычного Seller workspace без hard delete;
- любое successful reconfirm/update сбрасывает freshness clock;
- policy thresholds configurable;
- deterministic boundary tests на ровно `2d`, `7d`, `14d`, без sleep.

Closed-contract revision затрагивает S1/S5/S9. Перед реализацией нужен отдельный STOP/review и Slice Contract; не переписывать исторические migrations.

### 4. Seller Freshness Reminder — proactive reconfirmation loop

Связано с Issue #32.

User task: Seller не обязан сам помнить, когда нужно освежить Offers; KAIDA.KZ регулярно инициирует reconfirmation.

Target flow:

`Offer due -> reminder -> Seller Offer Workspace -> Всё без изменений / Что-то изменилось -> confirmation/apply -> freshness reset`

Направление:

- target cadence примерно daily, но cadence задаётся policy/configuration;
- reminder ведёт на обычный Seller Workspace, не на техническую ChangeSet page;
- transport/channel выбирается только в Slice Contract;
- in-app due-state нельзя выдавать за external push, если внешнего уведомления фактически нет;
- scheduler/background job, external service, privacy и duplicate-delivery/idempotency проверяются только если реально присутствуют в выбранной реализации.

Issue #31 владеет thresholds/ranking/archive semantics; #32 их не переопределяет.

### 5. Search Sorting A — explicit freshness / proximity + visible distance

Связано с Issue #12 и UX-011.

User task: Buyer явно понимает, как отсортирован Search, и может выбрать proximity ordering.

Минимальное направление:

- `Актуальнее` — явный default;
- `Ближе` — после explicit buyer geolocation;
- расстояние показывается пользователю;
- сохраняются S9 Haversine / deterministic tie-breaker / privacy semantics;
- новые explicit sort modes не могут нарушить закрытую к этому моменту Freshness Policy #31: fresh tier остаётся выше ageing tier, а `>= 7d` Offer не участвует в выдаче вообще.

### 6. Search Sorting B — price ordering

Зависит от Mandatory Offer Price и Freshness Policy.

Направление:

- `Дешевле`;
- при необходимости `Дороже`;
- нельзя напрямую сравнивать несовместимые currency/unit semantics;
- price sort работает только среди buyer-eligible Offers и не возвращает ageing tier выше fresh tier.

До Slice Contract должна быть определена коммерческая сопоставимость цены/единицы.

### 7. M1 — Offer media

Направление:

- seller-provided media принадлежит Offer;
- несколько фото;
- primary/cover asset;
- buyer card получает реальное media presentation;
- Product canonical image/icon остаётся отдельной задачей.

Не смешивать с AI `photo -> Change Set`.

### 8. S14 — Discovery / «Для вас» v0

Buyer видит Offers по явно указанным interests без ML.

S13 уже закрыт и является зависимостью S14.

Discovery обязан использовать закрытую Freshness Policy: Offer `>= 7d` buyer не видит.

### 9. S15 — Search learning

Оператор видит реальные search queries, zero-result и unmatched queries и использует их для ручного улучшения Product / aliases / Category.

### 10. S16 — Operations

Оператор может отключить ошибочный Offer или Seller.

После S16 выполняется отдельная оценка фактической границы MVP / public beta и обязательных pre-launch gaps.

## INSERTION CANDIDATES

Эти capabilities **не стоят автоматически после S16**. Они могут быть подняты в COMMITTED на ближайшем checkpoint boundary, если сработал trigger.

### Market internal navigation — Issue #10

**Earliest insertion point:** технические базовые зависимости Location/Search уже существуют; начинать можно только отдельными vertical slices после явного решения Product Owner.

**Trigger:** пилот / seller acquisition реально опирается на крупные рынки, где обычного маршрута до внешней Location недостаточно и Buyer должен понимать конкретный ряд / павильон / место.

**Latest useful point:** до запуска пилота, для которого внутренняя навигация по рынку является существенной частью buyer task.

Если trigger не наступил, capability остаётся future и не задерживает общий MVP.

Разбивать минимум на:

- Market directory;
- Market scheme / MarketPlaces;
- Seller Location -> MarketPlace binding;
- Buyer navigation/search inside Market.

Market не становится архитектурным центром; Offer остаётся центральной сущностью.

### Additional Search filters

**Earliest insertion point:** после Search Sorting A. Отдельные фильтры имеют дополнительные зависимости.

**Trigger:** реальная выдача становится достаточно большой, чтобы сортировки `Актуальнее / Ближе / Дешевле` не помогали Buyer быстро сузить выбор.

Кандидаты:

- radius — после proximity semantics;
- price range — после mandatory price и решения unit/comparability;
- media/photo — после M1;
- rating — только после появления Reviews/Rating data;
- location type / Market — если использование этого реально оправдывает.

Не добавлять `Только с ценой`: цена должна стать publishability invariant.

### M2 — Offer video extension

**Earliest insertion point:** после M1.

**Trigger:** реальные seller/buyer сценарии показывают, что фото недостаточно и video как media Offer даёт отдельную пользовательскую ценность.

**Latest useful point:** нет обязательного MVP deadline. Если trigger не доказан, M2 остаётся отложенным.

### Real SMS provider — S22

**Earliest insertion point:** Identity contract уже позволяет замену test OTP provider отдельным slice.

**Trigger:** переход от закрытого теста к реальным внешним пользователям, которым нельзя выдавать test OTP.

**Latest useful point:** до соответствующего публичного запуска.

Не начинать только потому, что S22 есть в Feature Map: до trigger тестовый OTP остаётся допустимым.

## RE-EVALUATION GATES

Чтобы не пересобирать roadmap после каждой идеи, insertion candidates проверяются в фиксированных точках.

### Gate R1 — CLOSED after UX2A

Результат зафиксирован выше: Seller Offer Workspace и Seller Freshness Loop подняты в COMMITTED до Search Sorting.

### Gate R2 — после Search Sorting B

Проверить:

- нужна ли Market Navigation конкретному ближайшему пилоту;
- появились ли основания для Search filters;
- нет ли нового критичного Buyer/Search gap, который делает M1 преждевременным.

Если triggers не доказаны — продолжать в M1.

### Gate R3 — после M1

Проверить:

- нужен ли M2 video;
- нужен ли media-based Search filter;
- появились ли другие media/product gaps, без которых S14 теряет смысл.

Если triggers не доказаны — идти в S14.

### Gate R4 — после S16 / перед public-beta decision

Проверить весь список launch-critical gaps, включая:

- существует ли реально работающий proactive Seller reminder channel, а не только in-app due-state;
- необходимость real SMS provider S22;
- moderation / operations adequacy;
- unresolved product requirements, которые нужны именно выбранному формату пилота / public beta.

Только после этого фиксируется следующая post-MVP / public-launch очередь.

## LATER

### AI Input S17+

Не начинать без отдельного product decision и до устойчивого ручного seller loop.

AI остаётся способом сформировать Seller Change Set, а не способом напрямую изменить Offer.

### Recommendations / behavioral ranking / promotion / monetization

Следовать зависимостям Feature Map и не поднимать их в текущую очередь без product signal и достаточных данных.

## Unplaced requirement rule

Если в UX Backlog, Issue или утверждённых product requirements обнаружено важное требование, но для него нет строки в Feature Map / COMMITTED / INSERTION CANDIDATES, оно не считается автоматически `LATER`.

Оно помечается как **UNPLACED GAP** и выносится Product Owner на ближайший re-evaluation gate для решения:

- включить в COMMITTED;
- оформить как INSERTION CANDIDATE с trigger;
- сознательно отнести в LATER;
- отклонить.

Так отсутствие номера slice не превращает важное требование в «когда-нибудь после всего».

## Anti-drift rule

Перед подготовкой **каждого следующего Slice Contract** исполнитель обязан:

1. проверить текущий `main` и последний verified checkpoint;
2. прочитать этот `EXECUTION_PLAN.md`;
3. определить, находится ли проект на обычном checkpoint boundary или на одном из `R1–R4`;
4. если re-evaluation gate не наступил — выбрать первый незакрытый пункт COMMITTED;
5. если gate наступил — проверить triggers INSERTION CANDIDATES и получить явное решение Product Owner;
6. проверить связанные Feature Map / UX Backlog / Issues;
7. не подменять очередь новой идеей из чата или backlog без явного решения Product Owner.

Если во время разработки появляется новая важная идея:

`наблюдение -> Issue / UX Backlog -> завершить текущий slice -> checkpoint -> ближайший re-evaluation gate / Product Owner decision -> при необходимости изменить EXECUTION_PLAN -> отдельный Slice Contract`

Нельзя просто вклинить её внутрь текущего executable slice.

После закрытия этапа этот файл обновляется только если изменился verified state, COMMITTED order, insertion status или re-evaluation decision. Не создавать второй параллельный roadmap с тем же назначением.
