# ТЗ дизайнеру: media-pass поверх принятого KAIDA Pass 3

> **Кому:** дизайнеру текущего редактируемого прототипа KAIDA Pass 3.
> **Статус:** non-blocking future M1 design input. Не меняет accepted Pass 3, не гейтит текущие seller slices и
> становится implementation target только через будущий M1 Slice Contract и отдельную visual acceptance.
> **Дата:** 2026-09-24. **Направление утвердил:** Product Owner (RashRosh).
> **Базовый артефакт:** https://claude.ai/artifact/B5PDSyednY4pNtmhAtC9tN
> **Основание:** принятый `WIREFRAME_PASS3_REVIEW.md`, `DESIGN_SYSTEM.md` §6,
> `UX_REFERENCE_INDEX.md` — разделы «Offer / product cards» и «Media / photos».
> **Это не:** разрешение начинать M1 вне `EXECUTION_PLAN.md`, media Slice Contract или описание upload/storage/API.

Все новые фреймы получают внешнюю handoff-пометку `FUTURE M1 DESIGN HYPOTHESIS · FIXTURE-ONLY · NOT CURRENT
PRODUCTION SCOPE`. Для video используется `OPTIONAL M2 LAYOUT-ONLY`. Эти пометки находятся вне пользовательского UI.

## 0. Результат этой итерации

Не создавать новый независимый UX и не перерисовывать весь Pass 3. Сначала сохранить immutable export/copy
принятого артефакта, затем в его рабочей копии добавить отдельный раздел `MEDIA PASS` и точечно сделать текущие
buyer/seller surfaces пригодными для фотографий предложения:

1. показать фото в Search, Nearby и seller workspace;
2. честно показать состояние без фото;
3. добавить media-секцию в целевой вариант создания/редактирования Offer;
4. показать media-изменения на шаге подтверждения;
5. добавить proposed media-first detail concept предложения для визуальной проверки;
6. при желании показать один optional video-ready scalability sketch, не превращая видео в уже реализованную функцию;
7. отдельно зафиксировать нерешённый вопрос о ложной фотографии, загруженной продавцом.

Принятые части Pass 3 остаются базой: shell, palette, typography, navigation, RU/KZ, состояния, контакты,
freshness, Location и ChangeSet flow не проектируются заново.

## 1. Главное решение о demo-фотографиях

**Решение Product Owner:** в pre-MVP прототипе, fixture-driven UI и demo presentation можно использовать тестовые,
стоковые, синтетические или сгенерированные фотографии. Они нужны, чтобы спроектировать реальную композицию
карточек, галереи и seller flow. Точная рабочая граница из Design System: **до M1** это fixture-only presentation,
production behavior от неё не зависит; к MVP продукт либо опирается на утверждённый real-media contract, либо
остаётся с neutral fallback.

Это решение отменяет только прежний запрет на декоративные/fake photos в задании Pass 3. Оно **не** означает,
что production уже умеет принимать фотографии продавца, и не меняет место M1 в очереди.

Использовать три разных понятия и не смешивать их:

| Понятие | Что это | Как показывать в media-pass |
|---|---|---|
| `demo / fixture photo` | Контролируемая командой тестовая фотография для макета или demo | Внутри UI выглядит как нормальный контент; вне фрейма и в записке явно помечена как fixture, не как seller upload |
| `seller-provided media` | Реальная будущая фотография конкретного Offer | Только целевой M1-вариант; upload/storage/lifecycle не объявлять реализованными |
| `neutral fallback` | У Offer нет доступной фотографии или она не загрузилась | Отдельное честное состояние без поддельного снимка товара |

Не писать поверх каждой фотографии «демо» и не портить этим пользовательскую композицию. Статус fixture фиксируется
в имени набора, аннотации за пределами пользовательского экрана и в сопроводительной записке.

## 2. Что это ТЗ меняет, а что сохраняет

### Меняет

- media-related варианты `S-01`, `S-02`, `S-04`, `S-05`, `S-06`, `S-10`;
- добавляет proposed concept `M1-D1` для подробного просмотра Offer с галереей; route/deep-link/reload semantics
  остаются future M1 contract gap;
- добавляет ветки `F1-M` и `F2-M` в схему переходов;
- разрешает fixture-фото в design/demo до M1;
- позволяет optional video sketch, чтобы проверить масштабируемость photo layout без запуска M2.

### Не меняет

