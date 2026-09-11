# KAIDA.KZ 2.0 — S0 Implementation Contract v1.0

**Slice:** S0 First Search  
**Статус:** готов к реализации  
**Тип:** Foundation vertical slice  
**Главный принцип:** реализуется только описанное ниже поведение. Всё остальное считается out of scope.

## 1. Цель slice

Доказать минимальный сквозной контур KAIDA.KZ:

**П1 вводит название товара → система обращается к реальной БД → находит Offer → показывает, где товар продаётся.**

Пользовательский сценарий:

1. Анонимный пользователь открывает KAIDA.KZ.
2. Вводит `баранина`.
3. Запускает поиск.
4. Получает тестовое актуальное предложение.
5. Видит товар, цену, продавца, место продажи и комментарий продавца.

Второй обязательный сценарий:

1. Пользователь вводит `единорог`.
2. Система ничего не находит.
3. Пользователь видит понятное состояние пустой выдачи.

S0 доказывает цепочку:

`Browser → UI → API → application logic → PostgreSQL → Offer → UI`

## 2. Definition of User Value

После завершения S0 пользователь уже может получить ответ на минимальный вопрос: «Где продаётся баранина?»

Ответ основан на тестовых данных, но проходит через ту же техническую цепочку, которую позднее будут использовать реальные Offers.

## 3. Техническая основа

| Область | Решение |
|---|---|
| Runtime | Node.js 24 LTS |
| Язык | TypeScript strict |
| Web | Next.js 16, App Router |
| API | Next.js Route Handlers |
| БД | PostgreSQL 18 |
| ORM / migrations | Drizzle ORM |
| Runtime validation | Zod |
| Unit / integration tests | Vitest |
| E2E | Playwright |
| Package manager | pnpm |
| Стили | CSS Modules + CSS variables |
| Git | GitHub |
| Архитектура | modular monolith |

Приложение и PostgreSQL должны полностью работать локально.

В S0 приложение не деплоится во внешнюю инфраструктуру.

## 4. Архитектурная граница

S0 содержит пять функциональных областей:

- Catalog владеет Product;
- Sellers владеет Seller;
- Locations владеет Location;
- Offers владеет Offer;
- Search выполняет read-сценарий `query → Product → Offers → result`.

HTTP route не содержит бизнес-логики поиска.

React UI не обращается к PostgreSQL напрямую.

## 5. Модель данных S0

Создаются ровно четыре продуктовые таблицы:

- `products`;
- `sellers`;
- `locations`;
- `offers`.

Других продуктовых таблиц в S0 быть не должно.

### 5.1 products

| Поле | Тип | Обязательное | Назначение |
|---|---|---:|---|
| id | UUID | да | внутренний идентификатор |
| name | text | да | каноническое название товара |

Ограничения:

- `name` не пустой;
- `name` уникален в рамках S0.

В S0 нет category, aliases, synonyms, slug, embeddings, search keywords и AI attributes.

### 5.2 sellers

| Поле | Тип | Обязательное | Назначение |
|---|---|---:|---|
| id | UUID | да | внутренний идентификатор |
| display_name | text | да | отображаемое имя продавца |

Seller нельзя создавать или редактировать через UI/API в S0.

### 5.3 locations

| Поле | Тип | Обязательное | Назначение |
|---|---|---:|---|
| id | UUID | да | внутренний идентификатор |
| name | text | да | название точки |
| address_text | text | да | текстовое описание местоположения |

В S0 нет latitude, longitude, location type, market hierarchy, pavilion hierarchy, map provider IDs и геокодирования.

### 5.4 offers

| Поле | Тип | Обязательное | Назначение |
|---|---|---:|---|
| id | UUID | да | идентификатор Offer |
| product_id | UUID FK | да | Product |
| seller_id | UUID FK | да | Seller |
| location_id | UUID FK | да | Location |
| price_amount | numeric | нет | цена |
| price_currency | char(3) | нет | ISO-код валюты |
| price_unit | text | нет | единица цены |
| seller_comment | text | нет | комментарий продавца |
| created_at | timestamptz | да | дата создания |
| updated_at | timestamptz | да | дата изменения |

Правила:

- отрицательная цена запрещена;
- если `price_amount` указан, `price_currency` обязателен;
- цена необязательна;
- комментарий необязателен.

В S0 нет `status`, `last_confirmed_at`, `expires_at`, freshness score, promotion, moderation state, media и Seller Change Set.

