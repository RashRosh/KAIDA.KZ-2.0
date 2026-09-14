# UX1A — App shell / navigation — Slice Contract

**Status:** `APPROVED — IMPLEMENTATION AUTHORIZED`  
**Verified checkpoint:** `v0.0.14-s13`  
**Verified main SHA:** `ff8bd7eed8406d35e469c8a0a4bc2f6332068361`  
**Implementation branch:** `slice/ux1a-app-shell`

UX1A is the first corrective UX slice inserted before UX1B, UX1C, UX2, M1 and S14. It does not reopen or renumber S0-S13.

Product Owner updated the visual baseline during UX1A manual acceptance. The approved KAIDA.KZ Design System is authoritative for visual language below behavioral slice contracts and `PROJECT_RULES.md`. Historical visual implementation details such as Plus Jakarta Sans or the temporary `3px` radius are superseded by UX1A; closed product/API/business behavior is not reopened.

## 1. User task

Пользователь открывает любую текущую основную область KAIDA.KZ и сразу понимает, как вернуться к Buyer home/Search, открыть `Рядом`, перейти в seller flow и войти/выйти, потому что верхняя часть приложения имеет одну предсказуемую навигационную систему без визуальных скачков между маршрутами.

## 2. Scope

UX1A включает только app-shell/navigation cleanup поверх закрытого поведения S0-S13:

- один общий визуальный и структурный app shell для текущих основных экранов;
- единый wordmark KAIDA.KZ как переход на главную;
- понятные navigation entry points в Buyer home/Search, `Рядом` и существующий `/seller` flow;
- существующий auth status/login/logout остаётся доступным без изменения Identity semantics;
- seller-specific страницы могут иметь context label, но не отдельную несогласованную верхнюю систему;
- desktop navigation имеет стабильный геометрический центр независимо от route content, auth/context content и наличия вертикального scrollbar;
- на mobile primary header имеет design-system height `84px`, на desktop от `768px` — `104px`; mobile navigation может быть отдельной shell-строкой под primary header, чтобы сохранить 44px tap targets;
- основной UI-шрифт — Roboto; browser runtime не должен выполнять отдельный запрос к внешнему font-service;
- вводится утверждённая design-system radius scale: `8 / 12 / 16 / 20px` (`--radius-sm`, `--radius`, `--radius-lg`, `--radius-xl`); прежний временный `3px` отменён до закрытия UX1A;
- вводятся только те design tokens, которые нужны текущему UI и последующим изменениям уже существующих компонентов; новые product components «на будущее» не создаются;
- навигация не создаёт horizontal overflow на поддерживаемых representative viewport widths;
- только необходимые presentation components/styles, design-system documentation и E2E proof.

UX1A не меняет внутреннюю структуру seller forms или Buyer Offer cards.

## 3. Explicit out of scope

Не входят:

- UX1B marketplace Offer cards, grid/list density и card redesign;
- фиктивные media slots/placeholders в UX1B;
- UX1C изменение Nearby geo-intent flow и удаление второго подтверждения;
- UX2 объединение seller setup + contacts и другие seller form improvements;
- address autocomplete, controlled unit lists или системная замена inputs;
- Product image/icon data;
- Offer photo/video, Media module, upload/storage/lifecycle и media layout — это M1/M2;
- reviews/rating implementation — они остаются продуктово запланированы, но требуют отдельного slice;
- S14 `Для вас`;
- новые product capabilities;
- изменения DB/schema/migrations;
- изменения public API;
- изменения Search matching/ranking/lifecycle;
- изменения Nearby radius/filter/order/privacy semantics;
- изменения Seller ownership/setup/contact business semantics;
- изменения Interests semantics;
- новый auth flow;
- новый UI framework/Tailwind;
- копирование конкретного marketplace UI один в один.

## 4. Closed contracts used

### S0 / S7 — Search

UX1A сохраняет существующую Buyer home/Search capability. Search request/response, matching, eligibility и ordering не меняются.

### S2 — Auth

Используются существующие login/session/current-user/logout semantics. Header может переиспользовать существующий auth status UI, но не меняет Identity API, cookie/session behavior или authorization.

### S3 — Seller / Location

Навигация только делает существующий `/seller` flow очевидно доступным. Seller setup, ownership и Location semantics не меняются.

### S11 — Discovery / Nearby

Навигация может вести на существующий `/nearby`, но UX1A не меняет его geolocation behavior. Переход в раздел сам по себе не должен запускать browser geolocation request.

### S13 — Interests

Interest UI/business behavior не меняется; UX1A не трогает Offer card content.

## 5. Closed contracts potentially touched

UX1A обязан сохранить:

- S2 auth/login/logout/current-user behavior;
- S3 seller ownership/setup behavior;
- S7 Search capability и публичные semantics;
- S10 Buyer contact behavior;
- S11 explicit-user-action/privacy boundary для geolocation;
- S13 interest behavior;
- все остальные closed S0-S13 contracts.

