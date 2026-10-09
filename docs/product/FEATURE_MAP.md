# KAIDA.KZ 2.0 — Feature Map

Этот документ — **долгосрочная карта capabilities и зависимостей**.

Он **не владеет текущей очередностью, NEXT stage или verified checkpoint**. Для этого используется `docs/product/EXECUTION_PLAN.md`.

Каждый product slice должен заканчивать пользовательское поведение, которое можно открыть в браузере, проверить руками и покрыть нужным automated proof.

Базовый продуктовый цикл:

```text
Seller Input
→ SellerChangeSet
→ Offer
→ Search / Discovery
→ Buyer Action
```

Parent sources для будущих cross-cutting workstreams:

- commercial semantics / Free–Pro–Boost–Business →
  `docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`;
- Backoffice planning/decomposition → `docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`;
- Demand product/readiness → `docs/product/KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md`.
- AI / semantic technology candidates → `docs/product/AI_TECH_CANDIDATES.md`.

Они задают direction и dependencies, но не являются Slice Contracts и не разрешают implementation.

## Core domain

Основные понятия MVP:

- `User` — учётная запись;
- `Seller` — профиль продавца;
- `Location` — физическая торговая точка;
- `Category` — полноценная сущность каталога/navigation grouping для просмотра ассортимента, Search filters,
  Discovery, market pages и будущей маршрутизации спроса; Excel taxonomy маппится на неё, но не определяет её модель;
- `Product` — канонический товар;
- `Offer` — актуальное предложение Product в конкретной Location;
- `SellerChangeSet` — набор предлагаемых продавцом изменений;
- `SellerChangeItem` — конкретное изменение внутри Change Set.

Дополнительные сущности появляются только когда их требует конкретный slice.

## Numbered capability map

Статус здесь показывает только whether capability уже закрыта как product contract; row order не является текущим execution order.

| ID | Область | Законченное поведение | Зависит от | Этап | Статус |
|---|---|---|---|---|---|
| S0 | Search/Core | Покупатель вводит товар и видит актуальное тестовое предложение | — | Foundation | CLOSED |
| S1 | Offer lifecycle | Просроченный Offer перестаёт показываться | S0 | Foundation | CLOSED |
| S2 | Auth | Пользователь входит по телефону через test OTP | S0 | Foundation | CLOSED |
| S3 | Seller / Location | Продавец создаёт первую торговую точку | S2 | Foundation | CLOSED |
| S4 | Seller Input | Один Change Set создаёт Offer после подтверждения | S3 | Foundation | CLOSED |
| S5 | Offer management | Продавец обновляет/выключает Offer через Change Set | S4 | Foundation | CLOSED |
| S6 | Catalog | Search понимает canonical Product и aliases | S0 | Foundation | CLOSED |
| S7 | Search | Buyer находит реальные seller Offers | S4, S6 | MVP | CLOSED |
| S8 | Geo / Location | Seller сохраняет валидные coordinates; raw geo не публикуется | S3, S7 | MVP | CLOSED |
| S9 | Search ranking | Transient buyer geo может влиять на deterministic ranking | S1, S8 | MVP | CLOSED |
| S10 | Buyer action | Из Offer можно связаться с продавцом | S7 | MVP | CLOSED |
| S11 | Discovery | Buyer видит Offers рядом | S8, S9 | MVP | CLOSED |
| S12 | Seller Input | Один Change Set содержит несколько Change Items | S5 | MVP | CLOSED |
| S13 | Interests | Buyer отмечает Product как интересующий | S2, S6 | MVP | CLOSED |
| S14 | Discovery | Buyer видит Offers по явно указанным интересам | S7, S13 | MVP | PLANNED |
| S15A | Catalog bootstrap | Утверждённое RU-ядро стартового каталога проходит staging, merge и контролируемый import без дублей | S6 + PO-approved rows | Stage 10 | CLOSED (Production KB v1, `v0.0.52-production-kb-importer-v1`) |
| S15B | Search System revision | Buyer выбирает canonical Product; resolved выдача, unknown fallback и empty states имеют разную семантику | S15A (установленная Production KB v1), S7, S9; идёт после Catalog-backed Seller → Buyer runtime loop | Stage 10 | CLOSED (`v0.0.54`–`v0.0.60`) |
| S15C | Demand Data Foundation | KAIDA собирает conscious canonical/unresolved/zero-result demand и privacy-safe internal aggregates | S15B | Stage 10 | PARTIAL: D0 CLOSED (`v0.0.61`); D1 и далее — data-gated, не начаты |
| S16 | Operations | Оператор может отключить ошибочный Offer/Seller; первая часть — снятие карточки по факту публикации | S7 | Этап 1 (снятие) / MVP | PLANNED |
| S17 | AI Input | Свободный текст предлагает Seller Change Set | S12 | После этапа 1 | PLANNED |
| S18 | AI Input | Voice предлагает Seller Change Set | S17 | После этапа 1 | PLANNED |
| S19 | AI Input | Photo input предлагает Seller Change Set | S17 | После этапа 1 | PLANNED |
| S20 | AI Input | Video input предлагает batch Change Set | S17, S12 | После этапа 1 | PLANNED |
| S21 | Input channels | Telegram использует ту же seller-input logic | S17 | После MVP | PLANNED |
| S22 | Auth | Test OTP заменяется real SMS delivery | S2 | До публичного запуска | PLANNED |
| S23 | Notifications | Buyer получает уведомление о новом Offer интересующего Product | S14 | После MVP | PLANNED |
| S24 | Recommendations | Детерминированная personalized feed без ML | S14 + data | После MVP | PLANNED |
| S25 | Monetization policy | **STALE FORM:** hard active-Offer tariff cap удалён из текущего направления; вернуться можно только по pilot evidence и новому явному PO decision | pilot evidence + commercial parent source | Stage 12 review gate | REVIEW REQUIRED |
| S26 | Commercial foundation | Первый конкретный paid use case получает server-side CommercialAccount / Plan / Entitlements / Limits / EffectiveEntitlements minimum, без generic framework заранее | approved commercial parent source + owning use case | Stage 12, отдельные slices | PLANNED / NOT AUTHORIZED |
| S27 | Pro | Один sellable Pro объединяет AI + full Demand + Performance и запускается только после минимально полезной готовности всех трёх capabilities | S17–S20 + D4 readiness + S33 + S26 + Billing foundation | Stage 12, readiness-gated | PLANNED |
| S28 | Boost | Eligible Offer получает отдельные Purchase / PromotionCampaign semantics; one-off Boost доступен независимо от Pro, не меняет organic ranking и не гарантирует продажу | S26 + buyer visibility/moderation policy + future payment foundation | Stage 12, отдельный workstream | PLANNED |
| S29 | Boost delivery | Paid Offer получает маркированный дополнительный охват на approved sponsored surfaces, отдельно от organic и Editorial Featured | S28 + delivery/measurement contract | Stage 12, readiness-gated | PLANNED |
| S30 | Recommendations | Behavioral ranking учитывает реальные interactions | S24 + data | Позднее | PLANNED |
| S31 | Discovery | Редкость товара влияет на показ | data | Позднее | PLANNED |
| S32 | Trust | ИИ-модерация проверяет новые карточки и правки до публикации; спорное — человеку | S17 | После AI Input | PLANNED |
| S33 | Seller performance | Free: views/opens/route/contact actions и basic totals; Pro: breakdown/trends/history/Demand linkage/funnel-like/Boost analytics; proxy action не называется продажей | instrumentation + S26; S28–S29 для Boost metrics | Stage 12 / позднее | PLANNED |

