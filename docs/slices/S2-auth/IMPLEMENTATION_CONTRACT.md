# KAIDA.KZ 2.0 — S2 Auth Implementation Contract

**Slice:** S2 Auth / тестовая телефонная авторизация  
**Статус:** утверждён, реализация разрешена  
**Рабочая ветка:** `slice/s2-auth`  
**Исходная база:** `v0.0.2-s1` / `566fdef32c09932425b59a22424f505ea474c220`  
**Контрольная версия после полного DoD:** `v0.0.3-s2`

## 1. Цель slice

S2 должен доказать:

`anonymous → phone → OTP request → test delivery → verify → User → DB session → authenticated → reload/browser reopen → still authenticated → logout → anonymous`

При этом существующий anonymous Search S0/S1 остаётся публичным.

До отдельной manual acceptance после CI итоговый статус может быть только:

`NOT READY: manual acceptance pending`.

До manual acceptance запрещены merge в `main`, tag `v0.0.3-s2` и начало S3.

## 2. Неизменяемые решения

1. Login identifier только phone.
2. S2 application поддерживает KZ-oriented `+7` input.
3. Canonical phone: `+7XXXXXXXXXX`.
4. SMS отсутствует.
5. Каждый OTP request создаёт новый random six-digit OTP.
6. Fixed `000000` запрещён.
7. OTP TTL default: 300 seconds.
8. Session TTL default: 2,592,000 seconds / 30 days.
9. Defaults являются техническими, не продуктовой политикой.
10. JWT отсутствует.
11. Session database-backed и opaque.
12. Browser получает high-entropy token, DB хранит только digest.
13. Plaintext OTP в PostgreSQL запрещён.
14. Ровно три Identity tables: `users`, `auth_otp_challenges`, `auth_sessions`.
15. Auth framework/SaaS, Redis, provider registry и microservice отсутствуют.
16. Global auth middleware отсутствует.
17. Search остаётся anonymous и не получает Identity dependency.
18. Seller не связывается с User в S2.
19. `0000` и `0001` не меняются.
20. Search/Offers/Seller/Location modules и DB contracts не меняются.
21. OTP consume и OTP supersede имеют DB/transaction-level correctness guarantees.
22. User uniqueness обеспечивается PostgreSQL.
23. S22 меняет delivery, не verification/User/session/current-user contracts.

## 3. Identity ownership

Identity владеет User, phone normalization, OTP challenge, OTP crypto, OTP lifecycle, delivery boundary, session creation/resolution, cookie contract и logout.

Другие modules не читают `auth_sessions`/`auth_otp_challenges` и не разбирают auth cookie.

Будущий S3 использует только server-side Identity contract `resolveCurrentUser(...)`.

## 4. Phone normalization

Application принимает минимум:

- `+77001234567`;
- `+7 700 123 45 67`;
- `7 700 123 45 67`;
- `87001234567`;
- `8 (700) 123-45-67`;
- варианты с пробелами, `(`, `)`, `-`.

После удаления разрешённых formatting characters:

- `8XXXXXXXXXX` → заменить первый `8` на `7`, затем добавить `+`;
- `7XXXXXXXXXX` → добавить `+`;
- `+7XXXXXXXXXX` → использовать как candidate.

Итоговый S2 application regex:

`^\+7[0-9]{10}$`

Bare 10 digits, letters, extensions и другие country prefixes отклоняются.

DB constraint остаётся generic E.164-compatible:

`^\+[1-9][0-9]{7,14}$`

чтобы будущая международная поддержка не требовала менять User schema.

## 5. DB schema: `users`

| column | PostgreSQL | NULL | default |
|---|---|---:|---:|
| `id` | uuid | no | none |
| `phone_e164` | text | no | none |
| `created_at` | timestamptz | no | none |

Constraints:

- PK `id`;
- UNIQUE `phone_e164`;
- CHECK generic E.164-compatible representation.

UUID генерируется application layer через `crypto.randomUUID()`.

