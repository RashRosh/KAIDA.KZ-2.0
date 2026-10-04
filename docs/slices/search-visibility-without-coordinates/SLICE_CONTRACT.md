# Search visibility for addressed Locations without coordinates (stage 5A)

**Status:** APPROVED — IMPLEMENTATION AUTHORIZED (rev 3; финальные коррекции PO 2026-10-03: capability-семантика `routeAvailable`, risk flags)
**Base checkpoint:** `v0.0.46-search-sort-distance` (`c676cbe`)
**Branch:** `slice/search-visibility-without-coordinates-contract` (contract-only)
**Plan:** stage 5A `EXECUTION_PLAN.md` (вставлен решением PO 2026-10-03 перед stage #6; stage #6 — после 5A, Issue #12 остаётся OPEN)

## 1. User task

Покупатель может найти Offer в обычном Search, когда у его Location есть валидный адрес, но координаты недоступны — и KAIDA при этом не притворяется, что distance/routing существуют для такого Offer.

## 2. Product semantics (PO decision 2026-10-03: Location identity ≠ Location coordinates)

- **Address/Location identity — mandatory prerequisite обычной buyer visibility; coordinates — prerequisite только geo-dependent behavior.**
- **Адрес уже гарантирован и заново не строится**: `locations.address_text NOT NULL` + CHECK (`btrim` 1..500) на уровне БД для всех writers, zod-контракт `trim().min(1).max(500)`. Location без непустого адреса невозможна существующими DB/contracts.
- **valid address + no coordinates → Offer видим в ordinary Search** (GET без локации и POST с локацией) в обоих режимах сортировки stage #5.
- **no coordinates → geo-dependent capabilities недоступны и не притворяются**: нет `distanceMeters`; конечный radius «до 1/3/5 км» исключает; **в Nearby не появляется** (S11/UX1C не ревизуются); действие «Маршрут» не показывается (`routeAvailable === false`).
- **Offer page остаётся доступной** для geo-less Offer (generic buyer visibility).
- **Route endpoint сохраняет не раскрывающий 404** (строго координатный destination; никакой address-based routing).
- **Seller-side `buyerVisible` сохраняется как есть** и после ревизии означает: Offer доступен покупателю в ordinary Search / buyer Offer page. Nearby/route/radius capability не кодируются в seller `buyerVisible` (обоснование — §3).

### 2.1 Ranking geo-less Offer — точная детерминированная формула

- **«Сначала актуальнее»** (weights: freshnessWeight = 0.70, distanceWeight = 0.30 при MVP defaults):
  - geo-known: `weightedScore = freshnessScore × 0.70 + distanceScore × 0.30`;
  - **geo-less: `weightedScore = freshnessScore × 0.70` — distance component равен нулю** (`distanceScore` не вычисляется, фиктивное расстояние не подставляется, weights не перенормируются).
  - **Да, это сознательный ranking penalty**: при равном `freshnessScore` geo-known Offer всегда строго выше geo-less на `0.30 × distanceScore > 0`; максимальный возможный score geo-less внутри tier равен `freshnessWeight` (0.70), тогда как у geo-known он достигает 1.0. Penalty ограничен: fresher geo-less Offer обгоняет старый/далёкий geo-known — пример ниже.
  - **Пример (один fresh tier, «Актуальнее»)**: A — geo-less, подтверждён только что (`freshnessScore = 1.0`) → `1.0 × 0.70 = 0.70`; B — geo-known в 1 км (`distanceScore = 0.5`), возраст 24 ч (`freshnessScore = 0.5`) → `0.5 × 0.70 + 0.5 × 0.30 = 0.50`; C — geo-known в 0 м (`distanceScore = 1.0`), возраст ~4.8 ч (`freshnessScore = 0.9`) → `0.9 × 0.70 + 1.0 × 0.30 = 0.93`. Ожидаемый порядок: **C, A, B** — geo-less проигрывает близкому+свежему, но обгоняет старый Offer даже в километре от покупателя.
- **«Сначала ближе»** (weights: 0.30/0.70) — групповое правило без интерливинга:
  1. все geo-known Offers tier по `weightedScore DESC → lastConfirmedAt DESC → Offer.id ASC`;
  2. затем geo-less Offers по `freshnessScore DESC → lastConfirmedAt DESC → Offer.id ASC` (эквивалентно freshness DESC → id, поскольку freshnessScore монотонен по свежести внутри tier).
- Никакой result-set normalization; tie-breakers и Haversine/whole-meter basis stage #5 не меняются.

## 3. Visibility model (минимальная, по решению Controller review)

**Два независимых предиката, никаких новых seller-флагов и seller UI:**

1. **Generic buyer/Search visibility predicate** — lifecycle-eligible + не снят оператором (identity гарантирована схемой). Используется Search GET/POST и buyer Offer page.
2. **Geo-dependent eligibility predicate поверх него** — generic + `isNotNull(latitude)` ∧ `isNotNull(longitude)`. Используется Nearby (`discovery.repository.ts`) и route destination (`buyer-offer-route.repository.ts`) — их поведение не меняется.

**Seller `buyerVisible` остаётся существующим одиночным флагом** (`list-owned-offers.ts`) и после ревизии означает: Offer доступен покупателю в ordinary Search / buyer Offer page. Минимальное изменение — из его формулы уходит член `locationHasGeo` (одна строка); Nearby/route/radius capability в нём не кодируются. **Оценка достаточности:** конкретного consumer, которому нужен seller-side route/Nearby capability, не найдено — продавец и так видит geo-статус точки как отдельную характеристику в workspace (point editor / seller-location-geo-fallback), а видимость Offer'а в Search теперь не зависит от координат. Общей семантической чистотой это не обосновывается.

**Public buyer capability:** Search DTO и buyer Offer DTO получают **`routeAvailable: boolean`** (always-present). **Семантика — capability: поле сообщает клиенту, доступен ли для этого Offer текущий route capability**; оно **не** определяется как «координаты существуют». В текущей реализации значение выводится из существующего route prerequisite — полных координат Location, — что сохраняет публичную capability независимой от implementation detail: будущий address-based routing не потребует переименования/переинтерпретации DTO. Это не `geoKnown`; raw coordinates не раскрываются. Search card и buyer Offer page показывают «Маршрут» **только при `routeAvailable === true`**. Existing route endpoint semantics/404 не меняются.

## 4. Closed contracts — explicit revision (PROJECT_RULES §4)

Основная ревизия — **UX1D-buyer-offer-actionability**:

- **AC1** («Search and Nearby include an active/fresh Offer only when Seller phone and complete Location geo are present») → Search требует Location identity (адрес, гарантированный схемой), **не** координат; Nearby сохраняет требование координат;
- **AC6** («Seller missing phone and/or Location missing geo remains seller-side but its Offer is absent from Search/Nearby») → geo-less Offer отсутствует только в Nearby и radius-фильтре; в Search/Offer page видим;
- **eligibility matrix** («phone+no-geo … excluded») → для Search «no-geo» включён (phone-требование уже снято point-contacts-hours; ревизуется только geo-часть);
- **closed-contract change §S8** («geo-less Location remains legal seller-side, but its Offer is not buyer-visible») → для Search отменяется — частичный возврат к исходной формулировке S8 («Offer referencing geo-less Location remains valid and searchable»), но без geo-dependent возможностей;
- **карточные AC** («Every shown buyer OfferCard has primary actions Позвонить and Маршрут» / «Card contains Позвонить and Маршрут») → карточка с `routeAvailable: false`: `Позвонить` (+ доступные каналы) **без** `Маршрут`;
- **route AC** («resolves the currently eligible Offer … exact associated Location destination»; не раскрывающий 404) — **не меняется**.

Опосредованно, через текст самого UX1D: **S7** («buyer-searchable only when … geo»), **S8**, **S9** («eligibility prerequisites before ranking»). Не затрагиваются: **S11/UX1C** (Nearby geo/radius/distance/order), **S10** (contact semantics), **point-contacts-hours**, **S6**, lifecycle (#1), **UX1B** (media/grid), **UX1A** (shell), **UX2** (seller onboarding), **S15B** (search resolution boundary). S9 ordering уже ревизован stage #5 (v0.0.46) и этим slice не меняется.

Сохраняются без изменений: lifecycle eligibility, freshness tiers (#31), S6 product resolution, transient buyer location, детерминированность, S15B-совместимость, seller-side валидность неполных записей (UX1D AC2).

## 5. Scope

- **Visibility split** (`src/modules/offers/visibility/buyer-offer-visibility.ts`): generic predicate + geo-надстройка; `search.repository.ts` (Search GET/POST + buyer Offer page) → generic; `discovery.repository.ts` (Nearby) и `buyer-offer-route.repository.ts` → geo-надстройка (поведение не меняется).
- **Seller `buyerVisible`**: из формулы в `list-owned-offers.ts` уходит член `locationHasGeo` (одна строка); новых seller-флагов и seller UI нет.
- **Public DTO**: **`routeAvailable: boolean`** (always-present) в Search DTO и buyer Offer DTO; capability-семантика §3 — в текущей реализации выводится из существующего route prerequisite (полные координаты Location); никаких координат и `geoKnown`.
- **Ranking**: geo-less формула §2.1 — defensive-ветка stage #5 становится pipeline-reachable; weights/policy config stage #5 не меняются.
- **Карточка/Offer page**: «Маршрут» только при `routeAvailable === true`; distance-подпись — только при известном расстоянии.
- **i18n**: не требуется (скрытие действия не добавляет текстов; seller UI не меняется).

## 6. Explicit out of scope

- Nearby/Discovery (S11) — geo/radius/distance/order не меняются; UX1C; **новые seller-флаги, seller UI и design gap**; DB schema/migrations; address-based routing (2ГИС по адресу).
- Price/rating/media фильтры, «Только с ценой», «Открыто сейчас»; S15B; Search submit semantics; First Entry; popular queries.
- Persisted location/profile; фоновая geolocation; Backoffice ranking weights; dead-string cleanup.
- Изменение stage #5 UI (B07): sheet, chips, counter-dot, summary, empty-filtered — уже закрыты v0.0.46.

## 7. Risk flags

- **DB migration: NO**
- **public API: YES** — additive always-present `routeAvailable: boolean` в Search DTO и buyer Offer DTO
- **auth/security/privacy: NO** — этот slice не вводит нового storage, логирования, persistence или раскрытия Buyer/Seller coordinates. `routeAvailable` — нечувствительный capability boolean, уже отражённый покупателю доступностью/недоступностью действия «Маршрут». Существующий privacy closed contract сохраняется как regression coverage: raw Seller/Buyer coordinates не появляются в public response DTO (существующие privacy-ассерты s9/s10/s11/ux1d остаются).
- **concurrency/atomicity: NO** · **data loss: NO** · **external service: NO**

## 8. Acceptance criteria

1. Offer с валидным адресом и без координат присутствует в обычном Search без локации, упорядочен по freshness semantics (tier → lastConfirmedAt DESC → id).
2. В «Сначала актуальнее» geo-less Offer ранжируется по `freshnessScore × freshnessWeight` (нулевое distance component, сознательный penalty по §2.1) — без `distanceMeters` и без выдуманного расстояния.
3. В «Сначала ближе» внутри tier все geo-known Offers раньше geo-less; geo-less затем по freshness → id.
4. Конечный радиус «до 1/3/5 км» скрывает geo-less; «Любое» показывает; exact boundary для geo-known не меняется.
5. Geo-less Offer отсутствует в Nearby; S11 семантика не меняется.
6. Offer page geo-less Offer открывается (generic visibility); route endpoint возвращает не раскрывающий 404.
7. Карточка Search и actions Offer page показывают «Маршрут» **только при `routeAvailable === true`**; «Позвонить»/каналы работают; geo-known карточка без изменений.
8. DTO: `routeAvailable` — always-present boolean в Search DTO и buyer Offer DTO; capability-семантика §3 (в текущей реализации выводится из route prerequisite — полных координат Location); raw Seller/Buyer coordinates не появляются в public response DTO (existing privacy regression coverage).
9. Seller `buyerVisible` (без `locationHasGeo`) согласован с ordinary Search / Offer page visibility; новых seller-флагов и seller UI нет.
10. Closed contracts зелёные: S11 Nearby, S10 contacts, lifecycle, S6, UX1B/UX1D для geo-known карточек; ux1d-матрица обновлена только в ревизованной части (no-geo → Search included, Nearby excluded).
11. RU/KK: существующие строки достаточны (новых текстов slice не добавляет).
12. Determinism: идентичные входы дают идентичный порядок во всех режимах (без result-set normalization).

## 9. Automated test plan

- **Unit**: ranking geo-less формулы обоих режимов, включая пример §2.1 (порядок C, A, B в «Актуальнее»), группировку «Ближе», radius/geoless; weights/policy config без изменений (регрессия stage #5).
- **Integration**: eligibility split — Search включает no-geo (GET и POST), Nearby/route исключают; `routeAvailable` — always-present boolean, выводимый из route prerequisite (capability §3); offer page; seller `buyerVisible` без geo-члена; existing privacy regression: raw Seller/Buyer coordinates отсутствуют в public response DTO (существующие ассерты s9/s10/s11/ux1d; **новый logs-audit не добавляется** — slice не меняет логирование).
- **E2E**: seller-точка без координат видна в Search (карточка без «Маршрут», с контактами), отсутствует в Nearby, Offer page открывается без «Маршрут», route 404; privacy (URL/storage/DTO); существующие geo-known потоки без изменений.
- Полный regression — branch CI.

## 10. Manual acceptance scenario (черновик)

1. Seller создаёт точку с адресом; координаты недоступны → публикует Offer.
2. Buyer ищет товар обычным Search → Offer виден: адрес, контакты, без расстояния и без «Маршрут».
3. «Сначала ближе» + «до 1 км» → Offer скрыт; «Любое» → виден после geo-known.
4. Nearby → Offer не показан.
5. Прямая ссылка на Offer page → открывается; действия без «Маршрут»; route endpoint → 404 без раскрытий.
6. Seller в кабинете видит Offer как buyer-visible (существующий бейдж), гео-статус точки — как отдельную характеристику точки.
