# S15B-4a — Selected Product как сигнал, а не фильтр

**Status:** CLOSED. Checkpoint `v0.0.58-product-as-search-signal`; PR #111; `main` `9245765299231ae0fa5887a0c6288211df8079b9`; merged-main `KAIDA verify` run `37432078991` SUCCESS; manual acceptance PASS (implementation `283b10a`).
**Approved:** PO, 2026-10-06. Уточнения PO: новый prefix-поиск по alias/localized name в 4a не добавляется (существующий exact resolver сохраняется); при расхождении selected Product и resolver по `q` — union обоих без дублей.
**Base:** `main` после `v0.0.57-buyer-autocomplete`.
**Plan:** промежуточный slice S15B. **Не финальная Search-модель:** relevance tiers / eligibility threshold / их связь с `sort` — отдельный следующий slice S15B-4b. Прежняя идея S15B-4 (жёсткое разделение canonical и raw) отменена решением PO.
**Граница доставки:** mobile + русский (`PROJECT_RULES.md` §18.5).

## 1. User task

Один и тот же intent не теряет подходящие Offers только потому, что покупатель выбрал Product из подсказки: «Баранина» из autocomplete и «Баранина», набранная руками, дают одну и ту же выдачу, включая карточки продавцов со свободным названием.

## 2. Фактическое поведение на `main` (evidence)

- Текстовый путь: `resolveProduct` (exact: canonical / localized name / alias) → кандидаты `offers.product_id = id OR все слова запроса — префиксы слов title_search`; `resolvedProduct` возвращается (S15B-2).
- Путь S15B-3 (`product_id` / `productId`): `findCatalogProductById` → кандидаты **только** `product_id = id` (`words: []`); неизвестный uuid → `200`, `resolvedProduct: null`, `offers: []`.
- Следствие: выбор из подсказки отсекает free-title Offers, которые тот же текст нашёл бы руками; known-zero в этом пути появляется при отсутствии только связанных Offers.
- Порядок выдачи задают только `sort` / `direction` / buyer geo (`search-ranking.ts`); понятия релевантности в ранжировании нет.

## 3. Behavior

1. **Selected Product — сигнал.** `product_id` / `productId` добавляет `product_id = выбранный id` как один из источников кандидатов в **общий** candidate set. Он не сужает выдачу и не отключает остальные источники.
2. **Candidate set** (union, без весов и score; существующие детерминированные источники):
   - `offers.product_id` выбранного Product (при выборе из подсказки);
   - `offers.product_id` Product, найденного существующим exact resolver по `q` (как сейчас);
   - все слова `q` как префиксы слов seller title (`queryWords` / `title_search`, как сейчас).
   Новых источников (prefix-поиск по alias/localized name, fuzzy, транслит) нет: если такой сигнал не доступен существующим resolver'ом без новой логики — в 4a не входит.
3. **Эквивалентность.** Выбор Product «Баранина» (в поле — его название) и ручной ввод «Баранина» дают один и тот же набор Offers. Если выбранный Product и resolver по `q` дают разные Product.id — в набор входят оба (union).
4. **Порядок не меняется.** `sort` / `direction` / geo, `rankSearchOfferCandidates`, buyer visibility, актуальность, публичный DTO — как сейчас. Никаких relevance tiers / score в порядке выдачи.
5. **Stale / неизвестный `product_id`.** Валидный uuid без Product в каталоге не обнуляет выдачу и не ошибка: Search идёт по `q` обычным текстовым путём (resolver + слова). `resolvedProduct` при этом определяется resolver'ом по `q`. Синтаксически невалидный uuid → `400 INVALID_SEARCH_REQUEST` (как сейчас). `q` по-прежнему обязателен.
6. **Known-zero (уточнённый смысл).** Тексты не меняются: RU «Сейчас предложений нет.» / KK «Қазір ұсыныстар жоқ.» (`search.emptyKnown`). Показываются, когда `resolvedProduct !== null` и **весь** candidate set вернул 0 Offers. Отсутствие только product_id-linked Offers при наличии free-title кандидатов — это обычная выдача, не known-zero. Unresolved / unknown query + 0 Offers — прежнее `search.empty`.
7. **Ambiguous / not_found.** Обычный текстовый поиск по словам `q`; Product не выбирается автоматически, chooser и «Возможно, вы ищете» не показываются.
8. **UI / state без изменений.** Подсказки, выбор, сброс при ручной правке, адрес `/?q=…&product=<uuid>`, `kaida:last-search` v3 (`productId`), Back, chips (текстовые), touch-прокрутка Home — как в S15B-3. `resolvedProduct` в ответе по-прежнему `{id, name} | null`.

## 4. Scope / out of scope