## Inserted / cross-cutting capabilities

После S13 появились важные workstreams, которые не следует искусственно перенумеровывать задним числом. Их текущая позиция определяется `EXECUTION_PLAN.md`, а detailed requirements — Issues / Slice Contracts.

К ним относятся, среди прочего:

- Seller contextual entry/auth;
- card-based multiple trading points;
- AI-first seller showcase («Моя витрина») с ручным путём;
- mandatory Offer price;
- Seller actuality (бывш. freshness) degradation and reminders;
- explicit Search sorting / visible proximity;
- real Offer media (M1): до 5 фото, минимум одно; публичное видео — M2;
- point-owned contacts;
- moderation: ИИ до публикации, пост-проверка оператором при недоступном ИИ;
- reviews / rating / photo complaints (целевой макет, не запланировано);
- archive / restore / delete карточек;
- complete Russian/Kazakh localization; language chosen at the first visit and changed in «Ещё» (PO, 2026-09-29);
- **buyer promo banner above the search field** (PO, 2026-09-29): место над строкой поиска для акций, новинок и
  другой информирующей и вовлекающей маркетинговой информации KAIDA; кто и как управляет содержимым, частота смены,
  метки рекламы и связь с платным продвижением (S28–S29) решает отдельный контракт;
- KAIDA-owned address directory built on open data (OpenStreetMap) for Location address suggestions;
- KAIDA Demand: internal data foundation → readiness-gated free seller signals → readiness-gated paid analytics;
- Commercial foundation: server-side effective access, auditable usage/overrides and non-destructive downgrade;
- Backoffice: общий administrative client, который после planning/readiness раскладывается на operational vertical
  slices, а не строится одним релизом;
- Editorial Featured и Paid Promotion/Boost как разные entities/reasons of display;
- Market internal navigation as future spatial capability.

Наличие capability в этом разделе **не означает**, что её можно начать вне текущей очереди.

## Stable capability principles

### Russian / Kazakh localization

KAIDA is a bilingual product. Every KAIDA-owned user-facing string must exist in Russian and Kazakh: navigation, headings, buttons, hints, validation, errors, empty/loading/offline states, statuses, confirmation text, auth, accessibility labels, metadata and other system copy.

