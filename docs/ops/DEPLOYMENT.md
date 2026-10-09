# R3 deployment reference (private local testing)

This is a single-process Docker example, not a hosting configuration or permission for public launch. The approved boundary is [R3](../slices/r3-deployment-preparation/SLICE_CONTRACT.md). Test OTP returns the login code to the client: anyone who reaches the application can log in as any phone. Keep this stack private.

## Platform and configuration

The verification platform is Windows 11, Git Bash, Docker Desktop with a Linux amd64 VM. Use Node 24 and the package manager in `package.json` for the host commands. The image uses Node 24.19.0; the base and acceptance Caddy images are pinned by digest. No CA is installed in the host trust store.

Copy `ops/deployment/env.template` to an absolute path **outside the checkout**, fill the blank secrets, and keep that file confidential. Generate each secret with `node:crypto`, without putting values in command history. Do not pass secrets as build arguments. No environment file enters either image.

| Variable | Rule | Source |
|---|---|---|
| `KAIDA_DB_USER`, `KAIDA_DB_NAME` | Required; lowercase letters/digits/underscores. Never `kaida` or `kaida_test`. | R3 isolation; preflight rules |
| `KAIDA_DB_PASSWORD` | Required; at least 16 random letters/digits (URL-safe). No default password. | Compose database URL |
| `IDENTITY_OTP_HMAC_SECRET_HEX` | Required; 64 hexadecimal characters. | Identity configuration |
| `IDENTITY_COOKIE_SECURE` | Required: `true`. | Identity cookie; R3 TLS check |
| `KAIDA_BIND_ADDRESS` | Defaults to `127.0.0.1`. Private IPv4 only with `KAIDA_PRIVATE_TEST_ACK=yes`. Wildcards, public addresses, hostnames and IPv6 are refused. | R3 §3.2 |
| `KAIDA_APP_PORT`, `KAIDA_TLS_PORT` | Defaults 3400/8443. Unprivileged ports; never 3000/3100/3101/5432. | R3 isolation |
| `SEARCH_EVENTS_ORIGIN` | Optional, default `dev`; use `test` for verification. `organic` is forbidden until O-D0-ORG. | D0; R3 |
| `OPERATOR_PHONES` | Optional; empty means no operator. For smoke only: `+77000090002`. | Operator configuration; R1 smoke |
| `SELLER_COMMENT_TRANSLATOR` | Keep `off` for this reference. | Existing translation runtime |
| `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | Optional, all three or none. Not configured in the local proof; external delivery unverified. | Reminder configuration |
| `INTERNAL_JOB_SECRET` | Optional; protects manual internal reminder trigger. | Reminder configuration |
| `KAIDA_IMAGE_TAG` | Optional; use a tested SHA tag for updates/rollback. | Compose image references |

The containers receive `DATABASE_URL` assembled from the DB variables and `PHOTO_STORAGE_DIR=/data/photos`. PostgreSQL has no host-published port. DB and photos persist in `kaida-deploy-check_pg_data` and `kaida-deploy-check_photos`; non-root UID/GID 1000 owns the photo directory. Do not scale the application: one application process owns its in-process jobs.

LAN mode is only for deliberate **private testing with Test OTP**. Never forward ports or use it on a public network. Removing these restrictions requires O-AUTH and a separate PO decision. Direct Compose defaults to loopback but bypasses preflight; `deploy:up` is the supported start command.

## First start and repeat

Run from a clean checkout of the intended SHA in Git Bash:

```bash
pnpm install --frozen-lockfile
export R3_ENV='/c/path/outside-checkout/r3.env'
pnpm deploy:up --env-file "$R3_ENV" --tls-check
```

The command validates access/configuration before mutation, builds tools and runtime **sequentially**, starts the isolated database, applies migrations, imports Production KB, runs online preflight, then starts app and Caddy. No demo seed. Repeat is safe: migrations and import are idempotent. Online preflight checks write access, DB connectivity, every migration hash and Production KB identity/counts (682 products, 210 aliases, 35 categories). Extra seller-created products are allowed.

Open `https://localhost:8443`. Accept the expected self-signed certificate warning for this local test. Caddy uses `tls internal`, proxies to app:3000 and publishes only loopback. `http://localhost:3400/api/health` reports 200 when DB is reachable, otherwise 503, with `Cache-Control: no-store` and no internal details. Use HTTPS for login. Secure-cookie behavior on ordinary HTTP is tested using a test hostname resolved to loopback; browsers can treat localhost specially.

Convenient explicit Compose wrapper (always includes the env file):

```bash
dc() { docker compose -f ops/deployment/docker-compose.yml -f ops/deployment/docker-compose.tls-check.yml --env-file "$R3_ENV" "$@"; }
dc --profile tools run --rm tools pnpm deploy:preflight
KAIDA_SMOKE_BASE_URL=https://localhost:8443 pnpm deploy:smoke
```

Smoke creates test data and expects an initially empty offer catalog. It checks mobile RU seller → buyer → operator, stored photos, `origin=test`, Secure/HttpOnly cookies, a real approximately 14 MiB PNG and refusal above 15 MiB. Run it only on the disposable R3 stack, never a real data installation.

## Build, updates, rollback and restart

