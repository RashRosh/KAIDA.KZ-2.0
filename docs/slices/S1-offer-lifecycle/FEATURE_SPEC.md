# S1 — Offer Lifecycle / актуальность предложения

## Статус документа

Feature Spec для проектирования S1. Реализация S1 этим документом не начинается.

## Пользовательская задача

П1 не должен видеть предложение, которое больше не считается актуальным.

Если Offer давно не подтверждался или переведён в неактивное состояние, он перестаёт попадать в Search выдачу.

## Definition of User Value

После S1 KAIDA.KZ показывает покупателю только Offers, которые одновременно:

- активны;
- были подтверждены достаточно недавно по текущей политике актуальности.

Просроченные данные не загрязняют выдачу.

## Базовая модель S1

В S1 у Offer появляются только два lifecycle-поля:

- `status`: `active | inactive`;
- `last_confirmed_at`: момент последнего подтверждения актуальности.

`expires_at` в S1 не существует.

Offer видим, если одновременно выполняется:

`status = active AND last_confirmed_at > current_time - offer_validity_period`

Где `offer_validity_period` является конфигурационным параметром и не хранится в Offer.

### Boundary

Если:

`last_confirmed_at == current_time - offer_validity_period`

Offer уже считается просроченным и не показывается.

Следовательно, сравнение строгое: `last_confirmed_at > cutoff`.

## Политика срока актуальности

Финальное продуктовое значение срока актуальности в S1 не утверждается.

Для разработки допускается технический default 7 дней, то есть 168 часов.

Это не продуктовая политика и должно быть явно отражено в конфигурации/документации.

Период должен меняться без:

- migration;
- изменения модели Offer;
- изменения публичного Search API.

## Scope

В S1 входят:

- отдельная migration поверх S0 schema;
- `status` в Offer;
- `last_confirmed_at` в Offer;
- конфигурационный `offer_validity_period`;
- единый тестируемый источник текущего времени для lifecycle-решения;
- вычисление cutoff;
- фильтрация Search по `status` и `last_confirmed_at`;
- backfill lifecycle-полей для существующих S0 Offers;
- обновление seed так, чтобы тестовые `баранина` и `говядина` после обычного запуска оставались актуальными;
- автоматические lifecycle tests;
- regression всех сценариев S0;
- manual acceptance через существующий Search UI.

## Search behaviour

Все правила поиска S0 сохраняются.

Search по-прежнему:

1. валидирует и нормализует query по правилам S0;
2. находит Product exact-match без учёта регистра;
3. возвращает только видимые Offers.

Offer попадает в результат только если:

- `status = active`;
- `last_confirmed_at > cutoff`.

Просроченный или inactive Offer для П1 ведёт себя как отсутствующий Offer.

Если Product существует, но все его Offers невидимы, результат остаётся обычным успешным ответом:

`HTTP 200` + `offers: []`.

UI показывает существующий empty state.

## Public API

Публичный контракт S0 не меняется:

`GET /api/search?q=<query>`

Lifecycle-поля не добавляются в Search response.

Новые lifecycle endpoints в S1 не создаются.

## `inactive` в S1

`inactive` является только состоянием модели и дополнительным фильтром Search.

Пользовательского способа выключить Offer в S1 нет.

Seller UI, Seller Change Set и деактивация Offer пользователем относятся к последующим slices, в частности к S5.

## Источник времени

Lifecycle-решение не должно зависеть от реального ожидания времени в тестах.

Требования:

- текущий момент захватывается единообразно;
- источник времени можно подменить в автоматических тестах;
- один Search operation использует одно значение `current_time`;
- не использовать `sleep`, polling или ожидание фактического истечения периода;
- runtime Search не должен получать разные значения `now` на разных этапах одного решения об актуальности.

Точное внутреннее устройство фиксируется в migration/model contract.

## Migration requirement

S1 является эволюцией S0, а не переписыванием исходной schema.

Migration S0 не изменяется.

S1 migration должна:

- применяться поверх существующей S0 database;
- сохранять существующие Product, Seller, Location и Offer rows;
- заполнить lifecycle-поля существующим Offers;
- после upgrade оставить существующие S0 Offers видимыми;
- применяться в полной последовательности migrations на чистой PostgreSQL 18 database;
- не добавлять `expires_at`.

Точный порядок backfill и constraints описывается отдельно в `MIGRATION_MODEL_CONTRACT.md`.

## Seed contract

После обычного запуска migration + seed:

- `баранина` находится;
- `говядина` находится;
- оба seed Offers имеют `status = active`;
- оба seed Offers имеют достаточно свежий `last_confirmed_at`, чтобы быть видимыми при текущем configured validity period.

Seed не должен требовать ручного редактирования дат после запуска.

В тестах время seed должно быть управляемым, чтобы проверки оставались детерминированными без `sleep`.

## Out of Scope

В S1 не входят:

- `expires_at`;
- Seller UI;
- создание Offer пользователем;
- редактирование Offer пользователем;
- Seller Change Set;
- Seller Change Item;
- Seller Input;
- кнопка подтверждения актуальности;
- ручное продление Offer через UI/API;
- пользовательская деактивация Offer;
- lifecycle CRUD API;
- временный test-only lifecycle API;
- cron;
- scheduler;
- background jobs;
- уведомления продавцу;
- freshness score;
- ranking по freshness;
- Category;
- aliases/synonyms;
- geo;
- Discovery;
- auth;
- AI;
- Telegram;
- moderation;
- admin;
- promotion;
- monetization.

## Acceptance Criteria

S1 принимается только если одновременно выполнены следующие критерии.

### A. Модель и migration

1. В `offers` существуют `status` и `last_confirmed_at`.
2. В модели и schema отсутствует `expires_at`.
3. `status` допускает только `active` и `inactive`.
4. `status` обязателен для каждой Offer row после завершения migration.
5. `last_confirmed_at` обязателен для каждой Offer row после завершения migration.
6. Migration успешно применяется поверх S0 schema с существующими seed Offers.
7. Existing S0 Offers после upgrade получают `status = active`.
8. Existing S0 Offers после upgrade получают backfilled `last_confirmed_at`, который сохраняет их видимыми сразу после migration.
9. Migration не удаляет и не пересоздаёт S0 Offers ради backfill.
10. Полная цепочка migrations успешно поднимает clean PostgreSQL 18 database.

### B. Lifecycle semantics

11. Active Offer с `last_confirmed_at > cutoff` показывается.
12. Active Offer с `last_confirmed_at < cutoff` не показывается.
13. Active Offer с `last_confirmed_at == cutoff` не показывается.
14. Inactive Offer не показывается, даже если `last_confirmed_at > cutoff`.
15. Изменение конфигурационного validity period меняет cutoff без migration и без изменения Offer rows.
16. Технический default периода явно маркирован как временный, а не как утверждённая продуктовая политика.

### C. Время и тестируемость

17. Lifecycle tests не используют `sleep` или реальные ожидания истечения времени.
18. Тест может задать фиксированный `current_time` и получить детерминированный результат.
19. Один Search operation использует одно зафиксированное значение `current_time` для вычисления cutoff.

### D. Search и API regression

20. Публичная форма успешного Search response S0 не меняется.
21. Lifecycle-поля не появляются в публичном Search response.
22. `баранина` после обычного seed находится с существующей ценой и данными.
23. `говядина` после обычного seed находится и продолжает показывать `Цена не указана`.
24. `единорог` продолжает возвращать empty state.
25. Пустой query продолжает давать validation error S0.
26. Case-insensitive exact search и trim продолжают работать.
27. Если Product существует, но его Offer просрочен, API отвечает `200` и `offers: []`.
28. Если Product существует, но его Offer inactive, API отвечает `200` и `offers: []`.
29. Не создаётся новый lifecycle API ради тестов или manual acceptance.

### E. Seed

30. Обычный seed делает `баранина` и `говядина` актуальными относительно текущего configured validity period.
31. Test seed может использовать фиксированное время и остаётся воспроизводимым.
32. Seed не очищает пользовательские таблицы целиком и сохраняет ограниченный scope S0/S1 test data.

### F. Verification

33. Новые lifecycle unit/integration tests проходят.
34. Все существующие S0 unit/integration tests проходят либо обновлены только там, где S1 намеренно изменяет внутреннюю lifecycle-модель.
35. Production build проходит.
36. Playwright E2E проходит на mobile и desktop.
37. Полный regression/`verify` проходит.
38. Migration проверена и как upgrade S0 → S1, и как часть clean migration chain.
39. Manual acceptance пройдена через реальный UI.
40. После завершения S1 рабочая версия зафиксирована отдельным Git checkpoint только после полного verification.

## Manual Acceptance

Manual acceptance выполняется одним проходом через существующий Search UI.

Минимально проверить:

1. обычный seed;
2. `баранина` видна;
3. `говядина` видна;
4. техническим setup-способом сделать Offer `баранина` просроченным через изменение `last_confirmed_at`;
5. повторить поиск и убедиться, что Offer исчез;
6. техническим setup-способом вернуть свежий `last_confirmed_at` и убедиться, что Offer снова виден;
7. техническим setup-способом поставить `status = inactive` и убедиться, что Offer исчез;
8. вернуть `status = active`;
9. проверить `единорог`;
10. проверить пустой query;
11. пройти основной сценарий на mobile;
12. пройти основной сценарий на desktop.

Для manual setup разрешено прямое техническое изменение тестовых данных штатным DB/setup способом.

Не создавать временный lifecycle endpoint, Seller UI или admin UI ради приёмки.

## Definition of Done

S1 готов только после того, как:

- Feature Spec и model/migration contract соблюдены;
- migration безопасно эволюционирует S0;
- lifecycle filter работает на реальной PostgreSQL 18;
- boundary `last_confirmed_at == cutoff` проверен;
- seed Offers остаются видимыми;
- публичный Search API S0 не изменён;
- весь regression suite S0 зелёный;
- новые тесты зелёные;
- production build зелёный;
- mobile и desktop E2E зелёные;
- manual acceptance фактически выполнена;
- нет реализации S2+.