The shared app shell provides a visible Russian/Kazakh language switch for anonymous buyers, authenticated buyers and Sellers. The selected language applies consistently across buyer and seller routes and survives navigation and reload on the same device. Switch behavior is owned by `PROJECT_RULES.md` §18.4.

Catalog-owned display data needed to complete a user task (for example Product and Category names) must have Russian and Kazakh presentation. Search must accept the supported names/aliases in both languages.

**Catalog localization model (Product Owner decision, 2026-09-23).** `Product` stays one language-independent entity. Its display names become per-language values, and aliases are linked to a language as well: `Product → localized names → localized aliases`. System catalog names are curated and verified, never machine-translated at render time. Two forbidden shortcuts: packing Russian and Kazakh into the single `name` column, and treating today's language-agnostic aliases as a localization system. The current model is not reshaped before the localization slice starts.

**Seller-authored content translation (Product Owner decision, 2026-09-23).** Automatic translation is the target model, and these rules are fixed now:

1. the Seller's original text is always the source of truth;
2. the Seller writes it once, in their own language;
3. translation is produced automatically once that capability exists;
4. the reader can always reach the original;
5. editing the original makes the previous translation stale and it must be regenerated;
6. a failed translation falls back to the original — neither seller nor buyer flow breaks;
7. machine output never becomes the only stored text;
8. in the first stage Search does not depend on machine translation of seller comments; product search runs through the Product Catalog and aliases.

**Scope of seller translation (Product Owner decision, 2026-09-23).** Only the Seller's Offer comment is machine-translated. The Seller may write it in any language regardless of the interface language; its language is detected from the text, never assumed from the interface. Buyers see it in their interface language with a translation mark and access to the original. Seller name, trading-point name, address and custom price unit are always shown as written, in every language. The translator is a server-side LLM; until it is connected, the Seller-facing «Проверить перевод» action is hidden and buyers see the original. The whole interface is bilingual from the first release, with no Russian-only screens behind the language switch. Kazakh KAIDA-owned strings and Kazakh catalog names may be drafted by an LLM; they stay provisional until verified by a native Kazakh speaker. In the current delivery boundary (`PROJECT_RULES.md` §18.5) this verification is not a merge gate; it remains outstanding work (`docs/product/REQUIREMENTS_REGISTER.md`, O-KK-PROOF); machine translation at runtime is used only for Seller-authored data (the comment).

Storage shape and exact behavior are decided in the three localization Slice Contracts (`docs/slices/localization-foundation/`, `docs/slices/catalog-localization/`, `docs/slices/seller-comment-translation/`), not here. Per §10.1 of `PROJECT_RULES.md`, the translation provider is an improvement over a working path, never a required dependency of seller or buyer flows.

**Translator connection deferred (Product Owner decision, 2026-09-23).** `seller-comment-translation` shipped in `v0.0.29` with the translator switched off in production (`SELLER_COMMENT_TRANSLATOR=off`); the only adapter is a deterministic test/demo stand-in. No external translation provider is chosen now. A real server-side LLM is connected and tested near MVP, when KAIDA starts moving to its own server; until then buyers see comments as written and the Seller form shows no translation hint or preview.

No UI slice is complete if its changed user-facing surface works in only one supported language. Exact locale storage, URL strategy, fallback behavior and seller-authored content translation belong to the localization Slice Contract and must not fragment across individual screens.

### Offer price unit

Единица измерения — controlled choice с коротким закреплённым списком и вариантом `Другое` со свободным вводом (Product Owner decision, 2026-09-23). Свободный ввод как основной механизм не используется: он быстро порождает несовместимые варианты одного и того же значения (`кг`, `килограмм`, `кг.`, `за кг`).

Первый список: `кг`, `шт`, `л`, `упак.`, `другое`.

`100 г`, `500 г`, `1,5 кг` и подобное — **не** единицы измерения, а количество или размер упаковки. Такая потребность
подтверждена целевым макетом (AI-S09): **условная фасовка** — отдельное необязательное структурированное поле
(`упак.` → «В упаковке: 600 г»; `шт.` → «вес или объём»; для `кг` и `л` не показывается), вторичная строка карточки,
не комментарий и не часть единицы. В целевой модели единица становится обязательной. Storage и API — будущий Slice
Contract.

Wireframe может показывать этот controlled choice, но production implementation требует contract decision о canonical
codes (`kg`, `piece`, `liter`, `package`, `other` либо эквивалент), локализованном display, legacy free-text values и
семантике `Другое`. Хранить только русские labels как новые canonical values нельзя: это конфликтует с RU/KZ
presentation. Существующий nullable/free-text API не меняется молча внутри UI slice.

Exact proposed storage, migration and API revision are owned by
`docs/slices/offer-price-unit/SLICE_CONTRACT.md`; it must be approved before `seller-offer-editor` starts.

### KAIDA address directory

Подсказки адреса при создании торговой точки строятся на собственном справочнике KAIDA поверх открытых данных (в первую очередь OpenStreetMap), размещённом внутри системы. Внешний платный геокодер не подключается — см. `PROJECT_RULES.md` §10.1.