## 6. DB schema: `auth_otp_challenges`

| column | PostgreSQL | NULL | default |
|---|---|---:|---:|
| `id` | uuid | no | none |
| `phone_e164` | text | no | none |
| `otp_digest` | char(64) | no | none |
| `created_at` | timestamptz | no | none |
| `expires_at` | timestamptz | no | none |
| `consumed_at` | timestamptz | yes | none |
| `superseded_at` | timestamptz | yes | none |

Constraints:

- PK `id`;
- E.164-compatible phone CHECK;
- `otp_digest` lowercase hex SHA-256-size digest format;
- `expires_at > created_at`;
- consumed and superseded cannot both be non-null.

No materialized challenge status column.

Partial unique index обязательный:

`UNIQUE(phone_e164) WHERE consumed_at IS NULL AND superseded_at IS NULL`.

Expired unfinished challenge остаётся под этим invariant до следующего request, который supersede его transactionally.

## 7. DB schema: `auth_sessions`

| column | PostgreSQL | NULL | default |
|---|---|---:|---:|
| `id` | uuid | no | none |
| `user_id` | uuid | no | none |
| `token_digest` | char(64) | no | none |
| `created_at` | timestamptz | no | none |
| `expires_at` | timestamptz | no | none |

Constraints:

- PK `id`;
- FK `user_id -> users.id`;
- UNIQUE `token_digest`;
- digest lowercase hex format;
- `expires_at > created_at`.

Не добавлять refresh token, role, device, IP, User-Agent, last_seen, revoked flag или Seller ID.

Logout удаляет session row. Expired rows могут оставаться до будущей cleanup policy.

## 8. Identity clock

Identity имеет локальный contract:

`type IdentityClock = () => Date`.

Production implementation: `() => new Date()`.

Каждый use case захватывает `now` один раз.

Tests используют fixed clock. `sleep`/polling запрещены.

Runtime OTP/session semantics не используют PostgreSQL `now()`.

Expiry boundary:

`now >= expires_at` означает expired.

Не рефакторить Offers clock S1 в shared abstraction.

## 9. Identity config

Один файл `src/modules/identity/config/identity.config.ts` является единственным Identity env reader.

### 9.1 `IDENTITY_OTP_TTL_SECONDS`

Missing → `300`.

Только positive safe integer. Zero/negative/decimal/text/non-finite/unsafe rejected.

### 9.2 `IDENTITY_SESSION_TTL_SECONDS`

Missing → `2592000`.

Та же validation.

### 9.3 `IDENTITY_OTP_HMAC_SECRET_HEX`

Обязательный secret, **без fallback**.

Ровно 32 random bytes, представленные 64 hex characters:

`^[0-9a-fA-F]{64}$`.

Если secret отсутствует/invalid, Identity auth operation fail-fast; production insecure default запрещён.

`.env.example` и README обязаны показать локальный способ генерации стандартным `node:crypto`, например:

`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`

Настоящий secret не коммитится. В S2 не требуется внешний secret manager.

CI и Playwright используют явно заданный synthetic test secret.

### 9.4 `IDENTITY_COOKIE_SECURE`

Допустимо `true | false`.

Missing:

- `NODE_ENV === 'production'` → true;
- иначе false.

Local HTTP E2E обязан явно задавать false.

Generic config framework не создаётся.

## 10. OTP generation

Используется `node:crypto.randomInt`.

Диапазон 0..999999 форматируется до ровно 6 digits с leading zeros.

`Math.random`, timestamp-derived и fixed OTP запрещены.

## 11. OTP verification material

Поскольку six-digit OTP имеет низкую entropy, обычный unsalted SHA-256 недостаточен при DB leak.

S2 использует `HMAC-SHA-256` из `node:crypto`.

Message domain separation:

`kaida-otp-v1\0{challengeId}\0{phoneE164}\0{otp}`

где separator фиксирован `\0`.

Digest хранится lowercase 64-char hex.

