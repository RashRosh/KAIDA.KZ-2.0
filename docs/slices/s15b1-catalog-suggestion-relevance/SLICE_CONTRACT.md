# S15B-1 — Catalog suggestion relevance / reachability

**Status:** CLOSED. Checkpoint `v0.0.54-catalog-suggestion-relevance`; PR #97; `main` `b3432e4219a412ddb82ddc1afb8f03ef1f93c192`; merged-main `KAIDA verify` run `37326497017` SUCCESS; manual acceptance PASS.
**Base:** `main` `dba8cd8f5939b20accb973d2bde3950c200fa306` (checkpoint `v0.0.53-catalog-runtime-loop`).
**Plan:** первый vertical slice S15B (`EXECUTION_PLAN.md`). Остальной S15B этим контрактом не начинается.
**Граница доставки:** mobile + русский (`PROJECT_RULES.md` §18.5).

## 1. User task

П2 начинает естественно вводить название известного товара и получает нужный Product в первых пяти подсказках, а не теряет его из-за алфавитного порядка. Главный пример: `бар` / `баран` → `Баранина` в top-5. Нужно общее детерминированное правило, а не поправка под одно слово.

## 2. Фактическое поведение на `main` (evidence)

- Единственный потребитель: `GET /api/catalog/suggestions` → `suggestCatalogProducts` → `findCatalogNamesContaining`; endpoint вызывает только `CardEditor` продавца. Buyer autocomplete и других consumers в коде нет.
- Кандидаты: SQL ищет самое длинное набранное слово как подстроку в `products.name`, `product_localized_names.name`, `product_aliases.name` (обе локали, независимо от языка интерфейса), `ORDER BY p.name, p.id LIMIT 100`; затем JS оставляет совпадения «каждое слово набора — начало слова названия/алиаса» и берёт первые 5 в алфавитном порядке. Язык интерфейса влияет только на отображаемое имя.
- На Production KB v1 (682 Products) `бар` даёт `Барабулька`, `Бараний внутренний жир/рубец/фарш/язык` — `Баранина` не попадает; `баран` — `Баранина` пятая лишь из-за алфавита; `Баранина` целиком — вторая после `Бараний фарш`. Закрытый `seller-showcase-editor` acceptance 3 («Typing `бар` shows the catalog suggestion `Баранина`») на полном каталоге не выполняется: каталог из двух seed-Products скрывал проблему.
- Дополнительный дефект выборки: алфавитный порядок и `LIMIT 100` применяются **до** фильтра по словам, поэтому при коротком/частом слове нужный Product может выпасть ещё до отбора.
- Runtime loop (`v0.0.53`) это намеренно не исправлял.

## 3. Behavior

**Semantic eligibility predicate не меняется:** существующая минимальная длина ввода; существующая нормализация (`ё→е` и т. п.); каждое слово запроса должно быть prefix одного из слов одного из canonical/localized names или aliases Product. Меняются только порядок и отбор top-5.

Прежние `ORDER BY p.name, p.id LIMIT 100` до word-prefix фильтра **не входят** в eligibility contract: это implementation defect (преждевременное усечение кандидатов), и S15B-1 вправе его удалить. Поэтому фактически достижимый набор подсказок может расшириться, но Product не становится eligible по новому правилу сопоставления.

**Правило релевантности** (по лучшему совпадению Product среди его названий и алиасов; меньший номер выше):

1. полное совпадение запроса с названием;
2. полное совпадение запроса с алиасом;
3. название начинается с запроса целиком (слова запроса — начала первых слов названия подряд);
4. алиас начинается с запроса целиком;
5. совпадение по началам слов в названии (любые слова, любой порядок);
6. совпадение по началам слов в алиасе.

Внутри уровня: короче совпавший текст выше (общий товар раньше его вариантов: `Баранина` перед `Баранина для плова`), затем отображаемое имя (простое сравнение нормализованных строк, без локальной коллации), затем `Product.id`. Результат не зависит от порядка строк БД; ≤ 5 уникальных Products, один Product — одна подсказка.

Ранжирование применяется ко **всем** eligible Products, а не к алфавитной выборке: ни `LIMIT`, ни порядок кандидатов в SQL не должны отсекать eligible Product до ранжирования. Способ (SQL, JS, комбинация) выбирает реализация.

Без fuzzy, ML, весов, новых таблиц, внешних вызовов. Product identity, `resolveProduct`, поиск Offers покупателя и Stage 6 Rev 3 не меняются.

