# UX1A.1 — Bolt layout alignment — Slice Contract

**Status:** `APPROVED — IMPLEMENTATION AUTHORIZED`  
**Verified base:** `v0.0.15-ux1a`  
**Verified main SHA:** `0c19cfde3d0288bea4541e9d748a9cd0c4fdb1ea`  
**Implementation branch:** `slice/ux1a1-shell-visual-alignment`

`boltkaida2` используется как UX/UI composition reference: взаимное расположение shell/search/navigation/home hero. Его state model, fake auth, mock data, Search business logic, Tailwind/Vite stack и domain behavior не переносятся.

Этот corrective slice легитимно уточняет два закрытых visual contracts UX1A по решению Product Owner:

- desktop navigation больше не обязана быть геометрически центрирована внутри primary row; она становится отдельной левой secondary navigation row, как в reference composition;
- `104px` относится к desktop primary/top row; полный desktop shell может быть выше из-за отдельной secondary navigation row. Mobile primary row остаётся `84px`.

Product/API/business contracts S0–S13 не открываются.

## 1. User task

Покупатель открывает KAIDA.KZ и видит знакомую marketplace/search композицию: бренд слева, глобальный поиск в верхней desktop-зоне, вход справа, отдельную навигацию ниже и основной buyer search flow слева сверху вниз, а не разнесённый по двум несвязанным колонкам.

## 2. Scope

- перестроить desktop shell по композиции `brand | search | auth` в primary row;
- вынести `Поиск / Рядом / Продавцу` в отдельную secondary navigation row слева;
- сохранить route-aware active state и линейные navigation icons;
- desktop header Search должен вести в существующий настоящий Buyer Search flow, а не быть декоративным контролом;
- сохранить компактный mobile header/menu без постоянной второй navigation row;
- перестроить Buyer home из двухколоночного `intro | Search` в последовательную Bolt-подобную композицию `hero → description → Search → results`;
- визуально приблизить headline/spacing/content density к `boltkaida2` без копирования его mock capabilities;
- сохранить существующие Search validation/error/loading/result semantics, Search API и Offer data;
- сохранить реальный S2 auth, Next routes, Roboto, approved color/radius tokens и accessibility baseline.

## 3. Explicit out of scope

- `Для вас` / S14;
- fake ratings/reviews;
- fake Offer media/placeholders;
- redesign Offer cards/grid/detail — это UX1B/M1 boundaries;
- изменение Search matching/ranking/query logging/API contract;
- Nearby behavior change — UX1C;
- Seller forms/onboarding change — UX2;
- новый логотип/brandmark;
- новый auth flow;
- sticky mobile header;
- DB/schema/migrations;
- Seller ownership/business rules;
- geolocation semantics;
- Tailwind или новый UI framework.

## 4. Closed contracts used / preserved

Сохраняются:

- UX1A shared-shell boundary и wordmark → Buyer home;
- S0/S7 Search request/response, validation, matching, ranking, loading/error semantics;
- S2 auth/session/login/logout semantics;
- S3 Seller/Location ownership/setup semantics;
- S10 contact behavior;
- S11 explicit-user-action geo/privacy boundary;
- S13 Interests behavior;
- Roboto;
- radius scale `8 / 12 / 16 / 20px`;
- no page-level horizontal overflow;
- navigation to `/nearby` не вызывает browser geolocation автоматически.

Visual corrections explicitly supersede только UX1A desktop nav-centering и interpretation of total desktop header height, как указано выше.

Если implementation требует DB/API/business-rule change — STOP.

## 5. Risk flags

- **DB migration:** NO.
- **Public API:** NO.
- **Auth/security/privacy:** YES, ограниченно — shell продолжает отображать auth state и ведёт в Nearby/Seller; geo privacy и auth behavior должны сохраниться.
- **Concurrency/atomicity:** NO.
- **Data loss:** NO.
- **External service:** NO.

## 6. Expected modules / boundaries of change

Разрешены:

- shared AppHeader/navigation/search presentation;
- AuthStatus presentation;
- Buyer home page composition;
- SearchForm presentation/wiring, только чтобы query из header вошёл в существующий Search flow;
- shell/home CSS;
- targeted E2E proof;
- slice documentation.

Не ожидаются изменения в `src/db`, migrations, Search domain/repository/service logic, API route contracts или Seller/Location domain modules.

## 7. Acceptance criteria

1. Desktop primary row визуально имеет три зоны: KAIDA.KZ слева, Search по центру, auth/context справа.
2. Desktop primary/top row имеет `104px`; secondary navigation расположена отдельным рядом ниже, слева, поэтому полный desktop shell выше `104px`.
3. `Поиск / Рядом / Продавцу` имеют route-aware active state, `aria-current="page"`, icons и стабильную левую геометрию между routes.
4. Desktop header Search является рабочим: введённый query открывает Buyer home и запускает существующий real Search flow с теми же API/validation/result semantics.
5. Buyer home больше не использует двухколоночную композицию `intro слева / Search справа`; hero, description и основной Search идут сверху вниз в одной buyer-oriented композиции.
6. На mobile primary row остаётся `84px`, global header Search не забирает экранное место, navigation доступна через compact menu.
7. Mobile menu имеет touch targets не меньше `44x44px`, закрывается по Escape и после route selection, horizontal overflow отсутствует.
8. `Войти / Выйти` продолжают использовать существующие S2 API/session semantics.
9. Переход в `Рядом` не вызывает geolocation prompt автоматически.
10. Не появляются `Для вас`, fake media, ratings/reviews, новый Product capability или новый framework.
11. Roboto, approved colors/radii/spacing и accessibility baseline сохраняются.

## 8. Automated test plan

### Unit / integration / DB

Новые уровни не нужны: domain logic/API/schema не меняются. Existing regression suites остаются contract proof.

### E2E targeted proof

- primary row `84/104px` и отсутствие overflow;
- desktop composition `brand | search | auth` + separate left navigation row;
- route-aware active state и stable nav geometry;
- header Search → Buyer home → existing real Search result;
- mobile menu open/close/Escape/route selection;
- seller entry;
- navigation to Nearby без auto-geolocation;
- existing auth E2E остаётся regression proof.

После targeted proof — один full branch CI на финальном executable head. Повторный exact-SHA run не требуется без flaky/nondeterminism signal.

## 9. Manual acceptance scenario

1. На desktop сравнить KAIDA.KZ с `boltkaida2`: верхняя композиция должна читаться как `logo/brand → global search → login`, а навигация — отдельным рядом ниже слева.
2. На главной проверить последовательность `hero → description → main Search`, без старой двухколоночной раскладки.
3. Из `/nearby` выполнить поиск через header и убедиться, что открылась главная, query попал в основной Search и появился реальный результат.
4. Пройти `Поиск → Рядом → Продавцу → Поиск`; active state корректен, navigation row не прыгает.
5. На mobile проверить compact menu, отсутствие постоянной второй row и отсутствие horizontal overflow.
6. Проверить существующий login/logout.
7. Открыть `Рядом` через shell и убедиться, что переход сам не вызывает geolocation prompt.

## Gate

Targeted E2E → full branch CI → manual acceptance → pre-merge diff audit → merge → merged-main CI → annotated checkpoint tag. UX1B начинается только после закрытия UX1A.1.
