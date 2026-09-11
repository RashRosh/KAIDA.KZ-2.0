# S2 — Auth / тестовая телефонная авторизация

## Статус документа

Утверждённый Feature Spec для S2. Реализация начинается только по отдельному разрешению пользователя.

Исходная контрольная точка:

- `main`: `566fdef32c09932425b59a22424f505ea474c220`;
- tag: `v0.0.2-s1`;
- S0 First Search завершён;
- S1 Offer Lifecycle завершён;
- PostgreSQL остаётся PostgreSQL 18.

## Пользовательская задача

Анонимный пользователь хочет войти в KAIDA.KZ по номеру телефона без пароля.

Он:

1. открывает KAIDA.KZ;
2. продолжает пользоваться Search без входа;
3. открывает вход;
4. вводит номер телефона;
5. получает тестовый OTP;
6. вводит OTP;
7. успешно входит;
8. приложение знает конкретный `User`, которому принадлежит текущая session;
9. после reload и повторного открытия браузера пользователь остаётся авторизованным;
10. может явно выйти через logout.

## Definition of User Value

После S2 KAIDA.KZ имеет минимальную identity-основу для следующих slices и умеет server-side ответить на вопрос:

`какой User выполняет этот authenticated request?`

При этом Search остаётся публичным и не требует login.

## Главный архитектурный invariant

Identity является отдельным модулем modular monolith.

Identity владеет:

- `User`;
- phone normalization для identity;
- OTP challenge;
- OTP generation/verification;
- OTP expiry, superseding и one-time semantics;
- минимальной OTP delivery boundary;
- session creation/resolution;
- session cookie;
- logout.

Identity не владеет:

- Seller;
- Location;
- Offer;
- Search;
- Product;
- seller authorization;
- roles/permissions.

S2 не связывает существующий `Seller` с `User`. Это появляется только тогда, когда требуется S3.

## Что происходит с анонимным пользователем

До успешной OTP verification:

- Search доступен;
- `User` не создаётся;
- session не создаётся;
- Seller не создаётся;
- anonymous profile в БД не создаётся.

OTP request сам по себе не является регистрацией.

`User` появляется только после первого успешного подтверждения телефона.

## Scope

В S2 входят:

- новый модуль Identity;
- телефон как единственный login identifier;
- KZ-oriented phone normalization;
- OTP request;
- test OTP delivery без SMS;
- OTP verification;
- OTP TTL;
- one-time OTP;
- atomic OTP consume при concurrent verify;
- atomic superseding старого unfinished challenge при новом OTP request;
- создание нового User после первого успешного OTP;
- безопасный concurrent User get-or-create;
- повторный вход существующего User;
- database-backed opaque session;
- persistent session cookie;
- current-user resolution;
- logout;
- минимальный login UI;
- отображение authenticated/anonymous состояния;
- migration поверх S1;
- unit/integration/E2E tests;
- regression S0/S1;
- manual acceptance.

## Out of Scope

Не входят:

- реальный SMS;
- SMS provider SDK;
- OAuth/social login;
- email/password;
- password reset;
- magic links;
- MFA/passkeys;
- сложные roles/permissions;
- admin auth;
- seller authorization/onboarding;
- Seller/User relation;
- Seller/Location/Change Set;
- refresh tokens;
- JWT;
- Redis;
- external auth/session SaaS;
- Auth0/Clerk/Supabase Auth и аналоги;
- отдельный auth service/microservice;
- provider registry/plugin framework;
- global auth middleware;
- OTP resend throttling;
- rate limiting;
- anti-abuse;
- brute-force protection;
- account recovery;
- phone-change flow;
- device management;
- logout-all-devices;
- background cleanup jobs.

## Phone format

В S2 UI/application принимает KZ-oriented `+7` input и нормализует в:

`+7XXXXXXXXXX`

Минимально принимаются:

- `+7 700 123 45 67`;
- `+77001234567`;
- `7 700 123 45 67`;
- `87001234567`;
- `8 (700) 123-45-67`;
- варианты с пробелами, скобками и дефисами.

После normalization валидный S2 phone соответствует:

`^\+7[0-9]{10}$`

Bare 10-digit input без `7`/`8`, буквы, extensions и другие международные префиксы в S2 отклоняются.

S2 не определяет оператора и не доказывает фактическую принадлежность номера Казахстану.

DB representation не должна препятствовать будущему расширению на другие E.164 номера.

## Test OTP

Каждый OTP request генерирует новый случайный шестизначный OTP.

Вечного `000000` нет.

OTP:

- связан с challenge;
- связан с canonical phone;
- имеет TTL;
- одноразовый;
- при новом request предыдущий unfinished challenge этого phone надёжно supersede;
- plaintext OTP в PostgreSQL не хранится.

Technical default OTP TTL:

`5 минут`.

Это конфигурация S2, не финальная продуктовая политика.

Boundary:

`now >= expires_at` означает expired.

Wrong OTP не создаёт User/session и не consume challenge.

Expired, consumed или superseded challenge не авторизует.

## Atomic semantics

One-time semantics должны гарантироваться transaction/DB-level механизмом, а не только application check.

Два параллельных `verify` одного challenge не могут дать две успешные авторизации.

Новый OTP request должен transactionally supersede предыдущий unfinished challenge того же canonical phone так, чтобы после завершения concurrent requests существовал максимум один unfinished challenge.

Точные SQL/transaction mechanics фиксируются в `IMPLEMENTATION_CONTRACT.md`.

## User creation

Минимальный `User`:

- `id`;
- `phone_e164`;
- `created_at`.

`phone_e164` unique на уровне PostgreSQL.

Первый successful OTP создаёт User, если его нет.

Повторный login использует существующий User ID.

Concurrent login одного нового phone не может создать duplicate Users.

## Минимальная DB-модель

S2 добавляет ровно три Identity tables:

- `users`;
- `auth_otp_challenges`;
- `auth_sessions`.

Не добавлять profile/roles/Seller fields/refresh tokens/OAuth tables/device tables/audit tables.

## Session model

S2 использует opaque database-backed session.

Browser получает только high-entropy random session token.

PostgreSQL хранит только его verification/hash representation и связь с `User`.

Session cookie не содержит User ID, phone, role, Seller ID или profile data.

JWT и refresh-token infrastructure не используются.

Technical default session TTL:

`30 дней`.

Это конфигурация S2, не финальная продуктовая политика.

Session persistent, sliding refresh отсутствует.

Expired/unknown session означает anonymous.

## Cookie protection

Stable cookie contract фиксируется в Implementation Contract.

Обязательны минимум:

- одно стабильное имя;
- `HttpOnly`;
- `SameSite=Lax`;
- `Path=/`;
- persistent `Expires`;
- persistent `Max-Age`;
- `Secure` для HTTPS/production;
- logout удаляет ту же cookie с теми же scope/security attributes.

Cookie expiry не является server-side доказательством авторизации: PostgreSQL session и `expires_at` остаются source of truth.

Session token запрещено хранить в localStorage/sessionStorage, логировать или возвращать в JSON.

## Current User contract

Identity предоставляет server-side contract семантически вида:

`resolveCurrentUser(request/cookie context) -> CurrentUser | null`

Другие modules не читают `auth_sessions` и не разбирают session cookie самостоятельно.

S3 позднее сможет использовать этот contract.

Search в S2 к Identity не подключается.

## Test OTP delivery boundary

Identity application use case не строится вокруг поля `testOtp`.

Существует минимальная Identity-local OTP delivery boundary.

S2 test-delivery implementation имеет право показать/вернуть plaintext OTP пользователю закрытой тестовой версии.

В S22 test delivery заменяется SMS delivery без изменения:

- OTP verification;
- User creation;
- sessions;
- current-user resolution.

Provider registry/plugin framework не создаётся.

## API surface

S2 добавляет:

- `POST /api/auth/otp/request`;
- `POST /api/auth/otp/verify`;
- `GET /api/auth/me`;
- `POST /api/auth/logout`.

### `/api/auth/me`

Anonymous является нормальным состоянием:

HTTP `200`

```json
{ "user": null }
```

