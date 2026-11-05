# D2 — Цельная выдача поиска по новому дизайну

Редакция PO 2026-11-05 после отклонения menu-only и частичного переноса. Это единственный действующий контракт D2; прежние исключения hearts/4nav и сохранение chips/hours в выдаче отменены поручением переделать экран по предоставленным B03/B04. Приёмки PO пока нет. /welcome полностью отложен, стрелка при вводе сохранена.

## User task и scope

Покупатель находит предложение, сравнивает цену, место и давность подтверждения, меняет порядок, сохраняет конкретное предложение или открывает его/связь/маршрут. Мигрируется начатый Search: шапка, count/sort, карточки, loading, correction, error/retry, empty/geo notice, четыре существующих назначения навигации. Authority — два Artifact в [baseline](../../product/DESIGN_BASELINE.md); конкретные B03-Results, B03-Sort, B04-Empty. Модули: buyer presentation, общий существующий favourites hook, совместимое расширение Search DTO.

## Explicit out of scope

Search Home, First Entry, Nearby/Offer/Favourites/Seller/Operator целиком не мигрируются. Home сохраняет пять быстрых запросов; часы остаются на Offer. Нет новых доменных функций, geo-dialog, offline/cache, dark theme, изменения ranking/expiry/price/контактов. Иллюстрации и демонстрационные числа не подменяют реальные Offer. Desktop — адаптация одного списка до720px; отсутствующий desktop кадр не объявляется проверенным источником.

## Пересмотр визуальных ограничений и закрытые contracts

Начатая выдача не содержит chips и hours line; четыре nav destinations включают существующий /favourites; hearts вызывают существующие auth/save/remove/retry/privacy flows. Адрес с продавцом — caption13/18 в rem, одна строка с ellipsis, полный текст остаётся в DOM/title и подробностях. Точка — dark medium14/20. Эти явно описанные визуальные изменения заменяют прежние prescriptions, вызвавшие расхождения с экраном PO; полнота данных и масштабируемость проверяются отдельно.

Search/typed/Product/last-state/Back, направления сортировки, conscious-submit analytics, explicit geo intent, verified-only contacts, routeAvailable, номинальная цена/упаковка, приватность избранного и server-side eligibility сохраняются. При ошибке запроса прежняя выдача очищается по закрытому S0: дизайн с сохранёнными offline данными не внедряется без отдельной ревизии поведения. Геолокация запрашивается существующим явным выбором расстояния; дополнительный диалог B04.ST05 не вводится. Новый продуктовый конфликт требует STOP с объяснением.

SearchOffer получает optional lastConfirmedAt ISO из существующего offers.last_confirmed_at, уже публичного в BuyerOffer. Старые days/ageing остаются; клиенты/fixtures без нового поля валидны. Точные минуты/часы не выводятся из целых дней. Это additive public metadata, не новая lifecycle policy.

## Risk flags

| Flag | Есть | Проверка |
|---|---|---|
| Public API | да | Timestamp соответствует БД, optional schema; прежние поля/границы privacy не меняются |
| Auth/security/privacy | да | Новый вход в существующее избранное: guest cancel/focus, login/save/remove/retry/logout; один load на экран, защита от поздних session responses |
| DB migration | нет | Миграции/таблицы не меняются |
| Concurrency/atomicity | нет новых | Переиспользуются busy/epoch/server eligibility существующего hook |
| Data loss | нет | Изменение представления, synthetic fixture только в изолированной preview DB |
| External service | нет новых | Старые контактные ссылки; тесты не связываются с продавцами |

## Acceptance criteria

1. B03: search52, padding16, gap10, cards radius14/photo104; title Roboto40015/20, price Geologica70022/26, basis13/18, point50014/20, address13/18; footer44 и четыре nav. Цвета/SVG paths берутся из нового источника.
2. Сердце находится в правом верхнем углу фото; сохранение/удаление/ошибка/повтор/вход работают без открытия Offer. После выхода чужие сохранения не видны.
3. Давность использует реальное время подтверждения, минуты/часы/дни и пятицветную шкалу источника, со значком и доступным именем. Eligibility/ranking не зависят от новой визуальной шкалы.
4. Count и sort в одной области, trigger с funnel/chevron и счётчик «Найдено N» одинаковы во всех состояниях (решение PO 2026-11-05: отдельный denied variant B04 с outline/up-down и «Найдено N предложений» не используется). Меню56px, enter/exit120ms с исходными кривыми; focus/Escape/outside/reopen/reduced-motion работают.
5. B04 denied notice над toolbar, заголовок/текст/Retry соответствуют источнику; запрос geo только по действию пользователя. Кнопка маршрута показывает расстояние только при наличии текущего distanceMeters, иначе «Маршрут».
6. Loading повторяет форму B03 skeletons; correction над toolbar и ссылка typed-search сохраняет смысл/URL; error/empty сохраняют закрытые действия, честно отделяя адаптации поведения от визуального совпадения.
7. Offer/Back, повторный запрос, сортировка, цены/упаковка и verified contacts сохраняют прежнюю бизнес-логику; прямое действие не открывает карточку.
8. Нет горизонтального overflow на320/360/390/768/1440; при200% текста caption масштабируется, полные where данные доступны, действия остаются44px. Shared defaults вне начатого Search не меняются.
9. До показа PO агент сравнивает реализацию с соответствующим состоянием источника на одинаковой CSS ширине/данных, проверяет computed sizes и сохраняет screenshots/report. Зелёный CI не заменяет визуальную проверку.

## Verification и manual acceptance

Targeted: source-parity/state captures, sort/geo, Home/Back/typed, price/hours/contacts/readability, настоящая mutation/auth/privacy избранного и timestamp integration. Затем полный unit/integration/E2E, lint/types/build, branch CI, diff audit. Повторы только после failure/изменения. [Visual review](VISUAL_REVIEW.md) содержит реальные пределы соответствия.

PO принимает цельный сценарий: открыть выдачу → сравнить карточки с B03 → сохранить/убрать → сортировка и направление/default → Offer/Back → пустая выдача/ошибка geo. Проверка агента не является manual acceptance PO. До приёмки и поручения PO нет merge/tag; следующий slice не начинается. Полное исследование всех87/91 материалов и миграция всего приложения не заявляются завершёнными.
