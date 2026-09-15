# UX1A.2 — Bolt-like Auth modal — Slice Contract

**Status:** `APPROVED — IMPLEMENTATION AUTHORIZED`  
**Verified base:** `v0.0.16-ux1a1`  
**Verified main SHA:** `f7dcb93689ae40a5fddaa7ead478630f97d2f958`  
**Implementation branch:** `slice/ux1a2-auth-modal`

`boltkaida2` используется как прямой visual/composition reference для login modal. Переносятся геометрия, backdrop, modal card, typography, control sizing, icons, spacing и двухшаговая композиция. Fake browser auth, browser-generated OTP, local User/role state и Bolt business logic не переносятся.

## 1. User task

Анонимный пользователь нажимает `Войти` в общем shell, не покидая текущую страницу, вводит телефон, получает настоящий S2 test OTP, подтверждает код и остаётся авторизованным. Вход визуально воспринимается как аккуратный modal flow уровня Bolt, а не как отдельная техническая страница.

## 2. Scope

- кнопка `Войти` в shared shell открывает centered modal/dialog поверх текущей страницы;
- Bolt-like backdrop: затемнение + blur;
- modal composition максимально близко к reference: compact card, brand/shield mark, `Вход в KAIDA.KZ`, close control, phone step, OTP step;
- phone step использует реальный `POST /api/auth/otp/request`;
- OTP step использует реальный `POST /api/auth/otp/verify`;
- dynamic test OTP остаётся показан в UI только как разрешённый S2 test-delivery surface;
- после успешного verify modal закрывается, header сразу отражает authenticated user без ручного reload;
- закрытие по `X`, Escape и backdrop не создаёт User/session и не меняет auth state;
- `/login` сохраняется как deep-link/fallback и использует тот же modal/auth implementation, без второй независимой auth-логики;
- mobile/desktop presentation остаётся responsive и без horizontal overflow;
- сохраняются существующие S2 validation/error/loading semantics и тексты backend errors;
- Bolt copy используется только там, где не противоречит фактическому test-delivery behavior KAIDA.KZ.

## 3. Explicit out of scope

- изменение Auth API;
- DB/schema/migrations;
- SMS provider;
- rate limiting/anti-abuse/brute-force protection;
- OAuth/social login/email/password/passkeys;
- изменение OTP TTL, one-time, superseding или concurrency semantics;
- изменение session/cookie model;
- Seller auth/roles/permissions;
- auth redesign за пределами phone/OTP/login/logout presentation;
- Tailwind/lucide/new UI framework dependencies.

## 4. Closed contracts used / preserved

- S2 KZ phone normalization and validation;
- S2 dynamic six-digit test OTP delivery;
- S2 challenge TTL, one-time, superseding and atomic verification semantics;
- S2 User creation/reuse;
- S2 database-backed opaque persistent session and cookie contract;
- S2 `/api/auth/otp/request`, `/api/auth/otp/verify`, `/api/auth/me`, `/api/auth/logout` public contracts;
- anonymous Search remains available;
- UX1A/UX1A.1 shared shell, stable header geometry and Bolt-aligned presentation;
- `/login` remains reachable as an auth deep link/fallback;
- Roboto, approved colors/radii, 44px minimum interactive targets and accessibility baseline.

If implementation requires auth API/schema/business-rule change — STOP.

## 5. Risk flags

- **DB migration:** NO.
- **Public API:** NO.
- **Auth/security/privacy:** YES — presentation changes around authentication; all S2 security/session contracts must remain unchanged.
- **Concurrency/atomicity:** NO new risk; covered by closed S2 integration tests.
- **Data loss:** NO.
- **External service:** NO.

## 6. Expected modules

- shared AuthStatus/login trigger presentation;
- reusable auth modal + auth flow client component;
- `/login` route fallback composition;
- auth-related CSS;
- targeted auth E2E tests;
- UX backlog/status documentation.

No changes expected in `src/modules/identity` domain/application/storage, DB migrations, auth API routes or cookie/session implementation.

## 7. Acceptance criteria

1. Anonymous `Войти` is a button/control in the shared shell that opens a modal without route navigation.
2. Modal visually follows Bolt reference: dimmed blurred backdrop, centered compact card, brand/shield mark, close control, title and aligned controls.
3. Phone step shows `Телефон`, phone icon, `+7 700 123 45 67` placeholder and full-width `Получить код` CTA.
4. `Получить код` calls the existing real S2 OTP request endpoint; invalid phone/backend errors remain visible in the modal.
5. OTP step stays in the same modal, shows canonical phone, dynamic S2 test code, six-digit input, `Войти` and `Изменить номер`.
6. Wrong/expired OTP remains rejected by the existing S2 backend and error is shown without closing the modal.
7. Correct OTP creates/resolves the real S2 session; modal closes and header immediately shows the authenticated phone.
8. Close button, Escape and backdrop close the modal without creating User/session or mutating auth state; focus returns to the login trigger.
9. `/login` deep link opens the same auth implementation and successful login returns to buyer home; there is no duplicate independent auth flow.
10. Reload/browser-context persistence and logout remain unchanged; anonymous Search continues to work.
11. Mobile and desktop dialog fit the viewport, controls keep minimum 44px targets and no horizontal overflow appears.
12. No auth API, Identity domain, DB migration, cookie/session or dependency changes occur.

## 8. Automated test plan

No new unit/integration/DB tests are required because S2 domain/API/schema contracts do not change. Existing S2 integration suite remains regression proof.

Targeted E2E:
- shell `Войти` → modal opens without URL change;
- X / Escape / backdrop close without auth mutation;
- formatted phone → real OTP request → dynamic test code visible;
- wrong OTP → error, correct OTP → modal closes + authenticated phone visible;
- `/login` deep link uses the same flow;
- expired challenge remains rejected through real UI;
- reload/browser persistence/logout regression;
- mobile/desktop dialog geometry/no overflow.

Then one full branch CI on the final executable SHA. No exact-SHA rerun unless flaky/nondeterminism appears.

## 9. Manual acceptance scenario

1. На desktop открыть главную и нажать `Войти`: modal должен появиться поверх текущей страницы и визуально совпадать с Bolt reference по композиции.
2. Закрыть X, затем снова открыть и закрыть Escape/backdrop; пользователь остаётся anonymous.
3. Ввести форматированный номер, получить dynamic test code, проверить OTP-state и `Изменить номер`.
4. Ввести неправильный код, увидеть ошибку; затем правильный — modal закрывается, phone появляется в header.
5. Reload: login сохраняется. Нажать `Выйти`: anonymous state возвращается.
6. Открыть `/login` напрямую и убедиться, что отображается тот же flow, а не другая auth page.
7. Повторить визуальную проверку на mobile: dialog помещается, элементы не вылезают, keyboard/focus usable.

## Gate

Targeted E2E → full branch CI → manual acceptance → pre-merge diff audit → merge → merged-main CI → annotated checkpoint tag. UX1B начинается только после закрытия UX1A.2.
