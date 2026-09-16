# KAIDA.KZ 2.0 — Project Rules / Process v2

Этот документ задаёт обязательный процесс разработки и стабильные архитектурные границы проекта.

Он **не является roadmap**. Текущая очередь работ живёт только в `docs/product/EXECUTION_PLAN.md`.

## 1. Проект строится с нуля

Старый KAIDA.KZ не является архитектурной базой и не переносится автоматически.

Старые ТЗ, код и материалы могут использоваться как источник требований, историческая справка или evidence ранее принятых решений, но не получают приоритет только потому, что уже существуют.

## 2. Только маленькие vertical slices

Не создавать весь MVP одним большим блоком.

Каждый product slice решает одну конкретную пользовательскую задачу полностью:

`UI → API → бизнес-логика → БД → тесты → manual acceptance`

После каждого изменения должна существовать заведомо рабочая версия продукта.

Следующий product slice начинается только после закрытия предыдущего checkpoint, если отдельно не согласована независимая maintenance-задача.

Docs/test-infrastructure/CI/tooling maintenance не считается product slice, если она не меняет user behavior, public API/business contract и не добавляет capability.

## 3. Slice Contract

Перед implementation составляется один компактный `Slice Contract`.

Он должен содержать только необходимое для однозначной проверки:

1. одну user task;
2. scope;
3. explicit out of scope;
4. закрытые contracts, которыми slice пользуется;
5. закрытые contracts, которые потенциально затрагиваются;
6. реальные risk flags;
7. ожидаемые модули изменения;
8. 5–12 acceptance criteria;
9. automated verification plan только для нужных уровней;
10. короткий manual acceptance scenario.

Не создавать второй большой Implementation Contract, если Slice Contract уже однозначно задаёт поведение и архитектурные границы.

Не фиксировать внутренние имена файлов, функций и типов без объективной необходимости. Ожидаемые модули — это scope boundary, а не запрет на любой технически необходимый файл.

## 4. Risk flags

Стандартные risk flags:

- DB migration;
- public API;
- auth / security / privacy;
- concurrency / atomicity;
- data loss;
- external service.

Дополнительные проверки добавляются только для реально присутствующих рисков.

Не требовать максимальный набор тестов просто ради строгости.

## 5. Порядок работы над slice

Для product slice:

1. выбрать первую незакрытую работу из `EXECUTION_PLAN.md`;
2. подготовить и согласовать Slice Contract;
3. реализовать минимально необходимый diff;
4. выполнить targeted tests по реальным рискам;
5. получить один актуальный full regression proof на финальном executable head — обычно branch CI;
6. выполнить manual acceptance пользовательского поведения;
7. проверить diff на scope creep и closed-contract changes;
8. merge в `main`;
9. дождаться green merged-main CI;
10. создать annotated checkpoint tag;
11. только после этого начинать следующий product slice.

Если executable code/config/migration/test behavior изменился после branch CI, старый CI больше не доказывает новый head.

Docs-only maintenance не требует UI manual acceptance, если production behavior не меняется.

## 6. Closed contracts

Closed contract — это проверенное обещанное поведение, а не исторический файл.

К closed contracts относятся:

- user-visible behavior;
- public API semantics;
- business rules;
- data invariants;
- migration guarantees;
- privacy boundaries;
- ownership / lifecycle / ranking semantics;
- согласованные архитектурные границы.

Historical test file, helper или implementation detail сам по себе closed contract не образует.

Старый test harness можно менять, если его assumption устарел из-за легитимного развития системы и проверяемое поведение остаётся прежним.

Если новый slice действительно требует изменить closed contract, сначала STOP и объяснить:

- какой contract мешает;
- почему без изменения нельзя;
- что именно нужно пересмотреть;
- последствия;
- какие slices/modules затрагиваются.

Только после отдельного Product Owner decision новый Slice Contract может явно пересмотреть старое поведение.

## 7. Verification

Verification риск-ориентированная, без ритуального дублирования.

### Targeted proof

Использовать только нужные уровни:

- unit — чистая business logic / validation;
- integration — API, repository, DB constraints, transactions;
- migration-upgrade proof — schema/migration risk;
- E2E — пользовательский UI/API flow;
- build/typecheck/lint — compilation/runtime boundary.

### Full regression

Перед закрытием executable change должен существовать один актуальный full regression proof на соответствующем head. Full branch CI обычно одновременно является этим proof.

### Повторные exact-SHA runs

Нужны только при признаках:

- flaky/nondeterministic failure;
- race/concurrency;
- teardown instability;
- environment-specific failure;
- когда repeatability сама является частью contract.

### Failure classification

Перед исправлением нового failure определить класс:

1. `PRODUCT DEFECT`;
2. `STALE REGRESSION ASSUMPTION`;
3. `TEST IMPLEMENTATION / HARNESS DEFECT`;
4. `ENVIRONMENT / PROCEDURE / TOOLING`.

Production нельзя менять только ради stale assertion. Test нельзя ослаблять только ради зелёного CI.

### Deterministic harness

Повторяющуюся логику test DB, pool teardown, `pg_stat_activity`, cleanup и `DROP DATABASE` выносить в deterministic harness, если это уменьшает дублирование и race risk.

## 8. Scope discipline

Не рефакторить соседние части проекта без объективной необходимости.

Не создавать пустые модули «на будущее».

Не объединять независимые product changes в один slice.

Если Slice Contract нельзя однозначно проверить человеком за один проход, его нужно разделить.

Главный критерий прогресса — количество реально работающих и проверенных функций, а не объём кода или документации.

## 9. Архитектура MVP