Отсутствующая/invalid/expired session не является exceptional state.

Authenticated response содержит только минимальный current User.

## Public anonymous surface

После S2 без авторизации продолжают работать:

- `/`;
- Search UI;
- `GET /api/search?q=...`.

S2 не добавляет global auth redirect/middleware и не меняет S0/S1 Search contract.

## Identity configuration

Один маленький Identity config layer владеет минимум:

- OTP TTL;
- Session TTL;
- OTP HMAC secret;
- effective cookie Secure behaviour.

Magic numbers не размазываются по коду.

Generic config framework не создаётся.

OTP HMAC secret не имеет insecure production fallback.

Developer/manual setup обязан быть документирован и использовать стандартный `node:crypto` для генерации 32 random bytes / 64 hex chars.

CI/Playwright используют явно заданный synthetic test secret.

## Cryptography requirements

Используются только стандартные primitives `node:crypto`.

Plaintext OTP в DB запрещён.

Session token и OTP являются секретами с разной entropy, поэтому не обязаны использовать один hashing mechanism.

Конкретные primitives/domain separation фиксируются в Implementation Contract.

Собственную криптографию не писать.

## Migration requirements

S2 создаётся отдельной migration поверх `0000` и `0001`.

`0000` и `0001` не меняются.

S2 migration создаёт только Identity tables/indexes/constraints и не меняет Product/Seller/Location/Offer/Search/lifecycle schema.

Обязательны:

- реальный S1 → S2 upgrade path;
- clean PostgreSQL 18 migration chain.

## Test strategy

### Unit

Проверяются минимум:

- phone normalization/validation;
- config validation/defaults;
- OTP generation/digest/verification;
- session token generation/digest;
- cookie contract;
- TTL boundaries без sleep.

### Integration

Только реальный PostgreSQL 18.

Обязательны:

- OTP request creates challenge, not User;
- wrong/expired/superseded/consumed OTP failures;
- atomic concurrent OTP request;
- atomic concurrent OTP consume;
- concurrent User uniqueness/get-or-create;
- first login creates User/session;
- repeat login reuses User;
- valid/expired/unknown session resolution;
- logout;
- migration upgrade;
- clean migration chain.

### E2E

Playwright mobile + desktop доказывает:

`anonymous → Search → login → dynamic test OTP → wrong OTP → correct OTP → authenticated → Search → reload/browser persistence → logout → anonymous → Search`.

Debug/test auth endpoints запрещены.

Existing S0/S1 regression tests не ослабляются.

## Manual acceptance

После зелёного CI отдельно проверяются:

- anonymous Search;
- login с форматированным phone;
- dynamic test OTP;
- wrong OTP;
- correct OTP;
- authenticated phone;
- Search после login;
- reload persistence;
- browser reopen persistence;
- logout;
- Search после logout;
- repeat login same User;
- expired challenge через controlled DB setup;
- superseding старого challenge;
- mobile/desktop/keyboard/focus.

До manual acceptance статус:

`NOT READY: manual acceptance pending`.

## Pre-public-launch security gate

S2 является только закрытым тестовым auth.

До публичного запуска обязательны, а не optional:

- убрать test OTP leakage из API/UI;
- подключить реальный SMS provider;
- OTP request rate limiting;
- OTP verify rate limiting;
- brute-force protection;
- anti-abuse controls;
- resend policy;
- delivery failure/retry policy;
- production secret-management review;
- `Secure=true` на публичном HTTPS deployment.

Эти пункты являются launch blockers. Основной переход предусмотрен S22.

## Definition of Done

S2 `READY` только после:

- соблюдения Feature Spec и утверждённого Implementation Contract;
- PostgreSQL 18 migration verification;
- atomic OTP request/consume concurrency tests;
- concurrent User uniqueness test;
- новых unit/integration/E2E tests;
- полного S0/S1 regression;
- build;
- `pnpm verify`;
- фактически зелёного GitHub Actions;
- отдельной manual acceptance;
- merge в `main`;
- зелёного CI на merged `main`;
- tag `v0.0.3-s2`.

До отдельной manual acceptance запрещены merge/tag/S3.
