# KAIDA.KZ. ТЗ на систему поиска и товарного каталога

> **Статус в текущем репозитории (30.09.2026): TARGET PRODUCT SOURCE, не Slice Contract и не разрешение на
> реализацию.** Документ перенесён на актуальный `main` как вход для S15B. Перед кодом его нужно сверить с текущей
> реализацией и закрытыми S0/S6/S7/S9/S13, оформить contract revisions и отдельные Slice Contracts. Текущую очередь
> определяет `EXECUTION_PLAN.md`.
>
> **PO override от 30.09.2026:** §§10, 19 и acceptance этого документа не применяются в части переиспользования
> `buyer_interests` для действия «Сообщить, когда появится». Interest и explicit waiting — разные сущности/сигналы;
> Demand различает `поиск/просмотр → интерес → явное ожидание появления`. Точную модель определит отдельный
> watch-contract.

**Версия:** 0.1
**Дата:** 29.09.2026
**Статус:** продуктовый контракт для реализации
**Область:** покупательский поиск П1, связь поиска с каталогом товаров, выдача предложений, неизвестные запросы, подписка на появление товара, минимальная поисковая аналитика.

Этот документ является приоритетным для логики поиска. Если старые ТЗ противоречат ему именно в части поиска, разрешения запроса, выдачи и empty-state, использовать этот документ.

Монетизация, sponsored-выдача, платное продвижение и продавательская аналитика спроса в этот документ не входят. Здесь закладываются только данные и события, необходимые для их последующего построения.

---

## 1. Главный принцип

Поиск KAIDA.KZ строится вокруг **фиксированного, постоянно пополняемого каталога продуктов**.

Основная поисковая сущность:

```text
product_id
```

Покупатель не должен в нормальном сценарии искать по произвольному естественному языку. Система помогает ему выбрать нужный товар из каталога.

Базовый путь:

```text
П1 вводит название
→ KAIDA предлагает товары из каталога
→ П1 выбирает подходящий товар
→ поиск выполняется по product_id
→ KAIDA показывает актуальные предложения П2
```

Не делать AI/semantic search, который пытается разобрать запросы типа:

```text
где купить свежий тунец недорого рядом со мной
```

На текущем этапе поиск должен быть предсказуемым, каталоговым и детерминированным.

---

## 2. Термины

### Product

Нормализованный товар общего каталога KAIDA.KZ.

Минимально:

```text
id
canonical_name
localized_names
aliases
category_id
status
```

Пример:

```text
product_id: ...
canonical_name: Тунец
aliases:
- туна
- tuna
```

Конкретная структура локализованных названий и категорий сохраняется в существующей модели каталога.

### Offer

Конкретное предложение П2:

```text
Тунец охлаждённый
7 900 ₸/кг
торговая точка X
```

Offer принадлежит продавцу и торговой точке и, в целевой модели, должен быть связан с `product_id`.

Собственное название П2 может отличаться от канонического названия каталога.

### Alias

Альтернативное название существующего Product. Alias не является отдельным Product.

### Resolved query

Ввод П1, однозначно сопоставленный с существующим `product_id`.

### Unresolved query

Ввод П1, который не удалось достаточно уверенно сопоставить ни с одним Product.

### Similar offers

Fallback-выдача по тексту собственного названия Offer для unresolved query. Она не считается точной каталожной выдачей.

---

## 3. Что входит в глобальный поиск П1

Главный поиск ищет **товары**.

Не смешивать в одной поисковой подсказке и одной выдаче:

- товары;
- продавцов;
- рынки;
- категории.

Категории, рынки и продавцы остаются отдельными путями навигации продукта.

Старое требование, по которому глобальные search suggestions одновременно возвращают products/categories/sellers, данным документом для основного товарного поиска отменяется.

---

## 4. Источник истины

Для обычного поиска источником истины является Catalog.

Если П1 выбрал Product из подсказки, основная выдача строится по:

```text
offers.product_id = selected_product_id
```

Не смешивать в основную выдачу Offer другого `product_id` только потому, что его собственное название текстово похоже на запрос.

Это принципиальное изменение относительно текущего fallback-поведения Search, где catalog match и title-word match могут объединяться через OR.

