# S11 — Discovery / Что есть рядом

**Status:** DESIGN APPROVED CONDITIONALLY; IMPLEMENTATION BLOCKED  
**Base checkpoint:** `v0.0.11-s10`  
**Base main:** `eaeaad8900b59e23429860ecf5d5299d81ba61ce`  
**Branch:** `slice/s11-discovery`

## 1. User task

П1 открывает раздел `Рядом`, явно разрешает использование своего текущего местоположения и видит актуальные Offers, которые находятся поблизости.

Canonical flow:

`Buyer location → active/fresh Offers → Location geo → nearby filter → distance ordering → Buyer`

Поисковый запрос Product для этого сценария не требуется.

## 2. Scope

В S11 входит:

- отдельный Buyer-раздел `Рядом`;
- работа без обязательной авторизации;
- browser geolocation только после явного действия П1;
- использование полной пары `latitude + longitude` только для конкретного Nearby request;
- отдельный additive public Discovery API;
- только актуальные Offers по существующим S1 lifecycle rules;
- только Offers, чьи Locations имеют сохранённую geo-точку;
- фильтрация по одному server-side `nearbyRadiusMeters` policy;
- тот же Haversine + whole-meter distance contract, что закреплён S9;
- детерминированная сортировка `distanceMeters ASC → lastConfirmedAt DESC → Offer.id ASC`;
- отдельный Discovery response с вычисленным `distanceMeters` без raw Seller coordinates;
- loading / empty / geolocation error states;
- сохранение существующих S10 contact semantics в Buyer Offer representation.

`nearbyRadiusMeters` задаётся серверной конфигурацией/policy. Клиент не передаёт и не выбирает радиус. Конкретное значение policy не является публичным API contract.

## 3. Public Discovery API contract

S11 добавляет только:

`POST /api/discovery/nearby`

Nearby coordinates не передаются через URL/query string.

Strict request body:

```json
{
  "buyerLocation": {
    "latitude": 43.238949,
    "longitude": 76.889709
  }
}
```

Request rules:

- body должен содержать ровно `buyerLocation`;
- `buyerLocation` должен содержать ровно `latitude` и `longitude`;
- оба значения обязательны, finite numeric;
- latitude находится в `[-90, 90]`;
- longitude находится в `[-180, 180]`;
- partial point и unknown fields не принимаются.

Invalid JSON или invalid Buyer point:

```text
HTTP 400
{
  error: {
    code: "INVALID_NEARBY_REQUEST",
    message: "Проверьте местоположение."
  }
}
```

Successful response:

```text
HTTP 200
{
  offers: [
    {
      id,
      product: { id, name },
      seller: {
        id,
        displayName,
        contacts?: existing S10 public contacts
      },
      location: { id, name, addressText },
      price: existing Search price shape | null,
      sellerComment: string | null,
      distanceMeters: non-negative integer
    }
  ]
}
```

Discovery переиспользует существующую публичную Buyer Offer projection S7/S10 и добавляет только `distanceMeters` в собственный Discovery DTO.

`distanceMeters` не добавляется в `GET /api/search`, `POST /api/search` или существующий Search Offer contract.

Discovery response не содержит:

- Seller `latitude` / `longitude` / `geo`;
- Buyer coordinates / `buyerLocation`;
- `lastConfirmedAt`;
- radius policy;
- rank/score.

S11 не требует auth. Анонимный valid request получает обычный Discovery response.

## 4. Radius and distance semantics

Для Offer с полной `Location.geo` считается Haversine distance по закрытой S9 semantics:

```text
R = 6 371 008.8 meters
rawDistanceMeters = Haversine(...)
distanceMeters = Math.round(rawDistanceMeters)
```

Именно `distanceMeters`, то есть rounded whole-meter distance, участвует и в radius filtering, и в публичном Discovery response.

Nearby eligibility:

```text
distanceMeters <= nearbyRadiusMeters
```

Граница включена.

Следовательно:

- `distanceMeters < nearbyRadiusMeters` → included;
- `distanceMeters == nearbyRadiusMeters` → included;
- `distanceMeters > nearbyRadiusMeters` → excluded.

После eligibility results сортируются:

```text
1. distanceMeters ASC
2. lastConfirmedAt DESC
3. Offer.id ASC
```

`lastConfirmedAt` является внутренним tie-breaker и не публикуется.

Location без geo не имеет `distanceMeters`, не участвует в Nearby и продолжает оставаться легальной/searchable по закрытым S8/S9 contracts.

## 5. Explicit out of scope

Не входят:

- Product search внутри `Рядом`;
- Category navigation;
- personalization / interests / recommendations;
- ML/AI ranking;
- rarity;
- sponsored Offers;
- пользовательская настройка radius;
- карты, маршруты, travel time;
- geocoding/reverse geocoding;
- PostGIS/spatial indexes;
- background location / `watchPosition()` / polling;
- сохранение Buyer location;
- Buyer home point/location history;
- geo по IP;
- geo-less Offers в Nearby;
- pagination/infinite scroll;
- изменения Offer lifecycle;
- изменения Search ranking или Search DTO;
- изменения Seller geo editing;
- изменения Seller contacts;
- новые DB entities.

Если browser geolocation недоступна или запрещена, система не подменяет Nearby глобальной лентой всех Offers.

## 6. Закрытые contracts, которые S11 использует

**S1 Offer lifecycle:** только `status = active AND last_confirmed_at > freshness cutoff`; отдельной Discovery freshness model нет.

**S7 Real Seller Offers:** Discovery читает обычные committed Offers из существующего source of truth; отдельной публикации/index entity нет.

**S8 Location Geo:** geo принадлежит Location; raw Seller coordinates остаются private; geo-less Location остаётся легальной и searchable обычным Search.

**S9 Search ranking / geo semantics:** переиспользуются Buyer point validation, Haversine constant, whole-meter rounding и deterministic distance/freshness/id ordering semantics. Search eligibility и Search public response не меняются.

**S10 Buyer actions:** public Seller contacts и правила формирования buyer actions не меняются.

## 7. Закрытые contracts, которые потенциально затрагиваются

**S8 privacy boundary:** Discovery читает `Location.geo` только как internal calculation input. Raw Seller geo наружу не выходит.

**S9 privacy/Search boundary:** S11 имеет собственный DTO с `distanceMeters`. Это не разрешает публиковать distance, raw geo, Buyer location или `lastConfirmedAt` через Search.

**S1 lifecycle:** Discovery не вводит отдельную трактовку active/expired.

**S10 contacts:** форматы, ownership и link-generation contacts не меняются.

Обязательного изменения closed contract S0-S10 не требуется.

## 8. Risk flags

- **DB migration: NO** — новых таблиц, колонок, индексов и migrations нет.
- **Public API: YES** — новый additive `POST /api/discovery/nearby` с отдельным strict contract.
- **Auth/security/privacy: YES** — Buyer location является transient request input; raw Seller geo остаётся private.
- **Concurrency/atomicity: NO** — read-only capability, новых concurrent mutations нет.
- **Data loss: NO** — Discovery не изменяет persistent product data.
- **External service: NO** — внешние map/geocoding APIs не используются; browser geolocation не является серверной external integration.

## 9. Ожидаемые модули изменения

Ожидаются только необходимые границы:

- `Discovery` как новая функциональная область nearby selection;
- Buyer UI / routing для `Рядом` и transient geo state;
- API boundary Discovery;
- read-only использование существующих Offers lifecycle и Location geo данных;
- переиспользование публичной Buyer Offer/Seller contacts projection;
- targeted S11 tests и S11 documentation.

Не ожидаются schema/migration changes, Identity business logic changes, Seller Input, Catalog resolver или Seller management changes.

## 10. Acceptance criteria