Если implementation требует DB/API/business change, STOP: это выходит за UX1A.

## 6. Risk flags

- **DB migration:** NO.
- **Public API:** NO.
- **Auth/security/privacy:** YES, ограниченно — shell отображает существующий auth state и даёт navigation entry в seller/nearby, поэтому необходимо доказать сохранность auth и geo privacy behavior.
- **Concurrency/atomicity:** NO.
- **Data loss:** NO.
- **External service:** NO для runtime product behavior. Font loading не должен добавлять browser runtime dependency на внешний font-service.

## 7. Expected modules / boundaries of change

Ожидаются только presentation/documentation изменения:

- shared app header/shell/navigation component(s);
- current route pages, которые дублировали header markup;
- global/shared styles и необходимые design tokens;
- root typography wiring;
- existing auth status placement/styling без изменения его API contract;
- targeted E2E tests;
- Design System / UX backlog / UX1A documentation.

Не ожидаются изменения в `src/db`, migrations, repositories/services, domain modules или API route contracts.

## 8. Acceptance criteria

1. Главная, `Рядом`, login и текущие seller pages используют одну узнаваемую app-shell/header систему вместо нескольких независимых вариантов.
2. KAIDA.KZ wordmark на затронутых страницах ведёт на Buyer home.
3. Из общего shell доступны понятные переходы как минимум в Buyer home/Search, `Рядом` и seller flow.
4. Seller entry ведёт в существующий `/seller` и не создаёт новую seller/auth semantics.
5. Existing auth status/login/logout остаётся функциональным; UX1A не меняет S2 API/session behavior.
6. Навигация и shell не имеют horizontal overflow на representative mobile и desktop viewport.
7. Primary header имеет `84px` на mobile и `104px` на desktop `>=768px`; эта геометрия едина на основных routes.
8. Desktop navigation остаётся визуально по центру viewport при реальных переходах `Поиск ↔ Рядом ↔ Продавцу`, включая переход на длинную seller page; ширина правого auth/context блока и scrollbar не сдвигают menu.
9. Основной UI использует Roboto с кириллицей; layout не зависит от наличия Roboto в ОС пользователя.
10. Design-system radius tokens равны `8 / 12 / 16 / 20px`; стандартные fields/buttons, использующие `--radius`, получают `12px`, small controls используют `8px` по назначению.
11. Переход в `/nearby` через shell не запускает browser geolocation автоматически; существующий S11 flow до UX1C остаётся прежним.
12. Search, Nearby, seller setup/contacts, interests и Offer data продолжают работать без изменения публичных/business contracts.

## 9. Automated test plan

### Unit

Новые unit tests не требуются: UX1A не добавляет business logic.

### Integration / DB

Новые integration/migration tests не требуются. Существующие suites остаются regression proof. Необходимость менять API/DB означает scope violation.

### E2E — targeted proof

Проверить изменённые границы:

- anonymous mobile/desktop: единый shell виден без overflow, Buyer home / `Рядом` / seller entry доступны;
- primary header height `84/104px` по breakpoint;
- Roboto и radius tokens реально применены;
- desktop nav имеет один и тот же center относительно viewport на `/`, `/nearby`, `/login`, `/seller` и после реальных click navigations;
- scrollbar space стабилизирован, длинная seller page не сдвигает nav;
- login/authenticated/logout остаются рабочими через existing S2 E2E;
- seller entry открывает existing `/seller`;
- переход на `/nearby` не вызывает geolocation request автоматически.

После targeted proof — один full branch CI на финальном executable head. Повторный exact-SHA run не нужен без flaky/nondeterminism signal.

## 10. Manual acceptance scenario

1. На mobile открыть главную: primary header визуально един, Roboto применён, ниже доступна понятная navigation row; горизонтального overflow нет.
2. Перейти `Поиск → Рядом → Продавцу → Поиск`: shell не прыгает влево/вправо и остаётся узнаваемым.
3. На desktop повторить переходы и специально сравнить положение `Поиск / Рядом / Продавцу` на главной и длинной seller page — menu не меняет горизонтальную позицию.
4. Войти существующим тестовым способом, вернуться на главную и убедиться, что auth state отображается и logout работает как раньше.
5. Нажать seller entry и убедиться, что открылся существующий seller flow без изменения его содержимого/бизнес-поведения.
6. Открыть `Рядом` и убедиться, что geolocation prompt не появляется только из-за перехода.
7. Визуально подтвердить новую radius scale вместо прежнего `3px`.

## Gate

Product Owner approved implementation on 2026-09-14 and approved the Design System corrections during UX1A manual acceptance. Backlog items UX-001, UX-005 and UX-006 remain `IN_SLICE` until manual acceptance PASS.

Implementation must still pass: targeted E2E → full branch CI → manual acceptance → diff audit → merge → merged-main CI → annotated UX1A checkpoint. UX1B starts only after UX1A is closed.
