# KAIDA.KZ 2.0 — Current Execution Plan

Этот документ является **единственным каноническим источником текущей очередности работ**.

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
- целевой UX продавца → `docs/product/SELLER_AI_FIRST_DESIGN_BRIEF.md` + `SELLER_AI_FIRST_DESIGN_REVISION_1.md` + макет
  (`PROJECT_RULES.md` §18.1);
- exact slice behavior → `docs/slices/**/SLICE_CONTRACT.md`;
- unresolved detailed requirements → GitHub Issues.

Перед началом работы исполнитель обязан самостоятельно проверить фактический `main`, tags и CI. SHA ниже фиксирует состояние на момент обновления, а не заменяет repository check.

## Последний verified product checkpoint

- tag: `v0.0.32-seller-offer-editor`;
- checkpoint commit: `ac29955` (merge PR #50, merged-main CI green);
- после Pass 3 закрыты: `localization-foundation` (`v0.0.27`), `catalog-localization` (`v0.0.28`),
  `seller-comment-translation` (`v0.0.29`, переводчик выключен до переезда на свой сервер), `seller-cabinet-overview`
  (`v0.0.30`), `offer-price-unit` (`v0.0.31`), `seller-offer-editor` (`v0.0.32`, единый ручной редактор);
- ранее закрыты `S0–S13`, `UX1A`–`UX2A`, Mandatory Offer Price, Seller Entry / contextual auth (#35), Seller Trading
  Points Workspace (#36), Buyer interest guest visibility (`v0.0.26`).

Текущий `main` может содержать более поздние docs/tooling maintenance commits без нового product checkpoint.

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
| 4 | Visual acceptance макета после ревизии 1 | Ждёт Product Owner (удобнее всего — прототип P4) |
| 5 | Slice Contracts этапа 1 (ИИ выключен) | После шага 4 |
| 6 | Реализация этапа 1 по контрактам | После шага 5 |

### Этап 1 — продавец без ИИ (черновой состав, порядок утверждает PO на шаге 5)

Цель: продавец проходит ручной путь целевого макета от пустой витрины до опубликованной и изменённой карточки.

1. **Фото предложения** — загрузка, хранение, показ покупателю; минимум одно фото у новой карточки. Это M1,
   перенесённый вперёд из замороженной очереди.
2. **Контакты у точки** — телефон / WhatsApp / Telegram принадлежат точке; новая точка получает контакты предыдущей;
   показ Offer покупателю требует подтверждённой точки, контакты необязательны; каждый внесённый контакт
   подтверждается (телефон и WhatsApp — кодом, Telegram — подключением), неподтверждённый покупателю не показывается.
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

Продавец пишет название своими словами; карточка публикуется под этим названием без выбора из каталога. Сопоставление
с каталогом KAIDA — позже, когда каталог будет сформирован. Для этапа 1 это означает: состояние «товара нет в
каталоге» в редакторе не нужно; контракт пункта 3 должен определить, как карточка со свободным названием находится
в поиске (сейчас поиск идёт через каталог и aliases — закрытые S6/S7), и это ревизия закрытых contracts по
`PROJECT_RULES.md` §4.

### Отменено

- `seller-points-contacts` (часть 3 контрактов Pass 3) — отменён: строил контакты на уровне продавца и отдельный
  экран контактов, которые новая модель отвергает. Заменяется пунктом 2 этапа 1.
- Ветка `slice/seller-offer-workspace` и контракт Issue #27 — отклонены ранее; контракт удалён из репозитория, история
  в Git и Issue #27.

---

# FROZEN COMMITTED QUEUE — после этапа 1

Эти stages сохраняют порядок, но ни один из них не стартует до закрытия этапа 1. Перескочить этап можно только после отдельного Product Owner decision и обновления этого файла.

| # | Stage | Owner |
|---|---|---|
| 1 | Seller Location geo fallback (paste-and-parse, S8 revision) | `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` |
| 1a | KAIDA address directory на открытых данных (подсказки адреса) | `FEATURE_MAP.md` / future Slice Contract |
| 4 | Nearby result-first correction | Issue #34 |
| 5 | Поиск: кнопка «Фильтры» — сортировка «ближе» / «актуальнее» и расстояние | Issue #12, `FEATURE_MAP.md` |
| 6 | Поиск: сортировка «дешевле» и цена от–до | Issue #12, `FEATURE_MAP.md` |
| 7 | AI Input — видео / фото / голос → черновики карточек | `FEATURE_MAP.md` S17–S20 / future Slice Contracts |
| 8 | AI-модерация (спорное — человеку) | `FEATURE_MAP.md` / future Slice Contract |
| 9 | S14 — Discovery / `Для вас` | Feature Map |
| 10 | S15 — Search learning | Feature Map |
| 11 | S16 — Operations (остаток после этапа 1) + MVP boundary review | Feature Map |

M1 (фото), первая часть S16 (снятие карточки оператором) и актуальность с напоминаниями (Issues #31, #32) перенесены в этап 1.

### Ключевые dependencies

- Geo fallback остаётся первым stage после этапа 1: contract утверждён (2026-09-22, S8 revision).
- Address directory (1a) идёт **после** geo fallback: подсказки адреса — улучшение поверх пути, который обязан
  работать без них (`PROJECT_RULES.md` §10.1). Макет может показывать поиск адреса и ссылку на карту с пометкой future
  data source; UI slice не реализует stages 1/1a молча. Первый шаг 1a — проверка покрытия адресов Алматы,
  licence/attribution и operational модели источника.
- Актуальность входит в этап 1: подтверждение актуальности живёт на «Моей витрине». Напоминания (#32) — в том же пункте.
- Search Sorting выполняется после политики актуальности.
- AI Input и AI-модерация по `PROJECT_RULES.md` §10.1 — улучшения поверх ручного пути; ручной путь и публикация без
  предварительной модерации обязаны работать при недоступном ИИ.

---

# INSERTION CANDIDATES

Insertion candidate не имеет жёсткого номера. Он рассматривается **только на checkpoint/re-evaluation boundary** и никогда не вклинивается внутрь уже открытого slice.

## Market internal navigation — Issue #10

- earliest sensible point: после этапа 1;
- trigger: пилот на крупных рынках показывает, что обычного route до Location недостаточно;
- direction: Market directory → scheme/MarketPlaces → Location binding → buyer internal navigation;
- default without trigger: остаётся unscheduled.

## Additional Search filters

Состав фильтра у строки поиска решён PO (2026-09-25): сортировка, расстояние, цена от–до — они вошли в stages 5–6.
Другие фильтры (тип точки, наличие фото, контактов и т. п.) не добавляются без нового решения PO.

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

## Unify buyer Search entry points

`HeaderSearch` (full-page GET) и `SearchForm` (client-side fetch) на `/` ведут себя по-разному.

- earliest: unscheduled;
- direction: унифицировать submission behavior, не меняя closed Search semantics (S0/S6/S7/S9).

---

# LATER / dependency-gated

Монетизация, продвижение, рекомендации, Telegram-канал ввода и аналитика продавца не участвуют в ближайшем выборе
только потому, что имеют номер в Feature Map.

AI остаётся способом сформировать черновики карточек (Seller Change Set), а не способом обойти Offer core.

---

# Re-evaluation gates

Проверять insertion candidates и новые approved requirements:

- после этапа 1;
- после актуальности + Search Sorting;
- после AI Input;
- после S16 перед решением о MVP/public beta.

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
