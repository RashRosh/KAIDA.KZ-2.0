# KAIDA.KZ — KAIDA Demand

> **Статус в текущем репозитории (30.09.2026): утверждённый planning source, не Slice Contract и не разрешение на
> реализацию.** В stage 10 разрешена только Demand Data Foundation (D0/D1 и необходимая база D2) после отдельных
> contracts. Seller UI, бесплатные сигналы и paid Demand проходят собственные readiness gates.
>
> **Последующие решения PO от 30.09.2026 имеют приоритет над вариантами внутри concept:** Free сохраняет полноценную
> ручную витрину, hard commercial active-Offer cap удалён из текущего monetization direction, а старая форма S25
> требует review; interest и
> explicit waiting не объединяются;
> 682 `YES` — кандидатное RU-ядро с пакетным import после dedup/conflict report; `Category` остаётся полноценной
> сущностью, а Excel taxonomy только маппится на простой рубрикатор; privacy threshold конфигурируем и определяется по
> данным; D3 сначала бесплатный, D4 требует подтверждённой цепочки supply response и отдельного willingness-to-pay.
> Demand не является отдельной подпиской: actionable signals входят в Free, full Demand — в Pro, aggregated
> multi-location Demand — в Business. Seller entry зафиксирован как `Ещё → Что ищут покупатели`.

**Версия:** 0.1
**Дата:** 30.09.2026
**Статус:** продуктовый концепт / bridge document для последующей подготовки ТЗ дизайнеру и ТЗ разработчику
**Область:** спрос П1 как полезный и потенциально платный инструмент для П2
**Не является:** Slice Contract, API/DB-ТЗ, финальной тарифной сеткой или разрешением на реализацию

---

## 0. Зачем нужен этот документ

KAIDA Demand — рабочее название направления, в котором KAIDA.KZ превращает накопленный покупательский спрос в понятные продавцу возможности:

> **что люди хотят купить рядом с моей торговой точкой, чего им сейчас не хватает и что я могу сделать с этим прямо сейчас.**

Этот документ нужен как продуктовая основа для двух следующих самостоятельных документов:

1. **ТЗ дизайнеру KAIDA Demand** — информационная архитектура, экраны, состояния, paywall, тексты, действия.
2. **ТЗ разработчику KAIDA Demand** — события, агрегаты, приватность, БД, API, права, фоновые задачи, интеграция с Search, Interests, Seller Workspace и Notifications.

Здесь намеренно не фиксируются конкретные SQL-схемы, endpoint names, тарифы и визуальные решения, если продуктовая логика ещё не требует единственного варианта.

---

# 1. Репозиторий и фактическая исходная точка

Документ сверялся с фактическим репозиторием `RashRosh/KAIDA.KZ-2.0`.

## 1.1. Baseline

Актуальная сверка 2026-09-30:

- `main`: `fd11a48fdca4f1645e70217d09c5a37b8a5d16eb`;
- последний commit: merge PR #66 `Редактирование торговой точки из карточки товара`;
- GitHub Actions run `36706008273` для этого SHA завершён `success`;
- verified product checkpoint: `v0.0.41-card-point-link`;
- checkpoints buyer/seller UI tail `v0.0.37`–`v0.0.41` закрыты.

## 1.2. Что уже реально есть в продукте и важно для Demand

### Seller side

У П2 уже есть:

- AI-first целевая информационная архитектура;
- стартовая поверхность `Витрина`;
- нижняя навигация `Витрина / Точки / Ещё`;
- несколько торговых точек;
- карточки товара по нескольким точкам;
- ручной редактор;
- Seller Change Set как контролируемый путь записи;
- фото;
- цены и единицы цены;
- контакты точки;
- режим работы;
- операторская пост-проверка;
- actuality lifecycle `2 / 7 / 14`;
- массовое подтверждение актуальности;
- архив;
- browser push subscriptions;
- фоновые напоминания продавцу об актуальности.

**Важно:** полноценный AI input видео/фото/голосом ещё находится в будущей очереди. Текущий seller contour обязан работать ручным путём.

### Buyer side

У П1 уже есть:

- поиск;
- search results;
- buyer offer page;
- Nearby;
- optional transient buyer geo;
- двуязычный RU/KK UI;
- актуальность карточек;
- контактные действия;
- Interests для существующего канонического Product.

### Search сегодня

Фактическое поведение `main` сейчас:

```text
q
→ exact Product resolution по catalog/localized names/aliases
→ product_id, если удалось
+
слова исходного q
→ поиск buyer-visible Offers через OR:
   offers.product_id = resolved product
   ИЛИ seller title word-start match
→ ranking
```

То есть seller title сегодня является частью нормальной выдачи даже при catalog resolution.

Кроме того:

- endpoint `/api/catalog/suggestions` уже существует;
- buyer `SearchScreen` **не использует его**;
- buyer submit работает по строке `q`;
- SearchResponse сейчас содержит только `query + offers`;
- SearchResponse не различает `catalog` и `raw_fallback`;
- zero-result известного Product и неизвестный query на уровне DTO не разведены;
- `offers.product_id` nullable;
- seller может публиковать карточку со свободным названием без обязательной catalog link.

### Catalog / Search learning

`FEATURE_MAP.md` содержит S15:

> оператор анализирует matched / unmatched / zero-result queries.

Но capability ещё `PLANNED`.

Stable principle уже зафиксирован:

```text
Query Log
→ matched / unmatched / zero-result analysis
→ controlled Product / alias / Category change
```

