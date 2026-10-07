# Backup и restore — резервная копия базы и фото KAIDA и восстановление в чистое окружение

Контракт: `docs/slices/backup-restore/SLICE_CONTRACT.md` (R2). Документ описывает, как сделать **один согласованный набор** (PostgreSQL + файлы фото Offer) и восстановить его в **пустое** окружение с проверкой. Всё локально; хостинг, облако, расписание и шифрование вне scope.

**Главное правило:** инструменты и проверка не трогают dev-стек разработчика — контейнер `kaidakz-20-postgres-1`, базы `kaida` / `kaida_test`, том `postgres_data`, порт 5432, `.data/photos`. Guards отказывают до любых действий (§9). Приёмочное окружение — отдельный compose-проект `kaida-r2-check`.

## 1. Что такое набор (bundle)

Один каталог (создаётся новым, **вне** рабочей копии репозитория):

| Файл | Содержимое |
|---|---|
| `db.dump` | `pg_dump -Fc` одного снимка БД (`--no-owner --no-privileges`) |
| `photos/` | копия каталога фото той же раскладки: `<id[0:2]>/<id>.{display,thumb}.webp` |
| `SHA256SUMS` | sha256 `db.dump` и каждого файла фото |
| `manifest.json` | версия формата, время, git SHA, версия PostgreSQL, число и хеш миграций, число строк по таблицам, число/размер фото. **Пишется последним** — его наличие = backup завершён. Секретов нет. |

Bundle содержит **персональные данные (телефоны) и действующие сессии**: хранить как конфиденциальный, не класть в Git, не прикладывать к отчётам.

## 2. Как достигается согласованность (механизм)

Запись приложения **не останавливается**. Порядок:

1. Одна транзакция `REPEATABLE READ` экспортирует снимок; из него берутся и dump, и счётчики строк, и список строк `photos` (всё — один момент T).
2. **После** dump копируются файлы фото. Каждое фото из снимка было записано на диск раньше своей строки в БД и **никогда не изменяется и не удаляется** (`offer-photos`), поэтому копия его содержит.
3. Проверка: для каждой строки `photos` из снимка в копии есть оба файла. Иначе backup **падает**, каталог не остаётся, manifest не пишется.

Фото, загруженные после T, могут оказаться в копии как «сироты» — это безвредно (сироты существуют и сейчас) и учитывается в отчёте. **Ограничение:** механизм верен, пока фото неизменяемы и не удаляются; любой будущий slice «удаление/замена/очистка фото» обязан сначала пересмотреть R2. Временные файлы загрузки (`*.tmp`) и всё, что приложение не пишет, в набор не входят.

## 3. Требования

Node.js 24, pnpm 11.19.0, Docker с Compose v2, зависимости репозитория (`pnpm install --frozen-lockfile`), собранное приложение (`pnpm build`) для запуска серверов. Свободные порты: `55433` (источник), `55434` (цель), `3201` и `3202` (приложения); другие — `KAIDA_R2_SOURCE_PORT`, `KAIDA_R2_TARGET_PORT`, `KAIDA_R2_APP_PORT`. PostgreSQL на хосте не нужен: `pg_dump`/`pg_restore` работают внутри контейнера БД. Команды — Git Bash/POSIX; **PowerShell и Linux не проверялись**.

## 4. Конфигурация и секреты — отдельно от bundle

В bundle **нет** `.env` и секретов; восстановленному окружению их задаёт оператор. Статус каждой зависимости:

| Что | В bundle? | Нужно в restored | Последствие при другом значении | Статус |
|---|---|---|---|---|
| `DATABASE_URL`, `PHOTO_STORAGE_DIR` | нет | да (свои) | — | проверено |
| `IDENTITY_OTP_HMAC_SECRET_HEX` | нет | да, 64 hex | **Сессии не затрагиваются:** в БД хранится `sha256(токен)` без секрета, старые cookie принимаются до `expires_at`. **Незавершённые OTP-challenges (TTL 300 с) и contact-verification перестают проверяться** — код запрашивается заново. Без секрета вход недоступен (`503 AUTH_UNAVAILABLE`). | по коду + проверено прогоном (старая сессия принята restored-приложением с другим секретом) |
| Сессии в БД | да | — | **Владелец старого cookie остаётся авторизованным в копии.** Отзыва сессий в R2 нет. | проверено |
| `WEB_PUSH_VAPID_*` | нет | для push | Push включён только при трёх переменных. Подписки (`endpoint/p256dh/auth`) в БД; браузерная подписка привязана к публичному ключу, с которым создана. Код удаляет подписку только при ответе 404/410, иная ошибка — `failed`. | по коду. **Не проверено:** что при другом ключе push-сервисы отклоняют доставку — ожидание по спецификации Web Push |
| `INTERNAL_JOB_SECRET` | нет | для ручного запуска reminder-job | данных не касается | по коду |
| `OPERATOR_PHONES`, `SEARCH_EVENTS_ORIGIN`, `IDENTITY_COOKIE_SECURE` и прочие | нет | по `.env.example` / `LOCAL_BOOTSTRAP.md` §4 | — | по документации |