## 4. Scope / out of scope

**In scope:** отбор и порядок подсказок shared Catalog-хелпера; seller UI на существующем endpoint; automated proof на Production KB v1; минимальный E2E mobile RU; возврат обходных правок runtime loop в E2E `seller-change-set`/`seller-showcase-editor` к естественному вводу (`бар`), если они становятся ненужными.

**Out of scope:** buyer autocomplete; `product_id` во flow Search; known-zero vs unknown; Query Log / S15C; динамические чипы; fuzzy/typo; semantic/AI; изменения KB/импорта; редизайн алиасов; Category UI; free-title fallback; новые таблицы; внешние сервисы; ранжирование Offers.

## 5. Expected modules

`catalog`: `application/suggest-products.ts` (правило), `infrastructure/products.repository.ts` (выборка кандидатов без усечения до ранжирования). Новые unit-тесты правила, integration-тест на KB v1, обновление E2E продавца. `CardEditor` и route меняются только если реализация докажет необходимость.

## 6. Closed contracts

- `seller-showcase-editor` (подсказки, acceptance 3) — реализация **восстанавливает** заявленное поведение; ревизия не требуется. «Same word-prefix rule», «up to 5», «help, never a requirement» сохраняются.
- S6 Catalog resolution / catalog localization — eligibility по названиям и алиасам обеих локалей не меняется; resolver не трогается.
- Production KB importer v1, catalog-runtime-loop — не меняются; их тесты остаются зелёными.
- Search S7 / Stage 6 Rev 3 — не затрагиваются.

## 7. Risk flags

DB migration: no · public API: **limited** — форма ответа `GET /api/catalog/suggestions` не меняется, меняются порядок/отбор (единственный потребитель — seller editor) · auth/security/privacy: no · concurrency/atomicity: no · data loss: no · external service: no.

## 8. Acceptance criteria

1. Тесты используют Production KB v1, установленный существующим importer-ом в изолированной БД (как в runtime loop); копий каталога в seed/fixtures нет.
2. `бар` и `баран` возвращают `Баранина` в top-5; `баран` — первой по правилу.
3. Сильное совпадение не вытесняется слабым из-за алфавита: полное название (`Баранина`, `Говядина`) — первым, раньше своих вариантов (`… для плова`); начало названия выше совпадения «в середине»; название выше алиаса того же уровня.
4. Максимум 5 подсказок, один Product — одна подсказка; повторные вызовы и перемешанный порядок кандидатов дают идентичный результат.
5. Eligibility predicate не меняется: 1-буквенный ввод, substring без word-prefix (`аранина`) и другие ранее не-eligible запросы не становятся eligible; aliases и localized names продолжают участвовать по тому же word-prefix rule (`мясо барана` → `Баранина`; `қой` → `Қой еті` при `locale=kk`).
6. Общая reachability: для каждого из 682 Products ввод его полного канонического RU названия возвращает его в top-5.
7. Выбор подсказки возвращает runtime Product UUID и привязывает карточку (`Offer.product_id`); `мёд гор` → `Мёд горный` без регрессии; тесты runtime loop зелёные.
8. Free-title путь, `resolveProduct`, buyer Search результаты и сортировка Rev 3 не изменены (существующие тесты зелёные без правки утверждений).
9. E2E mobile RU: ввод `баран` показывает `Баранина` среди подсказок, выбор привязывает карточку; обходные утверждения runtime loop возвращены к `бар`, где это следует из контракта `seller-showcase-editor`.

## 9. Verification

Unit — правило (уровни, tie-break, детерминизм, ≤5); integration на KB v1 (AC 2–7); E2E mobile RU; полный `pnpm verify`; branch CI. Вручную SQL/API-проверки не дублируются.

## 10. Manual acceptance (телефон, русский, БД с установленным KB)

1. «Сформировать карточки товаров» → «Заполнить вручную».
2. В «Название товара» набрать `баран` — среди подсказок «Баранина», первой.
3. Набрать `бар` — «Баранина» тоже среди пяти.
4. Выбрать «Баранина», указать цену и точку, опубликовать — карточка опубликована под этим товаром.

## 11. STOP conditions

- Reachability требует менять `resolveProduct`, eligibility/word-prefix semantics, Product/alias model или данные KB.
- Правило не даёт `Баранина` в top-5 без fuzzy/весов — доложить, не вводить scoring framework.
- Требуется менять buyer Search, `product_id` flow или Offer sorting.
- Требуется новая таблица, миграция или внешний сервис.
