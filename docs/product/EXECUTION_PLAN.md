# KAIDA.KZ 2.0 — Current Execution Plan

Этот документ является **единственным каноническим источником текущей очередности работ**.

## Ближайшая последовательность

Факты о checkpoint (tag, SHA, CI) здесь не дублируются — их ведёт `docs/agents/CURRENT_STATE.md`; исполнитель всё равно проверяет `main`, tags и CI напрямую. Закрытые пункты и их решения — в `docs/product/EXECUTION_HISTORY.md` и в Slice Contracts.

Порядок утверждён PO и **не изменён** этой редакцией:

1. Закрытая работа и её checkpoints — `docs/product/EXECUTION_HISTORY.md` и теги (`docs/agents/CURRENT_STATE.md`); здесь статусы не ведутся.
2. **R3 — Воспроизводимая подготовка развёртывания** без покупки и создания хостинга — **следующий пункт, но ON HOLD** по решению PO: не начинать без прямой команды PO. Контракта нет; не начат. Исходная формулировка и граница local readiness track сохранены в `EXECUTION_HISTORY.md` (пункт 5, «Local readiness track»).
3. После R3 — следующий кандидат предлагается агентом отдельно; D1 / readiness и canonical Product чипы при появлении данных.
4. Отложено, data-gated и не запланированное — ниже, без изменений.

Правило gates: **статус в REQUIREMENTS_REGISTER, пункт в этом файле или триггер пересмотра не разрешают реализацию.** Реализацию разрешает только прямая команда PO и утверждённый Slice Contract.

- **Отложено** (решение PO 2026-10-07): AI Input (stage 7), AI-модерация (stage 8), любая платная инфраструктура (хостинг, GPU, SMS-провайдер), **оценка и выбор поискового движка**. **AI-ввод — обязательное предварительное условие публичного запуска** (явное решение PO, заменяет прежнее «не утверждён»); разработка и внутреннее тестирование продолжаются без AI, запуск — нет. **AI-модерация условием запуска не является** и остаётся отложенной; действующие ручные требования модерации сохраняются (публикация после подтверждения продавцом, пост-проверка оператором, информационный текст об ответственности продавца), публикация без модерации не разрешается. Решение — условие запуска, а не разрешение на реализацию AI и не изменение очереди.
- **Data-gated:** production-like накопление demand начнётся только в реальном окружении; запись `organic` остаётся выключенной до настройки и проверки ежедневного `pnpm search-events:purge`; события `dev` / `test` / `synthetic` — не спрос. D1 / internal demand validation и динамические чипы Search Home (readiness-gate, ≤5 canonical Product, curated fallback) ждут данных. Остальной Discovery / Demand / Operations / commercial readiness — по зависимостям.
- **Не запланировано и не добавляется этим решением** (нужны отдельные решения PO до допуска реальных пользователей): настоящая аутентификация / доставка OTP, защита от злоупотреблений, юридические тексты, объём пилота; операторская доставка OTP, allowlist, оповещения о free-title карточках и прочие pilot-функции.

Старая `6F` (отдельная модель «нормализованный сырой запрос + время») **снята до реализации**: её законная цель
переходит в S15C/D0 после S15B, чтобы события фиксировали итоговую canonical / unresolved / zero-result семантику.
Старая `6G` убрана из ближней очереди и переосмыслена (см. таблицу ниже). Числовой порог трафика не вводится.

Документ отвечает только на четыре вопроса:

1. какой verified checkpoint последний (факты ведёт `CURRENT_STATE.md`);
2. что делаем следующим;
3. какие product stages уже committed;
4. какие capabilities могут быть вставлены позже по trigger.

Подробные требования живут в GitHub Issues и Slice Contracts, а не дублируются здесь.

## Source ownership

- process / verification / stable boundaries, включая обязательные UI-правила → `docs/PROJECT_RULES.md`;
- current execution order → этот файл;
- long-range capability/dependency map и продуктовые решения PO → `docs/product/FEATURE_MAP.md`;
- target product sources для будущих contracts → `docs/product/SEARCH_SYSTEM_SPEC_v0.1.md`,
  `docs/product/KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md` и
  `docs/product/KAIDA.KZ_initial_product_catalog_v0.1.xlsx`;