Сценарий: продавец вводит адрес → KAIDA предлагает варианты из своего справочника → выбор даёт `addressText` и координаты. Обязателен видимый путь `Ввести вручную`; для ручного адреса координаты задаются существующим действием «я на точке» (browser geolocation) или вставкой ссылки на карту, когда этот механизм будет реализован.

Справочник — отдельная capability со своим slice: импорт и обновление открытых данных, хранение, поиск с опечатками. Перед его планированием отдельно проверяются фактическое покрытие адресов Алматы, licence/attribution requirements выбранного источника, update cadence и operational стоимость собственного hosting/index. Недостаточное покрытие или временная недоступность справочника не ломают сценарий — ручной ввод остаётся полноценным путём, а не аварийным.

### Seller actuality (бывш. freshness)

KAIDA ценен тем, что Offer подтверждается продавцом как актуальный. В интерфейсе используется слово «актуальность»,
не «свежесть». Точные thresholds и reminder cadence задаются отдельными contracts; Feature Map не дублирует текущую
policy.

### Seller AI-first model (Product Owner decisions, 2026-09-24/25)

Цель — максимально короткий путь от товара на прилавке до карточки на витрине. Целевой UX:
`SELLER_AI_FIRST_DESIGN_BRIEF.md` + `SELLER_AI_FIRST_DESIGN_REVISION_1.md` + макет
https://claude.ai/artifact/3z2pznybpsJAJbWGTxgwE4.

1. **Один главный вход.** `Сформировать карточки товаров` → видео, фото, голос (ИИ) или `Заполнить вручную`. Все
   способы сходятся в один редактор и один пакет черновиков.
2. **Ручной путь — полноценный.** Пока ИИ выключен или недоступен, ИИ-способы видны, но выключены с пометкой
   «Временно недоступно» (включая диктовку комментария), а ручной путь проходит до публикации без тупиков.
3. **Разделы продавца:** `Витрина / Точки / Ещё`. Отдельного обзора и отдельного экрана контактов нет.
4. **Неполная карточка публикуется, продавец получает напоминание** (решение 2026-09-25, отменяет прежнее «фото
   обязательно»). Всё публикуется из черновика. **Неполные данные — это отсутствие фото и комментария:** без них карточка публикуется, но перед публикацией и на «Моей витрине» продавец видит
   напоминание, что карточка неполная и будет проигрывать конкурентам, с действием дополнить её. **Название и цена
   (с «Цена за») обязательны всегда**; без точки карточку негде показать, поэтому точка тоже нужна. Отсутствие фото на порядок выдачи **не влияет** — у покупателя
   нейтральная заглушка. Целевой лимит — 5 фото + 1 публичное видео.
5. **Модерация.** Целевая модель — ИИ проверяет новые карточки и правки до публикации, спорное уходит человеку.
   **Пока ИИ недоступен, модерации до публикации нет:** карточка и правка появляются на витрине сразу после явного
   подтверждения продавцом; оператор просматривает новые карточки по факту и может снять неподходящую. В этом режиме
   на подтверждении показывается информационный текст (без чекбокса): продавец несёт ответственность за соответствие
   фото, названия и описания законодательству Республики Казахстан. С ИИ-модерацией этот текст не показывается.
   **Что проверяется в целевом режиме** (решение 2026-09-26): модерация проверяет содержимое, а не то, кто его
   набрал. Новая карточка — из ИИ-черновика (даже без правок продавца) или вручную — проверяется всегда: кадры и
   название ИИ берёт из съёмки и речи продавца. Правка только цены, единицы из списка (кг, л, шт., упак.) или веса
   упаковки применяется сразу, без проверки. Правка фото или видео, названия, комментария, а также единица
   «Другое» (новая или изменённая) уходят на проверку. Цена — только число; «Другое» — одно слово (только буквы, без
   пробелов и цифр; точная длина — в контракте).
6. **Несколько точек.** Один черновик на N точек даёт N карточек («Будет создано N карточек»). Правка цены по умолчанию
   меняет её во всех точках этого товара; потом у отдельной точки можно задать свою цену, и общая правка её молча не
   затирает. Название, фото и комментарий — общие для всех точек товара; отдельно по точке меняется только цена.
   Новая точка к уже опубликованным товарам сама не добавляется: товары остаются в прежних точках, а подключить новую
   точку продавец может через «Изменить» (решения 2026-09-25).
7. **Контакты принадлежат точке.** У первой точки продавец заполняет телефон / WhatsApp / Telegram по желанию; каждая
   следующая точка получает контакты предыдущей, их можно изменить сразу или позже. **Каждый внесённый контакт
   подтверждается** (решение 2026-09-25): телефон и WhatsApp — кодом, Telegram — подключением; номер, под которым
   продавец вошёл, и контакты, скопированные от предыдущей точки, повторно не проверяются. Неподтверждённый контакт
   покупателю не показывается — защита от чужого номера, внесённого, чтобы кому-то досаждать звонками.
