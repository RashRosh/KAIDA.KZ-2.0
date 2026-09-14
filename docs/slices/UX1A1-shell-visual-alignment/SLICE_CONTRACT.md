# UX1A.1 — Shell visual alignment — Slice Contract

**Status:** `APPROVED — IMPLEMENTATION AUTHORIZED`  
**Verified base:** `v0.0.15-ux1a`  
**Verified main SHA:** `0c19cfde3d0288bea4541e9d748a9cd0c4fdb1ea`  
**Implementation branch:** `slice/ux1a1-shell-visual-alignment`

`boltkaida2` используется только как UX/UI reference. Его state model, auth, Search wiring, Tailwind/Vite stack и business logic не переносятся в KAIDA.KZ 2.0.

## 1. User task

Пользователь на любой основной странице KAIDA.KZ сразу понимает, в каком разделе находится, легко переходит между `Поиск / Рядом / Продавцу`, входит/выходит и на mobile получает компактную навигацию, при этом shell визуально ощущается как часть законченного продукта, а не техническая обвязка.

## 2. Scope

- presentation-only корректировка существующего UX1A shell;
- route-aware active state для `Поиск / Рядом / Продавцу`;
- единый линейный icon style для этих navigation entries;
- компактная mobile navigation вместо постоянно видимой второй navigation row;
- визуальное улучшение существующих `Войти / Выйти` без изменения S2 semantics;
- убрать `Тестовая версия` из основной navigation/auth композиции;
- Bolt-подобная плотность/состояния shell в пределах утверждённой KAIDA.KZ Design System;
- сохранить Next routes, AppHeader boundary, Roboto, tokens и accessibility semantics.

## 3. Explicit out of scope

- Search field в header;
- redesign Buyer home/Search;
- Offer cards/grid/detail;
- `Для вас` / S14;
- Nearby behavior changes;
- Seller forms/onboarding changes;
- media/photos/video;
- reviews/rating;
- новый логотип;
- новый auth flow;
- sticky mobile header;
- DB/schema/migrations;
- public API;
- Search matching/ranking;
- Seller ownership;
- geolocation semantics;
- Tailwind или новый UI framework.

## 4. Closed contracts used / preserved

Сохраняются UX1A guarantees:

- единый shared shell;
- KAIDA.KZ wordmark → Buyer home;
- доступность `Поиск / Рядом / Продавцу`;
- реальный S2 auth state;
- primary header `84px` mobile / `104px` desktop;
- Roboto;
- radius scale `8 / 12 / 16 / 20px`;
- отсутствие horizontal layout shift/overflow;
- navigation to `/nearby` не вызывает geolocation автоматически.

Также сохраняются S2 Auth, S3 Seller/Location, S7 Search, S10 contacts, S11 geo/privacy, S13 Interests и все остальные closed S0–S13 contracts.

Если implementation требует API/DB/business-rule change — STOP.

## 5. Risk flags

- **DB migration:** NO.
- **Public API:** NO.
- **Auth/security/privacy:** YES, ограниченно — presentation затрагивает auth state и entries в Nearby/Seller; behavior должен остаться прежним.
- **Concurrency/atomicity:** NO.
- **Data loss:** NO.
- **External service:** NO.

## 6. Expected modules / boundaries of change

Разрешены только:

- shared AppHeader/navigation presentation;
- AuthStatus presentation;
- shell CSS;
- targeted E2E proof;
- slice documentation.

Не ожидаются изменения в `src/db`, migrations, domain repositories/services или API route contracts.

## 7. Acceptance criteria

1. Desktop `Поиск / Рядом / Продавцу` имеют явный route-aware active state и `aria-current="page"`.
2. Navigation entries используют согласованные линейные иконки и сохраняют текстовые labels.
3. На mobile после primary header нет постоянно видимой второй navigation row; разделы доступны через понятное menu action.
4. Mobile menu имеет touch targets не меньше `44x44px`, не создаёт horizontal overflow, закрывается по Escape и после выбора route.
5. Header сохраняет `84px` mobile / `104px` desktop и не становится sticky на mobile.
6. `Войти / Выйти` визуально согласованы с shell и продолжают использовать существующие S2 API/session semantics.
7. `Тестовая версия` больше не конкурирует с navigation/auth зоной.
8. Desktop navigation остаётся геометрически стабильной между основными routes.
9. Переход в `Рядом` не вызывает geolocation prompt автоматически.
10. Roboto, утверждённые colors/radii/spacing и accessibility baseline сохраняются; `Для вас`, fake media, rating/reviews и новые capabilities не появляются.

## 8. Automated test plan

### Unit / integration / DB

Новые проверки не требуются: бизнес-логика, API и schema не меняются.

### E2E targeted proof

- shared shell/header geometry и no-overflow;
- route-aware active state;
- desktop nav centering through real route clicks;
- mobile menu open/close/Escape/route selection;
- seller entry;
- navigation to Nearby без auto-geolocation;
- existing auth E2E остаётся regression proof.

После targeted proof — один full branch CI на финальном executable head. Повторный exact-SHA run не требуется без признаков flaky/nondeterminism.

## 9. Manual acceptance scenario

1. На mobile открыть главную: header компактный, отдельная постоянная nav-row отсутствует, menu открывается и закрывается предсказуемо.
2. Пройти `Поиск → Рядом → Продавцу → Поиск`; active state всегда соответствует текущему разделу.
3. На desktop повторить маршрут и проверить, что menu не прыгает по горизонтали.
4. Проверить существующий login/logout flow.
5. Открыть `Рядом` через shell и убедиться, что переход сам не вызывает geolocation prompt.
6. Визуально подтвердить, что shell стал ближе к `boltkaida2`, но product behavior остался KAIDA.KZ 2.0.

## Gate

Targeted E2E → full branch CI → manual acceptance → pre-merge diff audit → merge → merged-main CI → annotated checkpoint tag. UX1B начинается только после закрытия UX1A.1.