1. Анонимный П1 может открыть `Рядом`; login не обязателен.
2. Browser location не запрашивается автоматически при загрузке страницы.
3. После явного действия П1 запрашивается одна текущая geo-точка.
4. `POST /api/discovery/nearby` принимает только strict complete finite Buyer point и invalid input получает `400 INVALID_NEARBY_REQUEST`.
5. Buyer location не сохраняется между reload и не становится profile/session state.
6. В Nearby входят только active и fresh Offers по неизменённому S1 contract.
7. Offer с Location без geo отсутствует в Nearby, но продолжает работать в обычном Search.
8. Radius filter использует `distanceMeters = Math.round(Haversine(...))` и inclusive rule `distanceMeters <= nearbyRadiusMeters`.
9. Offer ровно на radius boundary включён; Offer на один whole meter дальше исключён.
10. Nearby results детерминированно сортируются `distanceMeters ASC → lastConfirmedAt DESC → Offer.id ASC`.
11. Discovery response публикует `distanceMeters`, но не Seller raw geo, Buyer geo, `lastConfirmedAt`, radius, rank или score.
12. `GET /api/search` и `POST /api/search` сохраняют прежние eligibility, response shape, ranking, privacy и S10 contact behavior без изменений.

## 11. Automated test plan

### Unit

Только новая Discovery logic:

- `distanceMeters` whole-meter conversion using existing S9 semantics;
- radius `inside / exactly boundary / outside` with inclusive `<=` rule;
- deterministic `distance → freshness → id` ordering;
- geoless Offer не проходит Nearby eligibility.

Полный повтор доказательства Haversine mathematics из S9 не требуется, если переиспользуется тот же закрытый calculation contract.

### Integration / PostgreSQL

На реальных persisted Offers доказать:

- active + fresh + geo + inside radius → included;
- exactly boundary → included;
- outside radius → excluded;
- inactive → excluded;
- expired → excluded;
- geoless → excluded;
- deterministic ordering;
- anonymous request works;
- invalid Buyer point → exact `400 INVALID_NEARBY_REQUEST` semantics;
- Discovery response содержит `distanceMeters`, но не Seller raw geo / Buyer geo / `lastConfirmedAt` / radius;
- Discovery path является read-only: request не создаёт и не изменяет Buyer/User/Seller/Location/Offer persistent state;
- существующий Search response и ordering остаются неизменными.

### E2E mobile + desktop

- открыть `Рядом`;
- убедиться, что location не запрошена до явного действия;
- разрешить подготовленную browser geolocation;
- получить Nearby Offers и увидеть расстояние;
- увидеть inside/boundary Offer и отсутствие outside/geoless Offer;
- проверить empty state;
- проверить browser-geolocation failure state;
- после успешного geo flow проверить отсутствие Buyer coordinates в `localStorage`, `sessionStorage` и cookies;
- reload возвращает Nearby geo state в исходное состояние без сохранённой Buyer point.

Отдельный security suite не нужен.

### Migration / concurrency / external service proof

Не требуются, поскольку соответствующие risk flags отсутствуют.

После targeted proof требуется один полный branch CI на финальном executable SHA. Повторные exact-SHA runs без конкретного race/flakiness/nondeterminism signal не требуются.

## 12. Manual acceptance

Acceptance environment содержит:

- актуальный Offer A внутри nearby radius;
- актуальный Offer B за radius;
- актуальный Offer C на Location без geo.

Пользовательский проход:

1. Открыть `Рядом` без авторизации.
2. Убедиться, что приложение само не запросило geolocation.
3. Нажать действие показа товаров рядом и разрешить location.
4. Убедиться, что Offer A отображается и показано расстояние.
5. Убедиться, что Offer B и geo-less Offer C отсутствуют в Nearby.
6. Перезагрузить страницу и убедиться, что Buyer location не сохранилась и требуется новое явное действие.

SQL, API inspection, browser storage inspection, внутренние IDs и CI не входят в manual acceptance; privacy persistence assertions остаются automated E2E responsibility.

## 13. Gate

Три условных замечания Контролёра внесены в contract. Product implementation остаётся заблокированной до явного финального решения Контролёра:

`S11 CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED`