- auth, ownership, privacy, Offer lifecycle, price invariant и Search semantics;
- `SellerChangeSet → SellerChangeItem → confirmation/apply → Offer`;
- текущий production scope `seller-offer-editor`, где media по-прежнему out of scope;
- очередь: real seller media остаётся M1, video — M2 только после отдельного подтверждённого use case;
- photo/video как способ распознать Seller Input — отдельный AI Input workstream S19/S20, не Offer media;
- отсутствие cart, checkout, delivery, fake stock, ratings и reviews;
- принятые `S-03`, `S-07`, `S-08`, `S-09`, `S-11`, `S-12`.

Если media-варианту нужны новые данные или mutation semantics, дизайнер помечает это как `M1 DATA GAP`, а не рисует
их уже работающими.

## 3. Зачем media нужна в KAIDA

Фотография здесь не декоративная обложка интернет-магазина. Она должна помогать покупателю:

- быстро отличать похожие Offers друг от друга;
- понимать реальный вид, состояние, упаковку или комплект конкретного предложения;
- сопоставлять карточку в выдаче и подробный просмотр;
- решить, стоит ли связываться с продавцом или ехать в точку.

Продавцу media должна помогать узнать своё предложение в списке и управлять его содержимым. Фото не вытесняет
цену, freshness и Location — эти данные остаются обязательной частью первого сканирования.

Целевая иерархия buyer Offer:

```text
primary media
→ product + price/unit
→ freshness
→ Location/address/distance, если доступно
→ Seller/comment
→ contact actions
```

## 4. Правила buyer-карточки

Один OfferCard component используется в Search и Nearby. `Nearby` добавляет расстояние, но не получает отдельную
media-композицию.

Обязательные правила:

1. Primary photo заметна при быстром сканировании, но не прячет price, freshness и Location ниже первого экрана.
2. В карточке и на detail surface используется одна и та же primary photo.
3. Все карточки сохраняют стабильную media-область; отсутствие изображения не меняет геометрию списка.
4. Thumbnail может иметь единое соотношение сторон и аккуратный crop, но ключевой объект не должен срезаться.
   Полный кадр доступен в proposed `M1-D1`.
5. Не помещать важный текст поверх фотографии. Допустимы только компактные media controls: количество, play и
   понятная кнопка раскрытия, если они не закрывают объект.
6. В листинге нет autoplay, бесконечного carousel и переключения фото от случайного hover.
7. Media/title дают явный переход к подробному просмотру. Закрытый UX1D сохраняется: каждая buyer-visible card
   имеет прямые primary actions `Позвонить` и `Маршрут`, а ниже — только реально доступные messenger actions.
   Вся карточка не становится одним giant link.
8. Neutral fallback визуально слабее реального фото, но остаётся частью KAIDA visual language. Не подставлять
   случайную фотографию «похожего товара».
9. Loading skeleton повторяет media-геометрию. Broken/failed image тихо переходит в fallback без сломанной иконки.
10. Сердце интереса, call/route/messenger actions и media controls имеют отдельные focus/tap targets минимум
    `44×44 px` и не перекрывают друг друга.

Целевой порядок источников после M1: seller-provided primary photo конкретного Offer → canonical Product image/icon,
если такая capability появится → neutral fallback. Demo fixtures в этой итерации только имитируют эти состояния.
Если canonical Product image может быть воспринята как снимок конкретного Offer, это отмечается как trust/data gap,
а не маскируется визуально.

Дизайнер сам выбирает итоговую mobile-композицию — thumbnail рядом с данными либо компактный media-блок сверху —
но в записке показывает сравнение по двум критериям: сколько Offers видно без прокрутки и насколько легко различить
товар по фотографии. Desktop не обязан повторять mobile буквально.

## 5. Proposed M1 detail concept `M1-D1`

С появлением нескольких фотографий одной раскрытой карточки может оказаться недостаточно. Добавить recommended
concept `M1-D1 — Предложение подробно` для проверки этой гипотезы. Он не заменяет быстрый contact flow Pass 3,
не объявляет production route реализованной и не становится implementation target без решения будущего M1 contract.

### Mobile

Порядок сверху вниз:

1. back + shared shell context;
2. primary media и понятная индикация `1 из N`;
3. Product name и price/unit;
4. freshness;
5. Location/address/distance, если distance реально доступно;
6. Seller comment с уже принятым translation/original behavior;
7. Seller/Location context;
8. закрытые buyer actions: `Позвонить`, `Маршрут` и доступные messenger channels.

### Desktop

Две устойчивые области: gallery слева, данные и действия справа. Правая колонка не прокручивается независимо от
страницы без объективной необходимости. Price, freshness, Location и главное contact action видны без поиска по
экрану.