Verify пересчитывает digest и сравнивает через `crypto.timingSafeEqual` над buffers одинаковой длины.

Plaintext OTP:

- не хранится в DB;
- не логируется;
- не сохраняется в User/session.

Собственные crypto primitives запрещены.

## 12. Session token crypto

Session token имеет высокую entropy:

`crypto.randomBytes(32)` → 256 bits → `base64url` browser representation.

DB хранит только:

`SHA-256(sessionToken)` lowercase 64-char hex через `crypto.createHash('sha256')`.

Различие намеренное:

- low-entropy OTP → keyed HMAC;
- high-entropy random session token → SHA-256 digest.

## 13. Advisory lock key: exact algorithm

OTP replacement использует PostgreSQL transaction advisory lock по canonical phone.

Generic locking abstraction не создаётся.

Lock key вычисляется маленькой private Identity-local helper-функцией внутри `identity.repository.ts`:

1. UTF-8 input: `kaida-identity-phone-lock-v1\0${phoneE164}`;
2. `SHA-256` через `node:crypto.createHash('sha256')`;
3. взять первые 8 bytes digest;
4. интерпретировать их как signed 64-bit big-endian integer через `Buffer.readBigInt64BE(0)`;
5. передать decimal string этого bigint в `pg_advisory_xact_lock($1::bigint)`.

Properties:

- одинаковый canonical phone всегда даёт одинаковый key;
- key нигде не хранится как business data;
- collision максимум лишне сериализует два разных phones;
- collision не нарушает correctness, потому что row predicates/unique index работают по реальному `phone_e164`;
- helper используется только Identity OTP request repository path.

## 14. OTP Delivery boundary

Минимальный Identity-local contract семантически:

`OtpDelivery.deliver({ challengeId, phoneE164, code, expiresAt })`.

Core use case не знает поле `testOtp` и не ветвится по test mode.

S2 implementation `TestOtpDelivery` может вернуть delivery receipt, из которого HTTP adapter формирует test-only response:

```json
{ "delivery": { "mode": "test", "code": "482193" } }
```

Только test delivery имеет право вывести plaintext OTP наружу.

S22 заменяет delivery implementation на SMS без изменения verification/User/session/current-user logic.

Provider registry/plugin framework запрещён.

## 15. OTP request transaction

Use case:

`normalize phone → capture now → generate challenge UUID/OTP/expiry/digest → transactional replace → commit → delivery`.

Delivery выполняется после successful DB commit.

Transaction:

1. `BEGIN`;
2. вычислить exact advisory key по §13;
3. `SELECT pg_advisory_xact_lock($1::bigint)`;
4. `UPDATE auth_otp_challenges SET superseded_at = requestNow WHERE phone_e164 = phone AND consumed_at IS NULL AND superseded_at IS NULL`;
5. `INSERT` new challenge;
6. `COMMIT`.

Partial unique index является дополнительной DB guarantee.

Два concurrent requests одного phone после завершения оставляют ровно один unfinished challenge. Последний request в сериализованном PostgreSQL порядке supersede предыдущий.

## 16. OTP verify pre-check

Input: `challengeId`, `code`.

До login transaction:

1. validate UUID;
2. validate code ровно 6 digits;
3. capture `verifyNow` once;
4. load challenge;
5. reject consumed/superseded;
6. reject `verifyNow >= expires_at`;
7. recalculate HMAC;
8. timing-safe compare.

Wrong OTP не consume challenge и не создаёт User/session.

## 17. Atomic OTP consume + login transaction

После успешного crypto pre-check начинается одна transaction.

Критический conditional mutation:

`UPDATE auth_otp_challenges SET consumed_at = verifyNow WHERE id = challengeId AND consumed_at IS NULL AND superseded_at IS NULL AND expires_at > verifyNow RETURNING phone_e164`.

Только transaction, получившая RETURNING row, имеет право продолжить.

Если RETURNING пуст:

- verification non-success;
- User не создаётся;
- Session не создаётся.

