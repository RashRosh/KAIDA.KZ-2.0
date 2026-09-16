# KAIDA.KZ 2.0 — Current Execution Plan

## Назначение

Этот документ является **каноническим источником текущей очередности работ**.

Он отвечает только на вопросы:

- какой verified product checkpoint сейчас последний;
- какой slice / maintenance этап идёт следующим;
- какие новые решения были вставлены в очередь после первоначального Feature Map;
- какие capabilities остаются future и не должны начинаться самопроизвольно.

Он **не заменяет**:

- `docs/PROJECT_RULES.md` — правила разработки и verification;
- `docs/product/FEATURE_MAP.md` — долгосрочную карту capabilities и зависимостей;
- Slice Contracts — точное поведение конкретного slice;
- `docs/UX_BACKLOG.md` и GitHub Issues — список наблюдений и будущих идей.

Если появляется новая идея, она сначала попадает в backlog / issue. Она меняет текущую очередь только после явного продуктового решения и обновления этого файла.

## Приоритет источников для планирования

1. фактический repository state / verified checkpoint;
2. `docs/PROJECT_RULES.md`;
3. **этот `EXECUTION_PLAN.md` — для текущей очередности**;
4. `docs/product/FEATURE_MAP.md` — для общей карты и зависимостей;
5. `docs/UX_BACKLOG.md` и Issues — для ещё не включённых наблюдений.

Если Feature Map или UX Backlog содержат устаревший статус, это не должно автоматически менять очередь. Сначала синхронизируется документация.

## Текущее verified состояние

Последний product checkpoint:

- tag: `v0.0.21-ux2`;
- commit: `819063ba005b6c51e3ff42129e79530ab2dc31cc`;
- UX2 — Seller onboarding — CLOSED.

Текущий `main` может содержать последующую docs-only / tooling maintenance, не меняющую product behavior. На момент создания этого плана `main` = `ea846b843d0d44858785ee62a6e516b4e388f4d9` и отличается от UX2 checkpoint только docs-only Controller maintenance.

Закрытые product / UX checkpoints:

`S0–S13 → UX1A → UX1A.1 → UX1A.2 → UX1B → UX1C → UX1D → UX2`

## Текущая очередь

Следующий product/executable этап всегда выбирается сверху вниз. Нельзя перескочить к нижнему пункту без отдельного решения Product Owner и обновления этого файла.

### 1. NEXT — post-UX2 Search / App Shell responsive correction

Связано с Issue #16.

User task: Search в header должен оставаться usable на desktop, tablet/iPad и mobile без конфликтов элементов.

Утверждённое направление:

- текстовая кнопка `Искать` заменяется на одну компактную квадратную кнопку со стрелкой вправо на **всех ширинах**;
- 1024px / iPad layout не допускает наложения Search, account identity и logout/menu;
- Search behavior/API, Auth/session и business contracts не меняются.

Это маленький UI/responsive slice. Рабочее обозначение до утверждения Slice Contract: **UX2A**.

### 2. Mandatory Offer Price — отдельный contract-revision slice

Связано с Issue #13.

Product decision:

- Seller не может создать/подтвердить publishable Offer без цены;
- Seller не может удалить цену и оставить Offer publishable;
- buyer-facing Offer всегда имеет цену.

Это **не UI-fix**. Изменение конфликтует с закрытыми S4/S5 contracts и требует отдельного STOP/review и Slice Contract.

Обязательно до реализации определить semantics `unit` и безопасную forward migration. Исторические migrations не переписывать.

### 3. Search Sorting A — explicit freshness / proximity + visible distance

Связано с Issue #12 и UX-011.

User task: Buyer явно понимает, как отсортирован Search, и может выбрать proximity ordering.

Минимальное направление:

- `Актуальнее` — явный default;
- `Ближе` — после explicit buyer geolocation;
- расстояние показывается пользователю;
- сохраняются S9 Haversine / deterministic tie-breaker / privacy semantics.

Не включать сюда price sorting, если это раздувает slice.

### 4. Search Sorting B — price ordering

Зависит от Mandatory Offer Price.

Направление:

- `Дешевле`;
- при необходимости `Дороже`;
- нельзя напрямую сравнивать несовместимые currency/unit semantics.

До Slice Contract должна быть определена коммерческая сопоставимость цены/единицы.

### 5. M1 — Offer media

Возвращаемся к ранее запланированному Media блоку после обязательной цены и базовой явной сортировки.

Направление:

- seller-provided media принадлежит Offer;
- несколько фото;
- primary/cover asset;
- buyer card получает реальное media presentation;
- Product canonical image/icon остаётся отдельной задачей.

Не смешивать с AI `photo -> Change Set`.

### 6. M2 — Offer video extension, только если подтверждена необходимость

Не является автоматическим обязательным этапом.

Если фото M1 достаточно для MVP, M2 можно отложить отдельным продуктовым решением.

### 7. S14 — Discovery / «Для вас» v0

Buyer видит Offers по явно указанным interests без ML.

S13 уже закрыт и является зависимостью S14.

### 8. S15 — Search learning

Оператор видит реальные search queries, zero-result и unmatched queries и использует их для ручного улучшения Product / aliases / Category.

### 9. S16 — Operations

Оператор может отключить ошибочный Offer или Seller.

После S15–S16 повторно оценивается фактическая граница MVP / public beta.

## Не включено в ближайшую очередь

### Additional Search filters

Не являются автоматическим продолжением Search Sorting.

Кандидаты только после подтверждения реальной пользы и наличия данных:

- radius;
- price range;
- rating после Reviews/Rating;
- media/photo после M1;
- location type / Market, если реальное использование это оправдает.

Не добавлять `Только с ценой`: цена должна стать publishability invariant.

### Market internal navigation — Issue #10

Сохранено как важная future capability, но **не входит в текущую ближайшую очередь**.

Будущее направление разбивается минимум на:

- Market directory;
- Market scheme / MarketPlaces;
- Seller Location -> MarketPlace binding;
- Buyer navigation/search inside Market.

Market не становится архитектурным центром; Offer остаётся центральной сущностью.

### AI Input S17+

Не начинать до закрытия текущего MVP-контура и без отдельного product decision.

AI остаётся способом сформировать Seller Change Set, а не способом напрямую изменить Offer.

## Anti-drift rule

Перед подготовкой **каждого следующего Slice Contract** исполнитель обязан:

1. проверить текущий `main` и последний verified checkpoint;
2. прочитать этот `EXECUTION_PLAN.md`;
3. выбрать первый незакрытый пункт очереди;
4. проверить связанные Feature Map / UX Backlog / Issues;
5. не подменять очередь новой идеей из чата или backlog без явного решения Product Owner.

Если во время разработки появляется новая важная идея:

`наблюдение -> Issue / UX Backlog -> решение Product Owner -> при необходимости изменение очереди здесь -> отдельный Slice Contract`

Нельзя просто «вклинить» её в текущий executable slice.

После закрытия любого этапа этот файл обновляется **только если изменился verified state или дальнейшая очередность**. Не создавать второй параллельный roadmap с тем же назначением.