Хранение секретов и шифрование bundle — вне R2.

## 5. Одноразовое окружение

```bash
WORK="$(mktemp -d)"; WORKW="$(cygpath -m "$WORK" 2>/dev/null || echo "$WORK")"   # Node понимает путь только в виде C:/...
docker compose -f ops/backup-restore/docker-compose.yml up -d --wait             # контейнеры kaida-r2-source (55433) и kaida-r2-target (55434)
export SRC_DB='postgresql://kaida_r2:r2_local_only@127.0.0.1:55433/kaida_r2_source'
export TGT_DB='postgresql://kaida_r2:r2_local_only@127.0.0.1:55434/kaida_r2_target'
```

Источник — чистая база с каталогом (как в R1):

```bash
DATABASE_URL="$SRC_DB" pnpm db:migrate
DATABASE_URL="$SRC_DB" pnpm db:import:production-kb
```

Приложение-источник (пример; `.env` рабочей копии указывает на dev-стек, поэтому **всё задаётся в окружении процесса**, у которого приоритет над `.env`):

```bash
SECRET_SRC="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
mkdir -p "$WORKW/src-photos"
DATABASE_URL="$SRC_DB" PHOTO_STORAGE_DIR="$WORKW/src-photos" IDENTITY_OTP_HMAC_SECRET_HEX="$SECRET_SRC" \
IDENTITY_COOKIE_SECURE=false SEARCH_EVENTS_ORIGIN=test NEXT_TELEMETRY_DISABLED=1 \
  pnpm start --hostname 127.0.0.1 --port 3201
```

Данные источника создаёт человек через интерфейс (вход тестовым кодом, торговая точка, карточка с фото) либо R1 smoke как генератор данных: `KAIDA_SMOKE_PORT=3201 DATABASE_URL=… PHOTO_STORAGE_DIR=… IDENTITY_OTP_HMAC_SECRET_HEX=… OPERATOR_PHONES=+77000090002 pnpm bootstrap:smoke` (smoke сам поднимает сервер на этом порту — остановите свой).

## 6. Backup

```bash
pnpm backup:create --db-container kaida-r2-source --photos "$WORKW/src-photos" --out "$WORKW/bundle"
```

Приложение-источник можно не останавливать (§2). Отказ (код 2, ничего не изменено): каталог `--out` уже существует или внутри репозитория; каталог фото отсутствует или внутри репозитория (в том числе `.data/photos`); контейнер — dev-стек или не найден; в каталоге фото лежит `.restore-incomplete` (это недовосстановленная цель, не источник). Сбой после начала (код 3, например нет файла фото из снимка): созданный этим запуском каталог удаляется, manifest не пишется.

## 7. Restore в чистую цель

Цель — пустая БД и несуществующий или пустой каталог фото. Новая БД цели уже создана контейнером `kaida-r2-target` (`kaida_r2_target`).

```bash
pnpm backup:restore --bundle "$WORKW/bundle" --db-container kaida-r2-target --photos "$WORKW/tgt-photos"
```

Порядок: **preflight** (bundle: manifest, формат, состав и checksum; совпадение миграций bundle и приложения; guards; цель пуста) → `pg_restore` → копия фото → verify (число строк по таблицам и миграции = manifest; у каждой строки `photos` оба файла с совпавшим sha256; сироты — INFO). Только после успешного verify маркер `.restore-incomplete` удаляется и печатается «Restore OK».

| Код | Значение |
|---|---|
| 0 | сделано (restore — и проверено) |
| 1 | неверные аргументы |
| 2 | **отказ до изменений:** невалидный/неполный bundle (нет manifest, `db.dump` или `photos/`; нет или лишний файл фото; checksum; формат новее поддерживаемого), другие миграции, непустая БД или каталог фото цели, dev-стек, пути внутри репозитория |
| 3 | **сбой во время выполнения** (после первого изменения цели): цель может быть восстановлена частично; печатается `NOT READY`, цель остаётся с `.restore-incomplete`, повторный restore в неё отклоняется |