MVP — **modular monolith**.

Микросервисы не использовать без измеримой необходимости.

Функциональные области появляются по мере требований:

Identity, Sellers, Locations, Catalog, Offers, Search, Discovery, Seller Input, AI Processing, Media, Reviews, Moderation, Notifications, Monetization, Analytics.

Модуль имеет чёткую границу и взаимодействует с соседними через определённые contracts.

## 10. Суть продукта

KAIDA.KZ не является путеводителем по рынкам и не является классическим e-commerce checkout.

Главная задача: помочь покупателю понять, **где сейчас купить нужный товар**, а также показать товары, которые потенциально могут его заинтересовать.

Центральная сущность — **Offer**, актуальное предложение продавца.

Рынок, магазин, павильон, домашняя точка и другие физические места относятся к Location/domain navigation, но рынок не становится центром архитектуры.

Основная цепочка:

`Seller Input → Normalization / Processing → Offer → Search / Matching / Discovery → Buyer Action`

П1 = покупатель.  
П2 = продавец.

## 11. Seller Input и AI

П2 в перспективе может обновлять данные через текст, голос, фото, видео, web UI и Telegram.

Все каналы используют одну бизнес-логику. Telegram-бот не получает отдельное ядро.

AI не изменяет Offer напрямую.

Архитектурная граница:

`сырой ввод → AI/normalization предлагает SellerChangeSet → П2 проверяет/подтверждает → Offer изменяется`

Для массового ввода один SellerChangeSet может содержать несколько SellerChangeItems.

SellerChangeSet — способ безопасно предложить и применить изменение; ordinary seller UI не обязан выставлять эту техническую сущность пользователю наружу.

## 12. Актуальность Offer

Свежесть — центральная часть продукта.

Конкретные thresholds/ranking/reminder semantics принадлежат соответствующим product contracts и Issues, а не этому process-документу.

Любое изменение freshness policy должно быть детерминированно тестируемым и не должно физически удалять историю без отдельного data-loss decision.

## 13. Каталог

Product и пользовательский поисковый термин — не одно и то же.

Пользовательские запросы не должны автоматически создавать Products.

Правильный цикл:

`Search Query Log → matched / unmatched / zero result → анализ → controlled change Product / aliases / Category`

## 14. Контакты продавца

Не хранить произвольный внешний URL там, где достаточно структурированного идентификатора.

Для Telegram, Instagram и подобных сервисов хранить username/handle и формировать ссылку внутри KAIDA.KZ.

## 15. Авторизация

На закрытом тесте допускается phone → test OTP → session.

Identity должна позволять позже заменить тестовую доставку реальным SMS provider без переписывания остальной системы.

Public-launch security требования задаются отдельным launch/auth contract; test OTP нельзя выдавать за production-ready SMS flow.

## 16. Монетизация

Архитектурно разделять три направления:

1. **Объём** — тариф ограничивает число активных Offers через policy/config, а не hard-coded число.
2. **Удобство** — продвинутые способы массового seller input могут быть платными.
3. **Охват** — отдельное продвижение Offer.

Подписка Seller и promotion Offer — разные механизмы.

Платное продвижение не должно ломать organic relevance/freshness eligibility.

## 17. UI / Design

Mobile-first, полноценный responsive, фиолетовая базовая гамма.

UI развивается вместе со slices: сначала рабочий сценарий, затем визуальная доводка.

`docs/DESIGN_SYSTEM.md` владеет visual/presentation rules. Внешние UX references являются advisory evidence и применяются через `KEEP / ADAPT / REJECT / GAP` согласно `docs/product/UX_REFERENCE_INDEX.md`.

Design System и UX references не имеют права молча менять closed behavior/API/privacy/business contracts.

## 18. Git и checkpoints

`main` содержит только проверенное состояние.

Каждый product slice разрабатывается в отдельной ветке.

Небольшие осмысленные commits предпочтительнее больших смешанных commits.

После закрытия product slice:

`branch CI → manual acceptance → diff audit → merge → merged-main CI → annotated checkpoint tag`

Tag фиксирует проверенный checkpoint; ветки не являются резервными копиями истории.

## 19. Источники истины

У каждого вида информации один владелец:

- `README.md` — актуальное описание проекта для человека;
- `AGENTS.md` — router: какие документы читать;
- этот файл — process + stable architecture rules;
- `docs/product/EXECUTION_PLAN.md` — единственная текущая очередь;
- `docs/product/FEATURE_MAP.md` — long-range capability/dependency map;
- GitHub Issues — подробные требования незакрытой работы;
- `docs/DESIGN_SYSTEM.md` — visual/presentation rules;
- `docs/product/UX_REFERENCE_INDEX.md` — UX reference routing/audit;
- `docs/UX_BACKLOG.md` — только observation inbox до promotion в Issue;
- `docs/slices/**` — contracts/evidence отдельных slices;
- `docs/agents/KAIDA_CONTROLLER.md` — Controller procedure.

Если документы расходятся с фактическим repository state, сначала установить `main`, tag и CI, затем исправить stale documentation. Не создавать новый параллельный roadmap.

## 20. Роль Product Owner и AI

Product Owner принимает продуктовые решения, определяет нужное поведение, оценивает UI и выполняет manual acceptance.

AI отвечает за техническую реализацию, scope discipline, объяснение существенных архитектурных решений, достаточные тесты и честное состояние verification.

AI не должен скрывать проблемы, выдавать непроверенную реализацию за готовую или менять соседние части проекта без необходимости.

Для MVP предпочитать меньшее проверяемое решение более сложной архитектуре, если это не создаёт очевидный технический тупик.
