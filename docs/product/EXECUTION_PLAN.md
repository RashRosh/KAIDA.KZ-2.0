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

- tag: `v0.0.24-seller-entry`;
- checkpoint commit: `28eae6d64fac92b71339b3ae2f5235040f75b447`;
- Seller Entry / contextual auth — CLOSED;
- ранее закрыты `S0–S13`, `UX1A`, `UX1A.1`, `UX1A.2`, `UX1B`, `UX1C`, `UX1D`, `UX2`, `UX2A`, Mandatory Offer Price.

Текущий `main` может содержать более поздние docs/tooling maintenance commits без нового product checkpoint.

До Seller Entry был выполнен docs-only maintenance Issue #37: UX reference audit, Design System reconciliation и source-of-truth normalization. Он не создавал отдельный product checkpoint/tag. Evidence хранится в Issue #37 и PR #40.

---

# NEXT

## #36 — Seller Trading Points Workspace

Статус: **COMMITTED product slice**.

Следующая отдельная работа:

- открыть Issue #36;
- проверить relevant closed contracts, включая закрытый Seller Entry #35;
- подготовить compact Slice Contract отдельным проходом;
- не начинать implementation до approval этого contract.

Подробности: GitHub Issue #36.

---

# COMMITTED — после #36

Порядок выполняется сверху вниз. Перескочить этап можно только после отдельного Product Owner decision и обновления этого файла.

| # | Stage | Owner |
|---|---|---|
| 1 | Seller Offer Workspace | Issue #27 |
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

- Seller Entry закрыт и является prerequisite для перестройки seller workspace.
- Trading Points Workspace должен существовать до полноценного Offer Workspace с multiple Locations.
- Freshness Policy и Reminder идут после Offer Workspace, потому что reconfirmation должен жить в нормальном seller UX.
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

## Seller Location geo fallback (proposed S8 revision)

Capability известна из UX follow-up spot-check (`docs/product/UX_REFERENCE_INDEX.md`, 2026-09-21): текущий S8 не даёт альтернативы browser-only geolocation «на месте», если доступ отклонён/недоступен. Draft Slice Contract подготовлен: `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` (status: `PROPOSED — BLOCKED`).

- earliest: не раньше explicit Product Owner approval ревизии закрытого S8 (`PROJECT_RULES.md` §4 STOP procedure);
- trigger: Product Owner рассматривает draft contract и явно утверждает или отклоняет ревизию S8;
- direction: сохранить existing browser-only action как primary path, добавить fallback только при denial/unavailability;
- default without trigger: остаётся unscheduled, S8 behavior не меняется.

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