Пользовательский query не должен автоматически создавать Product.

### Interests сегодня

`buyer_interests` уже реализован как:

```text
(user_id, product_id)
```

и относится только к существующему canonical Product.

Текущий S13 означает:

> «этот Product мне интересен»

но **не означает автоматически**:

> «я прямо сейчас жду появления этого товара».

Notifications и interest analytics были прямо вынесены из S13 scope.

Следовательно, в KAIDA Demand нельзя считать каждый `buyer_interest` сильным waiting demand без отдельного продуктового решения.

### Analytics сегодня

В фактическом `main` **нет**:

- `search_events`;
- query log table;
- interaction analytics table;
- demand aggregates;
- Seller Demand API;
- seller-facing search analytics.

То есть KAIDA Demand пока не имеет готовой базы данных, которую можно просто визуализировать.

### Push сегодня

Push infrastructure уже существует:

- `push_subscriptions`;
- scheduler;
- delivery abstraction;
- sent-log;
- deeplink в seller workspace.

Сейчас она используется для actuality reminders.

Это даёт технический фундамент для будущих Demand alerts, но не означает, что Demand notifications уже реализованы.

---

# 2. Связанные продуктовые решения в репозитории

## 2.1. Issue #55

В репозитории уже открыт Issue #55:

> `Идея на потом: продавец видит, что ищут покупатели`

Там уже зафиксированы:

- что ищут рядом с точками продавца;
- как часто;
- что ищут, но не находят;
- только обезличенные сводки;
- без точного местоположения и отдельных buyer sessions;
- редкие запросы не показывать;
- решить временные и географические срезы;
- применить packaging Free signals → full Demand in Pro → aggregated multi-location Demand in Business;
- связать с S15 Search learning и Catalog.

KAIDA Demand является развитием этой идеи.

## 2.2. Monetization в текущем roadmap

`EXECUTION_PLAN.md` сохраняет commercial work после MVP/Demand readiness и добавляет planning gates до Backoffice
IA/UX. `FEATURE_MAP.md` помечает S25 hard-cap form как `REVIEW REQUIRED`, задаёт commercial foundation и разделяет
Pro, Demand, Boost и Business. KAIDA Demand остаётся собственным D0–D6 workstream и входит в Pro только после D4
paid-readiness.

## 2.3. Устранённое несоответствие S25

PO выбрал supply-first direction: Free не скрывает правдивый ассортимент ради baseline paywall. Commercial hard cap
удалён из текущего monetization direction, S25 old form не implementation-ready. Commercial value строится через Pro
(`AI + full Demand + Performance`), отдельный Boost и Business; technical/anti-abuse/fair-use limits остаются допустимы.

---

# 3. Отдельный Search System Spec v0.1

29.09.2026 был создан:

`docs/product/SEARCH_SYSTEM_SPEC_v0.1.md`

Canonical copy уже находится в `main`; при будущей S15B всё равно нужно учесть историю ветки
`docs/search-system-spec-v0.1` и сверить target source с актуальным кодом.

Историческая ветка использовалась как источник при переносе spec; её старые ahead/behind counts не являются
repository evidence.

Следовательно:

- Search Spec — важный продуктовый intent;
- но нельзя проектировать Demand так, будто он уже реализован.

Search Spec предлагает в будущем:

- primary search по canonical `product_id`;
- отдельный raw fallback;
- `search_events`;
- unresolved queries;
- explicit `Сообщить, когда появится`;
- unresolved interests/watches;
- seller-facing demand проектировать отдельно.

KAIDA Demand должен быть совместим с этой целевой моделью, но стартовать от реального `main`.

---

# 4. Продуктовая роль KAIDA Demand

KAIDA Demand — не «раздел статистики».

Это seller-side продукт, который отвечает на вопрос:

> **Что имеет смысл сделать продавцу сейчас, исходя из реального спроса покупателей KAIDA?**

Основная цепочка:

```text
П1 ищет
→ KAIDA понимает спрос
→ KAIDA понимает, насколько спрос покрыт предложением
→ П2 получает безопасный агрегированный сигнал
→ П2 добавляет / обновляет / подтверждает товар
→ появляется buyer-visible Offer
→ П1 получает лучший результат
```

В перспективе, если у П1 был explicit waiting intent:

```text
П1 ждёт Product
→ появляется buyer-visible Offer
→ KAIDA уведомляет П1
```

Это создаёт замкнутую demand → supply loop.

---

# 5. Главный принцип

## KAIDA Demand продаёт не доступ к людям, а доступ к рыночному сигналу.

П2 никогда не получает:

- список покупателей;
- user IDs;
- телефоны;
- аккаунты;
- отдельные sessions;
- точные координаты;
- историю поиска конкретного человека;
- timestamp, по которому можно легко идентифицировать одного человека;
- сырые редкие запросы, позволяющие догадаться, кто их ввёл.

П2 получает только безопасную агрегированную информацию.

---

# 6. Второй главный принцип

## Demand должен быть actionable.

Плохо:

> `Тунец — 137 запросов`

Хорошо:

> **Тунец**
> 31 покупатель искал за 7 дней
> 12 не нашли подходящего предложения
> 4 актуальных продавца рядом
> **Добавить товар**

Ещё лучше:

> **Тунец**
> Спрос на ваш товар вырос
> Ваша карточка скрыта из выдачи из-за актуальности
> **Подтвердить наличие и цену**

