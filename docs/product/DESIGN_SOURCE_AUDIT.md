# Аудит новых визуальных источников — 2026-11-05

Это evidence исследования, не второй план работ и не новый визуальный стандарт. Authority — [DESIGN_BASELINE.md](DESIGN_BASELINE.md), очередь — Execution Plan.

## Фактически прочитано

- Оба исходных Artifact открыты в авторизованном Chrome пользователя, без подмены старыми скриншотами.
- Холст: перечень всех 87 досок; матрица Z2 и лист Z1. Полностью прочитаны состояния досок 1–9 (B01/B02, выдача, меню/geo/error, пустые состояния, обе Nearby, обе offer details и heart states). Для B01–B02 и B03–B04 осмотрены screenshots. Из первоначально доступного DOM также прочитаны O03–O06; отдельная полная визуальная проверка этих досок не заявляется.
- Система: полный Overview/README, motion.md, manifest.json, tokens.json (семейства type/spacing/radius/shadow/size/breakpoint/duration/zIndex, светлые семантические цвета), Menu README и его preview source, часть bundle.css. Названия/usage токенов прочитаны из отрисованного файла, не угаданы по текущему коду.
- Отдельно для D2: DOM, inline sizes, computed styles, SVG paths и motion curve B03-Sort.dc.html. Проверены в реализации фактические font 15/22, selected 700, min-height 56, radius 14, surface и cubic-bezier. Найден и устранён cascade старого `.kaida button { font: inherit }`; общий CSS не менялся.

**Не завершено:** остальные buyer/auth/seller доски, полный поэкранный визуальный и интерактивный аудит, все component previews/source files и assets/licences. Не считать перечень 87/91 доказательством просмотра всего содержимого. Доступ через UI периодически завершается таймаутом; скачивание manifest через Download не дало пригодного локального экспорта. Состояния непроверенных досок не реализовывать по памяти или старым экспортам.

## Сопоставление и границы

| Новый источник | Текущий код / закрытый contract | Вывод |
|---|---|---|
| B01 без nav, постоянная кнопка и одна demo card | First Entry требует nav, conditional arrow и двухкарточную сцену | PO отложил весь экран; conditional arrow сохранить. D1 не реализуется. |
| B02 «Продолжить» и 7 chips | Search Home восстанавливает выдачу автоматически и ограничивает curated chips пятью | Отдельная проверка поведения перед этим slice; не менять в D2. |
| B04 anchored four-item menu | Существующие Search/SortControl уже имеют четыре критерия и direction semantics | D2 переносит presentation поверх прежних API, без изменения ранжирования/хранилища. |
| B04.ST05 отдельный geo-dialog | Существующий explicit distance selection сразу запрашивает geo; это закрытое поведение | Новый dialog не вводится в D2; нужен отдельный contract revision при выборе этого flow. |
| Menu README: default rows 48; конкретный B04: rows 56 | Старые строки 44 | D2 явно использует конкретный вариант B04 56; не объявляет 56 универсальным стандартом всей системы. |
| motion duration-base 200; таблица Menu и B04 120 | Старый список монтируется/снимается без motion | Конкретное Menu enter/exit 120, точные кривые из токенов; exit inert, rapid reopen отменяет старый таймер. |
| Caption token 13/18 и визуальные строки карточки | buyer-readability имеет закрытую гарантию scalable 14/20 для where/seller lines | Карточки не входят в D2; доступность/scalability не ослаблять из-за generic token. |
| B07 2-column grid и B08 layout/actions | Сейчас используются существующие подробные cards и Offer page | Будущие отдельные slices; ни одна такая поверхность не перенесена автоматически. |
| Component examples содержат filters, limits, tariffs; обзор описывает рынки | Offer-centric product, запрет самовольных paid/core changes | Примеры компонента не разрешают продуктовые функции или изменения commercial/Location semantics. |

## Старые ссылки и документация

Обновлены agent router, Project Rules, README, UX inbox и активная ссылка Feature Map. Прежние brief/revision/UX corpus и README старого экспорта помечены superseded. Из Markdown документации удалены старые Claude Artifact/Wonder URLs с явной пометкой исторического происхождения; актуальными ссылками остались два новых источника. Прямые URLs прежних UX guides удалены из UX_REFERENCE_INDEX; исторические продуктовые findings сохранены.

Старые runtime assets/CSS и технически используемый экспорт не удалены вслепую. Исторические контракты остаются evidence поставленного поведения; их визуальные targets больше не определяют будущий дизайн. Остаточный аудит всех устаревших визуальных формулировок и разделение смешанных product/design материалов ещё не закрыты. Это не утверждение полной очистки репозитория.

D2 scope revision: повторно непосредственно прочитан полный отрисованный DOM/CSS B03-Results и осмотрена композиция. Живой source snapshot сохранён локально в verification-evidence/B03-Results-current-source.html. Перенос цельной выдачи сохраняет chips, 3nav, hours, scalable where-lines и прежние freshness semantics; не добавляет heart/новые действия из иллюстраций. Это не полное исследование остальных87/91 материалов.
