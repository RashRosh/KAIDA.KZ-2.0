# UX1A.1 — Bolt layout alignment — Slice Contract

**Status:** `APPROVED — IMPLEMENTATION AUTHORIZED`  
**Verified base:** `v0.0.15-ux1a`  
**Verified main SHA:** `0c19cfde3d0288bea4541e9d748a9cd0c4fdb1ea`  
**Implementation branch:** `slice/ux1a1-shell-visual-alignment`

`boltkaida2` используется как UX/UI composition reference: взаимное расположение shell/search/navigation/home hero, buyer-facing copy и компактная композиция search controls. Его state model, fake auth, mock data, Search business logic, Tailwind/Vite stack и domain behavior не переносятся.

Этот corrective slice легитимно уточняет закрытые visual contracts UX1A по решениям Product Owner:

- desktop navigation больше не обязана быть геометрически центрирована внутри primary row; она становится отдельной левой secondary navigation row, как в reference composition;
- `104px` относится к desktop primary/top row; полный desktop shell может быть выше из-за отдельной secondary navigation row. Mobile primary row остаётся `84px`;
- Buyer home использует Bolt-подобную компактную search presentation: buyer-facing copy, популярные search shortcuts и icon-only explicit location toggle рядом с submit button, не меняя Search/geo semantics.

Product/API/business contracts S0–S13 не открываются.

## 1. User task

Покупатель открывает KAIDA.KZ и видит знакомую marketplace/search композицию: бренд слева, глобальный поиск в верхней desktop-зоне, вход справа, отдельную навигацию ниже и компактный основной buyer search flow слева сверху вниз. Он может одним нажатием выбрать популярный запрос или явно включить/выключить учёт своего местоположения прямо рядом с кнопкой поиска.

## 2. Scope

- перестроить desktop shell по композиции `brand | search | auth` в primary row;
- вынести `Поиск / Рядом / Продавцу` в отдельную secondary navigation row слева;
- сохранить route-aware active state и линейные navigation icons;
- desktop header Search должен вести в существующий настоящий Buyer Search flow, а не быть декоративным контролом;
- сохранить компактный mobile header/menu без постоянной второй navigation row;
- перестроить Buyer home из двухколоночного `intro | Search` в последовательную Bolt-подобную композицию `hero → description → Search → results`;
- использовать согласованный buyer-facing copy из `boltkaida2`, сохраняя правильное полное имя `KAIDA.KZ`;
- сделать основной Search визуально компактным: search icon, placeholder, submit `Искать`, explicit location icon-toggle справа от submit;
- location toggle имеет понятные состояния on/off, остаётся явным действием пользователя, не запрашивает geo автоматически, не хранит координаты и влияет только на следующий Search по закрытому S9 contract;
- добавить `Популярное` с shortcuts `Баранина / Говядина / Мёд / Картофель / Кумыс / Яблоки`; shortcut запускает тот же существующий real Search flow, не создаёт Product и не меняет Search matching;
- визуально приблизить headline/spacing/content density к `boltkaida2` без копирования его mock capabilities;
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
- новый логотип/brandmark;
- новый auth flow;
- sticky mobile header;
- DB/schema/migrations;
- Seller ownership/business rules;
- изменение geolocation privacy/persistence semantics;
- Tailwind или новый UI framework.

## 4. Closed contracts used / preserved

Сохраняются:

- UX1A shared-shell boundary и wordmark → Buyer home;
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

Visual corrections explicitly supersede только UX1A desktop nav-centering и interpretation of total desktop header height, как указано выше. Buyer-facing copy и presentation controls являются presentation changes и не меняют public/domain contracts.

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

- shared AppHeader/navigation/search presentation;
- AuthStatus presentation;
- Buyer home page composition/copy;
- SearchForm presentation/wiring для header query, popular shortcuts и explicit location toggle;
- shell/home CSS;
- targeted E2E proof;
- slice documentation.

Не ожидаются изменения в `src/db`, migrations, Search domain/repository/service logic, API route contracts, Catalog domain или Seller/Location domain modules.

## 7. Acceptance criteria

1. Desktop primary row визуально имеет три зоны: KAIDA.KZ слева, Search по центру, auth/context справа.
2. Desktop primary/top row имеет `104px`; secondary navigation расположена отдельным рядом ниже, слева, поэтому полный desktop shell выше `104px`.
3. `Поиск / Рядом / Продавцу` имеют route-aware active state, `aria-current="page"`, icons и стабильную левую геометрию между routes.
4. Desktop header Search является рабочим: введённый query открывает Buyer home и запускает существующий real Search flow с теми же API/validation/result semantics.
5. Buyer home больше не использует двухколоночную композицию `intro слева / Search справа`; hero, Bolt-подобный description и основной Search идут сверху вниз в одной buyer-oriented композиции.
6. Основной Search показывает placeholder `Баранина, мёд, картофель…`, submit `Искать`, search icon и отдельный location pin control непосредственно справа от submit.
7. Location pin имеет доступные on/off состояния, сохраняет explicit-only S9 semantics, не вызывает geolocation автоматически и после reload возвращается в off.
8. `Популярное` показывает шесть утверждённых shortcuts; нажатие shortcut заполняет query и выполняет тот же real Search, не изменяя Product/catalog/API.
9. На mobile primary row остаётся `84px`, global header Search не забирает экранное место, navigation доступна через compact menu; основной Search не создаёт horizontal overflow.
10. Mobile menu имеет touch targets не меньше `44x44px`, закрывается по Escape и после route selection.
11. `Войти / Выйти` продолжают использовать существующие S2 API/session semantics; переход в `Рядом` не вызывает geolocation prompt автоматически.
12. Не появляются fake media, ratings/reviews, новый Product capability или новый framework; Roboto, approved colors/radii/spacing и accessibility baseline сохраняются.

## 8. Automated test plan

### Unit / integration / DB

Новые уровни не нужны: domain logic/API/schema не меняются. Existing regression suites остаются contract proof.

### E2E targeted proof

- primary row `84/104px` и отсутствие overflow;
- desktop composition `brand | search | auth` + separate left navigation row;
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

1. На desktop сравнить KAIDA.KZ с `boltkaida2`: верхняя композиция должна читаться как `logo/brand → global search → login`, а навигация — отдельным рядом ниже слева.
2. На главной проверить `hero → Bolt copy → compact main Search → Популярное`; старых label/help и отдельной большой geo-кнопки нет.
3. Нажать популярный `Баранина` и убедиться, что выполняется настоящий Search и появляются реальные текущие результаты.
4. Включить pin справа от `Искать`, выполнить Search, выключить pin; визуально состояния различимы, геолокация запрашивается только после клика.
5. Из `/nearby` выполнить поиск через header и убедиться, что открылась главная, query попал в основной Search и появился реальный результат.
6. Пройти `Поиск → Рядом → Продавцу → Поиск`; active state корректен, navigation row не прыгает.
7. На mobile проверить compact menu, search row с pin, wrapping popular chips и отсутствие horizontal overflow.
8. Проверить существующий login/logout и открыть `Рядом` через shell без auto-geolocation prompt.

## Gate

Targeted E2E → full branch CI → manual acceptance → pre-merge diff audit → merge → merged-main CI → annotated checkpoint tag. UX1B начинается только после закрытия UX1A.1.