Любой основной Demand card должен по возможности заканчиваться действием.

---

# 7. Что является спросом

KAIDA Demand должен различать минимум четыре класса сигнала.

## 7.1. Search demand

П1 сознательно отправил Search.

Не считать спросом:

- каждый введённый символ;
- каждый autocomplete request;
- автоматическое обновление результатов;
- повторный locale refresh;
- demo search;
- internal/system запрос.

Одна осознанная отправка Search = один demand event.

## 7.2. Unmet demand

П1 выполнил Search, но в его фактическом поисковом контексте система не дала buyer-visible результата.

Это сильнее обычного Search.

Важно не смешивать:

```text
человек искал
```

и

```text
человек искал и ничего не нашёл
```

## 7.3. Explicit waiting demand

П1 сознательно нажал:

> `Сообщить, когда появится`

или эквивалентное действие с таким же явным смыслом.

Это самый сильный сигнал.

**Текущий S13 Interest сам по себе таким сигналом не является.**

Для waiting demand требуется отдельная семантика:

```text
explicit availability watch
```

Техническое ТЗ позднее определит, будет ли это отдельная сущность, отдельный intent type или расширение Interests без разрушения текущей семантики.

Продуктовый инвариант:

> generic interest ≠ explicit waiting intent.

## 7.4. Commercial interaction signal

В будущем Demand может учитывать как подтверждающий сигнал:

- Offer open;
- Seller open;
- route click;
- phone click;
- WhatsApp / Telegram click.

Это не Search demand и не доказательство покупки.

Interaction signal нужен, чтобы понимать, превращается ли спрос в коммерческое действие.

Для первой версии KAIDA Demand он может быть вторичным.

---

# 8. Canonical demand и unresolved demand

Из-за текущего состояния продукта Demand обязан поддерживать два слоя.

## 8.1. Canonical demand

Если query однозначно связан с:

```text
Product.id
```

вся статистика должна агрегироваться вокруг одного Product независимо от языка, регистра, alias, е/ё и допустимых синонимов.

Смысл:

> один товар = один спрос.

## 8.2. Unresolved demand

Если query пока нельзя уверенно связать с Product:

```text
resolved_product_id = null
```

он остаётся отдельным internal demand signal.

Нельзя:

- автоматически создавать Product;
- показывать П2 весь raw query log;
- считать каждую строку отдельным товаром.

Правильный путь:

```text
raw unresolved queries
→ normalization
→ clustering / operator review
→ safe demand candidate
→ Product / Alias decision
```

Только после достаточной нормализации unresolved cluster может попасть в seller-facing Demand.

---

# 9. Raw query никогда не становится seller analytics напрямую

Причины:

1. privacy;
2. PII может оказаться прямо в строке;
3. мат/спам;
4. опечатки;
5. дубли;
6. разные языки;
7. один и тот же товар может называться десятками способов;
8. злоумышленник может специально генерировать ложный спрос.

Поэтому seller-facing unresolved demand — это уже обработанная сущность, а не dump пользовательских строк.

---

# 10. Как учитывать предложение

Demand без Supply бессмысленен.

Для каждого canonical Product в выбранной зоне KAIDA должна уметь определить текущий supply.

Считать только то, что покупатель реально может увидеть сейчас:

```text
buyer-visible Offers
```

Следовательно, supply подчиняется тем же правилам, что Buyer Search:

- Offer active;
- Seller/Location допустимы;
- не снят оператором;
- обязательная цена валидна;
- actuality не вышла за visibility ceiling;
- остальные действующие buyer-visibility predicates выполняются.

Нельзя говорить продавцу:

> `Рядом 7 предложений`

если 5 из них уже не видны покупателю.

---

# 11. Какие supply-метрики полезны П2

Первая версия может использовать:

- число buyer-visible Offers;
- число distinct Sellers;
- число distinct trading points;
- наличие / отсутствие Offer самого П2;
- актуальность собственного Offer.

Предпочтительный seller copy:

> `Рядом 3 актуальных продавца`

или:

> `Актуальных предложений рядом нет`

В первой версии не требуется:

- выдавать список конкурентов;
- раскрывать внутренние данные конкурентов;
- делать competitor intelligence;
- сравнивать чужую выручку;
- считать долю рынка.

Всё публичное предложение продавец и так может увидеть как обычный П1. KAIDA Demand не должен создавать дополнительный surveillance API.

---

# 12. Demand Gap

Главная коммерчески полезная сущность:

> **спрос есть, а актуального предложения мало или нет.**

Но в первой версии не вводить непрозрачный:

```text
Opportunity Score: 87
```

У системы ещё нет данных, позволяющих честно объяснить 87.

## Рекомендуемая прозрачная логика приоритета

Сначала:

1. explicit waiting demand;
2. unique buyers с zero result;
3. unique buyers с Search demand;
4. search volume;
5. меньшее текущее buyer-visible supply.

Позже можно добавить рост/падение спроса, commercial actions, конверсию предыдущих opportunities и seasonality.

Не показывать продавцу внутренние искусственные коэффициенты.

---

# 13. Что должен видеть продавец

Рабочий продуктовый термин:

> **Что ищут покупатели**

Бренд/название продукта может быть:

> **KAIDA Demand**

но в UI лучше не заставлять локального продавца понимать слово Demand.

Возможные seller-facing заголовки:

- `Что ищут рядом`;
- `Возможности`;
- `Покупатели ищут`;
- `Спрос рядом`.