Целевое правило:

```text
resolved product_id
→ только Offers данного product_id
```

Текстовый поиск по seller title разрешён только как отдельный fallback для unresolved query.

---

## 5. Нормализация поискового ввода

Одинаковая нормализация должна применяться к:

- запросу П1;
- canonical product names;
- localized product names;
- aliases;
- индексируемому seller title для fallback.

Обязательно:

1. trim по краям;
2. Unicode normalization;
3. case-insensitive comparison;
4. `е` и `ё` считаются эквивалентными для поиска;
5. повторные пробелы схлопываются;
6. пустой запрос после нормализации запрещён;
7. SQL wildcard, кавычки и другие специальные символы не должны менять семантику SQL-запроса.

Не использовать конкатенацию SQL-строк из пользовательского ввода.

---

## 6. Autocomplete и suggestions

При вводе П1 получает до 5 предложений из Catalog.

Пример:

```text
фор...

Форель
Форель охлаждённая
Форель радужная
```

Источник suggestions:

- canonical names;
- localized names;
- aliases.

Один `product_id` может попасть в suggestions только один раз независимо от количества совпавших aliases.

Порядок качества совпадений:

1. точное canonical name;
2. точное localized name / alias;
3. начало canonical name;
4. начало слова внутри canonical name;
5. начало localized name / alias;
6. fuzzy-совпадение с canonical name;
7. fuzzy-совпадение с localized name / alias.

При равном качестве сортировка должна быть детерминированной. Не использовать случайный порядок.

Текущий word-start механизм каталога можно сохранить. К нему требуется добавить typo-tolerant fuzzy matching. Для PostgreSQL допустимо использовать `pg_trgm` или эквивалентный индексируемый механизм. Внешний поисковый движок для этого не нужен.

Fuzzy search используется только для выбора подходящего Product. Он не должен автоматически объявлять похожий товар точным совпадением.

---

## 7. Основной workflow поиска П1

### Сценарий A. П1 выбирает товар из suggestions

```text
ввод
→ suggestion
→ product_id
→ поиск Offers по product_id
→ выдача
```

Это основной и предпочтительный сценарий.

### Сценарий B. П1 нажимает Search/Enter без выбора suggestion

Backend повторно пытается разрешить текст.

#### B1. Однозначное точное совпадение

Если нормализованная строка точно соответствует:

- canonical name;
- localized name;
- alias;

получаем `product_id` и выполняем обычный каталожный поиск.

#### B2. Точного совпадения нет, но есть похожие Products

Не переходить сразу к Offer выдаче.

Показать:

```text
Возможно, вы ищете:

• Лакедра
• Желтохвост
• Сериола

[Искать как введено]
```

Количество вариантов: до 5.

#### B3. П1 выбирает предложенный Product

Дальше обычный поиск по `product_id`.

#### B4. П1 выбирает `Искать как введено`

Запрос становится `unresolved query` и запускается отдельный fallback по seller title.

---

## 8. Fallback для неизвестного товара

Если Product не разрешён, KAIDA может искать совпадения в собственных названиях Offers.

Это необходимо, потому что в существующей базе могут быть карточки, название которых ещё не связано с каталогом или содержит более специфическую формулировку.

Fallback должен быть строгим:

- нормализованные слова запроса;
- каждое значимое слово должно совпасть с началом слова в `offer.title_search`;
- fuzzy по всему массиву Offers не выполнять;
- никакой semantic/AI интерпретации.

Результат fallback нельзя визуально смешивать с точной каталожной выдачей.

Заголовок:

```text
Точного товара в каталоге не нашли
Похожие предложения
```

Если fallback вернул Offers, пользователь может их открыть, но система всё равно считает запрос unresolved.

Если fallback ничего не вернул:

```text
Такого товара сейчас в KAIDA.KZ не найдено.
```

Далее предложить:

```text
[Сообщить, когда появится]
[Посмотреть похожие товары]
```

---

## 9. Неизвестный запрос не создаёт Product автоматически

Жёсткое правило:

```text
query != product
```

Любой ввод покупателя не должен автоматически создавать запись в Catalog.

Иначе каталог быстро заполнится дублями и мусором:

```text
лакедра
Лакедра
лакедра рыба
лакедра свежая
ла кедра
```

Unknown query является сигналом спроса, а не товаром.

Он может позднее быть связан с новым Product после появления нормализованной позиции каталога.

---

## 10. Подписка `Сообщить, когда появится`

Есть два разных случая.

### 10.1. Product уже существует, Offers нет

Например:

```text
Product: Тунец
Offers: 0
```

Использовать существующий `buyer_interests(user_id, product_id)`.

Авторизация обязательна по текущей логике Interests.

### 10.2. Product ещё не существует

Например:

```text
query: лакедра
resolution: unresolved
```

Текущий `buyer_interests` это не поддерживает, потому что требует `product_id`.

Нужно добавить отдельную сущность для unresolved interest, не ломая существующий `buyer_interests`.

Рекомендуемая таблица:

```text
buyer_unresolved_interests

id UUID PK
user_id UUID NOT NULL
query_display TEXT NOT NULL
query_normalized TEXT NOT NULL
status active | resolved | cancelled
resolved_product_id UUID NULL
created_at TIMESTAMPTZ NOT NULL
resolved_at TIMESTAMPTZ NULL
cancelled_at TIMESTAMPTZ NULL
```

Инвариант:

```text
один active unresolved interest
на user_id + query_normalized
```

Когда новый Product появляется в Catalog и unresolved query однозначно связывается с ним:

1. заполнить `resolved_product_id`;
2. перевести unresolved interest в `resolved`;
3. создать обычный `buyer_interest`, если его ещё нет;
4. дальше использовать существующий механизм уведомлений по Product.

Не отправлять уведомление только по факту создания Product. Уведомление о появлении должно происходить, когда для Product появляется buyer-visible Offer.

---

## 11. Пополнение Catalog со стороны П2

П2 при создании или изменении товара использует тот же Catalog.

Workflow:

```text
П2 вводит название
→ suggestions из Catalog
→ есть подходящий Product?
```

Если да:

```text
выбрать Product
→ Offer получает product_id
```

Если подходящего Product нет:

```text
Нет подходящего товара
→ П2 вводит новую позицию
→ сервер повторно проверяет Catalog
→ после принятия новой позиции появляется стабильный product_id
→ Offer связывается с ним
```

Конкретная политика принятия нового Product, автоматическая или через модерацию, находится вне этого Search ТЗ.

Но для Search действует инвариант:

**новая позиция становится частью нормальной каталожной выдачи только после получения стабильного `product_id`.**

Legacy/unlinked Offer с `product_id = NULL` допускается как переходное состояние, но не должен попадать в основную выдачу известного Product. Он может появляться только в unresolved fallback.

---

## 12. Buyer-visible Offers

Search не определяет собственную альтернативную политику видимости. Использовать общую buyer visibility policy.

На текущей архитектуре Offer должен как минимум:

- быть `active`;
- быть в допустимом lifecycle window по `last_confirmed_at`;
- иметь валидную обязательную цену;
- иметь торговую точку с координатами;
- не быть скрытым оператором;
- проходить остальные действующие buyer-visibility проверки.

Inactive, expired и operator-removed Offers не участвуют ни в основной выдаче, ни в fallback.

Search не должен возвращать скрытую карточку из устаревшего кэша.

---

## 13. Актуальность

Свежесть данных остаётся одним из базовых свойств выдачи.

Не смешивать:

- свежесть данных Offer;
- дату медиа.

Для ranking использовать действующую Offer actuality policy и `last_confirmed_at`.

Текущая модель ageing tier сохраняется:

```text
fresh tier
выше
a­geing tier
```

Offer, вышедший за lifecycle cutoff, вообще исключается из Search.

---

## 14. Органический ranking по умолчанию

В этом документе речь только об органической выдаче. Sponsored/paid ranking будет описан отдельно.

### Если buyer location есть

Сохранить действующую логику S9:

```text
1. actuality tier
2. расстояние по возрастанию
3. last_confirmed_at по убыванию
4. offer_id для стабильного tie-break
```

### Если buyer location нет

```text
1. actuality tier
2. last_confirmed_at по убыванию
3. offer_id
```

Порядок должен быть детерминированным для одинакового входа.