Все seed Offers считаются актуальными по определению. Механизм актуальности появляется отдельной миграцией в S1.

## 6. Seed data

Seed детерминированный и воспроизводимый. Данные являются тестовыми.

### Products

- `Баранина`
- `Говядина`

### Seller

`Асыл Ет, тестовый продавец`

### Location

- name: `Тестовая мясная точка`
- address_text: `Алматы, Зелёный базар, тестовый павильон 12`

### Offer 1

- Product: Баранина
- Seller: Асыл Ет, тестовый продавец
- Location: Тестовая мясная точка
- price_amount: `4200.00`
- price_currency: `KZT`
- price_unit: `кг`
- seller_comment: `Свежий привоз.`

### Offer 2

- Product: Говядина
- Seller: Асыл Ет, тестовый продавец
- Location: Тестовая мясная точка
- price_amount: NULL
- price_currency: NULL
- price_unit: NULL
- seller_comment: `Есть мякоть и мясо на кости.`

Второй Offer специально проверяет нормальное состояние без цены.

В UI отображается `Цена не указана`.

Seed не запускается автоматически при production startup.

## 7. Search semantics S0

Перед поиском запрос:

1. trim;
2. проверка на пустое значение;
3. сравнение с `Product.name` без учёта регистра.

Работают:

- `баранина`;
- `Баранина`;
- `БАРАНИНА`;
- `  баранина  `.

Не поддерживаются:

- `баран`;
- `баранина свежая`;
- опечатки;
- синонимы;
- транслитерация;
- категории;
- semantic search;
- contains search;
- fuzzy search.

## 8. API contract

Продуктовая endpoint:

`GET /api/search?q=<query>`

Допускается техническая endpoint:

`GET /api/health`

Другие продуктовые API в S0 запрещены.

### 8.1 Успешный поиск

`GET /api/search?q=баранина` → HTTP 200.

Ответ содержит:

- нормализованный query;
- массив `offers`.

Каждый результат содержит:

- Offer id;
- Product: id, name;
- Seller: id, displayName;
- Location: id, name, addressText;
- Price: amount, currency, unit либо `null`;
- sellerComment: string либо null.

Числовая цена передаётся через API как decimal string, а не JavaScript floating point.

### 8.2 Ничего не найдено

`GET /api/search?q=единорог` → HTTP 200, `offers: []`.

Отсутствие результатов не является API error.

### 8.3 Пустой запрос

Отсутствующий `q`, пустой `q` или строка из пробелов → HTTP 400.

Стабильный machine code:

`INVALID_QUERY`

UI не показывает технический JSON.

### 8.4 Unexpected error

Backend/DB ошибка → корректный HTTP 5xx.

UI показывает:

`Не удалось выполнить поиск. Попробуйте ещё раз.`

Stack trace, SQL и внутренние детали пользователю не показываются.

## 9. UI contract

Одна пользовательская страница.

Обязательны:

- `KAIDA.KZ`;
- search input;
- search button;
- result;
- loading state;
- empty state;
- validation state;
- error state.

Placeholder:

`Например, баранина`

Поиск запускается кнопкой и Enter.

## 10. Состояния интерфейса

### Initial

До первого поиска не показывать empty state.

### Loading

Показать, что запрос выполняется. Повторную отправку во время текущего запроса блокировать.

### Result

Карточка показывает Product, цену или `Цена не указана`, Seller, Location, address и seller comment при наличии.

### Empty

`По вашему запросу ничего не найдено.`

Без рекомендаций и дополнительных товаров.

### Validation error

Пустую строку не отправлять как обычный поиск.

### System error

Показывать понятное сообщение без технических деталей.

## 11. Responsive contract

Проверить минимум:

- mobile около 390 px;
- desktop около 1440 px.

Требования:

- нет горизонтального scroll;
- search input не выходит за экран;
- button доступен;
- карточка читаема;
- текст не ломается неконтролируемо;
- интерфейс пригоден для touch;
- desktop не является просто растянутым mobile.

Tablet отдельным дизайном не проектируется.

## 12. Минимальная визуальная основа

Разрешено определить только:

- базовую типографику;
- Plus Jakarta Sans;
- background;
- основной текст;
- muted text;
- border;
- primary purple;
- radius;
- spacing;
- focus state.

Не создавать полноценную design system и не подключать UI-kit ради S0.