Финальный copy выбирается в ТЗ дизайнеру.

---

# 14. Рекомендуемая IA продавца

Текущую принятую нижнюю навигацию:

```text
Витрина / Точки / Ещё
```

в первой версии Demand **не менять**.

Не добавлять четвёртый пункт нижнего nav без отдельного PO decision.

## 14.1. Полный Demand

Разместить вход в:

```text
Ещё
→ Что ищут покупатели
```

## 14.2. Actionable teaser на Витрине

На `Витрине` можно показывать только сигналы, требующие действия продавца:

> `Покупатели ищут 3 товара, которых у вас нет`

или:

> `Ваш тунец ищут, но карточка скоро уйдёт из выдачи`

Сигнал должен вести либо на конкретное действие, либо в полный Demand.

Таким образом `Витрина` остаётся рабочим task surface, а не аналитическим dashboard.

---

# 15. Базовые типы Opportunity cards

## A. Product seller не продаёт

> **Лакедра**
> Ищут рядом
> Актуальных предложений мало
> `[Добавить товар]`

Если Product canonical:

- CTA открывает обычный seller card creation flow;
- Product может быть preselected internally;
- продавец всё равно видит человеческое название, не Product ID.

## B. Seller уже продаёт Product, карточка buyer-visible

> **Тунец**
> Этот товар активно ищут рядом
> Ваша карточка на витрине
> `[Открыть карточку]`

## C. Seller продаёт, но Offer ageing / hidden

> **Тунец**
> Покупатели ищут этот товар
> Ваша карточка требует подтверждения
> `[Подтвердить актуальность]`

Demand не создаёт новый parallel editor. Он ведёт в существующий Seller Change Set / actuality flow.

## D. Seller продаёт, но карточка выключена

> **Конина**
> Этот товар ищут рядом
> Ваша карточка выключена
> `[Проверить и включить]`

## E. Unresolved opportunity

> **Новый запрос покупателей**
> Лакедра
> Люди ищут похожий товар, которого пока нет в каталоге KAIDA
> `[Я продаю это]`

CTA открывает обычное создание карточки и не создаёт Product автоматически.

## F. Недостаточно данных

Не показывать ложную точность.

Например:

> `По этой зоне пока недостаточно данных, чтобы показать статистику.`

Не показывать продавцу точное `2 человека`, если это ниже privacy threshold.

---

# 16. Географическая модель

KAIDA Demand — прежде всего **local demand**.

Центр первой версии:

```text
конкретная торговая точка П2
```

а не произвольная точка на карте.

Это:

- уменьшает privacy abuse;
- делает данные actionable;
- соответствует seller workflow;
- не превращает продукт сразу в полноценный market-intelligence GIS.

## 16.1. Несколько точек

Продавец выбирает конкретную точку.

Первая версия считает Demand отдельно для выбранной точки.

Объединение нескольких точек и citywide analytics — Business layer позже.

## 16.2. Location без geo

Текущий `locations.latitude/longitude` nullable.

Поэтому нельзя притворяться, что локальный Demand известен, если у точки нет координат.

Допустимые варианты:

- попросить уточнить геопозицию точки;
- временно дать только city/venue-level statistics, если такой агрегат действительно существует;
- не показывать local-radius metrics.

Нельзя подставлять фиктивную точку.

## 16.3. Радиусы

Радиусы должны быть конфигурируемыми.

Продуктовая рекомендация для тестов:

```text
1 км / 3 км / 5 км / 10 км
```

но эти цифры не являются окончательным контрактом.

---

# 17. Временная модель

Полезны минимум:

```text
короткий период
7 дней
30 дней
```

Рабочий смысл:

- короткий — текущая операционная ситуация;
- 7 дней — что имеет смысл сделать на этой неделе;
- 30 дней — закупочное/ассортиментное решение.

Не фиксировать «сейчас = последние N часов» до анализа реального трафика.

История 90 дней / год / сезонность — позже.

---

# 18. Free vs paid

Основное правило:

> **KAIDA не должна брать деньги за возможность удовлетворить уже известный ей спрос. Деньги берутся за системное понимание рынка.**

## 18.1. Бесплатный слой

П2 бесплатно получает сигналы, которые помогают KAIDA закрыть спрос:

- есть спрос на Product, который П2 уже продаёт;
- есть explicit waiting demand на его Product;
- собственная карточка теряет спрос из-за actuality;
- несколько actionable opportunities рядом;
- CTA `Добавить товар`;
- CTA `Подтвердить актуальность`;
- qualitative signal при небольшом объёме данных.

Количество бесплатных opportunity previews — конфигурируемое, не фиксируется здесь.
На `Витрине` показываются только actionable teasers с CTA; полный Demand открывается через
`Ещё → Что ищут покупатели`.

## 18.2. Full KAIDA Demand / Pro capability

После собственного paid-readiness gate полный Demand входит в Pro как одна из трёх осей `AI + Demand + Performance`.
Pro entitlement не делает данные готовыми и не снимает privacy suppression. Capability даёт:

- полный список opportunities;
- numeric unique-demand counts, если privacy threshold выполнен;
- search volume;
- zero-result / unmet count;
- explicit waiting count;
- current supply counts;
- период;
- несколько радиусов;
- category filtering;
- history;
- trend;
- сортировки;
- demand alerts / digest;
- сравнение периодов.

## 18.3. KAIDA Business позже

Для сетей / multi-location:

- несколько точек одновременно;
- aggregated city/area views;
- сравнение точек;
- cross-location analytics;
- aggregated Demand;
- audit/history;
- role-based company access.

Heatmap, export, scheduled reports, API/1C/ERP и integrations — subsequent capabilities по отдельным readiness gates,
а не обязательная часть первого sellable Business.

## 18.4. Packaging rule

Отдельной подписки `KAIDA Demand` нет. Demand упаковывается только как Free signals, full capability внутри Pro и
multi-location/aggregated capability внутри Business. Exact presentation, periods, radii и объём Free preview
определяются после production-like data и privacy validation.

---

# 19. Что платный тариф никогда не снимает

Paid Demand **не отключает privacy threshold**.

Нельзя:

> `Заплатите и увидите, какие 2 человека искали товар`.

Если аудитория слишком мала:

- данные скрыты;
- объединены;
- либо показаны качественно.

Платёж не даёт доступа к individual buyer data.

---

# 20. Waiting demand — особый сигнал

Explicit waiting intent должен визуально и аналитически быть отделён от обычных Searches.

Пример:

> **12 человек ждут появления**

Это сильнее и понятнее продавцу, чем любой искусственный score.

## Важное техническое следствие

Нужно отдельное понятие:

```text
availability watch
```

Текущий `buyer_interest` не должен автоматически переименовываться в waiting demand.

Если Product уже есть, но Offers нет:

```text
П1 → Сообщить, когда появится
```

создаёт explicit watch.

Если Product ещё unresolved:

```text
П1 → Сообщить, когда появится
```

создаёт unresolved watch/query intent.

Когда query позже связан с Product:

- watch связывается с Product;
- уведомление отправляется только когда появился buyer-visible Offer.

---

# 21. Notifications П2

Demand не должен отправлять push на каждый Search.

Запрещённая модель:

```text
кто-то поискал тунец
→ push Айдару
```

Уведомление должно означать **изменение actionable state**.

Примеры:

- waiting demand достиг безопасного meaningful threshold;
- появился новый устойчивый Demand Gap;
- собственный популярный Offer скрывается из выдачи;
- weekly demand digest.

Точный threshold/frequency — решение после данных.

Существующую push infrastructure можно переиспользовать, но Demand должен иметь отдельную семантику, deduplication, frequency control и deep link.

---

# 22. Buyer privacy

Seller-facing read model должен быть агрегированным.

Пример разрешённого объекта:

```text
Product: Тунец
Period: 7d
Area: around seller_location X
Unique demand: N
Searches: M
Zero-result users: K
Waiting: W
Current sellers: S
Current points: P
```

Но даже эти числа выдаются только после privacy policy.

## Minimum audience threshold

Нужен configurable minimum audience.

Ни точное значение, ни формула здесь не фиксируются.

Если threshold не достигнут:

```text
есть спрос
```

либо:

```text
недостаточно данных
```

вместо точного числа.

## Геоданные

Точная buyer position продавцу не раскрывается.

Для хранения данных предпочтительна модель минимизации:

- exact geo используется transient для Search;
- Demand работает с coarse spatial bucket / preaggregated spatial counters / другим privacy-safe механизмом;
- raw exact coordinate не хранится длительно без доказанной необходимости.

Техническое ТЗ должно выбрать механизм.

---

# 23. Anonymous buyers

Search KAIDA доступен без авторизации, поэтому Demand не может считать только logged-in users.

Нужен privacy-safe способ отличать:

```text
1 человек сделал 10 Searches
```

от:

```text
10 разных людей сделали по одному Search
```

Техническое ТЗ должно определить dedupe key для authenticated User и anonymous session/device context.

Seller этот key никогда не получает.

---

# 24. Abuse / manipulation

Demand станет коммерчески ценным, следовательно появится мотивация его накручивать.

Минимальные принципы:

- autocomplete не считается demand;
- repeated identical searches одной session за короткий период не должны раздувать unique demand;
- seller не должен иметь простой способ самому накрутить локальный спрос;
- rate limits;
- suspicious/bot traffic не входит в seller metrics;
- unresolved queries проходят quality filtering;
- system/demo/test traffic исключается.

Полный anti-abuse — отдельная часть технического ТЗ.

---

# 25. Не превращать Demand в рекомендацию закупки

KAIDA может сказать:

> `Этот товар ищут`

но не должна в первой версии говорить:

> `Закупите 27 кг лакедры`

У нас нет данных о реальных продажах, маржинальности, остатках, сроке хранения и закупочной цене.

Поэтому Demand v1 — **market signal**, не demand forecasting / inventory planning.

---

# 26. Связь с Seller Change Set

Demand не создаёт второй write path.

Любое действие:

- добавить Product;
- обновить цену;
- включить карточку;
- подтвердить актуальность;

идёт через уже существующий seller domain path.

Принцип:

```text
Demand = read/intelligence layer + CTA
Seller Change Set = write layer
```

Demand не пишет Offers напрямую.

---

# 27. Связь с Catalog

## Known Product

CTA может передать internal Product context в existing card editor.

Seller не обязан видеть `product_id`.

## Unresolved demand

CTA не имеет права создать canonical Product.

Путь:

```text
Demand candidate
→ seller: «Я продаю это»
→ seller card draft
→ catalog matching / operator flow
→ Product/alias decision
→ publication/update through normal seller rules
```

S15 Search learning должен оставаться источником controlled catalog evolution.

---

# 28. Связь с buyer search

