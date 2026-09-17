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

- tag: `v0.0.23-mandatory-offer-price`;
- checkpoint commit: `6abc68ac7d67b368c91cc350f48829f839ecc76e`;
- Mandatory Offer Price — CLOSED;
- ранее закрыты `S0–S13`, `UX1A`, `UX1A.1`, `UX1A.2`, `UX1B`, `UX1C`, `UX1D`, `UX2`, `UX2A`.

Текущий `main` может содержать более поздние docs/tooling maintenance commits без нового product checkpoint.

---

# NEXT

## #37 — UX reference audit + source-of-truth normalization

Статус: **COMMITTED maintenance gate**.

До следующего UI/UX product slice необходимо:

- убрать противоречия между live planning/process/design docs;
- нормализовать ownership источников;
- сверить Design System с релевантным UX corpus через `KEEP / ADAPT / REJECT / GAP`;
- обновить media rule: временная demo/placeholder presentation разрешена до M1, но не является real seller media contract;
- закрыть GAP, влияющие на следующий UI-heavy slice;
- получить green branch CI и merge maintenance change в `main`.

Подробности: GitHub Issue #37.

Пока #37 не закрыт, следующий UI/UX product slice не начинается.

---

# COMMITTED — после #37

Порядок выполняется сверху вниз. Перескочить этап можно только после отдельного Product Owner decision и обновления этого файла.

| # | Stage | Owner |
|---|---|---|
| 1 | Seller Entry / contextual auth | Issue #35 |
| 2 | Seller Trading Points Workspace | Issue #36 |
| 3 | Seller Offer Workspace | Issue #27 |
| 4 | Seller Freshness Policy `2 / 7 / 14` | Issue #31 |
| 5 | Seller Freshness Reminder | Issue #32 |
| 6 | Nearby result-first correction | Issue #34 |
| 7 | Search Sorting A — freshness / proximity | Issue #12 |
| 8 | Search Sorting B — price | Issue #12 |
| 9 | M1 — real Offer media | Feature Map / future Slice Contract |
| 10 | S14 — Discovery / `Для вас` | Feature Map |
| 11 | S15 — Search learning | Feature Map |
| 12 | S16 — Operations + MVP boundary review | Feature Map |

### Ключевые dependencies

- Seller Entry должен быть закрыт до перестройки seller workspace.
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

---

# LATER / dependency-gated

AI-input и последующие automation/monetization/promotion/recommendation capabilities не участвуют в ближайшем выборе только потому, что имеют следующий номер в Feature Map.

AI остаётся способом сформировать Seller Change Set, а не способом обойти Offer core.

---

# Re-evaluation gates

Проверять insertion candidates и новые approved requirements:

- после #37 UX audit;
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
