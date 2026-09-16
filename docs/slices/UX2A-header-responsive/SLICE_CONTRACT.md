# UX2A — Post-UX2 Search / App Shell responsive correction

**Status:** APPROVED
**Base product checkpoint:** `v0.0.21-ux2`
**Product checkpoint commit:** `819063ba005b6c51e3ff42129e79530ab2dc31cc`
**Implementation base main:** `61f531b339497afc568d6da9dd8337be526024d0`
**Related:** Issue #16

## 1. User task

Пользователь может использовать global Search в header на mobile, tablet/iPad и desktop без конфликтов между Search, account identity, logout или menu controls.

Search submit выглядит одинаково на всех ширинах: компактная квадратная кнопка со стрелкой вправо.

## 2. Scope

UX2A включает только небольшую responsive correction общего App Shell / Header Search:

- текстовая кнопка `Искать` заменяется на icon-only квадратную кнопку со стрелкой вправо;
- один и тот же submit-pattern используется на всех поддерживаемых ширинах;
- доступное имя кнопки `Искать` сохраняется;
- submit имеет `width = height`;
- height submit равен текущему Header Search input height;
- сохраняется minimum `44x44px` interactive target закрытого App Shell / Design System;
- responsive layout header корректируется настолько, насколько требуется для устранения overlap/collision;
- особое внимание уделяется authenticated layout около `1024px`;
- global Header Search остаётся usable на mobile, tablet и desktop;
- существующие Search, Auth, navigation и Seller flows сохраняются;
- закрытые design constraints App Shell сохраняются;
- изменения ограничиваются presentation/responsive layer и необходимым targeted E2E proof.

## 3. Explicit out of scope

Не входят:

- Search matching, normalization, aliases или query logging;
- Search ranking или sorting;
- Search API / DTO;
- mandatory Offer price;
- основной Buyer Search redesign;
- Offer cards и buyer actions;
- Nearby behavior или geo semantics;
- Seller onboarding;
- Auth flow, OTP, session или authorization;
- Market Navigation;
- DB/schema/migrations;
- новые product capabilities;
- новый UI framework/dependencies;
- соседние UX backlog fixes.

## 4. Closed contracts used

UX2A использует и сохраняет:

- **S0 / S6 / S7 / S9 Search:** существующий query и Search flow;
- **S2 / UX1A.2 Auth:** существующие login/session/current-user/logout semantics;
- **UX1A / UX1A.1:** shared App Shell, Header Search, navigation, responsive shell и отсутствие page-level horizontal overflow;
- **UX1C:** существующее Nearby navigation/geo behavior;
- **UX1B / UX1D:** buyer Offer presentation/actions;
- **UX2:** Seller onboarding под тем же shared shell.

## 5. Closed contracts potentially touched

### UX1A / UX1A.1 visual App Shell

Это основная затрагиваемая граница.

UX2A уточняет responsive presentation:

- global Header Search должен оставаться usable на поддерживаемых ширинах;
- новый square arrow submit supersedes прежний текстовый submit;
- layout около tablet/iPad width может адаптироваться для устранения collision;
- существующие brand/navigation/Auth semantics сохраняются.

### Search presentation

Меняется только внешний вид submit-control и responsive placement. Query contract и Search behavior не меняются.

### Auth presentation

Authenticated identity/logout участвуют в responsive layout, но Auth behavior и session contracts не меняются.

Если implementation требует изменения Search/Auth API, business logic или других закрытых product contracts, работа останавливается до отдельного согласования.

## 6. Risk flags

- **DB migration:** NO
- **Public API:** NO
- **Auth/security/privacy:** NO new risk. Затрагивается только presentation существующих authenticated controls.
- **Concurrency/atomicity:** NO
- **Data loss:** NO
- **External service:** NO

## 7. Expected modules

Ожидаются изменения только в:

- shared App Header / responsive styles;
- Header Search presentation;
- Auth/account presentation только если это необходимо для устранения responsive conflict;
- targeted App Shell/Search E2E;
- UX2A documentation.

Не ожидаются изменения Search/Identity/Seller/Discovery/Offers/Catalog domain logic, API, DB или migrations.

## 8. Acceptance criteria

1. Header Search остаётся usable на mobile, tablet/iPad и desktop.
2. Search submit на всех ширинах является одной и той же icon-only кнопкой со стрелкой вправо; visible text `Искать` отсутствует, accessible name `Искать` сохраняется.
3. Search submit имеет квадратную геометрию: `width = height`.
4. Height Search submit равен текущему Header Search input height.
5. Submit сохраняет minimum `44x44px` interactive target закрытого App Shell / Design System.
6. Один и тот же размерный и иконный submit-pattern используется на всех ширинах; text-button вариант на отдельных breakpoint отсутствует.
7. На authenticated layout около `1024px` Search, account identity и logout/menu controls не перекрываются и остаются usable.
8. На узком mobile layout header не создаёт page-level horizontal overflow и основные controls остаются доступными.
9. Search submit продолжает передавать тот же query в существующий Search flow.
10. Existing Search/Auth semantics не меняются; Nearby, Seller onboarding, Offer cards и другие соседние contracts не изменяются.

### Manual responsive matrix

Визуальная responsive проверка выполняется на:

`320 / 360 / 390 / 768 / 1024 / 1440px`

`1024px` обязательно проверяется в authenticated state.

## 9. Automated test plan

Новые unit, integration, API или DB tests не требуются.

Targeted E2E доказывает только изменённые риски:

1. **Authenticated `1024px`**
   - Header Search и account/logout controls не пересекаются;
   - отсутствует page-level horizontal overflow;
   - controls остаются usable;
   - Search submit квадратный: `width = height`;
   - height submit равен Header Search input height;
   - interactive target не меньше `44x44px`.

2. **Один representative narrow/mobile viewport**
   - header остаётся usable;
   - нет horizontal overflow;
   - новый Search submit доступен;
   - submit квадратный;
   - height submit равен Header Search input height;
   - interactive target не меньше `44x44px`.

3. **Search wiring**
   - ввод query и новый submit запускают существующий Search flow;
   - query передаётся без изменения.

Enter semantics, полный login/logout flow и прочие закрытые Search/Auth regressions отдельно в UX2A не дублируются, если они уже покрыты существующим regression suite.

После targeted proof:

`targeted E2E → один full branch CI на final executable SHA → manual acceptance → обычные merge/checkpoint gates`.

Повторный exact-SHA CI не требуется без flaky/nondeterminism signal.

## 10. Manual acceptance scenario

1. Визуально пройти `320 / 360 / 390 / 768 / 1024 / 1440px`.
2. На каждой ширине убедиться, что используется один и тот же квадратный icon-only submit-pattern со стрелкой вправо.
3. Убедиться, что submit визуально совпадает по высоте с Header Search input и сохраняет нормальный interactive target.
4. Проверить отсутствие overlap и page-level horizontal overflow.
5. Особенно проверить authenticated `1024px`: Search, phone/account и logout/menu не конфликтуют.
6. Один раз выполнить реальный Search и убедиться, что query и результат работают как раньше.
7. Убедиться, что login/logout controls визуально доступны и usable.
8. Проверить, что никаких изменений Seller onboarding, Nearby или Offer UI в рамках UX2A не появилось.

## Gate

После approval:

`implementation → targeted E2E → full branch CI → manual acceptance → pre-merge diff audit → merge → merged-main CI → annotated checkpoint tag`.

UX2A не требует повторной сертификации закрытых S0/S2/UX1A/UX2 contracts сверх обычного regression CI.
