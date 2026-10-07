# Local bootstrap — запуск KAIDA с нуля (проверка и инструкция)

Контракт: `docs/slices/local-bootstrap-verification/SLICE_CONTRACT.md` (R1). Документ описывает **изолированную** проверку «чистого» запуска: свежий checkout, одноразовая БД и хранилище фото, секреты, миграции, Production KB, production build и smoke существующего ручного пути Seller → Buyer. Он не описывает развёртывание на хостинге (R3) и не заменяет `README.md` для ежедневной разработки.

**Главное правило:** проверка не трогает dev-стек разработчика — контейнер/БД `kaida` и `kaida_test`, том `postgres_data`, порт 5432, `.data/photos`, порты 3000/3100/3101. Никакие команды ниже не используют `docker compose` дефолтного проекта; одноразовая БД живёт в отдельном compose-файле с собственным именем проекта.

## 1. Требования

- Node.js 24.x (`.node-version` = 24.19.0, `engines` `>=24 <25`), Git, Docker с Compose v2.
- pnpm 11.19.0 (`corepack enable && corepack prepare pnpm@11.19.0 --activate`).
- Свободные порты: `55432` (одноразовая БД; другой — через `KAIDA_BOOTSTRAP_DB_PORT`) и `3200` (smoke-сервер; другой — `KAIDA_SMOKE_PORT`).
- Сеть для `git clone`, `pnpm install` и загрузки Chromium Playwright (кэш браузеров пользователя; dev-стек не затрагивается).

Команды — для Git Bash/Linux/macOS (POSIX); отличия PowerShell указаны отдельно.

## 2. Свежий checkout

```bash
WORK="$(mktemp -d)"                 # PowerShell: $WORK = Join-Path $env:TEMP ("kaida-bootstrap-" + [guid]::NewGuid())
git clone https://github.com/RashRosh/KAIDA.KZ-2.0.git "$WORK/kaida"
cd "$WORK/kaida"
git checkout <SHA>                  # проверяемый SHA; записать его в отчёт
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Ничего не копируется из рабочей копии: ни `node_modules`, ни `.env`, ни `.data`, ни `tmp/`, `scripts/`, `.vscode/`.

## 3. Изолированная БД

```bash
docker compose -f ops/local-bootstrap/docker-compose.yml up -d --wait
```

Файл задаёт проект `kaida-bootstrap-check` (свой контейнер, сеть и том), PostgreSQL 18 на `127.0.0.1:55432`. Две базы: `kaida_bootstrap` (clean, создаётся автоматически) и demo — её создаёт отдельная команда:

```bash
docker compose -f ops/local-bootstrap/docker-compose.yml exec -T postgres createdb -U kaida_bootstrap kaida_bootstrap_demo
```

## 4. Конфигурация и секреты

`.env` создаётся **с нуля**, не копированием `.env.example`: тот указывает на dev-стек. Секрет генерируется в момент проверки и нигде не сохраняется, кроме этого неотслеживаемого `.env`.

```bash
SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
cat > .env <<EOF
DATABASE_URL=postgresql://kaida_bootstrap:bootstrap_local_only@127.0.0.1:55432/kaida_bootstrap
IDENTITY_OTP_HMAC_SECRET_HEX=$SECRET
IDENTITY_COOKIE_SECURE=false
PHOTO_STORAGE_DIR=$WORK/photos
OPERATOR_PHONES=+77000090002
SEARCH_EVENTS_ORIGIN=test
NEXT_TELEMETRY_DISABLED=1
EOF
```

PowerShell: сгенерировать значение через `node -e "..."` и записать файл `.env` теми же строками (`PHOTO_STORAGE_DIR` — абсолютный путь внутри `$WORK`).

| Переменная | Статус | Заметка |
|---|---|---|
| `DATABASE_URL` | обязательна | изолированная БД; проверочные скрипты **отказываются** работать с портом 5432 и базами `kaida`/`kaida_test` |
| `IDENTITY_OTP_HMAC_SECRET_HEX` | обязательна | 64 hex-символа; без неё вход невозможен (наблюдение — раздел 9) |
| `IDENTITY_COOKIE_SECURE` | `false` только для http://localhost | для HTTPS-развёртывания `true` (R3) |
| `PHOTO_STORAGE_DIR` | обязательна для проверки | иначе фото идут в `.data/photos` относительно рабочего каталога |
| `OPERATOR_PHONES` | для шага оператора | пусто — никто не оператор; значение должно совпадать с `OPERATOR` в `ops/local-bootstrap/smoke.spec.ts` |
| `SEARCH_EVENTS_ORIGIN` | `test` для проверки | `organic` — только в реальном production после настройки и проверки ежедневного `pnpm search-events:purge` |
| `INTERNAL_JOB_SECRET`, `WEB_PUSH_*`, `SELLER_COMMENT_TRANSLATOR` | необязательны | пусто/`off` — функция выключена |

Остальные переменные `.env.example` имеют значения по умолчанию.

## 5. Режимы начальной БД

| Режим | Состав | Назначение |
|---|---|---|
| **Clean bootstrap** | миграции + `pnpm db:import:production-kb`, больше ничего | основа любого реального окружения |
| **Demo bootstrap** | Clean + `pnpm db:seed` | только локальная демонстрация/разработка; вымышленные продавец, точка, две карточки, Products «Баранина»/«Говядина» |

`pnpm db:seed` **не входит** в реальное окружение и не ставит каталог.

### 5.1 Clean bootstrap

```bash
pnpm db:migrate
pnpm db:import:production-kb
pnpm exec tsx ops/local-bootstrap/check-db-state.ts clean
```

Проверка падает, если каталог не равен 682 / 210 / 35 или хоть одна таблица бизнес-данных не пуста. Исключены: журнал миграций (`drizzle.__drizzle_migrations`), каталожные таблицы и техническая запись установки KB (`kb_package_install`, одна строка). Идемпотентность: повторить `pnpm db:migrate` и `pnpm db:import:production-kb`, затем снова `check-db-state clean` — результат тот же.

### 5.2 Demo bootstrap (отдельная база)

```bash
DATABASE_URL=postgresql://kaida_bootstrap:bootstrap_local_only@127.0.0.1:55432/kaida_bootstrap_demo sh -c \
  'pnpm db:migrate && pnpm db:import:production-kb && pnpm db:seed && pnpm exec tsx ops/local-bootstrap/check-db-state.ts demo'