8. **Показ покупателю** требует подтверждённой точки; контакты необязательны (на смену правилу «публичный телефон +
   geo»). Иконки связи у покупателя — без текстовых подписей, с доступным именем и зоной нажатия ≥ 44×44 px.

9. **Жалоба покупателя — на карточку целиком** (решение 2026-09-25, для будущего этапа отзывов и жалоб). В карточке
   одно действие `Пожаловаться на карточку`; причину покупатель выбирает на следующем шаге: цена не совпадает, фото
   не соответствует товару, неверное описание, другое (черновой список, уточняется контрактом). Текущие кадры макета,
   где жалоба есть только на фото (AI-B02 «Фото не соответствует товару», AI-B05), перерабатываются под эту модель.
   Выбор конкретного фото (кадр AI-B05) — не первый шаг жалобы: он появляется только после причины «Фото не
   соответствует товару» и только если у карточки больше одного фото; при одном фото шаг пропускается (решение
   2026-09-26). Нужна правка кадров дизайнером.
10. **Название товара — свободное название остаётся допустимым; каталог теперь существует** (решение 2026-09-25;
    обновлено 2026-10-05). Production KB v1 установлен в KAIDA PostgreSQL (`v0.0.52`), подсказки каталога берутся из
    runtime-каталога. Выбор из каталога **не обязателен**: продавец по-прежнему может написать название своими
    словами, и карточка публикуется под ним, как в закрытых contracts. Как такая карточка находится в поиске, определяет
    контракт (ревизия S6/S7).
    **Смешанный ввод** (решение 2026-09-27): пока продавец печатает, под полем появляются подсказки из каталога;
    выбранная подсказка привязывает карточку к каталогу, а без выбора карточка публикуется под словами продавца без
    ожидания. Каталог (682 Products) не закрывает весь рынок — он растёт контролируемой редактурой из реальных карточек и запросов.
    Seller-title word-start fallback остаётся только отдельным unresolved-путём и не смешивается через `OR` с
    resolved Product search (`docs/slices/seller-showcase-editor/SLICE_CONTRACT.md`, будущая ревизия S15B).
    **Показ названия на языке покупателя** (решение 2026-09-29): карточка, привязанная к каталогу, показывает
    покупателю название товара из каталога на его языке; карточка вне каталога — слова продавца как есть. Сейчас
    название везде показывается словами продавца; правило вводится внутри S15B (stage 10
    `EXECUTION_PLAN.md`); каталог уже установлен и пополняется контролируемо.
    **Оповещение о товаре вне каталога** (решение 2026-09-29): как только публикуется карточка, не привязанная к
    каталогу, оператор сразу получает оповещение, чтобы перевести название или добавить товар в каталог и привязать
    карточку. Кто именно получает (оператор, модератор, администратор) и каким каналом — решает Slice Contract. Входит
    в тот же stage 10; до этого такие карточки видны в общей ленте пост-проверки оператора без отдельного оповещения.

11. **Сортировка результатов поиска** (решение 2026-09-25; ревизия PO 2026-10-04 заменяет «Фильтры»). Покупатель может
    явно отсортировать результаты по расстоянию, цене и актуальности; для каждого критерия доступны оба направления.
    По умолчанию — актуальность, свежие первыми. Расстояние — явный запрос геолокации; без неё остаётся актуальность.
    Цена сравнивается как номинальная сумма KZT без нормализации единиц. Радиус, цена от–до и фильтры решения
    2026-09-25 отменены. Форму представления определяет Slice Contract. Contracts сортировки не объявляют текущий
    Search финальным: они обязаны быть совместимы с будущей S15B и не цементировать смешивание canonical и title
    fallback.

12. **Актуальность и ИИ — обязательны к запуску сервиса** (решение 2026-09-25): это главные отличия KAIDA, без них
    сервис теряет смысл, и публичный запуск без них не проводится. Актуальность вместе с напоминаниями продавцу
    входит в этап 1 вместе с «Моей витриной»; ИИ-ввод идёт отдельным этапом и **обязателен до запуска** (решение PO: условием запуска является только ИИ-ввод; ИИ-модерация условием запуска не является и остаётся отложенной — до неё действуют ручные требования модерации из п. 5; публикация без модерации не разрешена).
13. **Режим работы точки — обязателен** (решение 2026-09-25). Без режима точку не сохранить; новая точка получает
    режим предыдущей, как контакты, и его можно сразу изменить. В каждой карточке выдачи покупатель видит режим
    одной строкой: `9.00–18.00 | ПТ 13.00–18.00 | СБ ВС` — общие часы, затем дни с другими часами, выходные дни
    зачёркнуты. Цвет по текущему времени точки: **зелёный** — открыто, **оранжевый** — до закрытия час или меньше,
    **красный** — закрыто. По `PROJECT_RULES.md` §18.4 состояние не передаётся только цветом — перед строкой стоит
    значок разной формы для каждого состояния (решение PO: значок, без слова), с текстовым названием для экранных
    дикторов. Режим работы **не меняет** порядок выдачи и не скрывает
    карточки. В макете режима работы нет — нужен кадр дизайнера до контракта.