Both targets use the frozen lockfile; runtime has production dependencies and `next start`, tools has full dependencies and sources. Operational DB/import/preflight commands run in tools. Existing R2 commands run on the Docker host because they inspect containers and use `docker exec`; do not mount the Docker socket into tools. Sources for those commands are included, but tools intentionally has no host Docker access.

```bash
docker build --platform linux/amd64 --target tools --build-arg GIT_SHA="$(git rev-parse HEAD)" -t "kaida-tools:$(git rev-parse HEAD)" .
docker build --platform linux/amd64 --target runtime --build-arg GIT_SHA="$(git rev-parse HEAD)" -t "kaida-app:$(git rev-parse HEAD)" .
```

Routine build defaults: `BUILD_NODE_OPTIONS=--max-old-space-size=1536`, `BUILD_CPUS=2` (Next's `CIRCLE_NODE_TOTAL` worker setting). This reduces concurrency in the approximately 3.7 GiB VM, without changing Docker Desktop resources. If memory fails, retain the log, report the failing step/exit/OOM evidence and propose the smallest remedy; stop if unavailable memory makes the build impossible. No resource changes without PO approval.

Before updating, create an R2 backup. Checkout the approved new SHA, set `KAIDA_IMAGE_TAG` to that SHA in the external env file and run `deploy:up`. Keep the old images and backup. Roll back only to a compatible migration state; R3 does not establish forward/backward schema compatibility. For the unchanged R3 schema, restore the old tag and run `dc up -d --no-build --wait app tls-proxy` after preflight. A future schema rollback needs that slice's migration procedure.

Persistence check:

```bash
dc down              # NEVER add -v: that destroys the isolated persistent data
dc up -d --no-build --wait postgres app tls-proxy
```

Verify the same seller cards and photo bytes after restart. No root-repository Compose commands are part of this procedure.

## Backup and clean restore using unchanged R2

R2 expects host directories. Stop this isolated app, copy its immutable photo volume to a **new** external staging directory, then call the existing R2 CLI. With the app stopped, DB and photo staging describe the same installation. Never use `.data/photos` or the dev container. The staging/bundle contains personal data and live sessions; protect it. Host configuration secrets are not included.

```bash
dc stop app
mkdir -p "$R3_WORK/source-photos"     # new directory outside every checkout
docker cp kaida-deploy-check-app-1:/data/photos/. "$R3_WORK/source-photos"
pnpm backup:create --db-container kaida-deploy-check-postgres-1 --photos "$R3_WORK/source-photos" --out "$R3_WORK/new-backup"
dc up -d --no-build --wait app
```

Create a **separate empty** restore database/container and photo volume using `ops/deployment/docker-compose.restore-check.yml` and a separate env file (new secret/password/name). It publishes neither DB nor app. The R2 source and bundle stay read-only:

```bash
rc() { docker compose -f ops/deployment/docker-compose.restore-check.yml --env-file "$R3_RESTORE_ENV" "$@"; }
rc up -d --wait postgres
pnpm backup:restore --bundle "$R3_WORK/new-backup" --db-container kaida-deploy-restore-check-postgres-1 --photos "$R3_WORK/restored-photos"
pnpm backup:verify --bundle "$R3_WORK/new-backup" --db-container kaida-deploy-restore-check-postgres-1 --photos "$R3_WORK/restored-photos"
rc create app
docker cp "$R3_WORK/restored-photos/." kaida-deploy-restore-check-app-1:/data/photos
rc run --rm --user 0 app chown -R 1000:1000 /data/photos
rc up -d --wait app
```

Verify the app internally with `docker exec` and compare public search/photo bytes against the source. R2 checks every table count and referenced photo checksum. A failed restore remains NOT READY; do not start it or overwrite it. Follow [R2 recovery](BACKUP_RESTORE.md) with a newly created empty target. Delete only the named restore project after proof: `rc down -v`. The source reference stack stays available for PO acceptance. Never use a global prune.

## Security verification and limits

Local scanners are containers, pinned by digest in the verification report. Hadolint checks the Dockerfile; Trivy checks both final targets (vulnerabilities/secrets/misconfigurations) and the Dockerfile. DB freshness must be within 24 hours. Full reports belong in PR evidence; summaries and [exceptions](../../ops/deployment/security-exceptions.md) live in Git. No security exception is effective without PO approval; secrets always block. No scanners added to CI, no image published to a registry.

**Verified:** recorded in the R3 PR and `ops/deployment/verification.md`, with exact executable SHA, image IDs/base digest, versions, scan timestamps and exit codes. Pending checks must remain labelled pending.

**Expected, unverified:** another Linux amd64 Docker Engine should run the same image/Compose.

**Not supported/tested:** arm64, macOS, Podman, PowerShell reproduction, non-Docker execution. Also unverified: any provider proxy, public DNS/certificate renewal/HSTS/HTTP2/3, network perimeter, managed DB, traffic/load/memory guarantees, intensive concurrent backup, cross-version restore, external push delivery, multiple app instances, off-host/encrypted/scheduled backups, monitoring, genuine authentication, daily D0 purge and `organic`. Caddy proof does not establish provider body limits/timeouts or forwarded-header behavior. No public launch is authorized.