**In scope:** изменение формирования candidate set для `productId` и stale-id в `searchOffers`; known-zero как следствие union; обновление контракт-документов и тестов S15B-3 / S15B-2, чьи утверждения противоречат §3.

**Out of scope:** relevance score / tiers как порядок или eligibility-порог (S15B-4b); fuzzy, typo, транслит; prefix-matching по alias/localized name как новый источник; candidate suggestions / «Возможно, вы ищете» / chooser для `ambiguous`; явный «Искать как введено», raw mode, секции canonical/raw; новый sort и Search sorting UX refresh; Search Events / S15C / D0; Demand / watch; миграции БД; изменение подсказок, ranking, `sort` / `direction` / geo.

## 5. Expected modules

`search` (`application/search-offers.ts`; при необходимости `infrastructure/search.repository.ts` без изменения запроса), контракт `search.contract.ts` без изменения формы; тесты `tests/integration/search-by-product.test.ts`, `tests/e2e/search-by-product.spec.ts`, при необходимости unit; контракты S15B-3 / S15B-2.

## 6. Closed contracts

Явные ревизии (не «поведение не изменилось»):
- **S15B-3** — отменяются: §3.2 (Search «ТОЛЬКО по этому Product.id», «без OR по словам»), решение PO №4 (без fallback; несуществующий uuid → `resolvedProduct: null, offers: []`), AC 2 («карточка со свободным названием не попадает») и AC 6 в части «несуществующий uuid → пустой ответ». Сохраняются: подсказки, UI-паттерн, прокрутка Home, `q` обязателен, не-uuid → 400, сброс при правке, адрес и last-state.
- **S15B-2** — уточняется определение known-zero (§3.6): «0 Offers по всему candidate set». Для текстового пути поведение кода уже такое; изменение — в пути `product_id`, где known-zero больше не срабатывает при наличии free-title кандидатов. Тексты и критерий в UI те же.

Не ревизии: **S9 / Stage 6 Rev 3** (`sort` / `direction` / geo, порядок), S7 (поиск по названиям — один из источников, без изменений), S13, S15B-1, `search-home-last-state` (формат и поведение Back без изменений).

## 7. Risk flags

public API: **YES** (меняется семантика необязательного `product_id` / `productId`; форма ответа та же) · DB migration: no · auth/security/privacy: no · concurrency/atomicity: no · data loss: no · external service: no.

## 8. Acceptance criteria

1. Выбор Product из подсказки и ручной ввод его названия дают одинаковый набор Offers.
2. Free-title Offer со словами выбранного названия и без `product_id` попадает в выдачу при выборе Product.
3. Offers, привязанные к выбранному Product, остаются в выдаче; пересечение источников не дублирует Offer.
4. Известный Product, у которого нет linked Offers, но есть релевантные free-title Offers → обычная выдача, не known-zero.
5. Известный Product и ни одного кандидата → known-zero («Сейчас предложений нет.»); неизвестный запрос + 0 → прежний zero-result.
6. Валидный uuid без Product → `200`, поиск по `q` (resolver + слова); выдача не обнуляется только из-за id; не-uuid → `400`.
7. `ambiguous` / `not_found` → текстовый поиск, Product не выбирается автоматически.
8. Порядок при `sort` / `direction` / geo не меняется; `search-sort-rev3`, S9 тесты зелёные без правки утверждений порядка.
9. Адрес, `kaida:last-search` (v2/v3), Back, чипы, подсказки и их поведение — как в S15B-3.

## 9. Verification

Unit — при наличии чистой логики объединения; integration (Production KB v1, изолированная БД) — Search по `productId`: linked + free-title вместе, без дублей, stale uuid, known-zero с free-title и без, `ambiguous`; обновление ожиданий S15B-3 тестов; E2E mobile RU — выбор «баран» → «Баранина»: виден и free-title, и linked Offer; Back; «Тунец» (нет Offers) known-zero; затем полный `pnpm verify`, branch CI.

## 10. Manual acceptance (телефон, русский, БД с KB)

Подготовка: Offer, привязанный к «Баранина», и Offer продавца со свободным названием «Баранина на кости» без связи.
1. Ввести `баран`, выбрать «Баранина» — в выдаче оба Offers.
2. Ввести «Баранина» руками и Enter — тот же набор.
3. Сменить сортировку (цена / актуальность) — порядок как раньше.
4. Открыть карточку, Back — тот же результат.
5. Выбрать Product без Offers («Тунец») — «Сейчас предложений нет.»

## 11. STOP conditions

- Нужен relevance score / tiers / порог eligibility, изменение порядка или `sort` / `direction` / geo.
- Нужен новый источник кандидатов (prefix по alias/localized, fuzzy, транслит) или изменение resolver / подсказок.
- Нужна миграция БД или `mode`.
- Любое изменение last-state / адреса, кроме смысла `productId` как сигнала.
