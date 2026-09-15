# UX1A.1 — Bolt layout alignment — Slice Contract

**Status:** `APPROVED — IMPLEMENTATION AUTHORIZED`  
**Verified base:** `v0.0.15-ux1a`  
**Verified main SHA:** `0c19cfde3d0288bea4541e9d748a9cd0c4fdb1ea`  
**Implementation branch:** `slice/ux1a1-shell-visual-alignment`

`boltkaida2` используется как прямой UX/UI visual reference для shell/home: взаимное расположение, размеры, отступы, типографика, buyer-facing copy, controls и visual brandmark в header переносятся максимально близко к reference. Его state model, fake auth, mock data, Search business logic, Tailwind/Vite stack и domain behavior не переносятся.

Этот corrective slice легитимно уточняет закрытые visual contracts UX1A по решениям Product Owner:

- desktop navigation больше не обязана быть геометрически центрирована внутри primary row; она становится отдельной левой secondary navigation row, как в reference composition;
- `104px` относится к desktop primary/top row; полный desktop shell может быть выше из-за отдельной secondary navigation row. Mobile primary row остаётся `84px`;
- Buyer home использует Bolt-подобную компактную search presentation: buyer-facing copy, популярные search shortcuts и icon-only explicit location toggle рядом с submit button, не меняя Search/geo semantics;
- header/home presentation должна воспроизводить Bolt reference по размерам и spacing, а не только использовать похожие компоненты;
- Product Owner явно разрешил перенести visual brandmark из `boltkaida2` в header; это presentation asset, не изменение product/domain contracts.

Product/API/business contracts S0–S13 не открываются.

## 1. User task

Покупатель открывает KAIDA.KZ и видит аккуратную marketplace/search композицию уровня `boltkaida2`: бренд слева, глобальный поиск в верхней desktop-зоне, вход справа одинаковой высоты с header controls, отдельную навигацию ниже и компактный основной buyer search flow слева сверху вниз. Он может одним нажатием выбрать популярный запрос или явно включить/выключить учёт своего местоположения прямо рядом с кнопкой поиска.

## 2. Scope

- перенести visual composition header из `boltkaida2` максимально близко по фактическим размерам: container `80rem`, desktop side padding `48px`, top row `104px`, mobile `84px`, gap/controls/radii/button sizing;
- использовать Bolt visual brandmark `36x36` + `KAIDA.KZ` wordmark presentation;
- desktop header Search и auth control имеют Bolt-like `44px` control height и одинаковую вертикальную геометрию;
- вынести `Поиск / Рядом / Продавцу` в отдельную secondary navigation row слева с Bolt-like button geometry;
- сохранить route-aware active state и navigation icons;
- desktop header Search должен вести в существующий настоящий Buyer Search flow, а не быть декоративным контролом;
- сохранить компактный mobile header/menu без постоянной второй navigation row;
- перестроить Buyer home из двухколоночного `intro | Search` в последовательную Bolt-подобную композицию `hero → description → Search → popular shortcuts → results`;
- перенести Bolt typography/spacing home: display headline `clamp(2rem, 5vw, 3.25rem)`, body copy width/spacing и main vertical paddings;
- использовать согласованный buyer-facing copy из `boltkaida2`, сохраняя правильное полное имя `KAIDA.KZ`;
- сделать основной Search как в reference: search icon, placeholder, submit `Искать`, explicit location icon-toggle справа от submit;
- location toggle имеет понятные состояния on/off, остаётся явным действием пользователя, не запрашивает geo автоматически, не хранит координаты и влияет только на следующий Search по закрытому S9 contract;
- добавить `Популярное` с shortcuts `Баранина / Говядина / Мёд / Картофель / Кумыс / Яблоки`; shortcut запускает тот же существующий real Search flow, не создаёт Product и не меняет Search matching;
- сохранить существующие Search validation/error/loading/result semantics, Search API и Offer data;
- сохранить реальный S2 auth, Next routes, Roboto, approved color/radius tokens и accessibility baseline.

## 3. Explicit out of scope

- fake ratings/reviews;
- fake Offer media/placeholders;
- redesign Offer cards/grid/detail — это UX1B/M1 boundaries;
- изменение Search matching/ranking/query logging/API contract;
- изменение Product/aliases/catalog из-за популярных shortcuts;
- Nearby behavior change — UX1C;
- Seller forms/onboarding change — UX2;
- самостоятельный brand redesign сверх visual brandmark, уже существующего в Bolt reference;
- новый auth flow;
- sticky mobile header как behavioral change;
- DB/schema/migrations;
- Seller ownership/business rules;
- изменение geolocation privacy/persistence semantics;
- Tailwind или новый UI framework.

## 4. Closed contracts used / preserved

Сохраняются:

- UX1A shared-shell boundary и wordmark/brand → Buyer home;
- S0/S7 Search request/response, validation, matching, ranking, loading/error semantics;
- S2 auth/session/login/logout semantics;
- S3 Seller/Location ownership/setup semantics;
- S9 explicit transient buyer-location Search behavior;
- S10 contact behavior;
- S11 explicit-user-action geo/privacy boundary;
- S13 Interests behavior;
- Roboto;
- radius scale `8 / 12 / 16 / 20px`;
- no page-level horizontal overflow;
- navigation to `/nearby` не вызывает browser geolocation автоматически.

