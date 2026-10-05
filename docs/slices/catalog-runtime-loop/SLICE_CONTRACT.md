# Catalog-backed Seller → Buyer runtime loop

**Status:** DRAFT — CONTROLLER/PO REVIEW REQUIRED. Do not implement until `APPROVED — IMPLEMENTATION AUTHORIZED`.
**Base:** `main` `5b2171035c058f8337671b30222c7a247cb33b79` (`v0.0.52-production-kb-importer-v1`, merged-main `KAIDA verify` run `37293540946` SUCCESS) плюс docs-нормализация `docs/replan-after-production-kb-v1`.
**Branch:** `docs/catalog-runtime-loop-contract` (contract-only).
**Plan:** следующий продуктовый шаг после Production KB v1 (`EXECUTION_PLAN.md`). Следом — S15B (отдельно).
**Граница доставки:** mobile + русский (`PROJECT_RULES.md` §18.5).

## 1. User task

П2 начинает печатать название товара, которого не было в старом seed (но есть в Production KB v1), получает его в подсказках каталога, выбирает и публикует карточку обычным путём `SellerChangeSet`. П1 ищет этот товар в текущем поиске и видит именно эту карточку.

Это integration/user-flow proof, **не** импорт каталога и **не** S15B. Если полный путь уже работает на `main`, срез закрывается минимальным regression/E2E/manual proof и docs, без production-кода.

## 2. Фактическое поведение на `main` (evidence из чтения кода; сам путь целиком ещё не прогонялся)

- Подсказки: `GET /api/catalog/suggestions` → `suggestCatalogProducts` → SQL по `products`, `product_localized_names`, `product_aliases` в KAIDA PostgreSQL; правило «каждое набранное слово — начало слова названия/алиаса», до 5 подсказок, от 2 букв.
- Выбор: `CardEditor` при выборе подсказки передаёт `productId`; `catalogLink` (`card-change-sets.ts`) проверяет Product по id и записывает его в Offer; без выбора — тихая привязка по точному совпадению всего названия, иначе `product_id = null` (free title).
- Поиск П1: `searchOffers` → `resolveProduct` (точное совпадение канонического названия / localized name / alias) → `findOffersByProductOrTitleWords` (по `offers.product_id` ИЛИ по словам названия).
- Product из KB попадает в эти же таблицы (importer v1), runtime-зависимостей от внешних сервисов нет.
- **Единственный замеченный разрыв — тестовая среда, не продукт:** KB ставится CLI `pnpm db:import:production-kb`; `db:seed`, `db:test:prepare`, `pnpm verify` и CI его **не** вызывают, поэтому БД E2E/integration содержит только два seed-Product (`Баранина`, `Говядина`). Доказательство требует установки KB в тестовой БД существующим importer-ом.

## 3. Behavior

Детерминированный Product: **`Мёд горный`** (`KAIDA-P0697`, KK `Тау балы`, категория `HONEY_PRESERVES`) — не входит в seed, не имеет alias, имя уникально в пакете.

1. П2 в редакторе карточки в поле «Название товара» вводит `мёд гор` и видит подсказку `Мёд горный`.
2. Выбирает её, указывает цену/точку по обычному пути и публикует через review и подтверждение ответственности (существующий `SellerChangeSet`).
3. Создаётся Offer с `product_id` = runtime UUID `Мёд горный`.
4. П1 ищет `Мёд горный` и видит эту карточку (название, цена, точка); ищет `Тау балы` (казахское имя из каталога) и видит ту же карточку — это доказывает связь через canonical Product, а не совпадение слов названия.
5. Свободное название без выбора из каталога работает как раньше.

Выбор из каталога **не становится обязательным**. Идентичность Product/Offer не меняется. Новых endpoint-ов, таблиц, параметров API нет, если не найден реальный gap (§6).

## 4. Scope / out of scope

**In scope:** доказательство цепочки Seller UI → подсказка из runtime PostgreSQL → canonical Product linkage → `SellerChangeSet`/publish → `Offer.product_id` → текущий поиск П1 → видимая карточка; установка KB в тестовую БД существующим importer-ом; один integration-тест и один mobile-RU E2E; минимальный fix только если proof выявит реальный gap.

**Out of scope:** повторный импорт/изменение пакета из 682 Products; S15B (buyer autocomplete, `product_id` в запросе поиска, ранжирование подсказок, fuzzy); known-zero vs unknown; Query Log / Demand events; динамические чипы; AI; изменение free-title fallback; навигация по Category; обращения к внешней KB/corpus; обязательность выбора из каталога.

