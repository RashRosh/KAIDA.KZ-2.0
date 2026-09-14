# UX1A — App shell / navigation — Slice Contract

**Status:** `APPROVED — IMPLEMENTATION AUTHORIZED`  
**Verified checkpoint:** `v0.0.14-s13`  
**Verified main SHA:** `ff8bd7eed8406d35e469c8a0a4bc2f6332068361`  
**Implementation branch:** `slice/ux1a-app-shell`

UX1A is the first corrective UX slice inserted before UX1B, UX1C, UX2, M1 and S14. It does not reopen or renumber S0-S13.

## 1. User task

Пользователь открывает любую текущую основную область KAIDA.KZ и сразу понимает, как вернуться к Buyer home/Search, открыть `Рядом`, перейти в seller flow и войти/выйти, потому что верхняя часть приложения имеет одну компактную и предсказуемую навигационную систему.

## 2. Scope

UX1A включает только app-shell/navigation cleanup поверх закрытого поведения S0-S13:

- один общий визуальный и структурный header/app shell для текущих основных экранов;
- единый wordmark KAIDA.KZ как переход на главную;
- заметные navigation entry points в Buyer home, `Рядом` и существующий `/seller` flow;
- существующий auth status/login/logout остаётся доступным в shell без изменения Identity semantics;
- seller-specific страницы могут иметь контекстный label/secondary navigation, но не отдельную несогласованную верхнюю систему;
- header становится компактнее по высоте и отступам на mobile и desktop;
- навигация не создаёт horizontal overflow на поддерживаемых representative viewport widths;
- базовый design token радиуса для стандартных кнопок, input/select и аналогичных controls устанавливается в `3px`;
- только необходимые presentation components/styles и E2E proof.

UX1A не меняет внутреннюю структуру seller forms или Buyer Offer cards.

## 3. Explicit out of scope

Не входят:

- UX1B marketplace Offer cards, grid/list density и media slot;
- UX1C изменение Nearby geo-intent flow и удаление второго подтверждения;
- UX2 объединение seller setup + contacts и другие seller form improvements;
- address autocomplete, controlled unit lists или системная замена inputs;
- Product image/icon data;
- Offer photo/video, Media module, upload/storage/lifecycle;
- S14 `Для вас`;
- новые product capabilities;
- изменения DB/schema/migrations;
- изменения public API;
- изменения Search matching/ranking/lifecycle;
- изменения Nearby radius/filter/order/privacy semantics;
- изменения Seller ownership/setup/contact business semantics;
- изменения Interests semantics;
- новый auth flow;
- внешний UI framework/design-system dependency;
- копирование конкретного marketplace UI один в один.

## 4. Closed contracts used

### S0 / S7 — Search

UX1A сохраняет существующую Buyer home/Search capability. Search request/response, matching, eligibility и ordering не меняются.

### S2 — Auth

Используются существующие login/session/current-user/logout semantics. Header может переиспользовать существующий auth status UI, но не меняет Identity API, cookie/session behavior или authorization.

### S3 — Seller / Location

Навигация только делает существующий `/seller` flow очевидно доступным. Seller setup, ownership и Location semantics не меняются.

### S11 — Discovery / Nearby

Навигация может вести на существующий `/nearby`, но UX1A не меняет его geolocation behavior. Прямой переход в раздел сам по себе не должен становиться автоматическим browser geo request.

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
- **Auth/security/privacy:** YES, ограниченно — shell отображает существующий auth state и даёт navigation entry в seller/nearby, поэтому необходимо доказать, что auth и geo privacy behavior не изменились.
- **Concurrency/atomicity:** NO.
- **Data loss:** NO.
- **External service:** NO.

## 7. Expected modules / boundaries of change

Ожидаются только presentation-level изменения:

- shared app header/shell/navigation component(s);
- current route pages, которые дублируют header markup;
- global/shared styles и минимальные page styles;
- existing auth status placement/styling без изменения его API contract;
- targeted E2E tests;
- UX1A documentation/backlog status.

Не ожидаются изменения в `src/db`, migrations, repositories/services, domain modules или API route contracts.

## 8. Acceptance criteria

1. Главная, `Рядом`, login и текущие seller pages используют одну узнаваемую app-shell/header систему вместо нескольких независимых вариантов.
2. KAIDA.KZ wordmark на затронутых страницах ведёт на Buyer home.
3. Из общего shell доступны понятные переходы как минимум в Buyer home/Search, `Рядом` и seller flow.
4. Seller entry ведёт в существующий `/seller` и не создаёт новую seller/auth semantics.
5. Existing auth status/login/logout остаётся функциональным; UX1A не меняет S2 API/session behavior.
6. Навигация и header не имеют horizontal overflow на representative mobile и desktop viewport.
7. Header занимает существенно меньше декоративного вертикального пространства, чем текущие разрозненные варианты, не ухудшая tap targets и читаемость.
8. Стандартные кнопки и поля, использующие базовый radius token, получают `3px`; UX1A не требует полного redesign всех card surfaces.
9. Переход в `/nearby` через shell не запускает browser geolocation автоматически; существующий S11 flow до UX1C остаётся прежним.
10. Search, Nearby, seller setup/contacts, interests и Offer data продолжают работать без изменения публичных/business contracts.

## 9. Automated test plan

### Unit

Новые unit tests не требуются по умолчанию: UX1A не добавляет новую чистую business logic.

### Integration / DB

Новые integration/migration tests не требуются. Существующие suites остаются regression proof. Появление необходимости менять API/DB означает scope violation.

### E2E — targeted proof

Проверить только изменённые границы:

- anonymous mobile/desktop: общий header виден без overflow, Buyer home / `Рядом` / seller entry доступны;
- login navigation остаётся рабочей;
- authenticated state и logout остаются рабочими через существующий S2 flow;
- seller entry действительно открывает существующий `/seller`;
- переход на `/nearby` не вызывает geolocation request автоматически до существующего явного действия внутри страницы;
- основные страницы рендерятся с единой shell-геометрией на representative mobile/desktop widths.

После targeted proof — один полный branch CI на финальном executable head. Повторный exact-SHA full run не нужен без сигнала flaky/nondeterminism.

## 10. Manual acceptance scenario

1. На mobile открыть главную и визуально проверить компактный единый header с понятными entry points `Рядом`, seller и login/auth.
2. Перейти последовательно на `Рядом`, login и seller pages: верхняя система остаётся узнаваемой и не прыгает между несвязанными вариантами.
3. Войти существующим тестовым способом, вернуться на главную и убедиться, что auth state отображается и logout работает как раньше.
4. Нажать seller entry и убедиться, что открылся существующий seller flow без изменения его содержимого/бизнес-поведения.
5. Открыть `Рядом` и убедиться, что geolocation prompt не появляется только из-за перехода.
6. Повторить визуальную проверку на desktop: header компактный, навигация не ломается, горизонтального overflow нет.

## Gate

Product Owner approved implementation on 2026-09-14. Backlog items UX-001, UX-005 and UX-006 are `IN_SLICE`.

Implementation must still pass: targeted E2E → full branch CI → manual acceptance → diff audit → merge → merged-main CI → annotated UX1A checkpoint. UX1B starts only after UX1A is closed.
