# D2 — Цельная выдача поиска по новому дизайну

Поручение PO 2026-11-05: продолжать цельными экранами без приёмки отдельных элементов. Первая menu-only попытка не принята как недостаточно заметная; scope пересмотрен в той же ветке/PR207. Не checkpoint. /welcome целиком отложен.

## User task / scope

Покупатель находит предложение, сравнивает цену/место/актуальность, меняет порядок и открывает предложение или связь. Переносится начатый Search B03–B06: шапка, существующие chips, count/sort, список/карточки, loading, validation/error/retry, correction, empty/geo notice и оформление существующей навигации. Модули: только buyer presentation и локальный CSS; shared helpers получают optional presentation hooks, прежние вызовы сохраняются.

Sources: два Artifact из DESIGN_BASELINE.md. B03-Results.dc.html версии1793830896-9a07 непосредственно прочитан (DOM/CSS), осмотрен и сохранён в локальном verification-evidence/B03-Results-current-source.html; B03-Sort и B04 empty прочитаны ранее. Система: tokens/motion/Menu. B03: search52px, padding16, gap10, cards radius14, фото104, title Roboto400 15/20, price Geologica700 22/26, footer border/actions44. Menu: rows56, radius14, padding6, text15/22, enter/exit120ms, exact ease-out/in; reduced motion отключает движение.

## Explicit out of scope / совместимость

Search Home, First Entry, Nearby/Offer/Seller/Operator не мигрируются. Не добавляются heart, четвёртый nav item, geo-dialog, новые функции, dark theme, offline/cache, данные/thresholds из иллюстраций. Реальные photos/data не заменяются нарисованными помидорами. Сохраняются пять chips после поиска, три существующих nav destinations, часы работы, полные scalable where-lines14/20 и текущая семантика свежести/geo. Системный max1200 не означает растянуть читаемый список: desktop single column720 — адаптация без отсутствующего desktop кадра.

## Closed contracts / risk flags

Сохраняются search-sort-control-refresh/rev3, search-home-last-state, search-known-zero, typo-correction, buyer-readability, card-price-packaging/opening-hours, UX1D, Search/Product/typed/last-state и D0. Ранжирование, nominal prices, actual sort directions, explicit geo intent, routeAvailable/verified contacts, URLs, доступные имена и privacy не меняются. Новое оформление заменяет только прежние visual prescriptions. Стрелка меню показывает применяемое направление, trigger — текущее. При ином конфликте поведения — STOP.

DB migration/public API/auth/concurrency/data loss/external service: все false — API/domain/DB и внешние flows не меняются. UI lifecycle риска menu exit/reopen проверяется targeted E2E.

## Acceptance criteria

1. Вся начатая выдача использует новый фон, шапку, шрифты, cards/footer/nav treatment, включая отсутствие фото.
2. Цена/название/точка/адрес из прежнего SearchResponse; where-lines сохраняют полноту, scalable14/20 и contrast.
3. Count и sort в одной области; trigger и меню остаются в viewport320, поддерживают направления/focus/Escape/outside/reopen/reduced motion.
4. Card открывает прежний Offer; контакты и route сохраняют URL, verified-only и routeAvailable; отдельное действие не открывает card.
5. Loading/error/retry/empty/correction/geo notice сохраняют существующие действия/тексты RU/KK и получают новое оформление.
6. Query/Product/typed/last Search/Back/chips/geo intent сохраняются; API/domain/DB diff отсутствует.
7. На320/390/768/1440 нет horizontal overflow; 200% text не теряет where-lines/actions; desktop остаётся single list.
8. Search Home, /welcome, Nearby/Offer/Seller/Operator не получают новые стили через shared helpers.

## Verification / manual

Targeted existing search/sort/home/empty/correction/readability/price/hours/contacts E2E. Затем full unit/integration/E2E, lint/types/build и branch CI на итоговый runtime. Повтор только по failure/новому diff. Manual PO: запрос → сравнить карточки → sort/reverse/default → Offer/Back → другой запрос/empty. Agent visual review и PO acceptance раздельно. Diff audit: scoped CSS, presentation only, отсутствие API/domain/DB changes. No merge/tag до приёмки и поручения PO.

Evidence menu-only head fe47e05: full CI41932227244 PASS; не доказательство новой ревизии. Новый runtime verification IN PROGRESS. Первый targeted42:41PASS, menu320 fails; исправлено выравнивание справа при переносе. Root cause локальной нестабильности продавца в прежнем полном прогоне не установлен, соседние код/тесты не менялись. Новая PO acceptance отсутствует. Полный аудит87/91 источников не завершён и не заявляется.