## 13. Accessibility baseline

Обязательно:

- настоящий HTML form;
- label для search input;
- keyboard navigation;
- visible focus;
- Enter submit;
- понятный button text;
- feedback, доступный assistive technology;
- нормальная контрастность.

## 14. Разрешённая структура файлов

### Project foundation

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `next.config.ts`
- `eslint.config.mjs`
- `.gitignore`
- `.env.example`
- `README.md`

### Database

- `docker-compose.yml`
- `docker/init/01-create-test-db.sql`
- `drizzle.config.ts`
- `src/db/client.ts`
- `src/db/schema.ts`
- `src/db/seed.ts`
- `drizzle/migrations/*`

### Catalog

- `src/modules/catalog/db/products.table.ts`

### Sellers

- `src/modules/sellers/db/sellers.table.ts`

### Locations

- `src/modules/locations/db/locations.table.ts`

### Offers

- `src/modules/offers/db/offers.table.ts`

### Search

- `src/modules/search/contracts/search.contract.ts`
- `src/modules/search/application/search-offers.ts`
- `src/modules/search/infrastructure/search.repository.ts`

### HTTP

- `src/app/api/search/route.ts`
- при необходимости `src/app/api/health/route.ts`

### UI

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/page.module.css`
- `src/app/_components/SearchForm.tsx`
- `src/app/_components/OfferCard.tsx`

### Tests

- `vitest.config.ts`
- `playwright.config.ts`
- `tests/unit/*`
- `tests/integration/*`
- `tests/e2e/search.spec.ts`

### CI

- `.github/workflows/ci.yml`

### Documentation

- `docs/slices/S0-search/*`

Если действительно требуется файл вне scope, исполнитель сначала объясняет зачем он нужен, почему текущего scope недостаточно и затрагивает ли изменение следующий slice или публичный контракт.

## 15. Database workflow

Изменения БД только через migrations:

`schema change → generate migration → inspect migration → migrate → test`

Schema push не является штатным способом изменения общей/production базы.

Все migrations коммитятся в Git и должны применяться на чистой базе.

## 16. Development DB и test DB

Один локальный PostgreSQL instance содержит две отдельные базы:

- `kaida`;
- `kaida_test`.

Integration tests не очищают и не изменяют development database.

`.env.example` содержит примеры `DATABASE_URL` и `TEST_DATABASE_URL`.

Реальные секреты в Git не коммитятся.

## 17. Обязательные package commands

Нужны команды для:

- dev;
- build;
- lint;
- typecheck;
- unit tests;
- integration tests;
- E2E;
- migrations;
- seed;
- полного verification.

Обязательна общая команда `verify`.

## 18. Unit tests

Минимально проверить естественную чистую логику обработки query:

- U1: `баранина` валиден;
- U2: пробелы по краям удаляются;
- U3: пустая строка отклоняется;
- U4: строка из пробелов отклоняется.

Не создавать искусственные abstraction только ради unit tests.

## 19. Integration tests

Работают с настоящим PostgreSQL, без mock DB.

- I1 Found: `баранина` возвращает ровно один ожидаемый Offer.
- I2 Case insensitive: `БАРАНИНА` возвращает тот же Product.
- I3 Trim: `  баранина  ` возвращает тот же Product.
- I4 Empty result: `единорог` возвращает пустой массив.
- I5 Nullable price: `говядина` возвращает Offer с `price = null`.
- I6 Relationships: `баранина` возвращает правильные Product, Seller, Location.

## 20. E2E tests

Playwright проверяет реальное приложение.

### E1 Happy path

1. Открыть `/`.
2. Ввести `баранина`.
3. Запустить поиск.
4. Увидеть `Баранина`.
5. Увидеть `4 200`.
6. Увидеть `Асыл Ет`.
7. Увидеть `Тестовая мясная точка`.
8. Увидеть `Свежий привоз.`

### E2 Empty state

1. Ввести `единорог`.
2. Запустить поиск.
3. Увидеть сообщение об отсутствии результатов.
4. Не увидеть старую карточку результата.

### E3 Цена отсутствует

1. Ввести `говядина`.
2. Запустить поиск.
3. Увидеть Offer.
4. Увидеть `Цена не указана`.

Основной сценарий проходит минимум на mobile и desktop viewport.

## 21. CI

Каждый commit / PR должен запускать минимум:

1. install dependencies;
2. lint;
3. typecheck;
4. migration test database;
5. unit tests;
6. integration tests;
7. production build;
8. E2E tests.

Красный CI означает, что slice не готов.

## 22. Manual acceptance

После автоматических проверок человек вручную:

- открывает приложение на mobile width;
- ищет `баранина`;
- проверяет карточку;
- ищет `говядина`;
- видит `Цена не указана`;
- ищет `единорог`;
- видит empty state;
- проверяет пустой запрос;
- повторяет основной сценарий на desktop;
- обновляет страницу и повторяет поиск;
- убеждается в отсутствии горизонтального scroll и явных UI-поломок.

## 23. Жёсткий Out of Scope

В S0 запрещено реализовывать или создавать заготовки для:

User, Buyer profile, auth, OTP, SMS, Seller registration, Seller UI, Offer create/edit/delete UI, Seller Change Set, Seller Change Item, Category, synonyms, aliases, fuzzy/semantic search, AI, LLM, embeddings, vector DB, voice, photo, video, media, coordinates, browser geolocation, distance, PostGIS, map, recommendations, discovery feed, interests, notifications, Telegram bot, reviews, ratings, moderation, analytics platform, subscription, tariffs, active-offer limits, promotion, advertising, payments, admin panel, external search service, Elasticsearch, Redis, queues, microservices, event bus и Kubernetes.

Не создавать пустые таблицы и модули «на будущее».

## 24. Дополнительные технические запреты

Запрещено:

- database access в React components;
- search business/application logic в HTTP route;
- generic BaseRepository/BaseService/AbstractEntity ради будущего reuse;
- полноценная design system;
- global state manager;
- React Query/SWR только ради одного search request;
- auth provider;
- observability stack;
- внешние SaaS-зависимости, без которых S0 работает локально;
- использование старого кода KAIDA.KZ как основы.

## 25. Правило изменения scope

Если S0 нельзя корректно закончить без изменения соседней области, исполнитель не расширяет scope самостоятельно.

Нужно сообщить:

- проблема;
- необходимое изменение;
- почему это нельзя решить внутри контракта;
- последствия для будущих slices и публичных контрактов.

Мелкие технические детали, не меняющие публичный контракт и границы модулей, отдельного согласования не требуют.

## 26. Definition of Done

### Functional

- `баранина` находится;
- правильный Offer отображается;
- `говядина` находится;
- nullable price отображается корректно;
- `единорог` даёт empty state;
- пустой query обработан.

### Architecture

- UI не знает PostgreSQL;
- HTTP layer не содержит search logic;
- Search работает через application/repository boundary;
- БД содержит только четыре продуктовые таблицы;
- отсутствует код будущих slices.

### Database

- clean database создаётся с нуля;
- migrations применяются;
- seed загружается штатной командой;
- integration tests используют отдельную test DB.

### Quality

- lint green;
- typecheck green;
- unit green;
- integration green;
- E2E green;
- production build green;
- CI green;
- нет skipped/failing tests, скрывающих проблему.

### UI

- mobile работает;
- desktop работает;
- нет горизонтального scroll;
- loading/result/empty/error states работают;
- базовая keyboard accessibility работает.

### Documentation

README объясняет prerequisites, PostgreSQL, env, migrations, seed, запуск приложения и verification suite.

### Manual verification

Сценарий реально пройден через рабочий браузер.

## 27. Git checkpoint

Работа ведётся в ветке:

`slice/s0-search`

После Definition of Done:

1. проверить git diff;
2. убедиться, что нет изменений вне scope;
3. запустить `verify`;
4. пройти manual acceptance;
5. сделать осмысленные commits;
6. merge в `main`;
7. повторно проверить `main`;
8. поставить tag `v0.0.1-s0`.

Tag нельзя создавать, пока S0 не прошёл verification.

## 28. Состояние после S0

После S0 есть минимальная KAIDA.KZ, которая умеет одну вещь: найти в PostgreSQL тестовое предложение конкретного товара и показать его через рабочий веб-интерфейс.

У неё ещё нет Seller Input, Offer lifecycle, нормального Catalog, AI, рекомендаций, географии и монетизации.

Это правильное состояние после S0.

## 29. Следующий slice

S1 не начинается, пока S0 не прошёл все тесты, ручную проверку и не сохранён как рабочая контрольная точка.

Следующий Feature Spec:

**S1: Offer Lifecycle / актуальность предложения.**
