# Search filters: sort «Ближе»/«Актуальнее» + расстояние (stage #5, Issue #12)

**Status:** APPROVED — IMPLEMENTATION AUTHORIZED (rev 6A — final stage #5 contract; Controller/PO split decision 2026-10-03: stage #5 сохраняет закрытую UX1D eligibility без изменений; ревизия UX1D выделена в отдельный slice `search-visibility-without-coordinates`, contract-only, вне этого slice)
**Base checkpoint:** `v0.0.45-nearby-result-first`
**Base main:** `0bdfc3a`
**Branch:** `slice/search-sort-distance`
**Visual target:** принятый кадр `docs/product/mockup/seller-ai-first-rev1/B07.dc.html` (Rev 1) **без блока «Цена, ₸»**; ничего нового визуально не проектируется. Цена и «Сначала дешевле» — stage #6.

## 1. User task

Покупатель ищет товар как сегодня; справа от строки поиска (AI-B01 bar) — кнопка «Фильтры» (`i-filter`). Она открывает bottom sheet (AI-B07) с настройками этого slice: сортировка («Сначала ближе» / «Сначала актуальнее») и расстояние («до 1 км», «до 3 км», «до 5 км», «Любое»). Режимы задают относительный приоритет freshness и distance — оба фактора внутри freshness-тира работают всегда, если локация известна; UI не показывает проценты и score. Выбор «Сначала ближе» или конечного расстояния без локации сам запрашивает browser geolocation.

## 2. Ranking policy (PO decisions 2026-10-02/03) — замена S9 ordering semantics

Пайплайн видимых результатов:

```
lifecycle eligibility (без изменений)
→ freshness tier (fresh / ageing; >= 7 суток buyer-ineligible, в Search не появляется)
→ optional radius filter «до 1/3/5 км» (presentation-level, см. §2.7)
→ weighted ranking внутри tier
→ deterministic tie-breakers
```

1. **Freshness tiers первыми и не смешиваются score'ом**: fresh (`< 2 суток`) всегда впереди ageing (`>= 2 и < 7 суток`); никакой weighted score не поднимает ageing Offer выше fresh.
2. **Внутри одного tier оба фактора участвуют всегда при известной Buyer location.**
3. **Ranking weights/configuration** (PO decision, финальная формулировка):
   - веса **принадлежат server-side Search Ranking Policy**. В **этом slice** источник policy — **server-side configuration по существующему project config pattern**; Backoffice management весов **уже не существует** и этим slice не создаётся;
   - **ranking/scoring получает уже валидированный SearchRankingPolicy и не знает источник значений** — архитектурный шов: будущий DB/Backoffice-managed source заменяет текущий config source **без изменения buyer UI, public Search request contract и scoring/ranking functions**;
   - **buyer UI и public Search API передают только sort mode, никогда numeric weights**; strict-валидация отвергает попытку передать веса в запросе;
   - **MVP defaults**: `actuality` = freshness **0.70** / distance **0.30**; `distance` = freshness **0.30** / distance **0.70** — это defaults, не hardcoded business constants;
   - **valid config**: каждый вес — конечное число в [0..1], сумма весов режима равна 1;
   - **missing configuration → deterministic MVP defaults**; **explicitly supplied invalid configuration → fail-fast** (не тихий пересчёт);
   - **current slice НЕ создаёт DB storage, API или Backoffice UI для policy management**;
   - не создавать generic configuration framework «на будущее» — только минимальный Search Ranking Policy seam, нужный этому slice;
   - конфигурация — общая server-side policy, не пользовательская настройка;
   - **freshness eligibility/tier policy остаётся отдельным hard business rule и этими weights не управляется**.
4. **Scoring абсолютный и детерминированный. Запрещена нормализация относительно текущего result set** (min/max по найденным Offers): добавление/удаление другого Offer не меняет score существующих. MVP basis (фиксируется контрактом, unit-tested):
   - `freshnessScore` — линейный абсолютный возраст внутри своего tier (более свежий → больший score):
     fresh (0 ≤ age < 48h): `freshnessScore = 1 − age / 48h`;
     ageing (48h ≤ age < 168h): `freshnessScore = 1 − (age − 48h) / 120h`;
     значения (0..1]; функция и boundary (0, 48h, 168h) покрыты unit-тестами;
   - `distanceScore = 1 / (1 + distanceKm)` — абсолютное затухание от existing S9 derived whole-meter Haversine distance (`distanceKm = rankingDistanceMeters / 1000`); 0 км ≈ 1; не нормализуется по выборке;
   - `weightedScore = freshnessScore × freshnessWeight + distanceScore × distanceWeight`.
5. **Ordering внутри tier**: `weightedScore DESC → lastConfirmedAt DESC → Offer.id ASC`. Exact score tie разрешается freshness, затем id — детерминированно.
6. **Geo-less Offers (UX1D сохраняется без изменений в этом slice)**: закрытая UX1D eligibility остаётся в силе — Offer без Location geo **не появляется в реальном Search pipeline ни в одном режиме** (SQL-level `buyerVisibleOffersPredicate` не меняется этим slice), так же как и в Nearby. Ranking-функция сохраняет безвредную defensive-обработку `locationGeo = null` (без distance component, без перенормировки, без выдуманного расстояния) — это внутренняя robustness чистой функции, **а не user-facing acceptance behavior этого slice**; через реальный pipeline такие кандидаты не доходят. Конечный radius тривиально не включает geo-less Offers, поскольку их нет в выдаче.
7. **Radius** «Любое / до 1 / 3 / 5 км» — stage #5, presentation-фильтр **на клиенте** поверх complete Search response + `distanceMeters` (принято для текущей архитектуры; Search сегодня не имеет pagination/server-side limit). **Architectural boundary:** если Search позже получает pagination или server-side result limit, client-only radius filtering обязан быть пересмотрен — фильтровать неполную серверную выборку и считать её полным radius-result нельзя. Boundary фиксируется в коде-комментарием у фильтра и в этом контракте.

## 3. Closed contracts — explicit revision (PROJECT_RULES §4)

- **S9 ranking/presentation**: ordering-mode становится явным выбором покупателя с weighted policy §2; лексикографическая S9-схема «tier → distance → freshness → id» при известной локации заменяется weighted scoring (tie-breakers и Haversine/whole-meter basis сохраняются); public Search DTO получает **additive derived whole-meter `distanceMeters`** у geo-known Offers при любом режиме, если запрос содержал buyer location (нужно для подписей, радиуса и счётчика); s11-ассерт «Search DTO без `distanceMeters`» сужается до «Search DTO без raw координат».
- **Search API semantics (S0/S7)**: additive sort-mode параметр GET/POST; существующие формы запроса валидны; strict zod validation. **Веса в public API не входят и не появятся.**
- **UX2A / search shell**: удаляется standalone pin-geo-кнопка и её production logic (PO отклонил в visual review, Issue #12); явный submit, доступность, размещение поиска не меняются. **Неиспользуемые i18n-ключи `search.location*` НЕ удаляются.**
- **UX1B/UX1D карточка**: переиспользуется существующий `ResultCard` c `distanceMeters` (как в B07: «Тастак, место 31» + «Овощной ряд · 0,8 км»); нового содержимого карточка не получает.
- **UX1D eligibility — сохраняется без изменений этим slice** (Controller/PO split decision 2026-10-03): geo-less Offers остаются исключёнными из Search/Nearby; ревизия UX1D geo-eligibility выполняется отдельным slice `search-visibility-without-coordinates` и в stage #5 не входит.

Сохраняются без изменений: lifecycle eligibility, freshness tiers и #31 policy, S6 product resolution, transient buyer location (не сохраняется в localStorage/sessionStorage/cookies/URL, не логируется как profile state), неактивные/просроченные Offers не участвуют, детерминированность, S15B-совместимость, S10 contact semantics, seller-side валидность неполных записей (UX1D AC2), Nearby S11 целиком.

## 4. Scope

- **Ranking/domain**: sort-mode параметр; **server-side ranking policy configuration** (режим → веса; валидация; fail-fast; безопасные MVP defaults в коде); weighted ranking §2 (абсолютные score-функции, tie-breakers); defensive-обработка `locationGeo = null` в ranking-функции; расстояние/`distanceMeters` считаются как раньше (S9 Haversine, whole meters). **`buyerVisibleOffersPredicate` не изменяется.**
- **Public API** (`/api/search`): additive sort-mode параметр; strict validation; privacy DTO (только derived `distanceMeters`, никогда raw координаты; никаких новых visibility-маркеров в этом slice).
- **Radius-фильтр**: client-side поверх complete response + `distanceMeters` (мгновенно, без запроса); конечный радиус скрывает Offers дальше радиуса; смена sort mode = новый запрос (ranking — server authority); architectural boundary §2.7 в коде.
- **UI по B07** (без ценового блока):
  - кнопка «Фильтры» (`ib`, `i-filter`) справа от строки поиска в состоянии результатов; счётчик-точка = число настроек ≠ default; активное состояние `primary-soft`;
  - bottom sheet `role=dialog`: grab, «Фильтры» + закрытие; **Сортировка** — radiogroup из `li`-строк с радио («Сначала ближе», «Сначала актуальнее»); **Расстояние** — chips radiogroup («до 1 км», «до 3 км», «до 5 км», «Любое»);
  - главная кнопка «Показать N предложений» (N пересчитывается при каждом изменении), «Сбросить» → defaults («Сначала актуальнее», «Любое»);
  - applied-состояние: чипы активных фильтров под поиском, снимаются крестиком по одному, выдача обновляется сразу; строка-резюме «N предложений · до 3 км · сначала ближе»;
  - no-location состояние в sheet: серый баннер с кнопкой «Разрешить геолокацию» (B07 · No location) — путь retry; выдача остаётся «Сначала актуальнее»;
  - empty-из-за-фильтров состояние (B07 · Empty): «С такими фильтрами ничего нет», «Сбросить фильтры», «Изменить фильтры», число без фильтров; отдельно от обычного пустого поиска;
  - удаление pin-кнопки и её production logic из `SearchScreen`;
  - distance-подписи на карточках при известной локации — при любом режиме.
- **i18n**: новые строки `ru` + `kk` (тексты B07, помещаются от 320 px). Старые неиспользуемые `search.location*` ключи не трогаются.

### Geolocation intent (PO decision 2026-10-02, ревизия заметки B07)

- Открытие Search/«Фильтров» само geolocation **не** запускает.
- Выбор «Сначала ближе» **или конечного radius (1/3/5 км)** при отсутствии Buyer location — сам является explicit geo intent и вызывает browser geolocation; отдельное предварительное «Разрешить геолокацию» не требуется.
- Кнопка «Разрешить геолокацию» из B07 используется как **retry** после denial/unavailable.
- **Denial/unavailable**: ordinary Search работает; sort возвращается/остаётся «Сначала актуальнее»; finite radius сбрасывается в «Любое»; concise B07-feedback + retry; UI не притворяется, что geo-dependent setting активен.

## 5. Explicit out of scope

- **Ревизия UX1D geo-eligibility (geo-less Offers в обычном Search)** — отдельный slice `search-visibility-without-coordinates` (contract-only подготовлен, не начинается до полного закрытия stage #5 и APPROVED PO). Этим slice: `buyerVisibleOffersPredicate` не изменяется, generic offer-page/route visibility не изменяются, никакие `geoKnown`/`routeAvailable` visibility-маркеры в DTO не вводятся.
- **Backoffice UI для управления ranking weights** — подключается позже к policy-модулю без изменения ranking logic; этот slice строит только policy-модуль.
- Блок «Цена, ₸» и сортировка «Сначала дешевле» — stage #6 (в sheet их строк нет вообще, без мёртвых контролов).
- Rating/media/location-type фильтры, «Только с ценой», «Открыто сейчас».
- S15B, Search submit semantics, popular queries, First Entry demo.
- Nearby/Discovery (S11), UX1C intent, seller UI, DB schema, карта/маршруты.
- Persisted location/profile, фоновая geolocation, новые иконки.
- Dead-string cleanup старых `search.location*` ключей.

## 6. Risk flags

- **DB migration: NO**
- **public API: YES** — additive sort-mode параметр + additive derived `distanceMeters` в DTO; strict validation; privacy-asserts.
- **auth/security/privacy: YES** — geolocation только по явному действию; coordinates transient; в DTO только derived whole-meter `distanceMeters`, raw Buyer/Seller coordinates никогда не появляются.
- **concurrency/atomicity: NO** · **data loss: NO** · **external service: NO**

## 7. Acceptance criteria

1. Обычный поиск без локации: явный submit, чистая freshness semantics (tier → lastConfirmedAt DESC → id), geolocation не запрашивается.
2. «Фильтры» по B07 без ценового блока: radiogroup сортировки (2 пункта), chips расстояния (4), «Показать N предложений», «Сбросить»; отдельной pin-кнопки в Search нет.
3. Freshness tiers первыми: ageing Offer не стоит выше fresh ни в одном режиме, никаким score.
4. Внутри tier оба фактора работают при известной локации: «Актуальнее» может поставить более свежий, но более дальний Offer выше; «Ближе» в том же наборе может поменять их местами; проценты/score и численные веса в UI не видны и клиентом не передаются (запрос с весами отвергается валидацией).
5. Score абсолютный: добавление/удаление unrelated Offer не меняет порядок существующих (нет result-set normalization); веса читаются из server-side policy, невалидная конфигурация fail-fast, безопасные defaults не меняют tier eligibility.
6. Конечное расстояние скрывает Offers дальше радиуса; «Любое» показывает все; ровно radius — включён; чипы снимаются крестиком; счётчик-точка и строка-резюме по B07.
7. Geo intent: «Сначала ближе» или конечный радиус без локации сам вызывает prompt; denial → sort «Сначала актуальнее», radius «Любое», concise feedback + retry, обычный поиск работает, притворной активности нет.
8. Empty-из-за-фильтров состояние по B07; «Сбросить фильтры» возвращает defaults.
9. Privacy: raw координаты не появляются в DTO, URL, localStorage/sessionStorage/cookies; `distanceMeters` — только derived whole-meter при запросе с локацией; location transient; reload не запрашивает геолокацию сам.
10. RU и KK: строки B07 на обоих языках, помещаются от 320 px; смена языка не сбрасывает настройки и результаты.
11. **UX1D eligibility сохранена**: geo-less Offer отсутствует в Search/Nearby при любом режиме (закрытая UX1D AC1/AC6 без изменений); route endpoint и offer-page visibility не изменены.
12. Closed-contract guarantees зелёные (lifecycle eligibility, S6 resolution, детерминированность, S10 contact semantics, UX1D card actions); существующие S9/S7/s11 e2e обновлены только в части ревизованных assumptions (ordering, DTO distance, pin-кнопка).

## 8. Automated test plan

- **Unit — weighted ranking** (по поручению PO, минимум):
  - fresh tier всегда выше ageing независимо от distance/score **и независимо от значений весов из policy**;
  - внутри одного tier «Актуальнее» ставит более свежий, но более дальний Offer выше;
  - в том же наборе «Ближе» меняет их местами;
  - изменение unrelated third Offer не меняет score/order пары (никакой result-set normalization);
  - exact score tie → lastConfirmedAt DESC → Offer.id ASC;
  - defensive `locationGeo = null` handling чистой ranking-функции: без distance component, без перенормировки (pure-function assertion; через реальный Search pipeline недостижимо при сохранённой UX1D);
  - exact radius boundary (Offer ровно на radius) включён;
  - `freshnessScore` boundary: age = 0, 48h, 168h; монотонность по возрасту внутри tier;
  - **ranking policy configuration**: режим → корректные веса (MVP defaults 0.70/0.30 и 0.30/0.70); валидация (вес ∈ [0..1], сумма = 1); недопустимая конфигурация → fail-fast; изменение весов не влияет на tier eligibility.
- **Integration** (API): sort-mode параметр валиден и строг (мусор → 400); **передача численных весов клиентом отвергается strict-валидацией**; `distanceMeters` в DTO только при buyer location и у geo-known Offers; без локации DTO без distance; raw координаты не появляются ни в каком ответе; geo-less Offers остаются исключёнными из location-aware и location-less Search (UX1D сохранена).
- **E2E** (production build; адаптация existing search/s9/s11 specs): default search без geo; sheet по B07-структуре; «Ближе» без локации → prompt сам → ordering + distance-подписи; конечный радиус фильтрует, чип снимается; counter-dot и резюме-строка; denial → revert + feedback; no pin button; empty-из-за-фильтров; privacy-assert (URL/storage/DTO); kk-локаль. Обновление s11-ассерта «без raw координат».
- Полный regression — branch CI.

## 9. Manual acceptance scenario

1. Найти «помидоры» — привычные результаты; «Фильтры» видно, geo не запрашивался.
2. «Фильтры» → «Сначала ближе» → prompt приходит сам; разрешить → карточки с расстояниями; для двух Offers внутри одного freshness tier переключение «Актуальнее» ↔ «Ближе» может изменить их взаимный порядок согласно весам; fresh tier при этом всегда целиком выше ageing tier.
3. «Сначала актуальнее» → свежесть преимущественно выигрывает, подписи расстояний остаются.
4. «до 1 км» → только близкие, чип под поиском, счётчик на кнопке; «Любое» → все вернулись.
5. Запретить геолокацию → «Сначала ближе» и «до 3 км» → баннер с «Разрешить геолокацию» (retry), сортировка честно «Сначала актуальнее», радиус «Любое», поиск работает.
6. Сузить радиус до пустоты → «С такими фильтрами ничего нет» → «Сбросить фильтры» → всё вернулось.
7. Pin-кнопки нет; reload — geo сам не запрашивается; RU/KK переключение не ломает sheet и настройки.
