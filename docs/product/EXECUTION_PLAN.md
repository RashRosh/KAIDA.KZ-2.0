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

Новая идея сначала попадает в backlog / issue. Она не меняет текущий executable slice. Положение в очереди меняется только отдельным product decision и обновлением этого файла на checkpoint boundary.

## Приоритет источников для планирования

1. фактический repository state / verified checkpoint;
2. `docs/PROJECT_RULES.md`;
3. **этот `EXECUTION_PLAN.md` — для текущей очередности и insertion decisions**;
4. `docs/product/FEATURE_MAP.md` — для общей карты и зависимостей;
5. `docs/UX_BACKLOG.md` и Issues — для ещё не включённых наблюдений и требований.

Если Feature Map или UX Backlog содержат устаревший статус, это не должно автоматически менять очередь. Сначала синхронизируется документация.

## Текущее verified состояние

Последний product checkpoint:

- tag: `v0.0.21-ux2`;
- commit: `819063ba005b6c51e3ff42129e79530ab2dc31cc`;
- UX2 — Seller onboarding — CLOSED.

Текущий `main` после docs-only planning maintenance:

- `2f9475811f240e1d4d2526d213d63a1d72bb7fe7`.

Он не меняет product behavior относительно verified UX2 checkpoint.

Закрытые product / UX checkpoints:

`S0–S13 → UX1A → UX1A.1 → UX1A.2 → UX1B → UX1C → UX1D → UX2`

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

## COMMITTED — текущая твёрдая очередь

### 1. NEXT — post-UX2 Search / App Shell responsive correction

Связано с Issue #16.

User task: Search в header должен оставаться usable на desktop, tablet/iPad и mobile без конфликтов элементов.

Утверждённое направление:

- текстовая кнопка `Искать` заменяется на одну компактную квадратную кнопку со стрелкой вправо на **всех ширинах**;
- 1024px / iPad layout не допускает наложения Search, account identity и logout/menu;
- Search behavior/API, Auth/session и business contracts не меняются.

Рабочее обозначение до утверждения Slice Contract: **UX2A**.

### 2. Mandatory Offer Price — отдельный contract-revision slice

Связано с Issue #13.

Product decision:

- Seller не может создать/подтвердить publishable Offer без цены;
- Seller не может удалить цену и оставить Offer publishable;
- buyer-facing Offer всегда имеет цену.

Это **не UI-fix**. Изменение конфликтует с закрытыми S4/S5 contracts и требует отдельного STOP/review и Slice Contract.

До реализации определить semantics `unit` и безопасную forward migration. Исторические migrations не переписывать.

### 3. Search Sorting A — explicit freshness / proximity + visible distance

Связано с Issue #12 и UX-011.

User task: Buyer явно понимает, как отсортирован Search, и может выбрать proximity ordering.

Минимальное направление:

- `Актуальнее` — явный default;
- `Ближе` — после explicit buyer geolocation;
- расстояние показывается пользователю;
- сохраняются S9 Haversine / deterministic tie-breaker / privacy semantics.

### 4. Search Sorting B — price ordering

Зависит от Mandatory Offer Price.

Направление:

- `Дешевле`;
- при необходимости `Дороже`;
- нельзя напрямую сравнивать несовместимые currency/unit semantics.

До Slice Contract должна быть определена коммерческая сопоставимость цены/единицы.

### 5. M1 — Offer media

Направление:

- seller-provided media принадлежит Offer;
- несколько фото;
- primary/cover asset;
- buyer card получает реальное media presentation;
- Product canonical image/icon остаётся отдельной задачей.

Не смешивать с AI `photo -> Change Set`.

### 6. S14 — Discovery / «Для вас» v0

Buyer видит Offers по явно указанным interests без ML.

S13 уже закрыт и является зависимостью S14.

### 7. S15 — Search learning

Оператор видит реальные search queries, zero-result и unmatched queries и использует их для ручного улучшения Product / aliases / Category.

### 8. S16 — Operations

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

### Gate R1 — после UX2A

Проверить только blockers / критичные gaps, обнаруженные текущей responsive проверкой. Если blockers нет — идти в Mandatory Offer Price.

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