Все пункты, меняющие закрытые contracts (S3, S5, S10, S12, #36, `seller-cabinet-overview`, `offer-price-unit`),
проходят contract revision по `PROJECT_RULES.md` §4; список открытых технических gaps — brief §21–22.

### AI Input

AI — способ сформировать черновики карточек (Seller Change Set). AI не пишет Offer напрямую: продавец проверяет
черновики и явно отправляет их.

Technology choice is deliberately deferred. `docs/product/AI_TECH_CANDIDATES.md` tracks benchmark candidates, currently
including EmbeddingGemma 2 for local multimodal/semantic Product candidate generation and Jev/System-One-like typed
decision models for shortlist resolution / confidence gates. These are **candidates, not dependencies**. External
providers that process data outside Kazakhstan are production-ineligible unless the data-residency constraint is
satisfied; they may be evaluated only on synthetic/non-production data.

### Search learning

S15 теперь является workstream из трёх частей:

- **S15A Catalog bootstrap** — **CLOSED**: выполнен Production KB v1 (`v0.0.52-production-kb-importer-v1`);
- **S15B Search System revision** — canonical `product_id` primary, catalog suggestions, resolved search отдельно от
  seller-title fallback, known-zero отдельно от unknown;
- **S15C Demand Data Foundation** — D0/D1 и необходимая основа D2, internal/privacy-safe, без seller Demand UI;
  идёт только после стабилизации семантики S15B. Цель отдельного «query log» (старая 6F) входит сюда: события
  фиксируют итоговую canonical / unresolved / zero-result семантику.

**Текущая база каталога:** 682 Products / 210 aliases / 35 categories установлены в KAIDA PostgreSQL (Production KB v1);
runtime не зависит от workbook, corpus или внешней KB. Catalog-backed Seller → Buyer runtime loop закрыт (`v0.0.53-catalog-runtime-loop`); ближайший шаг — S15B, первый кандидат — релевантность и достижимость подсказок каталога. Proof-контракт
(`docs/slices/catalog-runtime-loop/SLICE_CONTRACT.md`), затем S15B.

**Динамические популярные чипы Search Home** — только популярные **canonical Product** чипы, ≤5, готовые к запуску по
readiness-gate (достаточные проверенные D0/D1 данные; числовой порог не задан), пока действуют curated чипы. Сырые и
unresolved запросы автоматически Products не становятся и как чипы не показываются.

Пользовательские query strings не создают Product автоматически:

```text
Query Log
→ matched / unmatched / zero-result analysis
→ controlled Product / alias / Category change
```

#### Initial Product Catalog v0.1 — исторический/редакторский источник (S15A закрыт)

Источник Production KB v1; в runtime не используется и не является будущим bootstrap. Источник: `docs/product/KAIDA.KZ_initial_product_catalog_v0.1.xlsx`. Это редакторский workbook, не migration и не
production seed: 787 candidates, из них 682 `include_v01=YES`, 105 `REVIEW`; RU — canonical/editorial basis, KK —
непроверенный draft. `candidate_code` — временный внешний ключ и никогда не `Product.id`.

Ниже — историческое описание замысла; catalog contract определил staging/validation, merge с существующими Products, stable UUID, localized names, aliases,
collisions, idempotency, rollback/correction и пакетный acceptance report. 682 `YES` — кандидатное RU-ядро: безопасные
строки принимаются пакетом после дедупликации, неоднозначные остаются человеку; 105 `REVIEW` не входят в первый import.
Нельзя считать draft KK verified, ставить `verified_at`, хранить весь каталог в seed или создавать дубли. Category —
полноценная сущность KAIDA; `category_code` workbook проходит явный mapping в простой неглубокий рубрикатор, а не
становится финальной taxonomy автоматически. Отложенная KK proofreading не блокирует RU bootstrap.

#### Search System target

Semantic Product resolution is a future benchmark path, not an automatic replacement for the current catalog/alias/fuzzy
semantics. If existing resolution quality becomes the limiting factor, evaluate the candidate stack in
`docs/product/AI_TECH_CANDIDATES.md` against the current deterministic baseline before adding embeddings, rerankers or
`pgvector`.

`docs/product/SEARCH_SYSTEM_SPEC_v0.1.md` — target product source, не действующий Slice Contract. Перед S15B его нужно
сверить с текущим кодом и closed S0/S6/S7/S9/S13, учесть историю ветки `docs/search-system-spec-v0.1` и оформить
явные contract revisions. Fuzzy применяется только к suggestions; unresolved demand и controlled catalog evolution не
создают Product автоматически.

Решение PO (2026-09-30): generic `buyer_interests` и explicit «Сообщить, когда появится» не объединяются. Demand
различает `поиск/просмотр → интерес → явное ожидание появления`; только последнее означает разрешение уведомить П1.
Техническую модель watch определяет отдельный contract.

### KAIDA Demand

Источник: `docs/product/KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md`; owning backlog — Issue #55. Growth-механизмы G3–G7 из `docs/product/GROWTH_STRATEGY.md` реализуются через этот же Demand workstream (S15C / D0–D5); соответствие определено в Growth Strategy. Demand показывает продавцу
агрегированные opportunities, а не individual buyer events. Demand не меняет organic ranking и не пишет Seller changes
мимо `SellerChangeSet`.

| ID | Capability | Audience / result | Gate |
|---|---|---|---|
| D0 | Search Demand Events | Internal conscious submit events: canonical/unresolved, zero/unmet context, result count, explicit geo only when used | S15B contract + privacy/session/anti-bot rules |
| D1 | Search Learning / Demand Aggregates | Internal matched/unmatched/zero-result canonical/unresolved aggregates and operator validation | D0 production-like data |
| D2 | Availability Watches | Buyer явно выбирает «Сообщить, когда появится»; unresolved может позднее связаться с Product | Separate watch contract; generic interest ≠ watch |
| D3 | Seller Free Demand Signals | Actionable aggregate cards, которые помогают закрывать unmet demand | Valid aggregates + Demand readiness gate |
| D4 | KAIDA Demand | Paid full list, periods, radius, supply and trend | D3 value proof + paid readiness gate |
| D5 | Demand Alerts | Push / digest | D3/D4 + notification policy |
| D6 | Business Demand | Multi-location / city / export | Later evidence and Business model |

Privacy boundary неизменен: sellers не получают user/session IDs, individual events или exact buyer coordinates;
не видят отдельные queries или history конкретного П1. Считаются unique users/privacy-safe anonymous demand sources,
а не raw repeats; редкие cohorts suppressed, geo укрупняется, minimum cohort threshold конфигурируем. До определения
безопасного порога такие группы не попадают в seller-facing Demand. Seller endpoints возвращают только aggregates;
test/demo/bot traffic исключается.

Порядок нельзя смешивать с будущим UI:

```text
instrumentation → production-like accumulation → internal validation → free signals → paid Demand
```

### Media

Seller-provided Offer media и AI media-input — разные capabilities. Настоящие Offer photos принадлежат media workstream; фото/видео как способ распознавания Seller Input относится к AI Input. Исходное видео, из которого ИИ собрал черновики, приватно и не подставляется в публичное видео карточки.

### Market navigation

Market — специализированный spatial container, а не центр архитектуры. Generic Location flow должен продолжать работать независимо от future Market scheme/MarketPlace capability.

### Backlog capabilities, owned by Issues (2026-10-05)

Подробные требования — в Issues; здесь только capability и dependency. Таблица **не меняет execution order**: #75 уже является входным backlog/source requirements для запланированного AI Input S17–S20; остальные строки остаются later / dependency-gated / trigger-gated согласно `EXECUTION_PLAN.md`.

| Capability | Issue | Dependency / trigger |
|---|---|---|
| AI-правила разбора seller input (Product vs Offer-атрибуты, confidence, provenance, дубли, `product_candidate`) | #75 | AI Input S17–S20; Product KB v1 установлен |
| Distance sensitivity товара/категории в ranking | #76 | S15B + D0/D1 данные; без скрытого score под явной сортировкой |
| Price Intelligence (benchmark цены к рынку для покупателя и продавца) | #79 | Product resolution (S15B), сопоставимые единицы/фасовка, накопленные актуальные цены; не в ranking на MVP |
| Группировка товаров продавца по категориям на «Моей витрине» | #54 | Category/каталог, решения PO (чьи категории, видит ли покупатель) |
| Security automation (Trivy/Hadolint, SBOM, SLSA, Semgrep, OSV) | #83 | триггеры в Issue |

### Commercial model / Monetization

Source: `docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`.

Внешняя упаковка — **Free / Pro / Business + отдельный Boost**:

- Free сохраняет полноценную ручную правдивую витрину и organic visibility;
- Pro объединяет `AI + full Demand + Performance`; строить/флагировать компоненты можно отдельно, но продавать Pro —
  только после минимально полезной готовности всех трёх;
- Boost — one-off paid reach конкретного eligible Offer, независимо от Pro;
- Business монетизирует organizational scale, а не просто большое число товаров.

Общая conceptual model:

```text
CommercialAccount → Plan → Entitlements → Limits → Usage → Overrides → BillingState
→ Purchases / PromotionCampaigns → EffectiveEntitlements
```

Она не требует немедленно создавать одноимённые tables. Каждый future slice материализует только нужный minimum.
Commercial checks выполняются server-side; product analytics не являются usage/billing ledger; downgrade не удаляет
данные. Technical/anti-abuse/fair-use limits отделены от commercial limits.

Первая версия фиксирует `1 Seller = 1 CommercialAccount`; Locations Seller используют общий commercial status.
Organization/polymorphic owner не вводятся до отдельного подтверждённого Business slice.

**S25 требует пересмотра:** прежний hard active-Offer cap конфликтует с supply/Search/Demand и не готов к
implementation. Модель «первые N бесплатно, дальше плати» удалена из текущего monetization direction; Free сохраняет
полный вручную поддерживаемый правдивый ассортимент. Вернуться к cap можно только по pilot evidence и новому явному
PO decision. Technical/anti-abuse/fair-use limits остаются допустимыми.

#### Pro chain

```text
AI ready + D4 paid-readiness + Performance instrumentation
→ S26 commercial/effective-access minimum
→ Pro feature gates
→ Billing foundation
→ Pro lifecycle/purchase
```

Внутренние feature flags не превращают частично готовый набор в продаваемый Pro.

#### Demand chain

```text
S15B → S15C D0/D1 + D2 foundation → internal validation → D3 free pilot
→ seller reaction + buyer benefit proof → willingness-to-pay → D4 in Pro
```

Privacy thresholds сильнее entitlement; Pro не превращает неготовые/редкие данные в seller-facing Demand.
Demand не имеет отдельной подписки: D3 actionable signals входят в Free, D4 full Demand — в Pro, D6 multi-location /
aggregated Demand — в Business. Основная IA: `Ещё → Что ищут покупатели`; Showcase показывает только actionable
teasers с CTA.

#### Boost chain

```text
sponsored-surface policy → PromotionCampaign eligibility → Purchase/payment foundation
→ marked Search / Nearby / relevant Discovery delivery → measurement/support
```

Boost не меняет organic Search/Discovery и не обходит actuality, moderation или buyer visibility. `Editorial Featured`
и `Paid Promotion` имеют разные entities, permissions, audit, metrics и removal semantics; Featured нельзя использовать
как shortcut. Boost v1: product/category relevance + geography + limited display period; fixed price/fixed period/
estimated extra reach, без auction/CPC/CPM и без гарантии продаж. Packages/prices/frequency caps/inventory принадлежат
отдельному Boost Product Spec.

#### Business chain

```text
employees/roles → multi-location management → bulk operations + XLS/CSV import
→ cross-location analytics + aggregated Demand → audit/history + higher/custom quotas
→ Business lifecycle → later API / 1C / ERP / integrations
```

Business переиспользует Seller/Location/Offer/Change Set domains, а не создаёт отдельный backend.

S25–S29 сохраняют идентификаторы ради истории, но их прежняя линейная зависимость
`hard cap → subscription → bulk → promotion` больше не является roadmap contract.

### Backoffice

Source: `docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`.

Backoffice — administrative client общего backend/domain. До его IA/UX обязательны:

```text
Requirement Inventory → Operations Map → Roles/Permissions → Domain states/invariants
→ Commercial & Monetization Readiness → MVP/Later → IA/UX → capability-gap audit
→ slice decomposition/dependency graph
```

После этого implementation идёт небольшими operational vertical slices. Первый vertical — **Catalog Operations**:
find Product → open → create/edit → Category/Alias → deactivate → see relations/duplicates → audit. Затем по dependency
audit: Seller/Location/Offer operations; moderation; reports/support; Editorial Featured; commercial read model;
audited Overrides; Promotion operations; Billing support позже. Это не разрешение сделать один mega-slice
`Backoffice`.

Minimum roles: `operator` для Catalog/Seller/Location/Offer, `moderator` для reviews/media, `admin` для roles/config/
critical operations; privileged commercial scope/role добавляется позже. Generic enterprise RBAC заранее не строится.
Editorial Featured ведёт команда KAIDA через Backoffice для «Интересное сегодня», home и market/discovery surfaces;
Seller его не покупает, normal Search sorting оно не меняет. Commercial Override ограничен entitlement/limit,
обязательными reason/actor/expiry/audit и default maximum duration 30 дней.

## MVP boundary

MVP должен доказать три цикла:

```text
Seller loop:
Seller сообщает / подтверждает → Offer актуален

Buyer pull loop:
Buyer ищет → находит → связывается с Seller

Buyer discovery loop:
Buyer открывает KAIDA → видит актуальные Offers рядом / по интересу
```

Точная readiness к MVP/public beta определяется отдельным boundary review после committed core contour, а не номером
строки в Feature Map.

Рядом с stage 11 проводится отдельный **Demand readiness assessment**; он не обязан блокировать сам MVP. Проверяются:
production-like traffic без test/demo/bot, качество canonical resolution и unresolved pipeline, explicit watches,
privacy-usable aggregates, соответствие supply buyer-visible reality и наличие actionable gaps. D3/D4 открываются
только по собственным gates. Для D3 заранее измеряется цепочка `signal → seller reaction → Product added/activated →
buyer-visible Offer → unmet demand received supply`; численные критерии назначаются после реального трафика. D4 требует
как доказанной ценности этой цепочки, так и отдельного willingness-to-pay evidence.