Demand не должен менять органический ranking.

Платный KAIDA Demand ≠ платный Search placement.

Это разные продукты:

```text
Demand → продавец понимает спрос
Boost/Promotion → продавец покупает дополнительный охват
```

Promotion по текущему Feature Map не имеет права обходить organic relevance / actuality / visibility.

Demand тоже не должен влиять на organic result order.

---

# 29. Рекомендуемый Demand screen

Не BI dashboard.

Приоритет:

```text
opportunities
→ filters
→ actionable cards
→ secondary trends/details
```

Не начинать экран с 8 графиков, круговой диаграммы и vanity metrics.

Верхний контекст:

```text
Что ищут покупатели
Точка: Зеленый базар
3 км · 7 дней
```

Сводка:

```text
8 возможностей
3 товара ждут особенно часто
```

Каждая card содержит только данные, необходимые для решения:

- Product;
- signal;
- demand;
- waiting;
- supply;
- trend при paid;
- action.

---

# 30. Design states, которые обязательно предусмотреть

Будущее ТЗ дизайнеру должно потребовать минимум:

1. Demand недоступен без seller login.
2. Seller есть, но точки нет.
3. Точка есть, geo отсутствует.
4. Loading.
5. Error.
6. Нет достаточных данных.
7. Есть только free signals.
8. Paid list.
9. Paywall/upgrade state.
10. Known Product opportunity.
11. Own Product opportunity.
12. Hidden/ageing own Product.
13. Unresolved demand candidate.
14. Privacy-suppressed count.
15. Multiple seller locations.
16. RU.
17. KK.
18. Demand alert deep-link state.
19. Empty paid filter result.
20. Subscription expired / paid capability unavailable.

---

# 31. Что передать дизайнеру как обязательный контекст

ТЗ дизайнеру должно ссылаться на текущую seller IA:

```text
Витрина / Точки / Ещё
```

и не создавать новый параллельный кабинет.

Нужно спроектировать минимум:

### A. Entry

`Ещё → Что ищут покупатели`

### B. Showcase teaser

Actionable card/block на `Витрине`.

### C. Full Demand list

С point/period/radius context.

### D. Opportunity detail

Если отдельная detail surface вообще нужна после прототипа.

### E. Free → Paid transition

Без dark patterns и без обещания данных ниже privacy threshold.

### F. CTA integration

- `Добавить товар`;
- `Открыть карточку`;
- `Подтвердить актуальность`;
- `Проверить и включить`;
- `Я продаю это`.

---

# 32. Что передать разработчику как обязательный контекст

Техническое ТЗ должно отдельно решить следующие блоки.

## 32.1. Search instrumentation

Новый event model:

- conscious submitted Search;
- query display/normalized;
- resolved Product nullable;
- resolution kind;
- results count;
- geo/search context;
- anonymous/auth dedupe context;
- source excludes demo/system requests.

## 32.2. Query resolution state

Различать:

- canonical;
- alias/localized;
- fuzzy-selected;
- unresolved;
- raw fallback;
- zero result.

## 32.3. Explicit watches

Отдельная семантика waiting intent.

## 32.4. Aggregation

Seller-facing Demand никогда не читает raw events напрямую.

Нужен aggregate/read model.

## 32.5. Spatial aggregation

Local demand вокруг seller location без раскрытия exact buyer location.

## 32.6. Privacy suppression

Configurable minimum cohort + safe fallback copy.

## 32.7. Supply projection

Только buyer-visible Offers согласно единому predicate.

## 32.8. Seller entitlement

Free / Demand / Business capability access.

## 32.9. CTA integration

Никакого direct Offer write.

## 32.10. Notifications

Переиспользование existing push infrastructure с отдельной семантикой.

## 32.11. Audit / observability

Нужно понимать:

- почему seller увидел opportunity;
- из какого периода/зоны она рассчитана;
- какая policy version использована;
- когда агрегат обновлён.

Не логировать individual buyer data в seller-facing audit.

---

# 33. Demand Data Foundation должен появиться раньше платного Demand

Это принципиально.

Последовательность:

```text
S15 / Search instrumentation
→ накопление нормальных events
→ internal Demand validation
→ free seller signals
→ paid KAIDA Demand
```

Нельзя сначала нарисовать paid dashboard, а потом начать думать, какие данные туда положить.

---

# 34. Место в roadmap

Demand зафиксирован в `FEATURE_MAP.md` как D0–D6 и в `EXECUTION_PLAN.md` как S15C foundation с отдельными readiness
gates. Этот документ остаётся parent product source, но не меняет execution order самостоятельно.

## Phase A — Demand Data Foundation

Привязать к S15 Search learning / Search System revision.

Это **не монетизация**.

Цель:

- собирать корректный demand;
- различать canonical/unresolved/zero-result;
- строить privacy-safe aggregates;
- проверять качество данных оператором.

## Phase B — Seller Demand Signals

После накопления данных.

Может быть бесплатным capability, потому что повышает supply liquidity.

## Phase C — Full KAIDA Demand in Pro

После доказанной цепочки D3 и отдельного willingness-to-pay evidence D4 может получить commercial entitlement внутри
Pro. Общая commercial semantics задаётся `KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`; privacy threshold остаётся
сильнее entitlement. Реализация требует отдельного Slice Contract и PO authorization.

---

# 35. Readiness gate: когда Demand вообще можно показывать

Demand нельзя включать только потому, что таблица существует.

Минимальные условия:

1. Search instrumentation стабильно пишет production-like данные.
2. Demo/test/bot traffic исключается.
3. Canonical resolution достаточно надёжен.
4. Unresolved query pipeline работает.
5. Seller location scope определён.
6. Privacy threshold и suppression протестированы.
7. Supply counts совпадают с buyer-visible reality.
8. Opportunity cards регулярно содержат реальные actionable cases.
9. Internal operator view позволяет проверить выборку.
10. Seller beta показывает, что люди понимают и используют сигналы.

---

# 36. Readiness gate для платного KAIDA Demand

Paid Demand запускается только когда бесплатный/внутренний Demand уже доказал ценность.

До запуска проверить:

- какая доля активных seller locations регулярно получает хотя бы одну meaningful opportunity;
- как часто seller после opportunity добавляет/обновляет Product;
- сколько Demand Gaps закрывается;
- насколько быстро после сигнала появляется buyer-visible Offer;
- не пустуют ли 7/30-day screens;
- не скрывает ли privacy threshold почти все данные;
- понимают ли продавцы разницу между Searches, people, waiting и supply.

Рекомендуется пройти полноценный пилотный период на реальном трафике до назначения цены.

---

# 37. Метрики самого KAIDA Demand

## Marketplace

- Demand Gap closure rate;
- time from first meaningful demand → first buyer-visible Offer;
- share of zero-result demand later covered;
- number of watches fulfilled;
- coverage by Product / area;
- seller response rate to opportunities.

## Seller behavior

- opportunity opened;
- opportunity → add Product;
- opportunity → edit/reconfirm;
- opportunity ignored;
- repeat use;
- alert open → action.

## Paid product позже

- Demand trial → paid;
- paid retention;
- use of advanced filters;
- value by seller segment.

---

# 38. Что не входит в KAIDA Demand v1

Не проектировать автоматически:

- доступ к individual buyers;
- buyer leads list;
- сообщения «этот человек ищет ваш товар»;
- точные buyer coordinates;
- buyer heatmap с возможностью деанонимизации;
- raw query log для П2;
- закупочный прогноз в кг/шт.;
- AI forecast;
- dynamic pricing recommendation;
- price-fixing / координацию продавцов;
- competitor revenue;
- competitor private inventory;
- Opportunity Score;
- ad auction;
- CPC/CPM;
- sponsored ranking;
- citywide Business heatmap;
- export/API;
- ML recommendations.

---

# 39. Связь с существующей монетизацией

KAIDA Demand становится отдельной осью ценности:

```text
AI / Convenience
→ экономит П2 время

Demand
→ показывает, что имеет смысл продавать

Promotion / Boost
→ даёт дополнительный охват

Business
→ масштабирует управление несколькими точками
```

Эти оси не должны искусственно склеиваться.

---

# 40. Решение PO: active Offer limits

Конфликт решён 2026-09-30:

- Free сохраняет полноценную ручную правдивую витрину;
- hard commercial active-Offer cap удалён из текущего monetization direction;
- S25 в старой форме не implementation-ready;
- technical, anti-abuse и fair-use limits допустимы и не являются paywall;
- основная value proposition монетизации: Pro (`AI + full Demand + Performance`), отдельный Boost и Business.

Вернуться к commercial assortment cap можно только по реальным pilot evidence и новому явному PO decision; тогда ему
потребуется отдельный configurable и non-destructive contract. Само сохранение технической возможности не является
roadmap commitment.

---

# 41. Примеры end-to-end flows

## Flow 1. Known Product, no supply

```text
П1 ищет Лакедру
→ Product resolved
→ buyer-visible Offers = 0
→ Search event = unmet
→ П1 включает explicit watch
→ aggregate достигает privacy threshold
→ П2 рядом видит Opportunity
→ П2 нажимает «Добавить товар»
→ Seller card flow
→ Offer становится buyer-visible
→ Demand Gap уменьшается
→ watches получают уведомление после появления Offer
```

## Flow 2. Product есть у П2, но карточка скрыта

```text
П1 ищут Тунец
→ Demand высокий
→ у П2 есть Offer
→ Offer ≥ visibility ceiling
→ buyer его не видит
→ Витрина П2 показывает actuality task
+
Demand показывает, что товар сейчас ищут
→ «Подтвердить актуальность»
→ existing reconfirm Change Set
→ Offer возвращается
```

## Flow 3. Unknown query

```text
П1 ищут «лакедра»
→ Catalog не resolved
→ raw/unresolved event
→ несколько похожих queries образуют устойчивый cluster
→ operator связывает/создаёт Product
→ прошлый demand переносится/атрибутируется по policy
→ Seller sees safe canonical opportunity
```

## Flow 4. Free seller

```text
П2 открывает Витрину
→ «Покупатели рядом ищут товары, которых у вас нет»
→ 1–N free opportunities
→ Add Product
```

## Flow 5. Paid Demand

```text
П2 → Ещё → Что ищут покупатели
→ выбирает точку
→ 7 дней / radius
→ полный opportunity list
→ сортирует по waiting / unmet / growth
→ открывает Product
→ Add / Update / Confirm
```

---

# 42. Acceptance principles для будущих ТЗ

Любое дизайнерское и техническое ТЗ KAIDA Demand должно сохранить следующие инварианты.

