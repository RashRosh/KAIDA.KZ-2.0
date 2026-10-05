# S15B-2 — Search state: resolved Product + known-zero

**Status:** CLOSED. Checkpoint `v0.0.56-search-known-zero`; PR #105; `main` `9383150d08943bb50de1d915193878352650c446`; merged-main `KAIDA verify` run `37370761534` SUCCESS; manual acceptance PASS (implementation `347a631`).
**Base:** `main` `4bf3cbe9eb32ff76e349829ba82259de485cf48b` (checkpoint `v0.0.55-card-editor-suggestion-scroll`).
**Plan:** второй vertical slice S15B (`EXECUTION_PLAN.md`, `SEARCH_SYSTEM_SPEC_v0.1.md` §17.2, §20 как target source). Buyer autocomplete — следующий отдельный slice (S15B-3), здесь не начинается.
**Граница доставки:** mobile + русский (`PROJECT_RULES.md` §18.5); казахский текст — в каталоге строк.

## 1. User task

Покупатель ищет существующий canonical Product, у которого сейчас нет активных Offers, и понимает, что товар KAIDA известен, но предложений нет. Неизвестный запрос остаётся обычным zero-result.

## 2. Фактическое поведение на `main` (evidence)

- `searchOffers` вызывает `resolveProduct(q)` (exact: canonical name / localized name / alias → `resolved | not_found | ambiguous`), но результат использует только как `productId` для запроса Offers (`product_id = id OR слова названия`) и не возвращает.
- Ответ — `{ query, offers }`; UI при `offers.length === 0` всегда показывает `search.empty` («По вашему запросу ничего не найдено.») — известный Product без Offers, `not_found` и `ambiguous` неотличимы.
- GET и POST `/api/search` оба идут через `searchOffers`.

## 3. Behavior

1. `searchOffers` сохраняет результат существующего resolver и возвращает его в ответе: `resolvedProduct: { id, name } | null`. Форма — как в target spec §20; `name` — то, что уже отдаёт resolver (`ResolvedProduct`), без новой locale/domain-логики.
2. `resolvedProduct` не `null` только при `resolved` (exact canonical / localized name / alias по существующим правилам). `not_found` и `ambiguous` → `null`.
3. Offers, их набор, порядок, `sort` / `direction` / buyer geo не меняются; текущий OR (`product_id` ∨ слова названия) остаётся как есть.
4. UI результата: при `0` Offers и `resolvedProduct !== null` — «Сейчас предложений нет.» (KK: «Қазір ұсыныстар жоқ.»); при `0` Offers и `resolvedProduct === null` — прежний `search.empty`. Известный Product с Offers — выдача как раньше.
5. Кнопки «Сообщить, когда появится» нет.

## 4. Scope / out of scope

**In scope:** сохранение результата resolver в Search runtime; additive поле ответа (и схема ответа); различение в UI known+0 и unknown+0; тексты RU/KK; обновление тестов, где ожидалась точная форма `{ query, offers }`.

**Out of scope:** buyer autocomplete; `product_id` как вход Search; разделение canonical и raw fallback; удаление OR; `mode`; fuzzy; «Возможно, вы ищете»; watch / «Сообщить, когда появится»; interests; Search Events / S15C / D0; изменение ranking; DB migrations; изменение resolver.

## 5. Expected modules

`search` (`application/search-offers.ts`, `contracts/search.contract.ts`), buyer `SearchScreen` и строки `src/i18n/messages.ts`; unit/integration/E2E тесты. Resolver (`catalog`) читается как есть.

## 6. Closed contracts

Реальные ревизии:
- **S0** — форма ответа Search (`{query, offers}`) получает additive поле `resolvedProduct`; потребитель обязан терпеть его отсутствие/`null`.
- **S6** — acceptance «unknown buyer term remains `200 + offers: []`» сохраняется; точное равенство `{query, offers: []}` в проверках расширяется до `resolvedProduct: null`. Семантика resolver не меняется.

Не объявляются ревизиями (поведение не меняется): S7 (поиск по названиям Offers), S9 / Stage 6 Rev 3 (ранжирование, `sort`/`direction`/geo), S13 (интересы). Если реализация обнаружит обратное — STOP, уточнение до кода.

## 7. Risk flags

public API: **YES** (additive поле ответа) · DB migration: no · auth/security/privacy: no · concurrency/atomicity: no · data loss: no · external service: no.

## 8. Acceptance criteria

1. Exact canonical name → `resolvedProduct = { id, name }`.
2. Exact localized name → resolved state.
3. Exact alias → resolved state.
4. `not_found` → `resolvedProduct = null`.
5. `ambiguous` → `resolvedProduct = null`.
6. Известный Product + 0 Offers → в UI RU «Сейчас предложений нет.» (KK «Қазір ұсыныстар жоқ.»).
7. Неизвестный запрос + 0 Offers → прежний текст zero-result.
8. Offers для resolved-запроса те же, что до slice (набор и порядок).
9. Rev 3 sort / direction / geo без изменений; существующие тесты `search-sort-rev3`, S9 зелёные без правки утверждений порядка.
10. Изменение API additive: GET и POST возвращают прежние поля; старое поведение за пределами нового состояния не ломается.

## 9. Verification

Unit/integration: resolver-состояния → `resolvedProduct` (AC 1–5), неизменность Offers и порядка (AC 8–9). Integration на Production KB v1 (изолированная БД, как в runtime loop): известный Product без Offers. E2E mobile RU: known-zero, unknown zero-result, известный Product с Offers. Затем полный `pnpm verify`, branch CI.

## 10. Manual acceptance (телефон, русский, БД с установленным KB)

1. Найти известный Product без Offers (например «Мёд горный», пока нет карточек) — «Сейчас предложений нет.»
2. Найти неизвестный запрос («лакедра») — прежнее «По вашему запросу ничего не найдено.»
3. Найти «Баранина» (есть Offers) — выдача как раньше.

## 11. STOP conditions

- Для известного Product потребуется менять набор/порядок Offers, resolver или OR.
- Нужна новая locale/domain-логика только ради поля ответа (имя берётся из resolver как есть).
- Понадобится `mode`, вход `product_id`, подсказки покупателя, watch-кнопка или любое изменение S7 / S9 / S13 поведения.
- Нужна миграция БД.
