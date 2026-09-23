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

## Core domain

Основные понятия MVP:

- `User` — учётная запись;
- `Seller` — профиль продавца;
- `Location` — физическая торговая точка;
- `Category` — каталог/navigation grouping;
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
| S15 | Search learning | Оператор анализирует matched/unmatched/zero-result queries | S6, S7 | MVP | PLANNED |
| S16 | Operations | Оператор может отключить ошибочный Offer/Seller | S7 | MVP / public beta | PLANNED |
| S17 | AI Input | Свободный текст предлагает Seller Change Set | S12 | После MVP | PLANNED |
| S18 | AI Input | Voice предлагает Seller Change Set | S17 | После MVP | PLANNED |
| S19 | AI Input | Photo input предлагает Seller Change Set | S17 | После MVP | PLANNED |
| S20 | AI Input | Video input предлагает batch Change Set | S17, S12 | После MVP | PLANNED |
| S21 | Input channels | Telegram использует ту же seller-input logic | S17 | После MVP | PLANNED |
| S22 | Auth | Test OTP заменяется real SMS delivery | S2 | До публичного запуска | PLANNED |
| S23 | Notifications | Buyer получает уведомление о новом Offer интересующего Product | S14 | После MVP | PLANNED |
| S24 | Recommendations | Детерминированная personalized feed без ML | S14 + data | После MVP | PLANNED |
| S25 | Monetization | Policy ограничивает active Offers | S5 | После MVP | PLANNED |
| S26 | Subscription | Subscription меняет лимиты/возможности Seller | S25 | После MVP | PLANNED |
| S27 | Convenience | Paid plan открывает ускоренный bulk input | S20, S26 | После MVP | PLANNED |
| S28 | Promotion | Seller создаёт promotion для Offer | S9 | После MVP | PLANNED |
| S29 | Promotion | Promoted Offer получает маркированный дополнительный охват | S28 | После MVP | PLANNED |
| S30 | Recommendations | Behavioral ranking учитывает реальные interactions | S24 + data | Позднее | PLANNED |
| S31 | Discovery | Редкость товара влияет на показ | data | Позднее | PLANNED |
| S32 | Trust | Автомодерация выявляет подозрительные Offers | data | Позднее | PLANNED |
| S33 | Seller analytics | Seller видит показы/контакты/эффективность продвижения | S28–S29 | Позднее | PLANNED |

## Inserted / cross-cutting capabilities

После S13 появились важные workstreams, которые не следует искусственно перенумеровывать задним числом. Их текущая позиция определяется `EXECUTION_PLAN.md`, а detailed requirements — Issues / Slice Contracts.

К ним относятся, среди прочего:

- Seller contextual entry/auth;
- card-based multiple trading points;
- Seller Offer Workspace;
- mandatory Offer price;
- Seller freshness degradation and reminders;
- explicit Search sorting / visible proximity;
- real Offer media (M1);
- complete Russian/Kazakh localization with a global `Русский / Қазақша` switch;
- KAIDA-owned address directory built on open data (OpenStreetMap) for Location address suggestions;
- Market internal navigation as future spatial capability.

Наличие capability в этом разделе **не означает**, что её можно начать вне текущей очереди.

## Stable capability principles

### Russian / Kazakh localization

KAIDA is a bilingual product. Every KAIDA-owned user-facing string must exist in Russian and Kazakh: navigation, headings, buttons, hints, validation, errors, empty/loading/offline states, statuses, confirmation text, auth, accessibility labels, metadata and other system copy.

The shared app shell provides a visible `Русский / Қазақша` switch for anonymous buyers, authenticated buyers and Sellers. The selected language applies consistently across buyer and seller routes and survives navigation and reload on the same device.

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

Storage shape (separate table or otherwise) is decided inside the localization Slice Contract, not here. Per §10.1 of `PROJECT_RULES.md`, the translation provider is an improvement over a working path, never a required dependency of seller or buyer flows.

No UI slice is complete if its changed user-facing surface works in only one supported language. Exact locale storage, URL strategy, fallback behavior and seller-authored content translation belong to the localization Slice Contract and must not fragment across individual screens.

### Offer price unit

Единица измерения — controlled choice с коротким закреплённым списком и вариантом `Другое` со свободным вводом (Product Owner decision, 2026-09-23). Свободный ввод как основной механизм не используется: он быстро порождает несовместимые варианты одного и того же значения (`кг`, `килограмм`, `кг.`, `за кг`).

Первый список: `кг`, `шт`, `л`, `упак.`, `другое`.

`100 г`, `500 г`, `1,5 кг` и подобное — **не** единицы измерения, а количество или размер упаковки. Если такая потребность появится, она моделируется отдельной сущностью, а не растворяется в поле единицы.

Wireframe может показывать этот controlled choice, но production implementation требует contract decision о canonical
codes (`kg`, `piece`, `liter`, `package`, `other` либо эквивалент), локализованном display, legacy free-text values и
семантике `Другое`. Хранить только русские labels как новые canonical values нельзя: это конфликтует с RU/KZ
presentation. Существующий nullable/free-text API не меняется молча внутри UI slice.

### KAIDA address directory

Подсказки адреса при создании торговой точки строятся на собственном справочнике KAIDA поверх открытых данных (в первую очередь OpenStreetMap), размещённом внутри системы. Внешний платный геокодер не подключается — см. `PROJECT_RULES.md` §10.1.

Сценарий: продавец вводит адрес → KAIDA предлагает варианты из своего справочника → выбор даёт `addressText` и координаты. Обязателен видимый путь `Ввести вручную`; для ручного адреса координаты задаются существующим действием «я на точке» (browser geolocation) или вставкой ссылки на карту, когда этот механизм будет реализован.

Справочник — отдельная capability со своим slice: импорт и обновление открытых данных, хранение, поиск с опечатками. Перед его планированием отдельно проверяются фактическое покрытие адресов Алматы, licence/attribution requirements выбранного источника, update cadence и operational стоимость собственного hosting/index. Недостаточное покрытие или временная недоступность справочника не ломают сценарий — ручной ввод остаётся полноценным путём, а не аварийным.

### Seller freshness

KAIDA ценен тем, что Offer подтверждается продавцом как актуальный. Точные thresholds и reminder cadence задаются отдельными contracts; Feature Map не дублирует текущую policy.

### AI Input

AI — способ сформировать Seller Change Set. AI не пишет Offer напрямую.

### Search learning

Пользовательские query strings не создают Product автоматически:

```text
Query Log
→ matched / unmatched / zero-result analysis
→ controlled Product / alias / Category change
```

### Media

Seller-provided Offer media и AI media-input — разные capabilities. Настоящие Offer photos принадлежат media workstream; фото/видео как способ распознавания Seller Input относится к AI Input.

### Market navigation

Market — специализированный spatial container, а не центр архитектуры. Generic Location flow должен продолжать работать независимо от future Market scheme/MarketPlace capability.

### Monetization

Volume limits, convenience and promotion/reach — независимые axes. Promotion не должен обходить organic relevance/freshness eligibility.

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

Точная readiness к MVP/public beta определяется отдельным boundary review после committed core contour, а не номером строки в Feature Map.