### Gallery

- primary media достаточно крупная для оценки товара;
- остальные media видимы как thumbnails или явный счётчик;
- active thumbnail различима не только цветом;
- swipe на touch, стрелки и клавиши `←`/`→` на desktop;
- full-screen viewer открывается на текущем элементе, закрывается кнопкой и `Esc`, возвращает фокус источнику;
- фото и video находятся в одной gallery, а не в двух разных блоках;
- portrait, landscape и близкий план не ломают контейнер;
- zoom добавляется только если он действительно помогает рассмотреть оригинал и не показывает пикселизацию.

### Переходы

```text
S-01 / S-02 card media or title
→ M1-D1
→ back
→ тот же query, scroll position и locale
```

Media/detail не добавляет обязательного шага перед `Позвонить` или `Маршрут`: эти действия остаются доступны прямо
на карточке. Старые Pass 3 варианты с общей кнопкой `Контакты` и buyer-visible `no-contact` не переносятся в
media-pass: по закрытому UX1D Offer без обязательных phone + Location geo не попадает в buyer Search/Nearby.

## 6. Изменения по существующим surfaces

| Surface | Что добавить или изменить |
|---|---|
| `S-01 Search` | Результаты с primary photo; смешанный список с фото и fallback; media/title → proposed `M1-D1`; `Позвонить` + `Маршрут` и optional messengers сохраняют UX1D; translation/original states получают тот же media-slot |
| `S-02 Nearby` | Тот же OfferCard с photo/fallback и реальным rounded distance; отдельный визуальный язык карточки не создавать |
| `S-04 Seller overview` | У максимум трёх недавно подтверждённых Offers показать компактный thumbnail или fallback; `Требует внимания` не вводить до Freshness Policy |
| `S-05 Seller offers` | Добавить thumbnail/fallback и media count, не ослабляя status-first hierarchy и primary action текущего состояния |
| `S-06 Create/edit` | Как M1 design hypotheses показать optional photo states: empty, one, several, simulated uploading, failed/retry, reorder, choose cover, remove; exact behavior/limits остаются `M1 DATA GAP` |
| `S-10 Change review` | Как M1 design hypothesis показать media diff: что добавляется, удаляется, меняется как обложка или порядок; representation/atomicity определит M1 contract |
| `LONG` | Проверить длинный RU/KZ content вместе с portrait/landscape photo, fallback, счётчиком и contact actions на 320 px |

## 7. Seller media flow для визуальной проверки

В media-варианте `S-06` фотография по умолчанию **не блокирует** публикацию: состояние без фото существует и ведёт
к neutral fallback. Если M1 решит сделать media обязательной для отдельных случаев, это будет отдельное решение.

Показать последовательность:

```text
media-empty
→ Добавить фото
→ uploading
→ media-one
→ добавить ещё / изменить порядок / выбрать обложку / удалить
→ S-10 pending-media
→ confirm
→ обновлённый S-05 и buyer card
```

Обязательные состояния:

- `media-empty` — короткое объяснение пользы, одно действие `Добавить фото`;
- `media-uploading` — preview + progress/status, повторный submit заблокирован только там, где это необходимо;
- `media-one` — видна обложка и доступные действия;
- `media-many` — порядок понятен, cover отмечена текстом/иконкой, reorder доступен без drag-only зависимости;
- `media-error` — что не получилось + `Повторить`/`Удалить`, остальные успешно добавленные media не исчезают;
- `media-remove` — удаление не маскируется под мгновенно применённое buyer-facing изменение;
- `pending-media` в `S-10` — понятная сводка до confirm;
- `confirmed-media` — canonical result в seller list. Станет ли новое media сразу buyer-visible, уйдёт на
  проверку или временно даст fallback, решает M1 вместе с `MEDIA-Q1`; макет не выбирает это молча.

Не фиксировать в UI выдуманные ограничения по количеству, мегабайтам, форматам и длительности. Если без текста
невозможно собрать layout, использовать placeholder copy `[лимиты определит M1]` только в аннотации вне экрана.

В `FUTURE M1 DESIGN HYPOTHESIS` показать сохранение media draft при создании Location, смене языка, submit error и
`Назад к правке`. Это **не текущее обещанное поведение**: точный механизм локального/серверного хранения и cleanup —
`M1 DATA GAP`, который обязан закрыть M1 contract до implementation.

## 8. Video-ready вариант