В публичный SearchResponse не отдавать внутренние ranking score, buyer coordinates и другую служебную ranking metadata.

---

## 15. Явные сортировки П1

Предусмотреть:

```text
distance
price
freshness
```

### distance

Доступна только при наличии buyer location.

```text
distance ASC
→ freshness DESC
→ offer_id
```

Offers без допустимой геоточки не участвуют в buyer search согласно текущей visibility policy.

### freshness

```text
last_confirmed_at DESC
→ offer_id
```

### price

Нельзя тупо сравнивать цены с несовместимыми единицами.

Например:

```text
4 000 ₸/кг
2 500 ₸/шт
2 200 ₸ за упаковку 500 г
```

не образуют корректный единый price ranking без нормализации.

Поэтому сортировка и фильтр по цене разрешены только внутри совместимой price basis либо после появления корректной нормализованной цены за базовую единицу.

Если сравнимость не гарантирована, backend не должен выдавать ложный порядок `дешевле`.

---

## 16. Геолокация и радиус

Геолокация П1 необязательна.

Без геолокации Search работает, но не показывает distance-based ranking.

При включённой геолокации:

```text
buyerLocation = latitude + longitude
```

Для точного geo filtering и distance в БД использовать PostGIS/GEOGRAPHY, а не загружать все Offers города во frontend.

Поддержать опциональный:

```text
radius_m
```

Точные пресеты радиуса являются UI-конфигурацией и не должны быть захардкожены в бизнес-логику Search.

Если radius не передан, геолокация используется для ranking без обязательного hard cutoff по расстоянию.

---

## 17. Empty states

Нужно различать минимум четыре состояния.

### 17.1. Known Product + Offers есть

Обычная выдача.

### 17.2. Known Product + Offers нет

```text
Сейчас предложений нет.
[Сообщить, когда появится]
```

Подписка создаётся на `product_id`.

### 17.3. Unknown query + есть похожие Products

```text
Возможно, вы ищете:
...
[Искать как введено]
```

### 17.4. Unknown query + fallback ничего не дал

```text
Такого товара сейчас в KAIDA.KZ не найдено.
[Сообщить, когда появится]
[Посмотреть похожие товары]
```

Нельзя выдавать технический `404` для нормального zero-result поиска.

---

## 18. Поисковые события и статистика

Монетизацию здесь не реализуем, но Search обязан создавать данные, из которых позже можно посчитать реальный спрос.

Не считать каждый символ autocomplete самостоятельным спросом.

Search demand фиксируется только после осознанного действия:

- П1 выбрал Product и запустил поиск;
- П1 отправил точный текст Enter/Search;
- П1 сознательно выбрал `Искать как введено`;
- П1 включил `Сообщить, когда появится`.

Минимальная сущность:

```text
search_events

id UUID PK
occurred_at TIMESTAMPTZ NOT NULL
user_id UUID NULL
anonymous_session_key_hash TEXT NULL
query_display TEXT NOT NULL
query_normalized TEXT NOT NULL
resolved_product_id UUID NULL
resolution_kind catalog | alias | localized | fuzzy_selected | raw_fallback | unresolved
result_count INT NOT NULL
buyer_location GEOGRAPHY(Point,4326) NULL
radius_m INT NULL
```

`buyer_location` сохраняется только если П1 сам включил геолокацию для данного поиска.

Эти события являются внутренними. Публичный Seller API не должен возвращать индивидуальные search events, user_id, session key или точную позицию конкретного П1.

Политика агрегации, минимальный размер аудитории, retention и будущий коммерческий доступ описываются отдельным ТЗ на Demand/монетизацию.

Для аналитики принципиально различать:

```text
known demand
resolved_product_id != NULL
```

и:

```text
unresolved demand
resolved_product_id = NULL
```

Отдельно считать явное ожидание `Сообщить, когда появится`. Оно не равно обычному search event.

---

## 19. API. Целевой контракт

Не ломать существующий `/api/search` без необходимости. Расширить его совместимо.

### 19.1. Suggestions

```text
GET /api/catalog/suggestions?q=...&locale=ru
```

Ответ:

```json
{
  "suggestions": [
    {
      "id": "uuid",
      "name": "Тунец"
    }
  ]
}
```

Максимум 5 уникальных Products.

### 19.2. Search известного Product без geo

Предпочтительный новый путь:

```text
GET /api/search?product_id=<uuid>&sort=freshness
```

Для обратной совместимости оставить:

```text
GET /api/search?q=тунец
```

Если `q` однозначно разрешается в Product, backend выполняет тот же поиск по `product_id`.

### 19.3. Search с точной геолокацией

Сохранить POST, чтобы не помещать точную buyer location в URL:

```json
POST /api/search
{
  "productId": "uuid",
  "buyerLocation": {
    "latitude": 43.23,
    "longitude": 76.91
  },
  "radiusM": 2000,
  "sort": "distance"
}
```

`radiusM` и `sort` опциональны.

### 19.4. Raw fallback

Не запускать его неявно для resolved Product.

Пример:

```text
GET /api/search?q=лакедра&mode=raw_fallback
```

Response должен явно маркировать:

```json
{
  "mode": "raw_fallback",
  "query": "лакедра",
  "resolvedProduct": null,
  "offers": []
}
```

### 19.5. Unresolved interest

Добавить отдельный endpoint, например:

```text
PUT /api/interests/unresolved
DELETE /api/interests/unresolved/{id}
```

Payload создания:

```json
{
  "query": "лакедра"
}
```

Не расширять существующий `PUT /api/interests/{productId}` так, чтобы он принимал строку вместо UUID. Существующий endpoint должен сохранить строгую семантику Product interest.

---

## 20. SearchResponse

Для каталожного поиска response должен явно содержать разрешённый Product.

Целевая форма:

```json
{
  "mode": "catalog",
  "query": "тунец",
  "resolvedProduct": {
    "id": "uuid",
    "name": "Тунец"
  },
  "offers": []
}
```

Для raw fallback:

```json
{
  "mode": "raw_fallback",
  "query": "лакедра",
  "resolvedProduct": null,
  "offers": []
}
```

Это позволяет frontend не угадывать по `offers.length`, был ли товар известен системе.

Нулевой список Offers у известного Product и неизвестный Product являются разными состояниями продукта.

---

## 21. Индексы

Сохранить существующие индексы Search и добавить недостающие для fuzzy suggestions.

Минимально:

### products

- normalized canonical name;
- fuzzy/trigram index по нормализованному имени.

### product_localized_names

- normalized name;
- fuzzy/trigram index при необходимости.

### product_aliases

- normalized alias;
- fuzzy/trigram index при необходимости.

### offers

- product_id + buyer-visible поля;
- title_search для unresolved fallback;
- status;
- last_confirmed_at;
- price;
- location_id.

### locations

- spatial index по геоточке.

Нельзя строить основной resolved Product Search через full scan seller titles.

---

## 22. Требования к frontend

1. Search field глобально доступно на основных buyer surfaces согласно действующей UX-концепции.
2. Suggestions появляются во время ввода.
3. Выбор suggestion хранит `product_id`, а не только текст.
4. Изменение текста после выбора сбрасывает выбранный `product_id`.
5. Submit без выбора suggestion проходит server-side resolution.
6. Unknown query не должен молча подменяться первым fuzzy match.
7. Similar offers визуально отделяются от catalog offers.
8. Empty state известного Product отличается от unknown query.
9. `Сообщить, когда появится` для известного Product работает через существующий Interests.
10. Для unresolved query используется отдельный unresolved-interest flow.
11. Search доступен без авторизации.
12. Авторизация запрашивается только в момент сохранения interest/watch, если пользователь анонимен.

---

## 23. Что сохранить из текущей реализации

Не переписывать без причины:

- существующий Catalog и стабильные `product_id`;
- canonical/alias resolution;
- localized product names;
- действующую Unicode/case normalization;
- защиту от SQL injection;
- current buyer visibility predicate;
- Offer lifecycle cutoff;
- S9 ranking;
- buyer location validation;
- public SearchOffer projection;
- Interests для существующего `product_id`;
- no-store для Search API;
- существующий seller-title word-start механизм как основу raw fallback.

---

## 24. Что изменить относительно текущего main

Обязательные изменения:

1. Buyer UI должен реально использовать catalog suggestions при вводе.
2. В primary catalog search передавать/сохранять `product_id`.
3. При resolved Product не объединять через OR catalog Offers и title-word Offers.
4. Seller-title matching вынести в отдельный `raw_fallback` режим.
5. Добавить fuzzy Product suggestions с typo tolerance.
6. SearchResponse должен различать `catalog` и `raw_fallback`.
7. Нулевой результат известного Product должен сохранять информацию о resolved Product.
8. Добавить unresolved interest/watch.
9. Добавить `search_events` для known/unresolved demand.
10. Поддержать явные sort/radius параметры без изменения базового органического S9 ranking.

---

## 25. Acceptance tests

Минимальный обязательный набор.

### Catalog resolution

- canonical name resolves;
- alias resolves в тот же Product;
- localized name resolves;
- case не влияет;
- е/ё не влияет;
- пробелы не влияют;
- SQL control characters безопасны;
- ambiguous exact alias не выбирает Product молча.

### Suggestions

- prefix canonical;
- prefix alias;
- multi-word word-start;
- typo выдаёт fuzzy suggestion;
- не более 5;
- один Product не дублируется через aliases;
- ordering deterministic.

### Catalog Search

- выбранный `product_id` возвращает только Offers данного Product;
- чужой похожий seller title не примешивается;
- inactive Offer исключён;
- expired Offer исключён;
- operator-removed Offer исключён;
- Offer без buyer-eligible location исключён;
- обязательная цена валидна.

### Ranking

- с buyer location: actuality tier → distance → freshness → id;
- без buyer location: actuality tier → freshness → id;
- одинаковый input даёт одинаковый order;
- internal ranking metadata отсутствует в public response.

### Unknown query

- unknown не создаёт Product;
- fuzzy suggestions появляются до raw fallback;
- raw fallback вызывается только явно;
- raw fallback не маркируется как exact catalog result;
- empty unresolved state позволяет создать watch.

### Interests

- known Product использует существующий buyer interest;
- unresolved query создаёт отдельный unresolved interest;
- duplicate unresolved watch idempotent;
- после связывания с новым Product interest мигрирует/связывается корректно;
- уведомление зависит от появления buyer-visible Offer, а не только Product.

### Analytics

- autocomplete keystrokes не создают demand events;
- submitted known search создаёт event с product_id;
- raw unresolved search создаёт event без product_id;
- geo записывается только если реально использовалась buyer location;
- public API не отдаёт individual search analytics.

---

## 26. Не входит в этот документ

Отдельно проектируются позже:

- sponsored slots;
- платное повышение видимости;
- алгоритм рекламной выдачи;
- KAIDA Demand для П2;
- доступ П2 к агрегированной статистике спроса;
- тарифы и лимиты;
- Opportunity Score;
- AI semantic search;
- поиск по блюдам и естественному языку;
- сложные товарные атрибуты и их taxonomy;
- правила ручной/автоматической модерации новых Products;
- персонализированный ranking.

---

## 27. Итоговый workflow

```text
П1 вводит запрос
        │
        ↓
Catalog suggestions
        │
        ├── выбрал Product ───────────────┐
        │                                 │
        └── submit текста                 │
                 │                        │
                 ↓                        │
         exact resolution?                │
           │          │                   │
          да         нет                  │
           │          │                   │
           │     fuzzy suggestions        │
           │          │                   │
           │     выбрал Product?          │
           │       │       │              │
           │      да      нет             │
           │       │       │              │
           └───────┴───────│──────────────┘
                           │
                    Искать как введено
                           │
                           ↓
                     raw fallback
                           │
                    ┌──────┴──────┐
                    │             │
                 есть offers     пусто
                    │             │
                    ↓             ↓
                Похожие       Сообщить,
              предложения    когда появится


Resolved Product
        │
        ↓
buyer-visible Offers by product_id
        │
        ↓
organic ranking
        │
        ↓
выдача / empty known Product
        │
        └── если пусто → Сообщить, когда появится
```

Главный инвариант системы:

**Catalog определяет, что именно ищет покупатель. Seller title помогает только тогда, когда Catalog пока не знает ответа.**