Затем **в той же transaction**:

`consume → get-or-create User → create Session → COMMIT`.

Если User/session creation падает, rollback возвращает challenge в unconsumed state.

Два concurrent verify одного challenge: exactly one success.

## 18. Concurrent User get-or-create

`users.phone_e164` PostgreSQL UNIQUE является source of truth.

Unsafe `SELECT then INSERT` как единственная guarantee запрещён.

Flow внутри transaction:

`INSERT ... ON CONFLICT (phone_e164) DO NOTHING RETURNING ...`.

Если row returned → новый User.

Если conflict → `SELECT ... WHERE phone_e164 = ...` в той же transaction → существующий User.

Concurrent attempts одного phone должны вернуть один logical User и оставить одну DB row.

## 19. Session creation

После User resolution:

1. `crypto.randomUUID()` → session ID;
2. `randomBytes(32)` → plaintext token;
3. base64url encoding;
4. SHA-256 digest;
5. `expiresAt = verifyNow + configured session TTL`;
6. DB insert digest only;
7. transaction commit;
8. plaintext token устанавливается cookie.

Новая successful authentication создаёт новую независимую session.

## 20. Cookie contract

Stable name:

`kaida_session`.

Successful login устанавливает согласованно:

- `name=kaida_session`;
- `HttpOnly=true`;
- `SameSite=Lax`;
- `Path=/`;
- `Secure=effective Identity config`;
- `Expires=auth_sessions.expires_at`;
- `Max-Age=configured session TTL seconds`.

`Domain` не устанавливать.

PostgreSQL `auth_sessions.expires_at` остаётся server-side source of truth. Наличие cookie и её client-side expiry сами по себе не авторизуют User.

Session token не возвращается JSON, не логируется и не хранится localStorage/sessionStorage/URL.

### Logout cookie

Logout удаляет matching session row по token digest, затем отправляет removal cookie с **тем же**:

- name;
- Path;
- SameSite;
- HttpOnly;
- Secure;

и одновременно:

- `Max-Age=0`;
- `Expires` = заведомо прошедшая дата.

Logout idempotent.

## 21. Current User contract

Identity предоставляет server-side contract:

`resolveCurrentUser(cookie/request context) -> { id, phoneE164 } | null`.

Он самостоятельно:

1. читает `kaida_session`;
2. no cookie → null;
3. digest token;
4. capture now once;
5. ищет session + User;
6. session valid iff `expires_at > now`;
7. возвращает minimal CurrentUser или null.

No sliding refresh.

Другие modules не знают cookie name/session hashing/session table.

Search этот contract в S2 не вызывает.

## 22. API contracts

Все auth endpoints: `Cache-Control: no-store`.

### `POST /api/auth/otp/request`

Request:

```json
{ "phone": "8 (700) 123-45-67" }
```

Success: HTTP 201.

```json
{
  "challenge": { "id": "uuid", "expiresAt": "ISO-8601" },
  "delivery": { "mode": "test", "code": "482193" }
}
```

Existing/new User не различаются в response.

Invalid phone: 400 `INVALID_PHONE`.

Unexpected backend: 503 `AUTH_UNAVAILABLE`.

### `POST /api/auth/otp/verify`

Request:

```json
{ "challengeId": "uuid", "code": "482193" }
```

Success: HTTP 200 + `kaida_session` cookie.

```json
{ "user": { "id": "uuid", "phone": "+77001234567" } }
```

Errors:

- malformed input → 400 `INVALID_AUTH_REQUEST`;
- unknown challenge → 400 `INVALID_OTP_CHALLENGE`;
- wrong OTP → 401 `INVALID_OTP`;
- expired → 410 `OTP_EXPIRED`;
- consumed/superseded/concurrency loser → 409 `OTP_NOT_ACTIVE`;
- unexpected backend → 503 `AUTH_UNAVAILABLE`.

### `GET /api/auth/me`

Anonymous/invalid/expired session:

HTTP 200

```json
{ "user": null }
```

Authenticated:

```json
{ "user": { "id": "uuid", "phone": "+77001234567" } }
```

### `POST /api/auth/logout`

Authenticated or anonymous: HTTP 204.

Deletes matching session if present and removes cookie.

## 23. UI contract

Главная Search page остаётся главным публичным экраном.

Anonymous header показывает `Войти`.

Authenticated header показывает canonical phone + `Выйти`.

Отдельный `/login` имеет два шага.

Phone step: label, `type=tel`, `autocomplete=tel`, validation/loading/error.

OTP step: canonical phone, six-digit input, `inputmode=numeric`, `autocomplete=one-time-code`, dynamic test code, wrong/expired states, возможность изменить phone.

После success → `/`.

Profile/dashboard/onboarding не создаются.

## 24. Migration contract

Новая migration:

`drizzle/migrations/0002_s2_auth.sql`.

Generated snapshot:

`drizzle/migrations/meta/0002_snapshot.json`.

`_journal.json` получает только запись 0002.

Migration создаёт только Identity tables/indexes/constraints.

Запрещено менять:

- `0000_s0_first_search.sql`;
- `0001_s1_offer_lifecycle.sql`;
- products/sellers/locations/offers schema;
- Search contract;
- Offers lifecycle.

## 25. Migration verification

Обязательны два path.

### Real S1 → S2 upgrade

Test: `tests/integration/s2-migration-upgrade.test.ts`.

Temporary DB exact name:

`kaida_s2_upgrade_test`.

Safety guards:

- source server только TEST_DATABASE_URL;
- PostgreSQL major 18;
- development DB не target;
- destructive create/drop только exact temporary name.

Flow:

`clean temp DB → actual 0000 → actual 0001 → representative S1 rows → snapshot old data → actual 0002 → inspect → cleanup finally`.

Проверить сохранность Product/Seller/Location/Offer IDs, fields, lifecycle timestamps/status и отсутствие изменений старой schema.

Дополнительно реально проверить DB constraints/unique/FK/partial unique challenge index.

### Clean path

`tests/integration/prepare-database.ts` применяет `0000 → 0001 → 0002`, повторный migrate = no-op.

Expected application tables ровно:

- products;
- sellers;
- locations;
- offers;
- users;
- auth_otp_challenges;
- auth_sessions.

S2 seed User не создаётся.

## 26. Unit test matrix

### Phone

Valid variants одного phone → `+77001234567`.

Invalid length/prefix/letters/bare 10 digits/empty rejected.

### Config

OTP TTL default 300 + positive integer validation.

Session TTL default 2592000 + same validation.

HMAC secret exact 64 hex required; missing/short/non-hex rejected.

Cookie secure explicit true/false; invalid rejected; env-based default behaviour tested.

### OTP crypto

- six digits;
- leading zero supported;
- deterministic HMAC same inputs;
- different OTP/challenge/phone → different digest;
- correct verify true;
- wrong verify false;
- plaintext differs from digest.

### Session crypto

- 32 random bytes before encoding;
- base64url representation;
- SHA-256 = 64 hex;
- same token same digest;
- different token different digest.

### Cookie

- exact name `kaida_session`;
- HttpOnly/Lax/Path/Secure;
- both Expires and Max-Age on login;
- logout same attributes + Max-Age=0 + expired Expires.

## 27. Integration matrix

Все tests используют реальный PostgreSQL 18.

### Request

Valid phone creates challenge, not User; canonical phone stored; plaintext OTP absent; expiry controlled.

### Supersede

Second request supersedes first; old code cannot login; exactly one unfinished challenge.

### Concurrent Request

Two requests same phone concurrently → exactly one unfinished challenge after completion; no unique invariant violation escapes as correctness failure.

### Wrong/Expired

Wrong OTP creates no User/session and does not consume.

`expires_at > now` valid, `== now` and `< now` rejected.

### Atomic concurrent consume

