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
- Market internal navigation as future spatial capability.

Наличие capability в этом разделе **не означает**, что её можно начать вне текущей очереди.

## Stable capability principles

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