- growth / marketplace-liquidity strategy → `docs/product/GROWTH_STRATEGY.md`: **STRATEGY BACKLOG — NOT IMPLEMENTATION AUTHORIZATION**; не меняет execution order и gates этого файла; Demand workstream (S15C / D0–D5) остаётся owning implementation workstream для G3–G7;
- commercial semantics → `docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`;
- Backoffice planning/decomposition → `docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`;
- целевой UX продавца → `docs/product/SELLER_AI_FIRST_DESIGN_BRIEF.md` + `SELLER_AI_FIRST_DESIGN_REVISION_1.md` + макет
  (`PROJECT_RULES.md` §18.1);
- exact slice behavior → `docs/slices/**/SLICE_CONTRACT.md`;
- unresolved detailed requirements → GitHub Issues;
- индекс требований (вид работы, статус, зависимости, где живёт подробность) → `docs/product/REQUIREMENTS_REGISTER.md`: **индекс, не очередь и не разрешение на реализацию**;
- verified checkpoint, SHA, tag, CI и операционный снимок → `docs/agents/CURRENT_STATE.md`;
- закрытая история плана → `docs/product/EXECUTION_HISTORY.md`.


Перед началом работы исполнитель обязан самостоятельно проверить фактический `main`, tags и CI; SHA и run id в этом файле не ведутся.

---

# COMMITTED STAGE REGISTER — после этапа 1

**Это реестр открытых stages, а не порядок исполнения; закрытые строки перенесены в `EXECUTION_HISTORY.md`, статусы записей ведёт `REQUIREMENTS_REGISTER.md`.** Номера в колонке `#` — исторические идентификаторы, они не
перенумеровываются и не задают очередность. **Фактический ближайший порядок единственный** (решение PO 2026-10-05, см.
«Verified base и ближайшая последовательность»):

Фактический порядок: R3 (ON HOLD по решению PO) → следующий кандидат предлагается агентом отдельно; D1 / readiness и canonical Product чипы — при появлении данных. Отложенное, data-gated и не запланированное — в разделе «Ближайшая последовательность». Stages 7, 8, 9 стоят в таблице по историческим номерам. Перескочить этот порядок можно только после отдельного Product Owner decision и обновления этого файла.

| # | Stage | Owner |
|---|---|---|
| 7 | AI Input — видео / фото / голос → черновики карточек (статус и условие запуска — `REQUIREMENTS_REGISTER.md`, S-AI-INPUT) | `FEATURE_MAP.md` S17–S20 / future Slice Contracts, Issue #75 |
| 8 | AI-модерация (спорное — человеку) (статус — `REQUIREMENTS_REGISTER.md`, S-AI-MOD) | `FEATURE_MAP.md` S32 / future Slice Contract |
| 9 | S14 — Discovery / `Для вас` | Feature Map |
| 10C | S15C — Demand Data Foundation, остаток: D1 и только необходимая база D2 (D0 — в `EXECUTION_HISTORY.md`); internal/privacy-safe, без seller Demand UI | Issue #55 / `KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md` |
| 11 | S16 — Operations (остаток после этапа 1) + MVP boundary review + Demand readiness assessment | Feature Map |
| 11A | Backoffice foundation planning: Requirement Inventory → Operations Map → minimum roles/Permissions → Domain states/invariants; first operational target = Catalog Operations | `KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md` |
| 11B | Commercial & Monetization Readiness: утвердить domain semantics/operations до Backoffice IA/UX, без Billing/Boost implementation | `KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md` |
| 11C | Backoffice planning completion: MVP/Later → IA/UX → capability-gap audit → operational slice decomposition/dependency graph | `KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md` |
| 12 | Readiness-gated commercial и Backoffice portfolio: отдельные slices/chains Pro, Demand, Boost, Business и operational Backoffice; не mega-implementation | `FEATURE_MAP.md` / parent sources / future Slice Contracts |

