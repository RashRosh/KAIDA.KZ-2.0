# UX1B — Marketplace Offer Cards

Status: APPROVED

Base checkpoint: `v0.0.15-ux1a`

Base verified `main`: `0c19cfde3d0288bea4541e9d748a9cd0c4fdb1ea`

## 1. User task

Покупатель выполняет Search или открывает Nearby и получает плотную, быстро сканируемую marketplace-ленту предложений: товар, цена, место покупки и доступные действия читаются сразу, без больших декоративных пустот.

## 2. Scope

- Переработать общий buyer-facing `OfferCard`, используя только уже существующие данные и действия.
- Сделать визуальную иерархию карточки плотнее и яснее.
- Product и price сделать первичными.
- Location + address и уже существующий optional distance поставить визуально выше Seller.
- Seller, seller comment, Interests и Contacts оставить вторичными, но доступными.
- Buyer Search/Home увести от landing-page композиции с большим hero/пустым пространством к рабочему search/feed интерфейсу.
- Nearby после получения результатов использует ту же marketplace-систему карточек.
- Обеспечить адаптивную плотную композицию на mobile и desktop.
- Соблюдать текущую Design System: Roboto, spacing/colors, радиусы 8/12/16/20 px, header 84/104 px.
- Добавить только необходимые UI/E2E/docs изменения.

Количество колонок на desktop не является contract: это presentation decision при сохранении читаемости, плотности и responsive behavior.

## 3. Explicit out of scope

- Фото/видео, media model, upload, storage, lifecycle.
- Fake thumbnail, placeholder или зарезервированный media slot.
- Product image/icon.
- Freshness UI, если для него нужны новые данные/API.
- UX1C: изменение Nearby flow, автогеолокация, устранение дополнительного действия.
- UX2 seller onboarding/forms.
- M1/M2.
- S14 personalization.
- Reviews/Rating.
- Изменение Search matching, eligibility, lifecycle или ranking.
- Изменение Nearby radius, eligibility, sorting или privacy.
- Изменение Interest semantics.
- Изменение Contact semantics, hrefs или порядка действий.
- Filters, categories, pagination, infinite scroll.
- DB, migrations, public API.
- Геометрия UX1A header/navigation.
- Seller/domain refactors.

## 4. Closed contracts used

- S0 / S7 Search.
- S1 Offer lifecycle.
- S8 / S9 geo + Search ranking.
- S10 Contacts.
- S11 Nearby Discovery.
- S13 Interests.
- UX1A shared app shell/navigation.

## 5. Closed contracts potentially touched

Только presentation surfaces S0/S7/S9/S10/S11/S13/UX1A.

Обязаны сохраниться:

- Search request/result semantics и существующие validation/loading/error/status semantics.
- Search composition/order contract.
- Explicit geolocation and privacy behavior.
- Contact availability, labels, targets and order.
- Interest states, texts and ARIA semantics.
- Price formatting и exact fallback `Цена не указана`.
- UX1A header/navigation geometry and routes.

Если для UX1B потребуется новое поле, API или business rule, implementation STOP до отдельного изменения contract.

## 6. Risk flags

- DB migration: NO.
- Public API: NO.
- Auth/security/privacy: NO new risk; existing behavior must be preserved.
- Concurrency/atomicity: NO.
- Data loss: NO.
- External service: NO.
- Реальный дополнительный risk: responsive/accessibility/UI regression.

## 7. Expected modules

Ожидаются изменения только в:

- shared Buyer OfferCard presentation;
- Buyer Search/Home layout;
- Nearby result presentation через тот же OfferCard;
- buyer/shared styles и только действительно нужные tokens;
- targeted UX1B E2E;
- UX1B docs/backlog status.

Не ожидаются изменения domain/application/repository/API/DB/Identity/Seller Input/seller management.

## 8. Acceptance criteria

1. Search results визуально воспринимаются как рабочая marketplace-лента: search controls и feed являются основной композицией, без большого независимого hero на desktop.
2. Nearby после появления результатов использует ту же визуальную систему карточек, а текущий geo flow не меняется.
3. Карточка использует только реальные текущие данные. Fake media и зарезервированная media geometry отсутствуют.
4. Иерархия существующих данных читается как `Product → price → Location/address + existing distance when present → Seller → comment → actions`.
5. Price formatting не меняется; при отсутствии цены выводится exact `Цена не указана`.
6. Interest и Contact actions остаются отдельными controls с текущими texts/semantics; touch target не меньше 44×44 px; вся карточка не становится одной большой ссылкой.
7. Design System соблюдена: Roboto, system spacing/colors, card radius 16 px, системные радиусы controls, border как основной способ отделения карточки; decorative shadow не обязателен.
8. Высота карточки определяется контентом; нет fixed/min-height, созданного ради будущего media.
9. Responsive работает на representative widths 360/390/768/1024/1440 и минимум 320 px без horizontal page scroll.
10. Search validation/loading/error/status ARIA, Nearby privacy, Interests, Contacts и UX1A header 84/104 px продолжают выполнять закрытые contracts.

## 9. Automated test plan

Новые unit/integration/DB/migration/concurrency/security tests не требуются.

Targeted UX1B E2E должны доказать:

- Search result presentation на mobile и desktop;
- отсутствие horizontal overflow;
- rendering реальных полей без invented media;
- одна и та же card presentation в Search и Nearby;
- существующие Interest/Contact controls остаются доступными;
- Nearby не запрашивает geolocation автоматически;
- UX1A shell/header остаётся неизменным.

Targeted regression: Search, S10 Contacts, S11 Nearby, S13 Interests, UX1A shell.

Для TSX/CSS обязательны lint/typecheck/build, затем один полный branch CI на финальном executable SHA. Exact-SHA rerun не требуется без признаков flaky/nondeterminism.

## 10. Manual acceptance scenario

1. Mobile около 390 px: выполнить Search с несколькими Offers. Убедиться, что feed плотный, первая карточка естественно следует за поиском, Product/price/location читаются быстро, actions удобны, media block отсутствует.
2. Desktop около 1440 px: убедиться, что нет landing-like большого пустого hero, Offers образуют нормальный рабочий feed, horizontal overflow отсутствует.
3. Nearby: до явного текущего действия геолокация не запрашивается; после получения результатов используется та же card system с существующим distance и без изменения flow.
4. Визуально подтвердить Roboto, радиусы Design System и отсутствие изменений UX1A header/navigation.
