# KAIDA.KZ 2.0 — Execution Prompt for S0

Этот текст предназначен для coding-agent, который будет реализовывать S0.

---

Ты работаешь над новым проектом **KAIDA.KZ 2.0 с чистого листа**.

Старый код KAIDA.KZ запрещено использовать как архитектурную основу, копировать из него модули или переносить решения автоматически.

## Главная задача

Реализуй **только Slice S0: First Search** согласно утверждённому документу:

`docs/slices/S0-search/IMPLEMENTATION_CONTRACT.md`

Также соблюдай:

- `docs/PROJECT_RULES.md`;
- `docs/architecture/TECHNICAL_FOUNDATION_V0.md`;
- `docs/slices/S0-search/FEATURE_SPEC.md`.

Implementation Contract является главным источником требований для S0.

Не расширяй scope.

Не начинай S1.

Не реализуй ничего «на будущее».

## Цель S0

После завершения S0 должен работать один сквозной пользовательский сценарий:

**анонимный пользователь открывает KAIDA.KZ → вводит `баранина` → система через реальный API и PostgreSQL находит тестовый Offer → показывает товар, цену, продавца, Location и комментарий.**

Также обязательны сценарии:

- `говядина` → Offer найден, цена отсутствует → `Цена не указана`;
- `единорог` → пустая выдача;
- пустой query корректно валидируется.

Это настоящий vertical slice:

`UI → API → application logic → PostgreSQL → UI`

## Технический стек

Используй только утверждённый стек:

- Node.js 24 LTS;
- TypeScript strict;
- Next.js 16 App Router;
- Next.js Route Handlers;
- PostgreSQL 18;
- Drizzle ORM + migrations;
- Zod;
- Vitest;
- Playwright;
- pnpm;
- CSS Modules + CSS variables;
- modular monolith.

Не заменяй стек без объективной технической причины.

Если обнаружена реальная несовместимость версий или блокирующая проблема, сначала сообщи:

1. что именно несовместимо;
2. доказательство проблемы;
3. минимальное изменение;
4. последствия.

До согласования не меняй фундамент самостоятельно.

## Перед началом реализации

1. Изучи текущее состояние репозитория.
2. Прочитай все документы S0.
3. Проверь `git status`.
4. Работай только в ветке `slice/s0-search`.
5. Если ветка отсутствует, создай её от актуального `main`.
6. Перед основным кодом составь внутренний план файлов, которые нужно создать/изменить.
7. Не создавай структуру будущего KAIDA.KZ.

Если существующие файлы не мешают S0, не переписывай их.

## Реализуемая модель данных

Создай ровно четыре продуктовые таблицы:

- `products`;
- `sellers`;
- `locations`;
- `offers`.

### products

- `id`: UUID PK;
- `name`: text required unique.

### sellers

- `id`: UUID PK;
- `display_name`: text required.

### locations

- `id`: UUID PK;
- `name`: text required;
- `address_text`: text required.

### offers

- `id`: UUID PK;
- `product_id`: UUID FK → products;
- `seller_id`: UUID FK → sellers;
- `location_id`: UUID FK → locations;
- `price_amount`: numeric nullable;
- `price_currency`: char(3) nullable;
- `price_unit`: text nullable;
- `seller_comment`: text nullable;
- `created_at`: timestamptz required;
- `updated_at`: timestamptz required.

Правила:

- отрицательная цена запрещена;
- если `price_amount` задан, `price_currency` обязателен;
- цена может отсутствовать;
- комментарий может отсутствовать.

Не добавляй `status`, `last_confirmed_at`, `expires_at`, coordinates, categories, aliases, media, moderation, promotion, auth fields, Seller Change Set или любые другие будущие поля.

Все seed Offers в S0 считаются актуальными по определению.

## Seed data

Создай детерминированный seed.

Products:

- `Баранина`;
- `Говядина`.

Seller:

`Асыл Ет, тестовый продавец`

Location:

- `Тестовая мясная точка`;
- `Алматы, Зелёный базар, тестовый павильон 12`.

Offer Баранина:

- price_amount `4200.00`;
- price_currency `KZT`;
- price_unit `кг`;
- seller_comment `Свежий привоз.`

Offer Говядина:

- price_amount NULL;
- price_currency NULL;
- price_unit NULL;
- seller_comment `Есть мякоть и мясо на кости.`

Seed не запускается автоматически при production startup.

## Search behaviour

Нормализация query:

1. trim;
2. reject empty;
3. exact Product.name comparison без учёта регистра.

Обязаны работать:

- `баранина`;
- `Баранина`;
- `БАРАНИНА`;
- `  баранина  `.

Не реализовывать fuzzy search, contains, aliases, synonyms, typo correction, category search, semantic search, embeddings и AI.

## API

Продуктовая endpoint:

`GET /api/search?q=<query>`

Допускается только технический health check:

`GET /api/health`

Не создавать CRUD endpoints для Products, Sellers, Locations или Offers.

Успешный результат HTTP 200 содержит:

- нормализованный query;
- `offers[]`;
- Offer id;
- product: id, name;
- seller: id, displayName;
- location: id, name, addressText;
- price либо null;
- sellerComment либо null.

Decimal price передавать как string, а не JavaScript float.

`единорог` → HTTP 200 и `offers: []`.

Отсутствующий/пустой query → HTTP 400 и machine code `INVALID_QUERY`.

Unexpected server/DB error → корректный 5xx без SQL, stack trace и внутренних деталей для пользователя.

## Архитектурные границы

Обязательны функциональные области:

- Catalog;
- Sellers;
- Locations;
- Offers;
- Search.

Search координирует read-case:

`query → Product → Offers → result`

Запрещено:

- SQL/database access в React component;
- database query непосредственно в route;
- search application logic непосредственно в `route.ts`;
- giant service, владеющий всей предметной областью;
- generic BaseRepository/BaseService ради будущего reuse;
- unnecessary abstraction.

HTTP route должен только принять/валидировать boundary input, вызвать application use case и сформировать HTTP response.

## UI

Одна страница.

Обязательны:

- `KAIDA.KZ`;
- search input;
- search button;
- loading;
- result;
- empty;
- validation;
- system error.

Placeholder:

`Например, баранина`

Поиск кнопкой и Enter.

Result card показывает Product, цену или `Цена не указана`, Seller, Location, address и seller comment при наличии.

Empty state:

`По вашему запросу ничего не найдено.`

System error:

`Не удалось выполнить поиск. Попробуйте ещё раз.`

## Responsive и accessibility

Проверить minimum:

- mobile ~390 px;
- desktop ~1440 px.

Нет горизонтального scroll. UI пригоден для touch. Desktop не должен быть просто растянутой мобильной колонкой.

Обязательны semantic form, label, keyboard navigation, visible focus, Enter submit, понятные feedback states и нормальная контрастность.

## Визуальная основа

Разрешено только необходимое для S0:

- Plus Jakarta Sans;
- базовые CSS variables;
- purple primary;
- background/text/muted/border;
- radius;
- spacing;
- focus state.

Не подключай UI-kit, Tailwind, shadcn и полноценную design system.

## PostgreSQL

PostgreSQL локально поднимается Docker.

Приложение запускается обычным Node/Next process.

Отдельные базы:

- `kaida`;
- `kaida_test`.

Integration tests не должны менять development DB.

Используй:

- `DATABASE_URL`;
- `TEST_DATABASE_URL`.

Создай `.env.example`. Реальные секреты не коммить.

## Migrations

Только migrations:

`schema → generated migration → inspect → migrate → tests`

Не использовать schema push как штатный механизм общей БД.

Migration files должны быть в Git и применяться с чистой базы.

## Tests

Integration tests работают с настоящим PostgreSQL, не mock DB.

Обязательные integration scenarios:

- `баранина` → правильный Offer;
- `БАРАНИНА` → тот же Product;
- `  баранина  ` → тот же Product;
- `единорог` → `offers: []`;
- `говядина` → `price = null`;
- `баранина` содержит правильные Product/Seller/Location.

Playwright E2E:

### Happy path

`/` → `баранина` → увидеть `Баранина`, `4 200`, `Асыл Ет`, `Тестовая мясная точка`, `Свежий привоз.`

### Empty

`единорог` → empty state, предыдущая карточка исчезла.

### Nullable price

`говядина` → `Цена не указана`.

Основной сценарий проверить на mobile и desktop.

## Package scripts

Нужны команды для:

- dev;
- build;
- lint;
- typecheck;
- unit;
- integration;
- E2E;
- migrations;
- seed.

Обязательна одна общая команда `verify`, выполняющая полный набор проверок Definition of Done.

## CI

GitHub Actions на commit/PR:

1. install;
2. lint;
3. typecheck;
4. test DB / migrations;
5. unit;
6. integration;
7. production build;
8. E2E.

Не использовать `continue-on-error` для скрытия проблем.

Не оставлять skipped tests вместо исправления.

## README

README после S0 должен объяснять:

1. prerequisites;
2. installation;
3. PostgreSQL startup;
4. env;
5. migrations;
6. seed;
7. app startup;
8. tests;
9. `verify`.

Не превращай README в большой документ о будущем KAIDA.KZ.

## Категорически запрещено

Не реализовывать и не создавать заготовки для:

User/Buyer, auth, OTP, SMS, Seller registration/dashboard, Seller Input, Seller Change Set/Item, Offer create/edit UI, categories, aliases, synonyms, fuzzy/semantic search, AI/LLM, embeddings/vector DB, voice/photo/video/media, coordinates/geolocation/PostGIS/maps/distance, recommendations/discovery/interests, notifications, Telegram, reviews/ratings/moderation, analytics platform, subscription/tariffs/limits, promotion/advertising/payments, admin panel, Redis, queues, Elasticsearch, microservices, event bus, Kubernetes.

Не создавай пустые директории/interfaces/tables для будущих функций.

## Не делать скрытый рефакторинг

Не переписывай соседние файлы «для красоты».

Не меняй публичные контракты вне S0.

Не устанавливай библиотеки, которые не нужны для S0.

Если видишь улучшение вне scope, только перечисли его в финальном отчёте, не реализуй.

## Порядок реализации

Рекомендуемый порядок:

1. repository/project foundation;
2. PostgreSQL local environment;
3. schema;
4. first migration;
5. seed;
6. repository/data access;
7. Search application use case;
8. API;
9. UI;
10. integration tests;
11. E2E;
12. CI;
13. README;
14. full verification;
15. manual verification;
16. Git checkpoint.

После каждого существенного шага запускай релевантные проверки. Не откладывай все тесты на конец.

## Regression policy

Новая работа не считается готовой, если падает существующий test, build, typecheck, migration или E2E.

## Обязательная реальная проверка

После реализации:

1. подними PostgreSQL;
2. примени migrations;
3. выполни seed;
4. запусти приложение;
5. открой рабочий UI;
6. пройди пользовательские сценарии;
7. запусти `verify`.

Если browser/computer tool доступен, используй его для ручной проверки. Если недоступен, честно укажи это. Не заявляй manual verification, если фактически её не выполнил.

## Когда нужно остановиться и спросить

Не задавай вопросы по мелким техническим решениям внутри контракта.

Остановись только если:

1. требование технически невозможно;
2. требуется изменить публичный API;
3. требуется новая продуктовая сущность;
4. требуется выйти за S0;
5. требуется затронуть будущий slice;
6. требования конфликтуют;
7. требуется необратимо менять существующие пользовательские данные;
8. нужен секрет, платный сервис или внешний аккаунт.

## Definition of Done

Не называй S0 завершённым, пока одновременно не выполнены:

- поиск `баранина` работает;
- поиск `говядина` работает;
- nullable price работает;
- `единорог` работает как empty state;
- empty query валидируется;
- migrations проходят с чистой базы;
- seed работает;
- development/test DB разделены;
- lint green;
- typecheck green;
- unit green;
- integration green;
- E2E green;
- production build green;
- CI создан;
- mobile проверен;
- desktop проверен;
- README актуален;
- нет функциональности S1+.

## Git checkpoint

Перед окончанием:

1. `git status`;
2. `git diff`;
3. убедись в отсутствии изменений вне scope;
4. финальный `verify`;
5. manual acceptance;
6. небольшие осмысленные commits;
7. рабочая ветка `slice/s0-search`.

Не начинай S1.

Merge в `main` и tag `v0.0.1-s0` допустимы только после полного Definition of Done и фактической проверки.

## Финальный отчёт

Верни:

### S0 Status

`READY` или `NOT READY`.

`READY` только при полном Definition of Done.

### Реализовано

Кратко, только фактически работающее поведение.

### Изменённые файлы

Список + зачем каждый нужен.

### Database

Migrations, tables, seed и результат clean migration test.

### Verification

Фактический результат каждой проверки:

- lint;
- typecheck;
- unit;
- integration;
- E2E;
- build;
- manual mobile;
- manual desktop.

Не писать «должно работать».

### Git

Branch, commits, tag если создан, состояние working tree.

### Deviations

Все отклонения от Implementation Contract. Если нет: `Нет.`

### Problems

Все известные проблемы. Если нет: `Нет.`

### Следующий шаг

Только:

**Подготовить Feature Spec для S1 Offer Lifecycle.**

Не начинай реализацию S1 самостоятельно.

Главный критерий: не количество кода, а наличие маленькой заведомо рабочей версии KAIDA.KZ, которая делает ровно одну полезную вещь и может быть безопасно сохранена как контрольная точка.
