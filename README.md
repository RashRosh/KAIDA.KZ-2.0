# KAIDA.KZ 2.0

Проверенная база проекта перед S2: `v0.0.2-s1`. В ветке `slice/s2-auth` реализуется S2 Auth: тестовый вход по телефону через динамический OTP, database-backed session и logout. Search S0/S1 остаётся анонимным.

До отдельной ручной приёмки S2 не считается READY, не merge в `main` и не получает tag `v0.0.3-s2`.

## Stack

- Node.js 24 LTS;
- pnpm 11.19.0;
- Next.js 16 App Router / Route Handlers;
- TypeScript strict;
- PostgreSQL 18;
- Drizzle ORM;
- Zod;
- Vitest;
- Playwright Chromium.

Docker используется только для PostgreSQL. Mock/SQLite вместо integration database не используются.

## Локальный запуск

```bash
git clone https://github.com/RashRosh/KAIDA.KZ-2.0.git
cd KAIDA.KZ-2.0
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

S2 требует локальный OTP HMAC secret. Сгенерируйте 32 random bytes / 64 hex characters стандартным `node:crypto`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Скопируйте результат в `.env`:

```text
IDENTITY_OTP_HMAC_SECRET_HEX=<64 hex characters>
```

Insecure fallback отсутствует. Настоящий secret в Git не коммитится. Для S2 не требуется внешний secret manager.

Далее:

```bash
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Откройте `http://localhost:3000`.

## Environment

Минимум:

```text
DATABASE_URL=postgresql://kaida:kaida_local@127.0.0.1:5432/kaida
TEST_DATABASE_URL=postgresql://kaida:kaida_local@127.0.0.1:5432/kaida_test
OFFER_VALIDITY_PERIOD_HOURS=168
IDENTITY_OTP_TTL_SECONDS=300
IDENTITY_SESSION_TTL_SECONDS=2592000
IDENTITY_OTP_HMAC_SECRET_HEX=<required 64 hex chars>
IDENTITY_COOKIE_SECURE=false
```

`OFFER_VALIDITY_PERIOD_HOURS=168`, OTP TTL 300 seconds и Session TTL 30 days являются technical defaults, не финальной продуктовой политикой.

`IDENTITY_COOKIE_SECURE=false` допустим для локального HTTP. Public HTTPS deployment обязан использовать Secure cookie.

## S2 Auth

Пользовательский flow:

```text
anonymous
→ phone
→ test OTP
→ verify
→ User
→ PostgreSQL session
→ authenticated
→ reload/browser reopen
→ logout
→ anonymous
```

Phone input S2 принимает KZ-oriented `+7` формы и нормализует к `+7XXXXXXXXXX`. Реального SMS в S2 нет.

Каждый OTP request создаёт новый случайный six-digit code. Test delivery показывает code в UI. Plaintext OTP в PostgreSQL не хранится: verification material = HMAC-SHA-256 с отдельным 32-byte server secret.

Session token создаётся как 32 random bytes, кодируется base64url и выдаётся только HttpOnly cookie `kaida_session`. В PostgreSQL хранится SHA-256 digest token.

Cookie successful login:

- HttpOnly;
- SameSite=Lax;
- Path=/;
- configured Secure;
- Expires = server session expires_at;
- Max-Age = configured Session TTL.

Logout удаляет DB session и ту же cookie с `Max-Age=0` и expired `Expires`.

PostgreSQL `auth_sessions.expires_at` остаётся server-side source of truth.

### Auth API

- `POST /api/auth/otp/request`;
- `POST /api/auth/otp/verify`;
- `GET /api/auth/me`;
- `POST /api/auth/logout`.

Anonymous `/api/auth/me` возвращает HTTP 200:

```json
{ "user": null }
```

`GET /api/search?q=...` остаётся полностью anonymous.

## Concurrency guarantees

OTP replacement сериализуется per canonical phone через PostgreSQL transaction advisory lock. Lock key детерминированно вычисляется как SHA-256 от domain-separated phone, первые 8 bytes читаются как signed int64. Key не хранится в business data.

Дополнительно PostgreSQL partial unique index запрещает два unfinished challenges одного phone.

OTP consume выполняется conditional `UPDATE ... RETURNING` внутри той же transaction, где выполняются User get-or-create и session insert. Поэтому два concurrent verify одного challenge не могут дать два successful login.

`users.phone_e164` имеет PostgreSQL UNIQUE. User creation использует `INSERT ... ON CONFLICT DO NOTHING`, затем lookup existing User.

## Database / migrations

Migration chain:

- `0000_s0_first_search.sql`;
- `0001_s1_offer_lifecycle.sql`;
- `0002_s2_auth.sql`.

S2 добавляет ровно три Identity tables:

- `users`;
- `auth_otp_challenges`;
- `auth_sessions`.

`0000` и `0001` не изменяются. Products/Sellers/Locations/Offers schema не меняется.

S2 verification проверяет и clean chain, и real S1 → S2 upgrade на отдельной temporary PostgreSQL 18 database `kaida_s2_upgrade_test`.

## Search / Offer lifecycle regression

S0/S1 contracts сохраняются:

- `баранина` → актуальный Offer;
- `говядина` → nullable price;
- `единорог` → empty;
- exact case-insensitive Product search + trim;
- Offer visible только если `status = active AND last_confirmed_at > cutoff`;
- boundary `+1 ms / == cutoff / -1 ms` остаётся прежним.

Identity не подключается к Search в S2. Global auth middleware отсутствует.

## Verification

Установить Chromium один раз:

```bash
pnpm exec playwright install --with-deps chromium
```

Полный regression:

```bash
pnpm verify
```

Он включает lint, typecheck, migrations, seed, clean test DB, unit, integration, production build и mobile+desktop E2E.

GitHub Actions поднимает реальный `postgres:18` и выполняет тот же `pnpm verify` с explicit synthetic Identity test secret.

S2 дополнительно проверяет:

- phone/config/crypto/cookie unit tests;
- OTP request/verify/session integration;
- concurrent OTP requests;
- exactly-one-success concurrent OTP consume;
- concurrent User uniqueness;
- S1 → S2 migration upgrade;
- anonymous Search до/после login/logout;
- persistent cookie/auth state;
- expired OTP через direct DB test setup без debug API.

## Public-launch security gate

S2 предназначен только для закрытого теста и **не готов для публичного запуска**.

До public launch обязательны:

- убрать test OTP из API/UI;
- подключить real SMS provider;
- rate limiting request/verify;
- brute-force protection;
- anti-abuse controls;
- resend policy;
- delivery failure/retry policy;
- production secret-management review;
- Secure=true на публичном HTTPS deployment.

Это launch blockers, а не необязательные улучшения. Основной переход предусмотрен S22.

## Документы

- `docs/PROJECT_RULES.md`;
- `docs/architecture/TECHNICAL_FOUNDATION_V0.md`;
- `docs/product/FEATURE_MAP.md`;
- `docs/slices/S2-auth/FEATURE_SPEC.md`;
- `docs/slices/S2-auth/IMPLEMENTATION_CONTRACT.md`;
- `docs/slices/S2-auth/IMPLEMENTATION_NOTES.md`;
- `docs/slices/S2-auth/VERIFICATION.md`.