Флага перезаписи нет. Источник и bundle при restore только читаются.

Проверка уже восстановленной цели (только чтение): `pnpm backup:verify --bundle … --db-container kaida-r2-target --photos "$WORKW/tgt-photos"` (отказывает, если там маркер).

## 8. Проверка восстановленного приложения

```bash
SECRET_TGT="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"   # другой секрет, чем у источника
DATABASE_URL="$TGT_DB" PHOTO_STORAGE_DIR="$WORKW/tgt-photos" IDENTITY_OTP_HMAC_SECRET_HEX="$SECRET_TGT" \
IDENTITY_COOKIE_SECURE=false SEARCH_EVENTS_ORIGIN=test NEXT_TELEMETRY_DISABLED=1 \
  pnpm start --hostname 127.0.0.1 --port 3202
```

Автоматическая проверка (только чтение, вне `pnpm verify` и CI; охраняется теми же guards, что R1 smoke):

```bash
DATABASE_URL="$TGT_DB" PHOTO_STORAGE_DIR="$WORKW/tgt-photos" R2_SELLER_PHONE=+7XXXXXXXXXX R2_EXPECT_OFFERS=<число карточек продавца> \
R2_SOURCE_PHOTOS="$WORKW/src-photos" [R2_SOURCE_SESSION_COOKIE=<cookie сессии источника>] \
  pnpm exec playwright test -c ops/backup-restore/playwright.config.ts
```

Она входит продавцом **новым** тестовым кодом, видит все его карточки, проверяет, что (при заданном cookie) сессия источника принимается, что каждое фото отдаётся `200 image/webp` **побайтно как в источнике**, что покупатель без входа находит каждую видимую карточку и видит картинку.

## 9. Guards (общие для backup, restore, verify)

Отказ с кодом 2 до любых действий: контейнер публикует хост-порт 5432 или принадлежит compose-проекту корня репозитория (dev-стек); база `kaida` / `kaida_test`; каталоги фото и bundle внутри рабочей копии репозитория; контейнер не запущен или не найден. Backup самого dev-стека не поддерживается. Проверки guards выполняются без обращения к базе.

## 10. Сбой restore: безопасная очистка и повтор

Только цель (по точным именам), ничего другого:

```bash
docker exec kaida-r2-target dropdb -U kaida_r2 --force kaida_r2_target
docker exec kaida-r2-target createdb -U kaida_r2 kaida_r2_target
rm -rf "$WORKW/tgt-photos"          # только каталог фото этой цели
pnpm backup:restore --bundle "$WORKW/bundle" --db-container kaida-r2-target --photos "$WORKW/tgt-photos"
```

Источник и bundle не затрагиваются. Если приложение-цель уже запускалось — остановите его до очистки.

## 11. Очистка одноразовых ресурсов

```bash
# остановить приложения на 3201/3202
docker compose -f ops/backup-restore/docker-compose.yml down -v     # только проект kaida-r2-check
rm -rf "$WORK"                                                       # bundle, фото и логи прогона
docker ps -a --filter name=kaida-r2                                  # должно быть пусто
docker volume ls --filter name=kaida-r2-check                        # должно быть пусто
```

Не запускать `docker compose down -v` в корне репозитория — это dev-стек.

## 12. Что фиксировать в отчёте и пределы доказательств

SHA; версии Node/pnpm/Docker/PostgreSQL; точные команды; размеры и счётчики bundle; результаты preflight-отказов и сбоя во время выполнения; результат `backup:verify` и `restored.spec.ts`; доказательство очистки и неизменности dev-стека (id и время создания контейнера, том, порт 5432, число файлов `.data/photos` до/после, только чтение). Значения секретов и содержимое bundle в отчёт не попадают.

**Не доказано:** PowerShell и Linux; backup при постоянной очень высокой нагрузке записи (проверено нагрузкой в сотни загрузок, не бесконечной); совместимость между версиями PostgreSQL и приложения (restore требует тех же миграций и PostgreSQL одной мажорной версии с dump); большие объёмы данных; поведение внешних push-сервисов при смене VAPID-ключа; шифрование и хранение bundle; отзыв сессий в копии.