1. Demand не раскрывает individual buyer.
2. Seller не получает raw Search log.
3. Rare cohorts не раскрываются даже paid seller.
4. Search keystrokes не считаются спросом.
5. Generic Interest не равен waiting demand.
6. Unknown query не создаёт Product автоматически.
7. Canonical aliases не дробят demand.
8. Supply считается только по buyer-visible Offers.
9. Demand не пишет Offer напрямую.
10. Demand не меняет organic ranking.
11. Free seller получает сигналы, необходимые KAIDA для закрытия явного спроса.
12. Paid seller получает глубину анализа, а не доступ к людям.
13. Demand не обещает покупку.
14. Demand не даёт quantity procurement forecast.
15. Все данные/агрегаты/логи остаются в рамках data-residency KAIDA.KZ.
16. RU/KK обязательны.
17. Current seller IA `Витрина / Точки / Ещё` не ломается без нового решения.
18. Точный seller location не выдумывается, если geo отсутствует.
19. Privacy suppression сильнее subscription entitlement.
20. Любая статистика должна иметь понятный период и spatial scope.

---

# 43. Что нужно решить перед ТЗ дизайнеру

Уже зафиксировано PO: UI name `Что ищут покупатели`, entry `Ещё → Что ищут покупатели`, на `Витрине` — только
actionable teasers с CTA; отдельной Demand subscription нет.

Открыты только presentation details после накопления данных:

1. exact counts в Free при достаточной аудитории или qualitative signal;
2. количество free opportunities;
3. period presets;
4. radius presets;
5. нужен ли отдельный Opportunity detail screen;
6. upgrade/paywall pattern внутри Pro packaging;
7. точная позиция teaser на `Витрине`;
8. trend в первой paid версии;
9. seller push для Demand v1 или in-app + digest.

---

# 44. Что нужно решить перед ТЗ разработчику

1. Новая финальная Search architecture: rebase/approve `SEARCH_SYSTEM_SPEC_v0.1`.
2. Event schema.
3. Anonymous dedupe.
4. Exact semantics `results_count` / unmet.
5. Explicit watch entity.
6. Unresolved query clustering/resolution history.
7. Spatial aggregation model.
8. Privacy cohort threshold.
9. Aggregate refresh cadence.
10. Data retention raw vs aggregate.
11. Demand capability key/gate внутри общей Commercial Entitlements Model.
12. Demand API/read model.
13. Anti-abuse.
14. Notification cadence.
15. Migration path для existing Interests.
16. Как пересчитать historical unresolved demand после Catalog resolution.
17. Как Demand связан с несколькими seller locations.
18. Как исключать test/demo/operator traffic.
19. Observability и сверка aggregate vs source events.
20. Data-residency implementation.

---

# 45. Repository integration state

В canonical planning уже выполнено:

1. Issue #55 является owning backlog;
2. D0–D6 отражены в `FEATURE_MAP.md`;
3. S15C и readiness gates отражены в `EXECUTION_PLAN.md`;
4. S25 hard-cap form помечена `REVIEW REQUIRED`;
5. Search Data Foundation, Seller Free Demand Signals и full Demand разделены;
6. commercial access связан с общей Commercial Entitlements Model.

До implementation по-прежнему нужны актуальная сверка Search System с кодом, отдельные Slice Contracts и явная
авторизация PO.

---

# 46. Предлагаемая декомпозиция будущей реализации

Это не authorization на implementation, а рекомендуемые будущие slices.

## D0 — Search Demand Events

Internal only.

```text
Search submit
→ normalized/resolved outcome
→ privacy-safe event
```

## D1 — Search Learning / Demand Aggregates

Operator/internal.

```text
matched / unmatched / zero-result
→ canonical/unresolved aggregates
```

## D2 — Availability Watches

Buyer explicit waiting intent.

## D3 — Seller Free Demand Signals

Actionable seller cards, без paid analytics.

## D4 — KAIDA Demand

Paid full list, periods, radius, supply, trend.

## D5 — Demand Alerts

Push / digest.

## D6 — Business Demand

Multi-location / city / export later.

---

# 47. Итоговая продуктовая формула

KAIDA Demand должен отвечать П2 не:

> «Какая у нас статистика поиска?»

а:

> **«Что люди хотят купить рядом с тобой, чего им сейчас не хватает и что ты можешь сделать с этим прямо сейчас?»**

При этом KAIDA остаётся на стороне marketplace liquidity:

```text
больше корректного спроса
→ больше полезного предложения
→ больше successful searches
→ больше buyer actions
→ больше причин П2 поддерживать данные
→ больше данных для KAIDA
```

Монетизация появляется не за сокрытие базового спроса, а за:

```text
глубину
+
историю
+
срезы
+
приоритизацию
+
автоматические сигналы
+
масштаб
```

---

# 48. Короткое решение v0.1

**KAIDA Demand = seller-side intelligence layer поверх Search, Catalog, buyer-visible Supply и explicit Watches.**

Первая версия должна:

- показывать opportunities, а не сырые графики;
- разделять canonical и unresolved demand;
- считать Search / unmet / waiting разными сигналами;
- использовать только актуальный buyer-visible supply;
- сохранять приватность П1;
- не ломать `Витрина / Точки / Ещё`;
- вести CTA в существующие seller write flows;
- давать free seller достаточно информации, чтобы KAIDA могла закрывать Demand Gap;
- продавать более глубокое понимание рынка;
- запускаться как paid product только после накопления достаточного реального спроса.

**Главный инвариант:**

> **KAIDA Demand показывает продавцу рынок, но не показывает ему покупателей.**
