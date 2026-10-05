# S15B-3 — Buyer autocomplete + search by selected Product (`product_id`)

**Status:** DRAFT — PO APPROVAL REQUIRED. Do not implement until `APPROVED — IMPLEMENTATION AUTHORIZED`.
**Base:** `main` после `v0.0.56-search-known-zero`.
**Plan:** третий vertical slice S15B (`EXECUTION_PLAN.md`); вход — audit S15B (CURRENT / TARGET / GAP), нового полного аудита нет. `SEARCH_SYSTEM_SPEC_v0.1.md` §6, §7A, §19 — target source.
**Граница доставки:** mobile + русский (`PROJECT_RULES.md` §18.5).

## 1. User task

Покупатель начинает вводить товар, выбирает canonical Product из подсказок и получает Search именно по выбранному Product.

## 2. Фактическое поведение на `main` (evidence)

- Buyer Search принимает только текст `q` (GET `q`, POST `q`/`buyerLocation`/`sort`/`direction`, strict-схема); `product_id` не принимается. Подсказки каталога потребляет только seller-редактор (`GET /api/catalog/suggestions`, S15B-1 relevance, ≤ 5).
- Текстовый путь: exact `resolveProduct` → Offers `product_id = id OR слова названия` (OR остаётся, S15B-4 его не трогает здесь); ответ содержит `resolvedProduct` (S15B-2).
- Состояние последнего поиска: `sessionStorage` `kaida:last-search` (формат `v: 2`: `query`, `sort`, `direction`) и адрес `/?q=…`; Back с карточки Offer возвращает на `/?q=…`, результаты запрашиваются заново.

## 3. Behavior

### 3.1 Подсказки
Поле поиска (Search Home и строка результатов) показывает подсказки каталога от 2 букв, до 5, под полем, по существующему endpoint `GET /api/catalog/suggestions?q&locale` — **без второй реализации ранжирования и без изменения логики подсказок**. Запрос — debounce как у продавца. Listbox/combobox-паттерн (стрелки, Enter на активной подсказке, Escape закрывает, blur закрывает), опция выбирается по `pointerdown`, как у продавца. Подсказки — помощь, не требование: Enter без выбранной подсказки выполняет прежний текстовый поиск.

### 3.2 Выбор Product → canonical path
Выбор подсказки подставляет в поле её название, закрывает список и сразу выполняет Search по выбранному Product. Search по выбранному Product ищет **только** Offers с `offers.product_id = <id>` (без OR по словам названия): те же buyer-visibility, актуальность, ранжирование, `sort` / `direction` / buyer geo, тот же публичный DTO. `resolvedProduct` в ответе — выбранный Product; известный Product без Offers даёт known-zero (S15B-2).

### 3.3 `q` и `product_id` в GET/POST
- GET: `product_id=<uuid>` необязательный; `q` по-прежнему обязателен (видимый текст, адрес, last-state). При наличии `product_id` совпадение идёт по Product, `q` на выбор Offers не влияет.
- POST: необязательное `productId` (uuid) в strict-схеме; `q` и `buyerLocation` остаются; координаты в URL не попадают.
- Некорректный `product_id` / `productId` (не uuid) → `400 INVALID_SEARCH_REQUEST`. Корректный uuid несуществующего Product → `200`, `resolvedProduct: null`, `offers: []` (устаревшая подсказка не ошибка).
- Без `product_id` поведение API не меняется.

### 3.4 Ручная правка после выбора
Выбор запоминается только пока текст поля точно равен выбранному названию (после trim). Любая правка текста сбрасывает выбранный Product; следующий submit — обычный текстовый поиск (raw path, с существующим resolver/OR). Очистка поля (×) тоже сбрасывает. Результаты на экране при этом не пересчитываются до submit.

### 3.5 Last-state и навигация
- Адрес результата выбранного Product — `/?q=<название>&product=<uuid>`; адрес текстового поиска остаётся `/?q=…`.
- `kaida:last-search` получает необязательное `productId` (формат читается как прежний `v: 2` без него; запись с `productId` — следующая версия формата, повреждённое/чужое значение = «нет последнего поиска»). Хранит только запрос, сортировку, направление и `productId`; не результаты и не координаты.
- Back с карточки Offer и «Поиск» в навигации возвращают тот же Search по `productId`, результаты запрашиваются заново; нормализация distance без координат — как сейчас.
- Чипы curated-запросов остаются текстовыми запросами (путь без `product_id`).

### 3.6 Mobile interaction
Подсказки раскрываются вниз под полем. Экранная клавиатура не должна закрывать подсказки целиком; способ (общий принцип прокрутки поля к верху рабочей области при открытии списка в touch-сеансе, как в `card-editor-suggestion-scroll`, либо иной) — **решение PO** (§11).

## 4. Scope / out of scope

**In scope:** buyer-side подсказки (UI) на существующем endpoint; выбор Product; `product_id` во входе Search (GET/POST); canonical path по выбранному Product; сброс при ручной правке; last-state + адрес; тесты.

**Out of scope:** разделение resolved/raw и удаление OR для текстового пути (S15B-4); `mode`; fuzzy; «Возможно, вы ищете»; Demand / watch / `search_events`; изменение ранжирования, `sort`/`direction`/geo; изменение ранжирования или логики подсказок; чипы с `product_id`; seller-редактор.