Visual corrections explicitly supersede UX1A desktop nav-centering, interpretation of total desktop header height and prior placeholder wordmark-only presentation. Buyer-facing copy and presentation controls are presentation changes and do not change public/domain contracts.

Если implementation требует DB/API/business-rule change — STOP.

## 5. Risk flags

- **DB migration:** NO.
- **Public API:** NO.
- **Auth/security/privacy:** YES, ограниченно — shell продолжает отображать auth state и ведёт в Nearby/Seller; explicit geo privacy/transience должны сохраниться.
- **Concurrency/atomicity:** NO.
- **Data loss:** NO.
- **External service:** NO.

## 6. Expected modules / boundaries of change

Разрешены:

- shared AppHeader/navigation/search/brandmark presentation;
- AuthStatus presentation;
- Buyer home page composition/copy;
- SearchForm presentation/wiring для header query, popular shortcuts и explicit location toggle;
- shell/home CSS;
- targeted E2E proof;
- slice documentation.

Не ожидаются изменения в `src/db`, migrations, Search domain/repository/service logic, API route contracts, Catalog domain или Seller/Location domain modules.

## 7. Acceptance criteria

1. Desktop primary row визуально повторяет Bolt reference: visual brandmark + KAIDA.KZ слева, Search по центру, auth справа.
2. Desktop primary/top row имеет `104px`; secondary navigation расположена отдельным рядом ниже, слева; mobile primary row `84px`.
3. Header input, `Искать` и `Войти` используют одинаковую Bolt-like control height `44px`; login больше не выглядит ниже Search button.
4. Header Search ограничен Bolt-like `max-width: 36rem`, container имеет `80rem` max-width и `48px` desktop side padding.
5. `Поиск / Рядом / Продавцу` имеют route-aware active state, `aria-current="page"`, icons и Bolt-like `44px` button geometry.
6. Desktop header Search является рабочим: введённый query открывает Buyer home и запускает существующий real Search flow с теми же API/validation/result semantics.
7. Buyer home использует Bolt-like display typography и spacing; hero, description и основной Search идут сверху вниз, без прежней oversized headline/large empty vertical layout.
8. Основной Search показывает placeholder `Баранина, мёд, картофель…`, submit `Искать`, search icon и отдельный location pin control непосредственно справа от submit.
9. Location pin имеет доступные on/off состояния, сохраняет explicit-only S9 semantics, не вызывает geolocation автоматически и после reload возвращается в off.
10. `Популярное` показывает шесть утверждённых shortcuts с Bolt-like chip geometry; нажатие shortcut выполняет тот же real Search, не изменяя Product/catalog/API.
11. На mobile global header Search не забирает экранное место, navigation доступна через compact menu; основной Search/popular shortcuts не создают horizontal overflow.
12. `Войти / Выйти` продолжают использовать существующие S2 API/session semantics; переход в `Рядом` не вызывает geolocation prompt автоматически.
13. Не появляются fake media, ratings/reviews, новый Product capability или новый framework; Roboto, approved colors/radii и accessibility baseline сохраняются.

## 8. Automated test plan

### Unit / integration / DB

Новые уровни не нужны: domain logic/API/schema не меняются. Existing regression suites остаются contract proof.

### E2E targeted proof

- primary row `84/104px` и отсутствие overflow;
- desktop composition + control-height geometry `44px` для header search/submit/auth;
- route-aware active state и stable nav geometry;
- header Search → Buyer home → existing real Search result;
- main Search button/validation/loading остаются real Search flow;
- popular shortcut → query → existing Search API/result;
- existing S9 E2E подтверждает explicit transient location on/off behavior;
- mobile menu open/close/Escape/route selection;
- seller entry;
- navigation to Nearby без auto-geolocation;
- existing auth E2E остаётся regression proof.

После targeted proof — один full branch CI на финальном executable head. Повторный exact-SHA run не требуется без flaky/nondeterminism signal.

## 9. Manual acceptance scenario

1. На desktop сравнить header рядом с `boltkaida2`: brandmark/wordmark, header Search, `Искать` и `Войти` должны совпадать по ритму и control height; навигация — отдельным рядом ниже слева.
2. На главной проверить Bolt-like размер headline, текст, расстояния `hero → description → main Search → Популярное`; прежней oversized композиции нет.
3. Нажать популярный `Баранина` и убедиться, что выполняется настоящий Search и появляются реальные текущие результаты.
4. Включить pin справа от `Искать`, выполнить Search, выключить pin; визуально состояния различимы, геолокация запрашивается только после клика.
5. Из `/nearby` выполнить поиск через header и убедиться, что открылась главная, query попал в основной Search и появился реальный результат.
6. Пройти `Поиск → Рядом → Продавцу → Поиск`; active state корректен, navigation row не прыгает.
7. На mobile проверить compact menu, search row/pin, wrapping popular chips и отсутствие horizontal overflow.
8. Проверить существующий login/logout и открыть `Рядом` через shell без auto-geolocation prompt.

## Gate

Targeted E2E → full branch CI → manual acceptance → pre-merge diff audit → merge → merged-main CI → annotated checkpoint tag. UX1B начинается только после закрытия UX1A.1.