```

PowerShell: задать `$env:DATABASE_URL` на время этих команд и затем вернуть значение. Отчёт `demo` перечисляет совпадения канонических названий seed и KB — это информация для PO, не автоисправление.

## 6. Production build и smoke

Выполняется на **clean** базе (`.env` из раздела 4):

```bash
pnpm build
pnpm bootstrap:smoke
```

Smoke (`ops/local-bootstrap/smoke.spec.ts`, mobile 390×844, вне `pnpm verify` и CI) поднимает `pnpm start` на порту 3200 и проходит существующий ручной путь через публичный интерфейс: первый визит → поиск известного товара без предложений → вход продавца по test OTP → точка с адресом и ссылкой на карту (manual geo fallback) → карточка из каталога с фото и карточка со свободным названием → покупатель без входа находит обе, видит фото → страница карточки и ссылка маршрута (проверяется построение `dgis://` URL без перехода к сторонним сервисам) → оператор видит обе карточки → события поиска имеют `origin=test`. Все данные smoke — синтетические и живут только в изолированной БД и `PHOTO_STORAGE_DIR`.

## 7. Очистка

```bash
docker compose -f ops/local-bootstrap/docker-compose.yml down -v   # только проект kaida-bootstrap-check
cd / && rm -rf "$WORK"
docker ps -a --filter name=kaida-bootstrap-check                  # должно быть пусто
docker volume ls --filter name=kaida-bootstrap-check              # должно быть пусто
```

Не запускать `docker compose down -v` в корне репозитория — это dev-стек.

## 8. Что фиксировать в отчёте

SHA; версии Node/pnpm/Docker; точные команды; время шагов; результаты `check-db-state` (clean до и после повторного импорта, demo); результат smoke; доказательство очистки; отчёт о неизменности dev-стека (идентификатор и время создания контейнера, том, порт 5432, количество файлов в `.data/photos` — read-only, до и после); найденные отклонения. Значения секретов в отчёт не попадают.

## 9. Наблюдения прогона

_Заполняется по результату прогона._