One challenge + correct OTP + two concurrent verify calls:

- exactly one success;
- exactly one non-success;
- exactly one consumed challenge;
- exactly one new login session;
- for new phone exactly one User.

### User uniqueness

Concurrent real get-or-create path same phone:

- exactly one DB User;
- both results same User ID;
- PostgreSQL UNIQUE is final guarantee.

### Re-login

Two sequential successful logins same phone → one User, same User ID, two sessions allowed.

### Session

Valid token resolves correct User. Unknown/expired/`expires_at == now` → null. No sliding extension. Plaintext token absent in DB.

### Logout

Current session deleted; User remains; second session same User remains; repeated logout safe.

## 28. E2E matrix

New file: `tests/e2e/auth.spec.ts`.

Existing S0/S1 E2E assertions не ослабляются.

Mobile + desktop:

1. anonymous `/`;
2. anonymous Search `баранина` works;
3. `Войти`;
4. formatted KZ phone;
5. dynamic test OTP shown;
6. wrong OTP rejected;
7. correct OTP accepted;
8. authenticated phone shown;
9. Search after login works;
10. reload remains authenticated;
11. persistent cookie has real expiry;
12. restored/new browser context with cookie still resolves same User;
13. logout;
14. `/api/auth/me` anonymous semantics;
15. Search after logout works;
16. expired OTP via Node-side direct DB setup rejected.

No debug/test auth endpoint.

Playwright mobile/desktop projects use different deterministic test phones to avoid parallel collisions. Cleanup targets only own fixture phones.

## 29. CI

Single workflow renamed `S2 verify`.

Still uses `postgres:18` and `pnpm verify`.

CI env explicitly sets:

- `IDENTITY_OTP_TTL_SECONDS=300`;
- `IDENTITY_SESSION_TTL_SECONDS=2592000`;
- `IDENTITY_OTP_HMAC_SECRET_HEX=<64-char synthetic CI-only test hex>`;
- `IDENTITY_COOKIE_SECURE=false`.

No external SMS/network auth service.

Playwright production-build server gets explicit synthetic Identity test config. Existing viewport/browser/parallel semantics remain unless proven blocking.

## 30. Regression invariants

Не ослаблять S0/S1 tests.

Сохраняются:

- `баранина`;
- `говядина` nullable price;
- `единорог` empty;
- empty query validation;
- case-insensitive exact Search;
- trim;
- lifecycle fresh/`+1ms`/`==cutoff`/`-1ms`/inactive semantics;
- mobile/desktop Search;
- Offer Lifecycle E2E.

Anonymous Search работает без cookie/session.

## 31. Exact allowed file scope

### Existing files allowed to modify

1. `.env.example`
2. `.github/workflows/ci.yml`
3. `README.md`
4. `playwright.config.ts`
5. `src/db/schema.ts`
6. `src/app/page.tsx`
7. `tests/integration/prepare-database.ts`
8. `drizzle/migrations/meta/_journal.json`

`src/app/page.module.css` не входит в normal whitelist. Если станет блокирующим, требуется предварительное согласование.

### New Identity DB files

9. `src/modules/identity/db/users.table.ts`
10. `src/modules/identity/db/auth-otp-challenges.table.ts`
11. `src/modules/identity/db/auth-sessions.table.ts`

### New Identity logic

12. `src/modules/identity/config/identity.config.ts`
13. `src/modules/identity/time/identity-clock.ts`
14. `src/modules/identity/phone/normalize-phone.ts`
15. `src/modules/identity/crypto/otp.ts`
16. `src/modules/identity/crypto/session-token.ts`
17. `src/modules/identity/delivery/otp-delivery.ts`
18. `src/modules/identity/contracts/auth.contract.ts`
19. `src/modules/identity/infrastructure/identity.repository.ts`
20. `src/modules/identity/application/request-otp.ts`
21. `src/modules/identity/application/verify-otp.ts`
22. `src/modules/identity/application/resolve-current-user.ts`
23. `src/modules/identity/application/logout.ts`
24. `src/modules/identity/session/session-cookie.ts`

