# D2 — Новый дизайн меню порядка поиска

**Scope выбран из прямого поручения PO о миграции (2026-11-05). Implementation / verification in progress. Не checkpoint.** D1 `/welcome` отложен PO и не входит в работу.

## User task

Покупатель меняет порядок существующей выдачи, меняет направление повторным выбором и возвращается к порядку по умолчанию через меню у контрола.

## Scope и visual evidence

Только контрол и anchored меню B04.ST01–ST04 в [новом холсте](https://claude.ai/artifact/X7VZCf7SrZ1pDbn9qZTZDn#play-c011725c5a1c) и компонент Menu / motion [новой системы](https://claude.ai/artifact/5xzk5XmbEnpxawj3ZTQovr). Просмотрены screenshot, DOM и computed styles B03-Sort.dc.html версии `1793830896-9a07`: surface #FDFBFF, ink #1F1026, primary #9900CC, selected #F8E5FF, line #E9D9F2, radius 14, padding 6, rows 56 px, text 15/22 px, trigger 16/24 px weight 500 gap 8 и touch 44. Тень: 0 4px 12px #5B0A7A/12% + 0 2px 4px #1F1026/7%. Menu enter/exit 120 ms, opacity/translateY(-4)/scale(.98), origin у триггера; кривые из computed styles и tokens.json: cubic-bezier(.33,1,.68,1) / cubic-bezier(.32,0,.67,0); reduced motion и keyboard — без движения.

Сохраняются текущая позиция над выдачей, API wiring, labels, критерии/direction и доступные имена. Новые стили локальны этому компоненту, не global overrides. Модули: buyer presentation SortControl и его локальные стили; существующий Search/API/DB используются без изменения.

## Explicit out of scope

Остальной Search B02/B03, карточки, счётчик результатов, навигация, `/welcome`, Seller/Operator, новый geo-dialog B04.ST05, offline/cache, dark theme. Не добавлять функции и не менять поисковый core. Общая инвентаризация всех артефактов и очистка старых визуальных references — отдельная часть текущего поручения, не повод расширять runtime diff D2.

## Закрытые contracts

`search-sort-control-refresh`, `search-sort-rev3`, `search-home-last-state`, S0/S7/S9/S15B/D0 сохраняются: default relevance без direction, естественное направление другого критерия, активный явный критерий меняет направление, запрос/Product/last-state сохраняются. Геолокация только по существующему явному выбору distance, без промежуточного нового диалога; отказ и восстановление не меняются. Ноль результатов скрывает контрол как раньше.

Заменяются только прежние визуальные предписания refresh (14 px, radius 12/8, row 44, старый рисунок sliders) новыми по прямому поручению о главном визуальном baseline. Стрелка активного пункта продолжает показывать **применяемое**, а триггер **текущее** направление. Нельзя буквально скопировать иллюстративную стрелку макета, если она противоречит этой принятой semantics. Новый гео-dialog потребует отдельной ревизии, поэтому здесь не реализуется. Если понадобятся другие изменения закрытого поведения — STOP.

## Risk flags

DB migration: нет. Public API: нет. Auth/security/privacy: новой логики нет; существующий explicit geo intent проверяется регрессией. Concurrency/atomicity: нет новой доменной операции; UI rapid reopen/close проверяется отдельно. Data loss: нет. External service: нет новой runtime зависимости.

## Acceptance criteria

1. Контрол/меню используют вышеописанные значения нового источника, в пределах viewport от 320 px; соседние поверхности не меняются.
2. Весь триггер открывает один anchored список из четырёх прежних пунктов, текущий выделен фоном и pressed semantics.
3. Цена/расстояние/актуальность применяют прежние естественные направления; повторный выбор разворачивает; default сбрасывает только порядок.
4. Выбор закрывает список сразу логически: закрывающийся слой недоступен фокусу и нажатиям; visual exit не задерживает API.
5. Escape, outside и повторный trigger закрывают; фокус возвращается на trigger, входящий focus устанавливается один раз.
6. Быстрое закрытие/открытие не оставляет дубликат, таймер старого закрытия не убирает новый слой.
7. Motion следует новым 120 ms/ease-out/in; keyboard и reduced motion без движения; disabled не сжимается.
8. Query/Product, Last Search/Back, no-results, geo grant/deny и disabled сохраняются; API/domain/DB diff отсутствует.

## Verification / manual

Targeted: existing mobile `search-sort-control` / `search-sort-rev3` E2E и новый rapid-reopen/reduced-motion сценарий; unit/integration поиска без ослабления. Lint/typecheck/build, full regression, branch CI на executable SHA. Manual PO: реальный запрос → меню → цена → повтор цены → default → Escape/повторное открытие; 320/390 px. Agent browser review и PO acceptance записывать раздельно. Затем scope/closed-contract diff audit; merge/main CI/tag только после gate и поручения PO согласно AGENTS.

**Evidence:** pending; нет утверждения полного исследования всех досок, PASS регрессии или PO acceptance.