M1 (фото), первая часть S16 (снятие карточки оператором) и актуальность с напоминаниями (Issues #31, #32) перенесены в этап 1.

**Commercial correction (решение PO, 2026-09-30):** Free сохраняет полноценную ручную правдивую витрину. Старый S25
с hard active-Offer cap помечен `REVIEW REQUIRED` и не готов к implementation; модель «первые N бесплатно, дальше
плати» удалена из текущего monetization direction. Вернуться к ней можно только по pilot evidence и новому явному PO
decision; допустимы technical/anti-abuse/fair-use limits. Целевая упаковка: Pro = `AI + full Demand + Performance`;
Boost = независимая от Pro one-off purchase маркированного дополнительного охвата; Business = organizational scale.
`Editorial Featured` не является `Paid Promotion`.

Stages 11A–11C — planning/readiness, не implementation. Они не разрешают Billing UI, provider, subscriptions, новые
billing tables, Boost, Business или seller-facing paid Demand. Stage 12 не является одним monetization release:
каждый workflow проходит собственные dependencies и обычный vertical-slice loop. Идентификаторы S25–S29 сохраняются
ради истории, но прежняя линейная схема `hard cap → subscription → bulk → promotion` считается stale.

### Ключевые dependencies

- Geo fallback закрыт checkpoint `v0.0.43-seller-location-geo-fallback`.
- Address directory (1a) идёт **после** geo fallback: подсказки адреса — улучшение поверх пути, который обязан
  работать без них (`PROJECT_RULES.md` §10.1). Макет может показывать поиск адреса и ссылку на карту с пометкой future
  data source; UI slice не реализует stages 1/1a молча. Preflight 2026-10-01 подтвердил достаточную основу для
  Almaty pilot: 134,066 OSM objects с `addr:housenumber`, из них 129,026 (96.24%) также имеют `addr:street` внутри
  OSM boundary relation `2465058`; это не гарантия полной адресной базы, поэтому manual flow остаётся first-class.
  Выбран weekly Geofabrik Kazakhstan PBF → isolated PostgreSQL + `pg_trgm`, без Nominatim/PostGIS/внешнего runtime
  geocoder. ODbL attribution/provenance/share-alike и real import cost evidence входят в acceptance утверждённого contract.
- Актуальность входит в этап 1: подтверждение актуальности живёт на «Моей витрине». Напоминания (#32) — в том же пункте.
- Search Sorting выполняется после политики актуальности.
- Contracts stages 5–6 не объявляют существующую Search-модель финальной и не закрепляют смешивание catalog resolve с
  seller-title fallback. Они добавляют сортировки/фильтры совместимо с будущей S15B; сравнение цены разрешено только
  для сопоставимой единицы или подтверждённой нормализованной цены.
- AI Input и AI-модерация по `PROJECT_RULES.md` §10.1 — улучшения поверх ручного пути; ручной путь и публикация без
  предварительной модерации обязаны работать при недоступном ИИ.
- Backoffice IA/UX не начинается до Requirement Inventory, Operations Map, Roles/Permissions, domain
  states/invariants и отдельного Commercial & Monetization Readiness gate. Backoffice не получает собственную
  business logic и после planning раскладывается на operational vertical slices.
- Commercial access рассчитывается server-side через minimum модели
  `CommercialAccount → Plan → Entitlements → Limits → Usage → Overrides → BillingState → Purchases /
  PromotionCampaigns → EffectiveEntitlements`; это conceptual dependency, а не список tables для немедленного создания.
- Pro зависит одновременно от готовых AI, D4 paid-readiness и Performance instrumentation; entitlement не заменяет
  readiness capability. Capabilities могут создаваться/флагироваться отдельно, но sellable Pro не запускается до
  минимально полезной готовности всех трёх.
- Boost развивается отдельной цепочкой и доступен независимо от Pro. Campaign delivery не смешивается с organic
  ranking или Editorial Featured и не обходит actuality/moderation/buyer visibility. V1 ограничен
  product/category relevance, geography и display period на Search/Nearby/relevant Discovery; без auction/CPC/CPM и
  без гарантии продаж.
- Business v1 начинается с employees/roles и multi-location scope одного Seller поверх общих
  Seller/Location/Offer/Change Set domains; bulk/XLS/CSV и cross-location analytics развиваются там же.
  Organization и API/1C/ERP/integrations — отдельные later slices по evidence, а не стартовая foundation.

### Stage 10 — S15 workstream, не срочная вставка в ближнюю очередь

Подготовленные источники фиксируют целевую модель, но не являются Slice Contracts и не разрешают реализацию раньше
stage 10.

#### S15B — Search System revision

Зависит от установленной базы Production KB v1; идёт после Catalog-backed Seller → Buyer runtime loop.

`SEARCH_SYSTEM_SPEC_v0.1.md` перенесён на текущий `main` как target source. Перед implementation нужно сверить его с
текущим кодом и закрытыми S0/S6/S7/S9/S13, учесть историю ветки `docs/search-system-spec-v0.1`, затем выпустить
contract revisions/Slice Contracts.

Целевая модель: canonical `product_id` — основной путь; catalog suggestions помогают выбрать Product; resolved Product
search не смешивается через `OR` с seller-title fallback; known Product + zero offers отличается от unknown query;
canonical и unresolved demand различаются; query не создаёт Product автоматически; fuzzy используется только для
suggestions; каталог развивается контролируемой редактурой.

**Решение PO (2026-09-30):** generic `buyer_interests` и «Сообщить, когда появится» — разные сущности и сигналы.
Demand различает как минимум три уровня силы намерения:

```text
поиск/просмотр → интерес → явное ожидание появления
```

Search и interest нельзя выдавать продавцу за число людей, явно ожидающих товар. Точную модель watch определяет
отдельный contract.

#### S15C — Demand Data Foundation

В stage 10 входят D0 Search Demand Events, D1 Search Learning / Demand Aggregates и только необходимая основа D2
Availability Watches. События создаются только conscious submit; сохраняют canonical/unresolved outcome,
zero/unmet-context, result count и buyer geo только когда покупатель явно его использовал. Нужны privacy-safe session
semantics, исключение test/demo/bot traffic, internal aggregates и linkage unresolved → resolved Product.

`Сообщить, когда появится` — явное действие ожидания и разрешение уведомить П1. Общий `buyer_interests` не доказывает
ожидание и не подменяет watch. Seller API/UI здесь нет. Продавцу никогда не передаются individual events, отдельные
queries, user/session IDs, history конкретного П1 или exact buyer coordinates. Считаются прежде всего уникальные
users/privacy-safe anonymous demand sources, а не сырые повторы. Редкие cohorts подавляются, география укрупняется,
minimum cohort threshold конфигурируем; пока безопасный порог не определён, seller-facing Demand для таких групп не
показывается.

Порядок развития фиксирован:

```text
instrumentation
→ production-like accumulation
→ internal validation
→ free seller signals
→ paid KAIDA Demand
```

#### Demand readiness на stage 11 и после

Stage 11 оценивает Demand readiness рядом с MVP boundary, но не обязан блокировать сам MVP. Проверяются объём и
чистота трафика, canonical resolution, unresolved pipeline, explicit waiting, privacy-usable aggregates, соответствие
supply buyer-visible reality и наличие регулярно actionable gaps.

D3 Seller Free Demand Signals можно вставить только после валидных агрегатов и readiness gate; сначала он бесплатный.
Базовые сигналы, которые помогают закрывать unmet demand, не прячутся за paywall. Для D3 сразу закладываются события,
которые позволяют проверить цепочку `signal → seller reaction → Product added/activated → buyer-visible Offer → unmet
demand received supply`. D4 paid Demand входит в stage 12 только после подтверждения этой цепочки и отдельной проверки
willingness to pay: реакция на бесплатный сигнал сама по себе не доказывает готовность платить. Численные критерии до
реального трафика не придумываются; D5 alerts и D6 Business остаются последующими readiness-gated stages.

### Stages 11A–12 — Commercial / Backoffice future order

Фиксируется порядок planning gates, а не один большой implementation backlog:

```text
11A  Backoffice Requirement Inventory / Operations / Permissions / Domain invariants
→ 11B Commercial & Monetization Readiness
→ 11C MVP/Later + IA/UX + capability gaps + slice dependency graph
→ 12  отдельные approved vertical slices по готовым dependencies
```

В stage 12 действуют независимые chains:

- **Pro:** AI ready + D4 paid-readiness + Performance instrumentation → commercial/effective-access minimum → Pro
  gates → Billing foundation → единый sellable `AI + full Demand + Performance` lifecycle/purchase;
- **Demand:** S15B → S15C → internal validation → D3 actionable Free signals → seller/buyer value proof →
  willingness-to-pay → D4 full Demand in Pro → D6 aggregated/multi-location Demand in Business; отдельной Demand
  subscription нет;
- **Boost:** sponsored-surface policy → PromotionCampaign eligibility → Purchase/payment foundation → marked paid
  Search/Nearby/relevant Discovery delivery → measurement/support; Boost не требует Pro, не использует auction/CPC/CPM
  в v1 и не гарантирует sales;
- **Business:** employees/roles → multi-location → bulk operations + XLS/CSV import → cross-location analytics +
  aggregated Demand → audit/history + higher/custom quotas → later API/1C/ERP/integrations;
- **Backoffice operational slices:** первым идёт Catalog Operations (`find → open → create/edit → Category/Alias →
  deactivate → relations/duplicates → audit`), затем Seller/Location/Offer operations → moderation → reports/support →
  Editorial Featured; commercial visibility/Overrides, Promotion operations и Billing support открываются только
  после соответствующего shared domain foundation. Порядок после Catalog подтверждается dependency audit.

Это future ordering. Ни одна строка не разрешает production implementation без owning Product Spec/Slice Contract и
отдельной команды PO.

---

# Issues → записи реестра

Порядок работ определяют разделы выше; статусы Issues и их условия пересмотра ведёт `REQUIREMENTS_REGISTER.md` (прежняя таблица состояний перенесена в `EXECUTION_HISTORY.md`). Issues владеют подробными требованиями и сюда не копируются.

| Issue | Запись реестра |
|---|---|
| #10 Market navigation | B-MARKET-NAV |
| #54 категории товаров продавца | S-CATEGORIES |
| #55 Demand | M-D1, M-D2, M-D3, M-D4-6, M-PRIVACY |
| #75 AI-правила seller input | S-AI-INPUT |
| #76 distance sensitivity | B-DISTANCE |
| #79 Price Intelligence | B-PRICE-INTEL |
| #83 Security automation | O-SEC-AUTO |
| #116 CI flake | O-CI-FLAKE |
| закрытые Issues (#12, #13, #16, #17, #19, #27, #31, #32, #34, #35, #36, #37, #42, #125, #130) и случайные (#20–#23, #28, #29) | DELIVERED / REJECTED записи (V-*, X-*) |

# INSERTION CANDIDATES

Insertion candidate не имеет жёсткого номера. Он рассматривается **только на checkpoint/re-evaluation boundary** и никогда не вклинивается внутрь уже открытого slice.

## Market internal navigation — Issue #10

- earliest sensible point: после этапа 1;
- trigger: пилот на крупных рынках показывает, что обычного route до Location недостаточно;
- direction: Market directory → scheme/MarketPlaces → Location binding → buyer internal navigation;
- default without trigger: остаётся unscheduled.

## Additional Search filters (отдельно от #12)

Сортировка «Расстояние / Цена / Актуальность» с направлением закрыта Stage 6 Rev 3 (`v0.0.51`). Радиус и цена от–до
в Rev 3 **сняты**; отдельные фильтры (радиус, диапазон цены, тип точки, фото/контакты, rating) не добавляются без нового
решения PO и своей data/usefulness-основы. Trigger: PO подтверждает конкретный filter use case.

## M2 — публичное видео предложения

- earliest: после фото этапа 1;
- целевой макет предусматривает до 5 фото + 1 публичное видео;
- trigger: Product Owner подтверждает, что видео нужно покупателю, а не только как вход для ИИ.

## Отзывы, рейтинг, жалобы на фото

В целевом макете (AI-S20–S22, AI-B03–B06, AI-M03–M05). Отдельный committed slice не определён.

- trigger: Product Owner утверждает trust/review use case, antifraud и moderation semantics;
- до этого нельзя показывать fake rating/reviews;
- решение PO (2026-09-25): жалоба — **на карточку целиком**, не только на фото; причина выбирается после нажатия
  (`FEATURE_MAP.md`, «Seller AI-first model», п. 9). Макет AI-B05 / AI-B06 / AI-M03 и brief §14.3 перерабатываются
  при подготовке этого этапа.

## Архив и удаление карточек

В целевом макете (AI-S15–S17): архив с восстановлением и сроком хранения — раздел архива с датой переноса и остатком срока, «Подтвердить и восстановить», исчезновение через 30 дней после переноса, необратимое «Удалить». Требует server jobs, точной temporal semantics и пересмотра R2 (фото неизменяемы и не удаляются). Поставлено частично: стадия актуальности `archived` (≥ 336 ч без подтверждения) как статус карточки продавца. Не поставлено: всё перечисленное выше. Подробности и открытые решения — `REQUIREMENTS_REGISTER.md`, запись S-ARCHIVE.

## OTP resend + timer

`AuthModal.tsx` не имеет resend-механизма; `S2-auth/FEATURE_SPEC.md` выносит resend/throttling за scope S2.

- earliest: unscheduled — требует product/security решения;
- trigger: Product Owner выбирает naive resend или отдельный slice с throttling ближе к launch.

## Промо-баннер над строкой поиска (решение PO, 2026-09-29)

Место над строкой поиска у покупателя под акции, новинки и другую информирующую / вовлекающую маркетинговую
информацию.

- earliest: после экранов покупателя по макету;
- экраны покупателя не реализуют баннер, но их вёрстка не должна мешать вставить его над строкой поиска;
- перед контрактом: кадр дизайнера, кто и как управляет содержимым (оператор), правила маркировки рекламы и связь с
  монетизацией / продвижением (stage 12, S28–S29).

## Стартовая страница сервиса — First Entry (остаток)

Мобильная часть поставлена (`v0.0.38-first-entry-mobile`, `v0.0.48-first-entry-correction`); исходный текст решений PO 2026-09-29 перенесён в `EXECUTION_HISTORY.md`. Остаток: недавние запросы на повторном визите не спроектированы; финальный слоган; десктоп ≥ 1280 (PO: не берём, в последнюю очередь); промо-баннер над поиском (см. выше); казахские строки — черновик, нужна вычитка.

## Тёмная / светлая тема (пожелание PO, 2026-09-29)

Переключатель темы в «Ещё» (у покупателя и у продавца), рядом с «Язык». Срок не назначен. В макете и токенах только
светлая тема — нужны тёмные токены и кадры дизайнера (`PROJECT_RULES.md` §18.1); палитру агент не придумывает.

## Правки экранов продавца после ручного просмотра PO (остаток)

Поставлены `seller-photo-tiles` (`v0.0.39`) и `seller-card-point-link` (`v0.0.41`); исходный текст перенесён в `EXECUTION_HISTORY.md`. Без кадра/контракта пока: контакты точки «по умолчанию» (показать мой номер, проверка номера — расширение point-contacts-hours), избранное покупателя, жалоба на карточку (этап отзывов и жалоб).

## Аналитика поиска и живой главный экран покупателя (остаток)

Поставлено: запись поисковых событий D0 (`v0.0.61`), Search Home с curated-чипами (`v0.0.49`), объяснение при опечатке (`v0.0.70`); исходный текст решения перенесён в `EXECUTION_HISTORY.md`. Остаток: выдача сразу на главном экране (ближайшее при геолокации, иначе популярное) и популярное из реальных данных — по readiness-gate D0/D1 (динамические чипы). Кнопка поиска: решение PO — только «→» в поле при наличии текста.

## Unify buyer Search entry points

`HeaderSearch` (full-page GET) и `SearchForm` (client-side fetch) на `/` ведут себя по-разному.

- earliest: unscheduled;
- direction: унифицировать submission behavior, не меняя closed Search semantics (S0/S6/S7/S9).

---

# LATER / dependency-gated

Рекомендации, Telegram-канал ввода и аналитика продавца не участвуют в ближайшем выборе только потому, что имеют номер
в Feature Map. Монетизация и продвижение поставлены в очередь решением PO (stage 12).

AI остаётся способом сформировать черновики карточек (Seller Change Set), а не способом обойти Offer core.

---

# Re-evaluation gates

Проверять insertion candidates и новые approved requirements:

- после этапа 1;
- после актуальности + Search Sorting;
- после AI Input;
- после S16 перед решением о MVP/public beta;
- после Demand readiness assessment;
- после Commercial & Monetization Readiness и Backoffice slice decomposition (stages 11A–11C);
- после каждого independently closed commercial/Backoffice checkpoint stage 12, а не после одного mega-release.

Если утверждённое требование не имеет места ни в COMMITTED, ни в INSERTION CANDIDATES, ни в Feature Map, оно получает статус **UNPLACED GAP** и разбирается явно.

---

# Как выбирать следующую работу

Перед новым Slice Contract:

1. проверить `main`, latest verified checkpoint/tag и CI;
2. прочитать этот файл;
3. взять первый незакрытый шаг из NEXT;
4. открыть owning Issue / Feature Map entry / целевой макет;
5. проверить relevant closed contracts;
6. подготовить compact Slice Contract;
7. не менять очередь по старому чату, UX backlog или numeric `Sxx` без Product Owner decision.

Наблюдение или идея проходит путь:

```text
observation
→ Issue / observation inbox
→ Product Owner decision
→ Execution Plan insertion if needed
→ Slice Contract
→ implementation
→ verified checkpoint
```