## 5. Expected modules

`search` (`contracts/search.contract.ts`, `contracts/buyer-location.contract.ts`, `application/search-offers.ts`, `infrastructure/search.repository.ts`, `last-search-state.ts`), `app/api/search/route.ts`, buyer `SearchScreen` (+ новый компонент подсказок в `_ui`), строки i18n; `catalog` читается как есть (endpoint и `findCatalogProductById`).

## 6. Closed contracts

Реальные ревизии:
- **S0 / S6 API** — публичный Search принимает необязательный `product_id` / `productId`; ответ — как в S15B-2.
- **Stage 6 Rev 3 (API)** — строгая POST-схема расширяется `productId`; параметры `sort` / `direction` / `buyerLocation` и их семантика не меняются.
- **`search-home-last-state`** — формат `kaida:last-search` и адрес получают необязательный выбранный Product.
- **S15B-2** — `resolvedProduct` теперь может прийти из выбора (не только из resolver).

Не ревизии (поведение не меняется): S7 (текстовый путь по названиям — без изменений), S9 / ранжирование, S13 (интересы), `seller-showcase-editor` / S15B-1 (endpoint подсказок получает второго потребителя без изменения).

## 7. Risk flags

public API: **YES** (additive: новый необязательный параметр) · DB migration: no · auth/security/privacy: no (`product_id` — идентификатор каталога, не персональные данные; координаты по-прежнему не в URL и не в хранилище) · concurrency/atomicity: no · data loss: no · external service: no.

## 8. Acceptance criteria

1. Buyer UI показывает ≤ 5 подсказок от 2 букв из `GET /api/catalog/suggestions`; ранжирование подсказок не реализуется повторно.
2. Выбор подсказки выполняет Search по Product: выдача — только Offers с `product_id = id` (карточка со свободным названием без связи не попадает); те же visibility / ранжирование / `sort` / `direction` / geo.
3. `resolvedProduct` = выбранный Product; Product без Offers → known-zero «Сейчас предложений нет.».
4. Текстовый запрос без выбора работает как до slice (resolver + OR), включая chips и Enter без подсказки.
5. Ручная правка текста после выбора (и очистка) сбрасывает Product; следующий submit — текстовый путь.
6. API: GET `product_id`, POST `productId` — валидный uuid обрабатывается; не-uuid → `400`; несуществующий uuid → `200` с `resolvedProduct: null`, `offers: []`; строгая POST-схема отвергает прочие лишние поля; без нового параметра ответ прежний.
7. Адрес и `kaida:last-search` сохраняют выбранный Product; Back с карточки Offer и «Поиск» возвращают тот же Search по `productId`; прежние сохранённые состояния читаются; повреждённые игнорируются.
8. Клавиатура и скринридер: combobox/listbox (стрелки, Enter, Escape, blur), цель касания ≥ 44 px; на телефоне подсказки не скрыты клавиатурой целиком (способ — решение PO).
9. Сортировка, геолокация, `search-sort-rev3`, S6/S7/S9 регрессии зелёные без изменения утверждений порядка; seller-подсказки не изменены.

## 9. Verification

Unit — разбор параметров, last-state формат, сброс выбора; integration — Search по `productId` (только связанные Offers, видимость/порядок неизменны, несуществующий id, known-zero) на Production KB v1; E2E mobile RU — «баран» → «Баранина» → выдача; правка → raw; Back с карточки; полный `pnpm verify`; branch CI.

## 10. Manual acceptance (телефон, русский, БД с установленным KB)

1. На Search Home набрать `баран` — видна подсказка «Баранина» (первой).
2. Выбрать её — выдача по Product «Баранина».
3. Сменить сортировку (цена / актуальность) — работает как раньше.
4. Открыть карточку, вернуться Back — тот же Search по Product.
5. Исправить текст в поле и нажать Enter — обычный текстовый поиск.
6. Набрать «Тунец» (нет Offers), выбрать — «Сейчас предложений нет.»

## 11. Design gaps / decisions for PO (`feedback_design_gaps_ask`)

- В принятом макете нет кадра buyer-подсказок. **Предложение:** повторить вид списка подсказок продавца (те же классы макета) под полем поиска; нужно ваше разрешение или кадр дизайнера.
- Видимость над клавиатурой: на Search Home поле стоит по центру. **Предложение:** тот же принцип, что в `card-editor-suggestion-scroll` — при открытии списка в touch-сеансе один раз прокрутить блок поля к верху; на странице результатов поле уже вверху и прокрутка не нужна. Нужно подтверждение (или иное решение, например перевод на раскладку результатов при фокусе).
- Уточнение: `q` остаётся обязательным вместе с `product_id` (для адреса/last-state/Back) — подтвердите.

## 12. STOP conditions

- Canonical path требует менять текстовый путь, OR, ранжирование Offers, resolver или логику подсказок.
- Нужна миграция БД или `mode`.
- Клавиатурная видимость требует вычислять высоту клавиатуры / `visualViewport` или менять общий `Sheet`/overlay (§18.4).
- Back/last-state невозможно сохранить без хранения результатов или координат.