Video не становится частью основной цепочки, не получает постоянный пункт навигации и не блокирует acceptance
этого photo-pass. Если дизайнер делает optional scalability sketch, он показывает только, что выбранная
media-композиция расширяется без полной пересборки:

- один `M1-D1__video` с poster, понятным play marker и video внутри общей gallery;
- один annotated seller-вариант с будущим video item рядом с photos;
- video запускается только после explicit intent, не в листинге и не автоматически;
- duration показывается только если такая metadata реально доступна;
- processing/error/moderation semantics помечаются `M2 DATA GAP`;
- никакого fake video, пустого player или `скоро` в primary UI.

## 9. Fixture media pack

Для проверки layout подготовить небольшой согласованный набор fixture media, а не повторять одну картинку во всех
карточках:

- минимум четыре разных Product/Offer context;
- одна portrait, одна landscape, один close-up и один кадр с несколькими объектами;
- один Offer с несколькими фотографиями;
- один Offer без фотографии;
- один video poster для future-варианта;
- без водяных знаков, чужих UI overlays, встроенной цены, скидки, rating или рекламного текста;
- ключевой объект расположен так, чтобы можно было честно проверить crop;
- источник каждого файла, license либо факт генерации записаны в fixture manifest.

Fixture-фото могут быть синтетическими. Они не должны использовать реальные личные данные и не должны выдаваться
в записке за фотографии конкретного продавца KAIDA.

## 10. Открытый продуктовый вопрос `MEDIA-Q1`: ложная фотография продавца

Demo fixture и обман со стороны продавца — разные проблемы. Первая разрешена этим ТЗ. Вторая **не решена** и должна
получить отдельный Product Owner decision до M1 Slice Contract.

Формулировка вопроса:

> Что делает KAIDA, если Seller загрузил фотографию, которая не относится к его реальному Offer, украдена,
> существенно устарела, сгенерирована/изменена так, что вводит Buyer в заблуждение, либо содержит запрещённый
> контент?

До решения `MEDIA-Q1` дизайнер **не имеет права** молча добавлять:

- badge `Проверенное фото`, `Реальное фото` или аналогичную гарантию;
- автоматический moderation verdict;
- pre-moderation, блокировку публикации или санкции продавцу;
- кнопку жалобы и её workflow;
- обязательный watermark, timestamp, съёмку только из камеры;
- специальную маркировку AI-generated content;
- обещание, что KAIDA проверила происхождение или актуальность изображения.

В сопроводительной записке `MEDIA-Q1` вынести отдельным unresolved decision и перечислить, какие будущие точки
вмешательства требуют выбора: guidance/attestation перед upload, moderation после upload, buyer report, operator
review, removal/appeal и последствия для Seller. Это не блокирует текущий composition pass, пока в нём не рисуются
ложные trust guarantees.

`MEDIA-Q1` также владеет моментом публичного появления фотографии. Пока нет решения, F2-M доказывает canonical
seller result после confirm, но не обещает немедленный показ нового media покупателю.

## 11. Accessibility и system states

- media control получает accessible name с действием и позицией: например, `Открыть фото 2 из 4`;
- generic seller photo не получает выдуманного подробного alt. Для design annotation использовать нейтральную
  стратегию вроде `Фото предложения: <Product>`; окончательная alt policy — решение M1;
- fallback может быть decorative только если Product name рядом уже даёт тот же смысл;
- carousel не trap'ит keyboard; focus order следует видимой последовательности;
- upload/reorder/remove доступны без drag-only и hover-only управления;
- progress объявляется через подходящую live region, error связан с конкретным media item;
- reduced motion не использует auto-slide или параллакс;
- loading, offline и server error сохраняют уже загруженные previews и введённые Seller данные.

## 12. Обязательные фреймы design-task

Список ниже проверяет полноту дизайнерской сдачи, но **не является новым product gate** для текущих seller slices.

Существующие принятые фреймы не удалять до visual acceptance media-pass. Новые разместить рядом в отдельном разделе.

### Buyer

- `S-01__results-media__{ru|kk}__mobile`
- `S-01__results-fallback__{ru|kk}__mobile`
- `S-01__results-loading-media__{ru|kk}__mobile`
- `S-01__card-actions-media__{ru|kk}__mobile`
- `S-01__card-original-media__{ru|kk}__mobile`
- `S-02__granted-results-media__{ru|kk}__mobile`
- `M1-D1__detail-photo__{ru|kk}__mobile`
- `M1-D1__gallery__{ru|kk}__mobile`
- `M1-D1__no-media__{ru|kk}__mobile`