Advisory lock helper по §13 остаётся private внутри `identity.repository.ts`, поэтому дополнительный locking file не создаётся.

### New API files

25. `src/app/api/auth/otp/request/route.ts`
26. `src/app/api/auth/otp/verify/route.ts`
27. `src/app/api/auth/me/route.ts`
28. `src/app/api/auth/logout/route.ts`

### New UI files

29. `src/app/login/page.tsx`
30. `src/app/login/page.module.css`
31. `src/app/login/_components/LoginFlow.tsx`
32. `src/app/_components/AuthStatus.tsx`
33. `src/app/_components/AuthStatus.module.css`

### Migration

34. `drizzle/migrations/0002_s2_auth.sql`
35. `drizzle/migrations/meta/0002_snapshot.json`

### Unit tests

36. `tests/unit/identity-phone.test.ts`
37. `tests/unit/identity-config.test.ts`
38. `tests/unit/identity-crypto.test.ts`
39. `tests/unit/identity-cookie.test.ts`

### Integration tests

40. `tests/integration/identity-auth.test.ts`
41. `tests/integration/identity-concurrency.test.ts`
42. `tests/integration/s2-migration-upgrade.test.ts`

### E2E

43. `tests/e2e/auth.spec.ts`

### Implementation documentation

44. `docs/slices/S2-auth/IMPLEMENTATION_NOTES.md`
45. `docs/slices/S2-auth/VERIFICATION.md`

### Approved design documents

46. `docs/slices/S2-auth/FEATURE_SPEC.md`
47. `docs/slices/S2-auth/IMPLEMENTATION_CONTRACT.md`

После начала implementation design docs не меняются без нового согласования.

## 32. Explicitly forbidden changes

Без отдельного согласования запрещено менять:

- `0000_s0_first_search.sql`;
- `0001_s1_offer_lifecycle.sql`;
- `src/modules/catalog/**`;
- `src/modules/offers/**`;
- `src/modules/sellers/**`;
- `src/modules/locations/**`;
- `src/modules/search/**`;
- `src/app/api/search/route.ts`;
- existing S0/S1 E2E assertions;
- `package.json`;
- `pnpm-lock.yaml`;
- `vitest.config.ts`;
- PostgreSQL version;
- docker PostgreSQL architecture.

Не добавлять dependencies, global auth middleware, debug/test auth endpoints.

## 33. Test OTP leakage boundary

Automated verification должна доказать:

- DB schema не содержит plaintext OTP column;
- stored digest != OTP;
- request/verify/session/current-user persistence не хранит plaintext OTP;
- verify response `/me` response session response не содержат OTP;
- test code выходит наружу только delivery-specific request response/UI;
- server logs не получают plaintext OTP.

## 34. Security boundary: mandatory pre-public-launch gate

S2 предназначен только для закрытого теста и **не готов для public launch**.

До публичного запуска обязательны launch blockers:

1. убрать `TestOtpDelivery` leakage из API/UI;
2. подключить real SMS provider;
3. OTP request rate limiting;
4. OTP verify rate limiting;
5. brute-force protection;
6. anti-abuse controls;
7. resend policy;
8. delivery failure/retry policy;
9. production secret-management review;
10. `Secure=true` на public HTTPS deployment.

Основной переход предусмотрен S22.

## 35. Manual acceptance

Отдельно после фактически зелёного CI:

1. normal migration + seed;
2. anonymous `/`;
3. anonymous `баранина` Search;
4. login `8 (700) 123-45-67`;
5. canonical phone shown;
6. dynamic six-digit test OTP;
7. wrong OTP rejected;
8. correct OTP accepted;
9. authenticated phone shown;
10. Search works authenticated;
11. reload persists;
12. close/reopen browser persists within TTL;
13. logout;
14. anonymous restored;
15. Search works anonymous;
16. login same phone again;
17. DB confirms exactly one User;
18. controlled DB setup expired challenge rejected;
19. new request supersedes previous unfinished challenge;
20. old code rejected, new code accepted;
21. mobile ~390-400 px;
22. desktop ~1440 px;
23. keyboard/focus/labels/Enter;
24. no horizontal scroll.

