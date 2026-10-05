# KAIDA.KZ 2.0 — Current Execution Plan

Этот документ является **единственным каноническим источником текущей очередности работ**.

## Verified base и ближайшая последовательность

- `main`: `ff8f08e3644af216dc2833b358610e213f7a1829`; checkpoint `v0.0.55-card-editor-suggestion-scroll` (PR #101; merged-main run `37347918337` SUCCESS); предыдущий `v0.0.54-catalog-suggestion-relevance` (S15B-1, PR #97, `b3432e4`);
  merged-main `KAIDA verify` run `37326497017` SUCCESS (rerun; первый запуск cancelled инфраструктурой). Предыдущие: `v0.0.53` (run `37305378999`), `v0.0.52` (run `37293540946`).
- **Production KB Importer v1 — CLOSED.** Production KB v1 — нормальная runtime-база KAIDA: 682 Products, 210 aliases,
  35 categories в KAIDA PostgreSQL; runtime Product UUID / Offer FK сохранены; внешней KB/corpus-зависимости в runtime нет.
- Stage 6 Rev 3 закрыт на `v0.0.51-search-sort-rev3`.

Порядок работ после решения PO (2026-10-05):

1. ~~Production KB v1 / S15A~~ — **CLOSED** (`v0.0.52`).
2. ~~Catalog-backed Seller → Buyer runtime loop~~ — **CLOSED** (`v0.0.53`, PR #93; integration/user-flow proof, production-код не менялся)
   (`docs/slices/catalog-runtime-loop/SLICE_CONTRACT.md`).
   **S15B-1 — Catalog suggestion relevance / reachability — CLOSED** (`v0.0.54`, `docs/slices/s15b1-catalog-suggestion-relevance/SLICE_CONTRACT.md`). UX-slice «Card editor — mobile visibility of catalog suggestions» — **CLOSED** (`v0.0.55`, `docs/slices/card-editor-suggestion-scroll/SLICE_CONTRACT.md`). **NEXT:** остальной S15B малыми slices после аудита кода (S15B-2 не начата).
3. S15B — Search System revision; раскладывается на малые vertical slices после аудита актуального кода.
4. Только после стабилизации семантики S15B — S15C / D0 Search Demand Events.
5. Начать production-like накопление demand-данных.
6. Параллельно накоплению — launch-critical AI Input / AI-модерация.
7. D1 / internal demand validation, когда появятся данные.
8. Динамические чипы Search Home — готовые к запуску только по readiness-gate популярные **canonical Product** чипы,
   ≤5, curated fallback.
9. Затем остальной Discovery / Demand / Operations / commercial readiness по зависимостям.

Старая `6F` (отдельная модель «нормализованный сырой запрос + время») **снята до реализации**: её законная цель
переходит в S15C/D0 после S15B, чтобы события фиксировали итоговую canonical / unresolved / zero-result семантику.
Старая `6G` убрана из ближней очереди и переосмыслена (см. таблицу ниже). Числовой порог трафика не вводится.

Он отвечает только на четыре вопроса:

1. какой verified checkpoint последний;
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
- commercial semantics → `docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`;
- Backoffice planning/decomposition → `docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`;
- целевой UX продавца → `docs/product/SELLER_AI_FIRST_DESIGN_BRIEF.md` + `SELLER_AI_FIRST_DESIGN_REVISION_1.md` + макет
  (`PROJECT_RULES.md` §18.1);
- exact slice behavior → `docs/slices/**/SLICE_CONTRACT.md`;
- unresolved detailed requirements → GitHub Issues.

Перед началом работы исполнитель обязан самостоятельно проверить фактический `main`, tags и CI. SHA ниже фиксирует состояние на момент обновления, а не заменяет repository check.

## Последний verified product checkpoint

- tag: `v0.0.55-card-editor-suggestion-scroll`; checkpoint commit `ff8f08e`; merged-main CI run `37347918337` green; предыдущие `v0.0.54-catalog-suggestion-relevance` (`b3432e4`), `v0.0.53-catalog-runtime-loop` (`c0d1749`), `v0.0.52-production-kb-importer-v1` (`5b21710`);
- до него закрыты: Stage 6 Rev 3 (`v0.0.51-search-sort-rev3`), 6B–6D (`v0.0.48`–`v0.0.50`), 5A
  (`v0.0.47-search-visibility-without-coordinates`), `v0.0.46-search-sort-distance` и более ранние checkpoints;
- **этап 1 закрыт**: `offer-photos`, `point-contacts-hours`, `seller-showcase-editor`, `operator-post-check`, Motion,
  `offer-actuality` и `actuality-reminders`; ранее закрыты `S0–S13`, `UX1A`–`UX2A`, localization foundation, catalog
  localization, seller comment translation, Seller Entry / contextual auth, Seller Trading Points Workspace.

Перед новой работой состояние всё равно перепроверяется по git/GitHub/CI.

---

# NEXT

## Разворот продавца к AI-first (Product Owner decision, 2026-09-24/25)

Product Owner признал направление seller UI по Pass 3 неверным: ввод данных продавцом должен быть максимально
простым, главный вход — одна кнопка `Сформировать карточки товаров` с ИИ-способами (видео, фото, голос), ручной ввод —
полноценный путь на время, пока ИИ выключен или недоступен. Продуктовые решения записаны в `FEATURE_MAP.md`
(«Seller AI-first model»), целевой UX — в `SELLER_AI_FIRST_DESIGN_BRIEF.md` и `SELLER_AI_FIRST_DESIGN_REVISION_1.md`.

Pass 3 больше не является UX target ни для продавца, ни для покупателя: единственная цель — AI-first макет
(`PROJECT_RULES.md` §18.1), в нём есть и покупательские экраны.

Feature freeze сохраняется: новые product capabilities вне этого раздела не начинаются.

### Шаги

| # | Шаг | Статус на 2026-09-25 |
|---|---|---|
| 1 | ТЗ дизайнеру AI-first витрины продавца | Сделано: `SELLER_AI_FIRST_DESIGN_BRIEF.md` |
| 2 | Первый макет | Сдан: https://claude.ai/artifact/3z2pznybpsJAJbWGTxgwE4 |
| 3 | Ревизия 1: правки редактора, решения PO, экраны «ИИ выключен», прототип ручного пути | Сдана в тот же макет (кадры `Rev 1`); сверка с §5 ТЗ ревизии — все 13 пунктов закрыты |
| 4 | Visual acceptance макета после ревизии 1 | Принят PO 2026-09-25; копия — `docs/product/mockup/seller-ai-first-rev1/` |
| 5 | Slice Contracts этапа 1 (ИИ выключен) | Все пять утверждены |
| 6 | Реализация этапа 1 по контрактам | Этап 1 закрыт 2026-09-28 (`v0.0.36-actuality-reminders`) |

### Этап 1 — продавец без ИИ (**закрыт**; ниже исторический состав)

Цель: продавец проходит ручной путь целевого макета от пустой витрины до опубликованной и изменённой карточки.

1. **Фото предложения** — загрузка, хранение, показ покупателю; фото необязательно, карточка без фото публикуется
   с напоминанием продавцу о неполной карточке (`FEATURE_MAP.md` «Seller AI-first model» п. 4). Это M1,
   перенесённый вперёд из замороженной очереди.
2. **Контакты у точки** — телефон / WhatsApp / Telegram принадлежат точке; новая точка получает контакты предыдущей;
   показ Offer покупателю требует подтверждённой точки, контакты необязательны; каждый внесённый контакт
   подтверждается (телефон и WhatsApp — кодом, Telegram — подключением), неподтверждённый покупателю не показывается;
   **режим работы точки** — обязательный, копируется от предыдущей точки; в каждой карточке выдачи строка вида
   «9.00–18.00 | ПТ 13.00–18.00 | СБ ВС» (выходные зачёркнуты), зелёный / оранжевый (≤ 1 ч до закрытия) / красный;
   на порядок выдачи не влияет (`FEATURE_MAP.md` п. 13). Перед контрактом нужен кадр дизайнера (в макете его нет).
3. **«Моя витрина» и ручной редактор** — навигация `Витрина / Точки / Ещё`, редактор AI-S09 в режиме «ИИ выключен»
   на основе PR #50, свободное название товара, фасовка, несколько точек с общей ценой и своей ценой точки,
   подтверждение с предупреждением об ответственности.
4. **Пост-проверка оператором** — лента новых карточек и снятие с витрины; статус «Снято оператором» у продавца. Это
   часть S16, перенесённая вперёд.
5. **Актуальность `2 / 7 / 14`** (Issue #31) — плашки «Сегодня … 6 дней» у покупателя, задача «Пора подтвердить
   актуальность» и «Всё актуально» на «Моей витрине», скрытие неподтверждённых карточек, **напоминания продавцу**
   до скрытия (Issue #32). Перенесены из замороженной очереди решением PO (2026-09-25): актуальность и ИИ — главные
   отличия KAIDA, без них сервис теряет смысл; без напоминаний продавец не узнает, что карточки пропали из поиска.
   Актуальность напрямую определяет позицию карточки в выдаче. Расписание напоминаний (решение PO, 2026-09-25):
   первое — **до** спуска в выдаче, на второй день после подтверждения («подтвердите, иначе завтра карточки опустятся
   в поиске»); второе — на шестой день («завтра карточки пропадут из поиска»). Больше напоминаний нет. Точное время
   и канал доставки определяет контракт.

**Правило запуска (решение PO, 2026-09-25):** публичный запуск сервиса без актуальности и без ИИ (ИИ-ввод и
ИИ-модерация) не проводится.

Каждый пункт затрагивает закрытые contracts (S3, S5, S10, S12, #36, `seller-cabinet-overview`, `offer-price-unit`) и
проходит contract revision по `PROJECT_RULES.md` §4.

### PR #50 `seller-offer-editor` — слит (`v0.0.32`, 2026-09-25)

По решению PO доведён (E2E на ошибки полей, закрытие с изменениями, двойное нажатие, казахский на 320 px) и слит.
Ручная приёмка PO не проводилась — PO решил сливать без неё. Редактор — основа ручного пути этапа 1; приведение к
виду AI-S09 — в контракте пункта 3.

### Название товара — свободное до формирования каталога (решение PO, 2026-09-25)

Продавец пишет название своими словами; карточка публикуется под этим названием без выбора из каталога. Каталог
теперь существует (Production KB v1, `v0.0.52`), но выбор из него остаётся необязательным: свободное название
продолжает работать как в закрытых contracts. Для этапа 1 это означает: состояние «товара нет в
каталоге» в редакторе не нужно; контракт пункта 3 должен определить, как карточка со свободным названием находится
в поиске (сейчас поиск идёт через каталог и aliases — закрытые S6/S7), и это ревизия закрытых contracts по
`PROJECT_RULES.md` §4.

### Отменено

- `seller-points-contacts` (часть 3 контрактов Pass 3) — отменён: строил контакты на уровне продавца и отдельный
  экран контактов, которые новая модель отвергает. Заменяется пунктом 2 этапа 1.
- Ветка `slice/seller-offer-workspace` и контракт Issue #27 — отклонены ранее; контракт удалён из репозитория, история
  в Git и Issue #27.

---

# Экраны покупателя по макету — закрыто (`v0.0.37-buyer-screens`)

Решение PO (2026-09-29) выполнено в PR #63: экраны покупателя пересобраны по принятому макету (`B01` выдача, `B02`
детальная карточка; экраны без кадра — из классов макета) раньше замороженной очереди. Новые функции не добавлялись:
фильтры `B07` остаются stages 5–6 ниже; отзывы, рейтинг и жалобы (`B03`–`B06`) — insertion candidate. Контракт —
`docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md`.

## Текущий repository gate

**Stage 5A — Search visibility for addressed Locations without coordinates — закрыт**: contract rev 3 APPROVED
(`docs/slices/search-visibility-without-coordinates/SLICE_CONTRACT.md`, contract commit `fc7c717`), реализация слита
PR #77 (slice-коммит `444b44f`, merge `419e60e`; repair-коммит `186ec21` — order-agnostic test assertion, merge `3763373` — PR #78),
branch CI green (runs `37182360419`/`37182363774` на `e21e2f8`, `37191449657`/`37198879235` на `186ec21`),
merged-main CI на `3763373` green (run `37199326198`), manual acceptance **PASS**.
Checkpoint annotated tag `v0.0.47-search-visibility-without-coordinates` создан на `415a25a`.

**Stage #6 Rev 2 отклонён на manual acceptance (PO, 2026-10-04)** — CHANGES REQUESTED, без PR/merge/tag. Ветка
`slice/search-price-sort-range-contract` (contract `b26573a`, реализация `977dbf0`, head `f9dd7cf`, branch CI `37205826673`
green) сохраняется неизменной как evidence; новая ветка Rev 3 строится от актуального `main`, из старой берутся только
полезные hunks/tests. Issue #12 остаётся OPEN.

**6A–6D и Stage 6 Rev 3 закрыты** (6B: PR #84, tag `v0.0.48-first-entry-correction`; 6C: PR #86, tag
`v0.0.49-search-home-last-state`; 6D: PR #88, tag `v0.0.50-inline-language`; Rev 3: PR #90, manual acceptance PASS,
checkpoint tag `v0.0.51-search-sort-rev3` создаётся на merge-коммите после green merged-main CI, до фактического
создания тег не считать существующим). **6F снята до реализации** (решение PO 2026-10-05, см. «Verified base и ближайшая последовательность»); следующий
шаг — Catalog-backed Seller → Buyer runtime loop. Порядок 6D → 6 был выбран потому, что First Entry/Search Home меняют ту же поверхность Search, что и popover Rev 3: popover не строится
внутри структуры, которую сразу заменят.

Решения PO (2026-10-04), которые должны войти в соответствующие Slice Contracts, не сокращаясь:

- **6B/6C:** `/welcome` — First Entry, показывается один раз на браузер/устройство; `/` — постоянный Search; пункт
  `Поиск` никогда не открывает First Entry. Состояние последнего поиска (запрос, сортировка, направление) — только в
  пределах вкладки/сессии; выдача и координаты не сохраняются, при возврате результаты запрашиваются заново; `distance`
  без текущих координат при восстановлении нормализуется в `actuality` (и в UI, и в хранилище), геолокация автоматически
  не запрашивается.
- **6D:** язык без отдельного gate и без Sheet — на First Entry и в `Ещё`, у покупателя и у продавца.
- **6 (Rev 3):** `sort=actuality|distance|price`, `direction=asc|desc`; выбранный критерий — настоящий первичный порядок,
  скрытого взвешенного score нет; порядок «свежие выше ageing» при явном `price`/`distance` больше не действует
  (`<7d` eligibility остаётся), actuality — tie-breaker, затем id; цена — номинальная KZT без нормализации единиц;
  geo-less после geo-known в обоих направлениях distance; по умолчанию actuality, свежие первыми; повторный выбор
  активного критерия меняет направление. Радиус, цена от–до, чипы фильтров, sheet «Фильтры» и `sort=cheaper` удаляются.
- **6F/6G** (решения 2026-10-04 сохраняются как входные требования к S15C/D0 и будущим canonical-Product чипам; сами 6F/6G как отдельные slices сняты 2026-10-05): только осознанные submit; без user-id и постоянного/сессионного идентификатора, пока контракт не докажет
  необходимость; событие — нормализованный запрос, время и нужный исход поиска; raw-события не дольше 90 дней
  (конфигурируемо); окно популярности по умолчанию 14 дней (конфигурируемо), порог повторов конфигурируем, ≤5 чипов,
  curated fallback; сырые запросы продавцу не показываются; модель общая с S15C, второй не создаётся.
- **Backlog аудита overlay** (вне текущих slices): выбор единицы цены, выбор торговых точек, «Откуда карточка».

# COMMITTED STAGE REGISTER — после этапа 1

**Это реестр stages, а не порядок исполнения.** Номера в колонке `#` — исторические идентификаторы, они не
перенумеровываются и не задают очередность. **Фактический ближайший порядок единственный** (решение PO 2026-10-05, см.
«Verified base и ближайшая последовательность»):

`v0.0.53` (runtime loop закрыт) → S15B → S15C/D0 → production-like accumulation →
AI Input / AI-модерация (пока копятся данные) → D1 / readiness → canonical Product чипы.

Stages 7, 8, 9 (AI Input, AI-модерация, S14) стоят в таблице по историческим номерам; AI Input и AI-модерация идут по
порядку выше, S14 — среди «остального Discovery» после него. Перескочить этот порядок можно только после отдельного
Product Owner decision и обновления этого файла.

| # | Stage | Owner |
|---|---|---|
| 1 | Seller Location geo fallback (paste-and-parse, S8 revision) | `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` |
| 1a | ~~KAIDA address directory на открытых данных (подсказки адреса)~~ — **закрыт** (PR #72, manual acceptance PASS) | `docs/slices/address-directory/SLICE_CONTRACT.md` |
| 4 | ~~Nearby result-first correction~~ — **закрыт** (PR #73, manual acceptance PASS) | Issue #34, `docs/slices/nearby-result-first/SLICE_CONTRACT.md` |
| 5 | ~~Поиск: кнопка «Фильтры» — сортировка «ближе» / «актуальнее» и расстояние~~ — **закрыт** (PR #74, manual acceptance PASS) | Issue #12, `docs/slices/search-sort-distance/SLICE_CONTRACT.md` |
| 5A | ~~Search visibility for addressed Locations without coordinates~~ — **закрыт** (PR #77 + repair PR #78, manual acceptance PASS) | `docs/slices/search-visibility-without-coordinates/SLICE_CONTRACT.md`, Issue #12 |
| 6A | Process/UX rules maintenance: граница доставки mobile + RU, выбор interaction pattern, язык без отдельного gate (docs) | `PROJECT_RULES.md` §18.4–18.5 |
| 6B | ~~First Entry correction: `/welcome` отдельно от Search `/`, intro один раз на браузер/устройство, язык на First Entry, без языкового экрана~~ — **закрыт** (PR #84, manual acceptance PASS) | `docs/slices/first-entry-correction/SLICE_CONTRACT.md` |
| 6C | ~~Search Home + состояние последнего поиска (поле по центру, ≤5 чипов, восстановление запроса/сортировки при возврате)~~ — **закрыт** (PR #86, manual acceptance PASS) | `docs/slices/search-home-last-state/SLICE_CONTRACT.md` |
| 6D | ~~Inline-язык в `Ещё` (покупатель и продавец): компактная таблетка `РУС \| ҚАЗ` в строке «Язык», сразу, без Sheet/Done~~ — **закрыт** (PR #88, manual acceptance PASS) | `docs/slices/inline-language/SLICE_CONTRACT.md` |
| 6 | Поиск, сортировка Rev 3 — **один vertical slice**: «Расстояние / Цена / Актуальность» с направлением, public API, порядок, anchored popover; заменяет отклонённую Rev 2 — **закрыт** (PR #90, manual acceptance PASS) | Issue #12, `docs/slices/search-sort-rev3/SLICE_CONTRACT.md` |
| 6F | ~~Search Query Log~~ — **снята до реализации** (2026-10-05); цель переходит в S15C/D0 после S15B | — |
| 6G | ~~Динамические популярные запросы~~ — убрана из ближней очереди; переосмыслена как readiness-gated популярные canonical Product чипы (≤5, curated fallback) после S15C/D0/D1; сырые/unresolved запросы Products не становятся | future Slice Contract |
| 7 | AI Input — видео / фото / голос → черновики карточек | `FEATURE_MAP.md` S17–S20 / future Slice Contracts |
| 8 | AI-модерация (спорное — человеку) | `FEATURE_MAP.md` / future Slice Contract |
| 9 | S14 — Discovery / `Для вас` | Feature Map |
| 10A | ~~S15A — Catalog bootstrap~~ — **закрыт** (Production KB v1, `v0.0.52-production-kb-importer-v1`) | `docs/slices/production-kb-importer/SLICE_CONTRACT.md` |
| 10A+ | ~~Catalog-backed Seller → Buyer runtime loop~~ — **закрыт** (`v0.0.53-catalog-runtime-loop`, PR #93, manual acceptance PASS) | `docs/slices/catalog-runtime-loop/SLICE_CONTRACT.md` |
| 10B | S15B — Search System revision (**S15B-1 catalog suggestion relevance — закрыт, `v0.0.54`**; дальше малые vertical slices после аудита кода): каталоговый `product_id`, suggestions, resolved search отдельно от seller-title fallback, known-zero отдельно от unknown | `SEARCH_SYSTEM_SPEC_v0.1.md` / future contract revisions |
| 10C | S15C — Demand Data Foundation (после стабилизации S15B; включает цель старой 6F): D0/D1 и только необходимая база D2; internal/privacy-safe, без seller Demand UI | Issue #55 / `KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md` |
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

#### S15A — Catalog bootstrap — CLOSED

**Выполнено Production KB v1** (`v0.0.52-production-kb-importer-v1`, `docs/slices/production-kb-importer/SLICE_CONTRACT.md`):
в KAIDA PostgreSQL установлены 682 Products, 210 aliases, 35 categories. Workbook остаётся историческим/редакторским
источником, не runtime-bootstrap. Текст ниже — историческое описание исходного замысла.


Входной artifact `KAIDA.KZ_initial_product_catalog_v0.1.xlsx` содержит 787 кандидатов: 682 `include_v01=YES` и 105
`REVIEW`; RU — canonical/editorial basis, KK — draft, отдельно даны aliases, editorial categories и source metadata.
Workbook — редакторский источник, не production migration и не seed.

Будущий contract обязан определить staging/validation, merge с существующими Products, stable UUID, localized names,
aliases, collision handling, idempotency, rollback/correction и пакетный отчёт принятия. 682 `YES` — кандидатное
RU-ядро: безопасные строки принимаются пакетно после дедупликации, неоднозначные конфликты остаются человеку;
автоматическое объединение допустимо только при однозначном правиле. `candidate_code` — временный внешний ID, не
`Product.id`.

Запрещено молча: импортировать все строки или 105 `REVIEW`; считать draft KK проверенным или ставить ему
`verified_at`; объявлять Excel taxonomy финальным рубрикатором; класть весь каталог в seed; дублировать существующие
Products. `Category` остаётся полноценной сущностью KAIDA, а `category_code` workbook маппится на простой неглубокий
рубрикатор KAIDA. Вычитка KK отложена и не блокирует RU bootstrap.

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

# ISSUE REGISTER (reconciliation 2026-10-05)

Порядок работ определяют разделы выше; Issues владеют подробными требованиями и сюда не копируются. Состояние каждого
Issue — ровно одно (классификация принята PO).

| Issue | Состояние | Owner / trigger |
|---|---|---|
| #12 Search sorting | covered / closed (completed, Stage 6 Rev 3, `v0.0.51`) | будущие фильтры — не остаток этого Issue, см. «Additional Search filters» |
| #55 Demand | input to scheduled workstream | S15A closed (`v0.0.52`) → S15B → S15C (stage 10C); D3–D6 — по gates в Feature Map |
| #75 AI-правила обработки seller input | input to scheduled workstream | AI Input (stage 7, S17–S20): входные правила будущих Slice Contracts; AI-модерация — stage 8 |
| #76 distance sensitivity в ranking | later / dependency-gated | после S15B + данных D0/D1. Не может влиять скрыто на явные `actuality | distance | price`; требует отдельного relevance/recommendation context и contract revision (Rev 3 закрыл скрытый score) |
| #79 Price Intelligence | later / dependency-gated | Product resolution (S15B) + накопленные цены; не в ranking на MVP |
| #10 Market navigation | later / triggered | «Insertion candidates» ниже |
| #54 категории товаров продавца | later / backlog | trigger: у продавцов много карточек; зависит от каталога/Category и решений PO |
| #83 Security automation | later / trigger-gated | триггеры внутри Issue (Dockerfile/registry/SBOM и т. д.) |
| #13, #16, #17, #19, #27, #31, #32, #34, #35, #36, #37, #42 | covered / closed | реализовано или завершено, Issue закрыт |
| #20–#23, #28, #29 | invalid / temp | не product requirements |

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

В целевом макете (AI-S15–S17): архив с восстановлением и сроком хранения. Требует точной temporal semantics и server
jobs; рассматривается вместе с актуальностью.

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

## Стартовая страница сервиса — First Entry (макет, 2026-09-29)

Живой макет (версия `1790680691-0123`, страница FIRST ENTRY: `FE0` — handoff, `FEA1` / `FEA3` / `FEPA` — телефон
< 1280, `FEB2` / `FEB3` / `FEPB` — экран ≥ 1280): заголовок, настоящее поле поиска и пример выдачи по «баранина»;
демо-анимация ≈ 3,5 с один раз (флаг `kaida_fe_demo_seen`). **Сделан только телефон** — контракт
`docs/slices/first-entry-mobile/SLICE_CONTRACT.md`; экран ≥ 1280 не трогаем (решение PO 2026-09-29).

Решения PO (2026-09-29): язык выбирается один раз и меняется в «Ещё» (макет рисует `РУС / ҚАЗ` и `/ru`, `/kk` —
не делаем); демо-пример с вымышленными данными показываем; геолокация только по действию пользователя; фото в
примере — нарисованные иллюстрации, оставляем; решения Pass 3 не переносятся — идём от макета. Кнопки поиска нет,
кроме `→` в поле при наличии текста.

Открыто: казахские строки — черновик, нужна вычитка; недавние запросы на повторном визите не спроектированы;
финальный слоган; десктоп (≥ 1280); промо-баннер над поиском; «живой главный экран» (популярное / ближайшее).

## Тёмная / светлая тема (пожелание PO, 2026-09-29)

Переключатель темы в «Ещё» (у покупателя и у продавца), рядом с «Язык». Срок не назначен. В макете и токенах только
светлая тема — нужны тёмные токены и кадры дизайнера (`PROJECT_RULES.md` §18.1); палитру агент не придумывает.

## Правки экранов продавца после ручного просмотра PO (2026-09-29)

Небольшие отдельные slices на ветках от `claude/buyer-screens` / `main`; контракты — DRAFT до утверждения PO.

- Плитки фото по обновлённому макету (`☆` / `×`, микроменю `← →`, подхват при перетаскивании) —
  `docs/slices/seller-photo-tiles/SLICE_CONTRACT.md`;
- переход к редактированию торговой точки прямо из карточки товара и возврат к ней с сохранённым вводом —
  `docs/slices/seller-card-point-link/SLICE_CONTRACT.md`;
- без кадра / контракта пока: контакты точки «по умолчанию» (показать мой номер, проверка номера — расширение
  point-contacts-hours), избранное покупателя, жалоба на карточку (этап отзывов и жалоб).

## Аналитика поиска и живой главный экран покупателя (решение PO, 2026-09-29)

Запись поисковых запросов покупателей (без привязки к человеку: текст, дата, нашлось ли что-то) — основа для двух
вещей: «популярные» запросы на главном экране (самое частое за 7–14 дней, только запросы с находками; запасной
список, пока данных мало) и продажа аналитики спроса продавцам (stage 12, монетизация).

- earliest: после экранов покупателя по макету; нужны миграция и контракт;
- в тот же slice: выдача сразу на главном экране (ближайшее при включённой геолокации, иначе популярное), нужна ли
  кнопка «Найти» или выдача подстраивается под набираемое, «Может, вы искали…» при опечатке;
- перед контрактом: правила хранения запросов и приватность (что считается персональными данными), связь с
  монетизацией (stage 12).

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
