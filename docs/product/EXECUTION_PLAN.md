# KAIDA.KZ 2.0 — Current Execution Plan

Этот документ является **единственным каноническим источником текущей очередности работ**.

Он отвечает только на четыре вопроса:

1. какой verified checkpoint последний;
2. что делаем следующим;
3. какие product stages уже committed;
4. какие capabilities могут быть вставлены позже по trigger.

Подробные требования живут в GitHub Issues и Slice Contracts, а не дублируются здесь.

## Source ownership

- process / verification / stable boundaries → `docs/PROJECT_RULES.md`;
- current execution order → этот файл;
- long-range capability/dependency map → `docs/product/FEATURE_MAP.md`;
- visual/presentation rules → `docs/DESIGN_SYSTEM.md`;
- exact slice behavior → `docs/slices/**/SLICE_CONTRACT.md`;
- unresolved detailed requirements → GitHub Issues.

Перед началом работы исполнитель обязан самостоятельно проверить фактический `main`, tags и CI. SHA ниже фиксирует состояние на момент обновления, а не заменяет repository check.

## Последний verified product checkpoint

- tag: `v0.0.26-buyer-interest-guest-visibility`;
- checkpoint commit: `f7e4b08c06f97dd8878666f726a5aadd93240d48`;
- Buyer interest ("heart") visibility for guests — CLOSED: anonymous buyers see the same interest control as authenticated buyers, click opens the shared Auth modal with context, interest is applied automatically after successful auth, no anonymous Interests API call; folded in the same checkpoint after manual acceptance surfaced three adjacent fixes — header identity indicator (logout icon button instead of raw phone number), Auth modal phone input live-formatting, Nearby dropping its redundant intro block once real results load in favor of a results header + refresh control;
- ранее закрыты `S0–S13`, `UX1A`, `UX1A.1`, `UX1A.2`, `UX1B`, `UX1C`, `UX1D`, `UX2`, `UX2A`, Mandatory Offer Price, Seller Entry / contextual auth (#35), Seller Trading Points Workspace (#36).

Текущий `main` может содержать более поздние docs/tooling maintenance commits без нового product checkpoint.

До Seller Entry был выполнен docs-only maintenance Issue #37: UX reference audit, Design System reconciliation и source-of-truth normalization. Он не создавал отдельный product checkpoint/tag. Evidence хранится в Issue #37 и PR #40.

---

# NEXT

## UI redesign stabilization gate — feature freeze

Статус: **PRODUCT FEATURE FREEZE / UX RESET** — Product Owner decision 2026-09-22.

Текущий UX признан неудовлетворительным. До закрытия этого gate новые product capabilities из очереди ниже не начинаются.

Ветка `slice/seller-offer-workspace` / `3b029d3` **не допускается к PR/merge/checkpoint**. Её локальные automated results не являются UX acceptance, её page composition не является базой нового UI.

**Судьба ветки (Product Owner decision, 2026-09-23): удалить после переноса полезного.** Ревью показало, что переносить нечего: единственная независимая находка — исправление перехвата фокуса в overlay — относится к компонентам `Modal.tsx` и `BottomSheet.tsx`, которых на `main` не существует (созданы коммитами `4818261` и `f5c2dfb` самой ветки). Патч применять не к чему, поэтому сохранено правило, а не код: `DESIGN_SYSTEM.md` §13.1. История коммитов остаётся в Git; сама ветка удаляется, чтобы будущий агент не принял её за актуальное направление разработки.

Обязательная последовательность gate:

1. преобразовать исходные wireframes в compact navigation/state/action/data specification для ключевых buyer/seller flows;
2. включить в specification обязательный глобальный switch русского/казахского языка и полное покрытие обоих языков для всех KAIDA-owned strings, system states, accessibility copy и catalog-owned display data; responsive presentation следует `DESIGN_SYSTEM.md`;
3. определить responsive rules для desktop без попытки дорисовать 42 независимых desktop-экрана;
4. подготовить статический либо fixture-driven prototype ключевых flows поверх нового UI shell и показать каждый core flow на русском и казахском;
5. получить Product Owner UX acceptance композиции, переходов, состояний и обеих языковых версий;
6. подготовить localization Slice Contract (locale persistence/fallback, catalog representation, bilingual Search proof, единая модель перевода seller-authored names/addresses/comments) и переписать Slice Contract #27 либо заменить его несколькими компактными UI slice contracts;
7. реализовать принятый UI поверх существующих domain modules, API, DB и closed core contracts;
8. для каждого vertical slice выполнить targeted proof в обеих локалях, full branch CI, manual acceptance, diff audit, merge, merged-main CI и checkpoint по `PROJECT_RULES.md` §19.

Working draft для шагов 1–3: `docs/product/UX_NAVIGATION_STATE_SPEC.md`. Он остаётся draft до Product Owner review и не разрешает начинать production UI branch.

### Ход gate

| Шаг | Статус на 2026-09-23 |
|---|---|
| 1–3 | Выполнены как draft: `UX_NAVIGATION_STATE_SPEC.md` (12 поверхностей, ~28 состояний, три цепочки F1–F3, responsive rules) |
| 4 | **Прототип проверен; замечания закрыты.** Locator: https://claude.ai/artifact/B5PDSyednY4pNtmhAtC9tN. `S-07__zero-create → address-selected` совпадает по адресу в `ru`/`kk`; до выбора `aria-selected="false"`. Остальные исправления приняты ранее. Evidence и вердикт — `WIREFRAME_PASS3_REVIEW.md` §12 |
| 5 | **Ожидает Product Owner visual acceptance.** После одобрения композиции, переходов, состояний и двух языковых версий можно переходить к шагу 6 |
| 6–8 | Не начаты |

Решения Product Owner, принятые 2026-09-23 по итогам ревью прохода 3 (каждое зафиксировано в файле-владельце):

- внешние зависимости — `PROJECT_RULES.md` §10.1;
- подсказки адреса из собственного справочника, без внешнего геокодера и без обязательной карты — `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` §9, `FEATURE_MAP.md`;
- единица измерения — controlled choice + `Другое` — `FEATURE_MAP.md`;
- модель локализации каталога и правила автоперевода seller-контента — `FEATURE_MAP.md`;
- текст ошибки без декоративного технического кода — `DESIGN_SYSTEM.md` §7.1;
- поведение фокуса в overlay — `DESIGN_SYSTEM.md` §13.1.

Граница redesign: presentation layer можно пересобирать с нуля; изменения auth/ownership/privacy/persistence/pricing/Offer lifecycle/ChangeSet/public API проходят отдельную contract revision по `PROJECT_RULES.md` §4 и §18.2.

Подробности и исторический rejected pass: GitHub Issue #27, `docs/slices/seller-offer-workspace/SLICE_CONTRACT.md` §10–11.

---

# FROZEN COMMITTED QUEUE — после UI redesign checkpoint

Эти stages сохраняют порядок, но ни один из них не стартует до закрытия UI redesign stabilization gate. Перескочить этап можно только после отдельного Product Owner decision и обновления этого файла.

| # | Stage | Owner |
|---|---|---|
| 1 | Seller Location geo fallback (paste-and-parse, S8 revision) | `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` |
| 1a | KAIDA address directory на открытых данных (подсказки адреса) | `FEATURE_MAP.md` / future Slice Contract |
| 2 | Seller Freshness Policy `2 / 7 / 14` | Issue #31 |
| 3 | Seller Freshness Reminder | Issue #32 |
| 4 | Nearby result-first correction | Issue #34 |
| 5 | Search Sorting A — freshness / proximity | Issue #12 |
| 6 | Search Sorting B — price | Issue #12 |
| 7 | M1 — real Offer media | Feature Map / future Slice Contract |
| 8 | S14 — Discovery / `Для вас` | Feature Map |
| 9 | S15 — Search learning | Feature Map |
| 10 | S16 — Operations + MVP boundary review | Feature Map |

### Ключевые dependencies

- Seller Entry и Trading Points Workspace закрыты и остаются проверенным product core; их текущая presentation не обязана сохраняться в redesign.
- Geo fallback остаётся первым product stage после redesign checkpoint: contract утверждён (2026-09-22, S8 revision), но feature freeze запрещает начинать его раньше.
- Address directory (stage 1a) идёт **после** geo fallback, а не вместо него: подсказки адреса — улучшение поверх пути, который обязан работать без них (`PROJECT_RULES.md` §10.1). Ручной ввод адреса и действие «я на точке» доступны в initial UI; вставка ссылки активируется только на stage 1, подсказки — только на stage 1a. Принятый prototype может показывать целевую композицию с явной маркировкой future data source, но UI implementation не имеет права молча реализовать stages 1/1a внутри redesign slice. Первый шаг stage 1a — проверка покрытия адресов Алматы, licence/attribution requirements и operational модели выбранного открытого источника.
- Freshness Policy и Reminder идут после redesign checkpoint и geo fallback, потому что reconfirmation должен жить в принятом seller UX.
- Search Sorting выполняется после Freshness Policy, чтобы sorting не закрепил устаревшую ranking semantics.
- M1 вводит настоящие seller-provided Offer media end-to-end; временные pre-MVP visuals M1 не заменяют.

---

# INSERTION CANDIDATES

Insertion candidate не имеет жёсткого номера. Он рассматривается **только на checkpoint/re-evaluation boundary** и никогда не вклинивается внутрь уже открытого slice.

## Market internal navigation — Issue #10

- earliest sensible point: после ближайшего seller workspace/freshness contour;
- trigger: пилот на крупных рынках показывает, что обычного route до Location недостаточно;
- direction: Market directory → scheme/MarketPlaces → Location binding → buyer internal navigation;
- default without trigger: остаётся unscheduled.

## Additional Search filters

- earliest: после Sorting A/B и появления достаточно плотной выдачи;
- trigger: реальные result sets показывают, что одной сортировки недостаточно;
- возможные направления: radius, price range, later media/rating/location-type filters только при наличии соответствующих данных/contracts;
- default without trigger: не добавлять giant filter drawer.

## M2 — Offer video

- earliest: после M1;
- trigger: фото недостаточно для подтверждённого seller/buyer use case;
- default without trigger: defer/skip.

## Reviews / Rating

Capability известна, но отдельный committed slice ещё не определён.

- trigger: Product Owner утверждает конкретный trust/review use case и moderation/media semantics;
- до этого нельзя показывать fake rating/reviews;
- если необходимость появится до MVP boundary — оформить Issue и insertion decision.

## OTP resend + timer

Capability из второго follow-up spot-check (`docs/product/UX_REFERENCE_INDEX.md`, 2026-09-21): `AuthModal.tsx` не имеет вообще никакого resend-механизма. UX-паттерн (кнопка + короткий таймер + одинаковый код при повторе) задокументирован в корпусе, но `S2-auth/FEATURE_SPEC.md` explicitly выносит `OTP resend throttling` / `resend policy` / `delivery failure/retry policy` за scope S2.

- earliest: unscheduled — требует explicit product/security решения, не только UI;
- trigger: Product Owner выбирает между (a) naive resend поверх существующего `/api/auth/otp/request` без throttling — тот же класс принятого pre-launch допущения, что и видимый test OTP код, или (b) отдельный slice с реальной resend/throttling policy ближе к launch;
- default without trigger: остаётся unscheduled.

## Unify buyer Search entry points

Capability из того же follow-up spot-check: `HeaderSearch` (full-page GET) и `SearchForm` (client-side fetch) на `/` ведут себя по-разному, что совпадает с именованным антипаттерном из UX-референса. Не задевает closed UX2A/App Shell acceptance criteria (те фиксируют только visual submit pattern).

- earliest: unscheduled — не в COMMITTED очереди;
- trigger: Product Owner decision о приоритете этой чистки относительно текущей COMMITTED очереди;
- direction: унифицировать submission behavior (вероятно — оба поля через client-side fetch), не меняя closed Search semantics (S0/S6/S7/S9) или UX2A visual submit pattern;
- default without trigger: остаётся unscheduled UNPLACED GAP.

---

# LATER / dependency-gated

AI-input и последующие automation/monetization/promotion/recommendation capabilities не участвуют в ближайшем выборе только потому, что имеют следующий номер в Feature Map.

AI остаётся способом сформировать Seller Change Set, а не способом обойти Offer core.

---

# Re-evaluation gates

Проверять insertion candidates и новые approved requirements:

- после seller workspace + freshness contour;
- после Search Sorting;
- после M1;
- после S16 перед решением о MVP/public beta.

Если утверждённое требование не имеет места ни в COMMITTED, ни в INSERTION CANDIDATES, ни в Feature Map, оно получает статус **UNPLACED GAP** и разбирается явно.

---

# Как выбирать следующую работу

Перед новым Slice Contract:

1. проверить `main`, latest verified checkpoint/tag и CI;
2. прочитать этот файл;
3. взять первый незакрытый COMMITTED stage;
4. открыть owning Issue / Feature Map entry;
5. проверить relevant closed contracts;
6. подготовить compact Slice Contract;
7. не менять очередь по старому чату, UX backlog или numeric `Sxx` без Product Owner decision.

Наблюдение или идея проходит путь:

```text
observation
→ Issue / observation inbox
→ Product Owner decision
→ Execution Plan insertion if needed
→ Slice Contract
→ implementation
→ verified checkpoint
```