### Seller

- `S-04__default-media__{ru|kk}__mobile`
- `S-05__list-media__{ru|kk}__mobile`
- `S-06__media-empty__{ru|kk}__mobile`
- `S-06__media-uploading__{ru|kk}__mobile`
- `S-06__media-many__{ru|kk}__mobile`
- `S-06__media-error__{ru|kk}__mobile`
- `S-10__pending-media__{ru|kk}__mobile`
- `S-05__result-media-confirmed__{ru|kk}__mobile`

### Representative desktop / stress proof

- `S-01__results-media__{ru|kk}__desktop`
- `S-05__list-media__{ru|kk}__desktop`
- `S-06__media-many__{ru|kk}__desktop`
- `M1-D1__detail-photo__{ru|kk}__desktop`
- `LONG__buyer-media__{ru|kk}__mobile-320`

### Optional M2 scalability sketch

- `M1-D1__video__{ru|kk}__mobile`
- annotated seller video item рядом с photos.

Отсутствие optional M2 sketch не блокирует сдачу photo-pass.

Если один фрейм честно покрывает несколько соседних состояний, не дублировать его ради количества. Но все названные
поведения должны быть видимы и однозначно проверяемы.

## 13. Схемы переходов

Добавить к текущему разделу `FLOW`:

```text
F1-M:
S-01/S-02 results
→ media/title → M1-D1 proposed concept
→ gallery / photo / optional video
→ direct call/route or optional messenger
→ back → тот же список, query, scroll и locale

F2-M:
S-06 media-empty
→ add/upload/retry/reorder/cover/remove
→ при необходимости S-07 без потери media draft
→ S-10 pending-media
→ confirm
→ S-05 canonical result
→ buyer projection не утверждается до решения MEDIA-Q1
```

Отдельно показать, что language switch не сбрасывает выбранные media/previews, а offline/failed upload не стирает
успешно добавленные элементы.

## 14. Формат сдачи

1. **До любых изменений** сохранить immutable export/copy принятого Pass 3 с датой и locator в репозитории.
2. Работать в копии принятого Pass 3 и добавить отдельный раздел `MEDIA PASS`; accepted baseline не перезаписывать.
3. После media-pass сохранить второй versioned export/copy и новый устойчивый locator.
4. Все user-facing варианты — `ru` и `kk`; казахские строки проходят native verification до implementation.
5. Mobile-first + перечисленные representative desktop frames.
6. Fixture manifest: файл/превью, источник или способ генерации, license/status, назначение в макете.
7. Короткая записка:
   - какие Pass 3 frames изменены;
   - почему выбрана итоговая card composition;
   - `M1/M2 DATA GAP`;
   - `MEDIA-Q1` без придуманного ответа;
   - сознательные отступления от этого ТЗ.
8. Paths обоих immutable exports и новый locator записать в `WIREFRAME_PASS3_REVIEW.md` вместе с точным списком
   заменённых frames и Product Owner verdict.

## 15. Чек-лист visual acceptance

- [ ] Фото реально помогает различать Offers, а не служит декоративным фоном.
- [ ] Price, freshness и Location не потеряли scan priority.
- [ ] Search и Nearby используют один OfferCard pattern.
- [ ] Offer с фото и без фото не вызывает layout shift.
- [ ] Primary media совпадает между карточкой и detail surface.
- [ ] Закрытый UX1D сохранён: `Позвонить` и `Маршрут` доступны прямо на каждой buyer card; media/detail не добавляет
      обязательный лишний шаг.
- [ ] Gallery работает для одной и нескольких фотографий, portrait/landscape и keyboard/touch.
- [ ] Seller видит empty/uploading/success/error/reorder/cover/remove и не теряет успешные previews при ошибке.
- [ ] Media changes видны до confirm и не выглядят buyer-facing до confirm.
- [ ] После confirm показан canonical seller result; публичность нового media не выдумана до решения `MEDIA-Q1`.
- [ ] Если optional video sketch показан, он остаётся вторичным future-вариантом в общей gallery, без autoplay и
      пустых stubs.
- [ ] Demo/fixture photos явно задокументированы вне UI и не выдаются за реальные seller uploads.
- [ ] `MEDIA-Q1` зафиксирован как нерешённый вопрос; fake trust badge/moderation promises отсутствуют.
- [ ] Нет ratings, reviews, cart, delivery, fake stock, discounts и других несуществующих данных.
- [ ] RU/KZ, 320 px, desktop, focus, touch targets, reduced motion и long-content proof пройдены.