No debug endpoint.

## 36. Implementation documentation

`IMPLEMENTATION_NOTES.md` фиксирует actual implementation choices/deviations within contract.

`VERIFICATION.md` фиксирует actual CI/run/test counts and manual status.

До manual acceptance Verification должен явно говорить:

`NOT READY: manual acceptance pending`.

## 37. Definition of Done

S2 получает `READY` только если одновременно:

### DB/Migration

- exactly three Identity tables;
- phone unique;
- generic E.164 DB constraint;
- no plaintext OTP/token persistence;
- real S1→S2 upgrade PASS;
- clean 0000→0001→0002 PASS;
- 0000/0001 unchanged;
- S0/S1 data preserved.

### OTP/Concurrency

- random 6-digit OTP;
- HMAC-SHA-256 representation;
- secret required no fallback;
- advisory key exact algorithm implemented;
- concurrent requests leave exactly one unfinished challenge;
- atomic conditional consume;
- concurrent verify exactly one success;
- concurrent User creation exactly one User.

### Session/Cookie

- 256-bit opaque token;
- SHA-256 digest only DB;
- session DB expiry source of truth;
- cookie `kaida_session`;
- HttpOnly/Lax/Path/Secure;
- both Expires + Max-Age login;
- Max-Age=0 + expired Expires logout;
- reload/browser persistence;
- expired session anonymous;
- no sliding refresh.

### API/Architecture

- four auth endpoints work;
- `/me` anonymous = HTTP 200 `{ "user": null }`;
- internal current-user contract exists;
- Search not connected to Identity;
- no global middleware;
- no JWT/Redis/framework/provider registry.

### Quality/Regression

- new unit green;
- new integration green on PostgreSQL 18;
- new auth E2E mobile/desktop green;
- all S0/S1 regression green without weakened assertions;
- lint/typecheck/build green;
- full `pnpm verify` green;
- actual GitHub Actions green;
- no skipped/failing tests masking failures.

### Manual/Git

- separate manual acceptance PASS;
- only then merge `slice/s2-auth` → `main`;
- CI on merged main green;
- only then annotated tag `v0.0.3-s2`.

## 38. Stop conditions

Implementation must stop and request approval if:

1. file outside whitelist required;
2. dependency/package change required;
3. public/API/DB contract must change;
4. Search must change or be auth-gated;
5. Offers/Seller/Location schema/module must change;
6. 0000/0001 must change;
7. global middleware appears necessary;
8. debug/test endpoint appears necessary;
9. plaintext OTP persistence appears necessary;
10. external SMS/service/account required;
11. approved concurrency guarantees cannot be met with described PostgreSQL approach.

Мелкие implementation details внутри contract не требуют отдельного согласования.

## 39. Implementation order

После утверждения design docs:

1. verify branch base = `v0.0.2-s1`;
2. write failing unit/integration/concurrency/migration/E2E tests;
3. add Identity schema + 0002 migration;
4. add config/crypto/phone/time;
5. add repository transactions and concurrency guarantees;
6. add OTP delivery/request/verify/session/current-user/logout;
7. add Route Handlers;
8. add minimal `/login` and auth status UI;
9. wire schema exports;
10. update clean DB preparation;
11. update README/.env/Playwright/CI strictly in whitelist;
12. run full `pnpm verify`;
13. push implementation;
14. wait actual GitHub Actions result;
15. if green, write Verification as `NOT READY: manual acceptance pending`;
16. no merge/tag/S3 until separate manual acceptance.

## 40. Final pre-manual state

После implementation + green CI, но до ручной приёмки, единственный допустимый итоговый статус:

`NOT READY: manual acceptance pending`.