## 5. Expected modules (уровень архитектуры)

Ожидаемо **production-кода нет**: только тестовый слой (новый integration-тест рядом с `tests/integration`, новый spec в `tests/e2e`, хелпер установки KB в тестовой БД через `importProductionKbPackage`). Затрагиваются на чтение: `catalog` (suggestions/resolve), `seller-input`, `search`.

## 6. Closed contracts

Ревизий не ожидается: `seller-showcase-editor` (смешанный ввод, подсказки), S6/S7 (resolve и поиск), `production-kb-importer`, `search-sort-rev3` читаются как есть. Если proof выявит gap — он фиксируется как точная contract revision по `PROJECT_RULES.md` §4 **до** правки кода, и правится только он.

Известный риск в тестовой среде: установка KB в общую E2E/integration БД может изменить исходы существующих тестов, рассчитанных на два seed-Product (например, подсказки по `бар`, неоднозначность). Допускается обновлять только утверждения, зависящие от seed-only каталога, с перечислением каждого в отчёте; если для этого нужно менять поведение продукта — STOP.

## 7. Risk flags

DB migration: no · public API: no · auth/security/privacy: no · concurrency/atomicity: no · data loss: no · external service: no.

Флаги основаны на фактически требуемых изменениях (ожидаются только тесты) и пересматриваются, если proof выявит production gap.

## 8. Acceptance criteria

1. В тестовой БД установлен Production KB v1 существующим importer-ом (682/210/35, без изменения пакета и importer-а); `Мёд горный` существует с runtime UUID и не входит в seed.
2. Ввод `мёд гор` в поле названия карточки возвращает `Мёд горный` из KAIDA PostgreSQL; `id` подсказки равен runtime Product UUID.
3. Выбор подсказки привязывает карточку к этому Product; ручная правка названия после выбора сохраняет текущее поведение (`keepsLink`/разрыв связи).
4. Публикация через существующие review/confirm/`SellerChangeSet` создаёт Offer с `offers.product_id` = этому UUID; Offer виден во «Моей витрине».
5. Поиск П1 по `Мёд горный` показывает эту карточку (название, цена, точка) и открывает её детальный вид.
6. Поиск П1 по казахскому имени `Тау балы` находит ту же карточку (связь через canonical Product, а не слова названия).
7. Карточка со свободным названием без выбора из каталога публикуется и находится по словам названия, как раньше; выбор из каталога необязателен.
8. Runtime-путь использует только KAIDA PostgreSQL: тесты проходят без checkout corpus и без внешних сетевых вызовов; Search matching/sorting/ranking/API semantics не изменены.
9. Существующие Catalog/Seller/Search regression-тесты зелёные; любые изменённые seed-only утверждения перечислены. Если gap найден — исправлен только он, с отдельным regression-тестом; иначе production-diff пуст.

## 9. Verification

- Integration: KB установлен → `suggestCatalogProducts` → создание/публикация карточки с `productId` → `searchOffers` по каноническому и казахскому имени; проверка `offers.product_id`.
- E2E mobile RU: полный сценарий §10 на production build.
- Полный `pnpm verify` и CI зелёные; typecheck/lint чистые. Локально full E2E на 8 GB машине может быть flaky — доверять CI.

## 10. Manual acceptance (телефон, русский, после First Entry; БД с установленным KB)

1. П2: открыть новую карточку, в «Название товара» набрать `мёд гор` — появляется подсказка «Мёд горный».
2. Выбрать подсказку, указать цену и торговую точку, нажать «Проверить и опубликовать», подтвердить ответственность.
3. На «Моей витрине» карточка «Мёд горный» опубликована.
4. П1: в Поиске набрать «Мёд горный» — видна эта карточка с ценой и точкой; открыть её.
5. Переключить язык на қазақша (или набрать «Тау балы») — та же карточка находится.
6. П2: создать вторую карточку со своим названием («Мёд с пасеки у Иссыка») без выбора подсказки — публикуется; П1 находит её по слову «пасеки».

## 11. STOP conditions

- Proof показывает, что подсказки не доводят до товара по естественному набору его названия (усечение выборки/порядок/ограничение 5 подсказок) и исправление требует переосмысления ранжирования подсказок или fuzzy — граница S15B: остановиться и доложить точную границу.
- Путь требует `product_id` в запросе поиска или buyer autocomplete — S15B.
- Нужно менять Product/Offer identity, free-title fallback, importer или пакет KB.
- Установка KB в тестовую БД требует изменения поведения продукта ради существующих тестов.
- Любая необходимость внешнего вызова в runtime.
