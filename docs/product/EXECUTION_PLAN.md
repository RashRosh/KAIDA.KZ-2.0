# KAIDA.KZ 2.0 — General Production Plan

Это **единственный канонический документ о том, что осталось сделать и в каком порядке**. Его можно читать отдельно: чтобы понять план, не нужно открывать реестр, Issues или контракты. Подробности лежат в подчинённых источниках (раздел 9), но они **не задают порядок** и не конкурируют с этим файлом.

**Этот план не разрешает реализацию.** Реализацию разрешают только прямая команда PO и утверждённый Slice Contract (`PROJECT_RULES.md` §3, §19). Состояние задачи и триггер пересмотра — повод вынести решение PO, а не разрешение. Порядок определяют зависимости, readiness-условия, явные решения PO и проверенные checkpoints, а не календарные даты: даты — свидетельство, а не правило очерёдности (правила runtime-дат, хранения и истечения безопасности это не затрагивает).

## Общая дорожная карта

**Next authorized slice: auth-otp-source-protection (PO2026-10-11), after its docs PR publication.** buyer-offer-reports CLOSED at v0.0.75-buyer-offer-reports (PO manual acceptance,2026-10-10). Reporting remains bounded to isolated synthetic testing; real-user reporting and production retention remain unauthorized. Only this bounded local slice is newly authorized; future candidates retain their dependencies and order.

**Утверждено**
1. **Фундамент — завершён.** Поиск и карточка предложения для покупателя, кабинет продавца и редактор карточки, актуальность, Production KB, справочник адресов, события D0, локальный bootstrap (R1), backup/restore (R2), блок UX/search 1–6 (последний checkpoint `v0.0.72`).
2. **R3 - CLOSED:** reproducible isolated deployment preparation without hosting; contract accepted by PO on 2026-10-09, PR #163 merged, merged-main CI green and annotated checkpoint v0.0.73-r3-deployment-preparation. Closure does not authorize public deployment or extend local-only security exceptions.

**Не утверждено как последовательность: направления и их зависимости**

| Направление | От чего зависит |
|---|---|
| Допуск реальных пользователей | AI-ввод (обязателен для запуска, отложен); решения PO по входу/OTP, защите от злоупотреблений, юридическим текстам, объёму пилота. AI-модерация условием не является. |
| Данные и Demand | Реальная среда; ежедневный purge D0 по расписанию; решение включить `organic`. Затем D1 → D2 → D3 (после Demand readiness) → D4 (после подтверждённой готовности платить). По тем же данным: динамические чипы, Price Intelligence (#79), чувствительность к расстоянию (#76). |
| Граница MVP | Остаток S16, обзор границы MVP, Demand readiness assessment. |
| Коммерция и Backoffice | Планирование 11A–11C; затем независимые цепочки Pro (AI + full Demand + Performance), Boost, Business и slices Backoffice (Catalog Operations первым). |
| Независимые кандидаты | Решение PO о постановке: улучшения поиска и экранов, кабинет продавца (архив, отзывы, видео), навигация по рынкам (#10), развитие каталога, Growth. |

## 0. Как читать

В плане три **независимые** величины. Ни одна из них не разрешает старт работы.

**1. Состояние в порядке работ** (одно значение):

| Состояние | Что значит |
|---|---|
| **SCHEDULED** | Has a place in the PO-approved queue (section 2); scheduling does not authorize implementation. |
| **GATED** | Ждёт названной зависимости, данных или готовности; зависимость указана в строке. |
| **DEFERRED** | Отложено решением PO; в строке — условие возврата. |
| **UNSCHEDULED** | Пока нет места в порядке. Это **не** означает, что требование не одобрено — основание смотри во второй величине. |
| **NEEDS-DECISION** | Прежде чем планировать, нужно решение PO; вопрос указан в строке. |

**2. Основание требования** (насколько само требование подтверждено; колонка «Основание», далее коды источников из `REQUIREMENTS_SOURCE_MAP.md` §1):

| Основание | Что значит |
|---|---|
| **DECIDED** | В источнике записано явное решение PO (утверждённый порядок, решение по объёму, отсрочке или принятому ограничению). |
| **DOCUMENTED** | Требование изложено в проектном источнике (Feature Map, Issue, спецификация, контракт, бриф), но решение PO об объёме и сроке не записано. |
| **RECOMMENDED** | Рекомендация экспертного обзора, агента или внешнего чата; не требование, пока PO его не принял. |

Колонки «Зависимости и условия готовности» даны формулировками источников; строки с пометкой ВНИМАНИЕ смешивают документированное требование с рекомендацией агента. Колонка «Следующее действие» — процедурная запись самого плана, не требование источника.

**3. Permission to start.** Status and requirement basis do not authorize implementation. R3 and auth protection are closed; PO authorized the bounded buyer-offer-reports contract. A direct PO instruction and approved Slice Contract remain required (PROJECT_RULES sections 3 and 19).

Вид работы: **Dev** — изменение продукта (всегда workflow slice: контракт → реализация → CI → приёмка PO → checkpoint); **Research** — письменная находка и решение PO, из неё может последовать Dev; **Ops** — среда, процесс, данные, юридические и организационные шаги (изменения кода внутри идут как Dev). Метки: **HOLD** — явная остановка PO; **STRATEGY** — запись strategy backlog, не mandate; **FOLLOW-UP** — записанное последующее дело; **LIMIT** — известное ограничение, принятое PO; **NON-GOAL** — ограниченное исключение или принцип (не вечный запрет).

Идентификаторы (`B-…`, `S-…`, `O-…`, `M-…`, `K-…`, `C-…`, `G-…`, `R-…`, `Q-R3`, `S14`, `D0–D6`, `#N`) стабильны и сохраняются; `REQUIREMENTS_REGISTER.md` — технический перекрёстный указатель ID → источники → полные формулировки ограничений.

## 1. Текущее положение

Факты о checkpoint (tag, SHA, CI) ведёт `docs/agents/CURRENT_STATE.md`; исполнитель в любом случае проверяет `main`, tags и CI напрямую. История закрытых пунктов — `EXECUTION_HISTORY.md` и Slice Contracts.

**Что уже работает (поставлено, проверено PO):**

- **Покупатель:** поиск по каталогу и названиям продавцов с понятной выдачей (известный товар / неизвестный запрос / пустые состояния с пояснением), сортировки «Расстояние / Цена / Актуальность», «Рядом», словоформы, автоисправление опечаток, интересы по Product, карточка предложения с ценой, единицей и упаковкой, контактами и часами работы, русский и казахский интерфейс (казахский текст предварительный), стартовая страница First Entry (мобильная).
- **Продавец:** вход и контекстный вход, «Моя витрина» с карточками на несколько торговых точек, редактор карточки (фото до 5, цена обязательна, единица и упаковка, часы работы, контакты точки), актуальность 2/7/14 с напоминаниями, подсказки адреса из собственного справочника (OSM), перевод комментария (выключен до переезда на сервер), приватный просмотр «как увидят покупатели» до и после публикации.
- **Каталог и данные:** Production KB v1 (682 / 210 / 35), поисковые события D0 (запись `organic` выключена), снятие карточки оператором и пост-проверка.
- **Операции:** воспроизводимый локальный bootstrap (R1), backup и restore (R2), baseline security automation (CodeQL, Dependency Review, Scorecard).
- **Основные теги:** S0–S15B закрыты (Production KB `v0.0.52`, S15B `v0.0.54`–`v0.0.60`), D0 `v0.0.61`, R1 `v0.0.62`, R2 `v0.0.64`, блок UX/search 1–6 закрыт (последний — `v0.0.72-pre-publication-buyer-preview`). Полный перечень — `CURRENT_STATE.md` и `EXECUTION_HISTORY.md`.

**Чего ещё нет:** настоящая аутентификация и доставка OTP, AI-ввод, AI-модерация, отзывы и рейтинг, архив карточек, навигация по рынкам, ленты и уведомления для покупателя, аналитика для продавца, платные тарифы и Backoffice, развёртывание на реальной среде.

## 2. Утверждённая очередь и кандидаты

**Утверждено PO (очередь):**

1. Закрытая работа — в истории и тегах; здесь статусы закрытого не ведутся.
2. **R3 - CLOSED:** completed at v0.0.73-r3-deployment-preparation; contract and PR #163 hold the evidence.
3. **auth-otp-protection — CLOSED:** PO manual acceptance PASS at `2df2f5dd82e6b1805f863548f71ab0c2ea0df067`; PR #166 merged at `11eb7f12943c25749b9dfb125b72686400b93e1d`; merged-main CI green, checkpoint `v0.0.74-auth-otp-protection`.
4. **buyer-offer-reports — CLOSED:** approved contract/previews and queue insertion (PO, 2026-10-10); docs PR168 and implementation PR169 merged, exact-head manual acceptance PASS, branch/main CI green, annotated checkpoint `v0.0.75-buyer-offer-reports`. Evidence: [ACCEPTANCE.md](../slices/buyer-offer-reports/ACCEPTANCE.md). No further implementation authorized.
5. **auth-otp-source-protection — SCHEDULED/APPROVED:** PO2026-10-11 approves [contract](../slices/auth-otp-source-protection/SLICE_CONTRACT.md), actual-component previews and implementation after docs PR publication. Local-only source quota20/exact IP/rolling15min, existing phone limits, atomic admission, protected reference ingress and supervised cleanup; no login redesign. STOP before implementation merge/tag for manual acceptance. Production trust/retention gates remain open.

**Approved bounded scope:** [buyer-offer-reports](../slices/buyer-offer-reports/SLICE_CONTRACT.md): buyer report → operator reviews saved/current evidence → disposition via existing whole-card moderation. Existing auth before explicit Send; four reasons, optional300-character text; immediate reason navigation/Back draft preservation; one User/card/version report including closed reports, five new reports/rolling24h, atomic admission; open/closed dispositions and acknowledgement only. Approved report-scoped operator historical-photo access, private buyer text separate from seller comments, closure independent of return. Local installation evidence retention only; no real users/production retention, broader reviews/ratings/appeals, new Issues or paid services. At authorized closure, port3000 serves the accepted checkpoint against the same isolated private snapshot with additive migration; reporting is disabled there. Original dev data/photos remain unchanged; voice remains paused.

**Approved bounded scope (2026-10-09):** [auth-otp-protection Slice Contract](../slices/auth-otp-protection/SLICE_CONTRACT.md) covers login OTP request throttling, failed-code attempts and same-modal resend/recovery. Approved initial policy: 60 seconds between requests; five accepted requests per canonical phone per rolling 15 minutes; five incorrect attempts per issued code; fresh-code recovery subject to the same limits, no permanent account lock. This covers O-OTP-RESEND and only the phone-based login portion of O-ABUSE. O-AUTH real delivery and broader anti-abuse remain open, including distributed many-phone abuse and deliberate exhaustion of another person's allowance. Approved final contract/docs PR #165, separate implementation PR #166, isolated verification, full branch/main CI and PO manual acceptance are complete; the slice is CLOSED. Real SMS/purchases excluded.

**PO research pause:** voice feasibility is PAUSED; evidence and memory blocker are retained in `docs/research/voice-input/local-feasibility-2026-10-09/`. Resume requires explicit PO instruction and sufficient memory preflight; do not resume automatically when memory frees. AI input remains required for launch; its implementation order is deferred. Existing manual/voice/photos/video channels, AI moderation deferral and public-launch gate are unchanged. The auth proposal is independently feasible locally and does not satisfy or remove the AI launch requirement.

**Не утверждено:** порядок после buyer-offer-reports. Раздел 5 перечисляет остальные workstreams как зависимости и кандидатов с состоянием каждой задачи; их взаимный порядок PO не задавал (исключение — зафиксированные ниже цепочки зависимостей внутри Demand и commercial/Backoffice, описанные в разделе 7 как зависимости, а не как расписание).

**Постоянные решения PO (действуют, порядок не меняют):**

- **AI-ввод — обязательное предварительное условие публичного запуска.** Разработка и внутреннее тестирование продолжаются без AI, запуск — нет. **AI-модерация условием запуска не является** и остаётся отложенной; действующие ручные требования модерации сохраняются (публикация после явного подтверждения продавцом, пост-проверка оператором с возможностью снять карточку, информационный текст об ответственности продавца); публикация без модерации не разрешается. Это условие запуска, а не разрешение реализовать AI.
- **Отложено (решение PO 2026-10-07):** AI Input (stage 7), AI-модерация (stage 8), любая платная инфраструктура (хостинг, GPU, SMS-провайдер), оценка и выбор поискового движка.
- **Hard commercial cap на число активных Offers не используется**; допустимы только technical, anti-abuse и fair-use limits. Возврат к cap требует отдельного решения PO.
- **Не запланировано и не добавляется без отдельных решений PO до допуска реальных пользователей:** настоящая аутентификация и доставка OTP, защита от злоупотреблений, юридические тексты, объём пилота, операторская доставка OTP, allowlist, оповещения о free-title карточках и прочие pilot-функции (раздел 4).
- **Data-gated:** production-like накопление demand начнётся только в реальном окружении; запись `organic` остаётся выключенной до настройки и проверки ежедневного `pnpm search-events:purge`; события `dev` / `test` / `synthetic` — не спрос.
- Старая `6F` снята до реализации (её цель перешла в D0); старая `6G` стала задачей B-CHIPS. Числовой порог трафика не вводится.

## 3. Открытые GitHub Issues (8)

Issues владеют подробным обсуждением; здесь — суть, что поставлено, что осталось и какое решение или действие следующее. Правки Issues (комментарии, обновление формулировок) выполняются только по прямой команде PO.

| Issue | Суть простыми словами | Поставлено | Осталось | Следующее решение / действие |
|---|---|---|---|---|
| **#10** Market navigation | Показать покупателю, где внутри большого рынка находится продавец: справочник рынков, интерактивная SVG-схема, привязка точки к конкретному месту (`MarketPlace`), позже — маршрут от входа. Рынок — не центр архитектуры; обычные точки работают без него. | Текстовый заменитель: тип точки «рынок / павильон», подсказка «Рынок, павильон, ряд или ориентир», адрес свободным текстом (V-MARKET-TEXT). | **(а)** Справочник рынков и схемы (B-MARKET-NAV), управляются KAIDA, не продавцом. **(б) Уточнение PO от 2026-10-08 (раньше выпадало из плана):** до схем — выбор рынка из справочника и необязательные поля места внутри рынка (павильон/сектор, ряд, номер места, ориентир) в карточке торговой точки; описание принадлежит точке, а не карточке; покупатель видит рынок и описание без придуманной точности; позже описание остаётся нетронутым при привязке `MarketPlace`; нельзя приравнивать текст продавца к проверенному ID места; нужны ли изменения закрытых контрактов — СТОП и отдельный Slice Contract. Записано как B-MARKET-TEXT (новый ID, раздел 5.5). | UNSCHEDULED (B-MARKET-NAV — DOCUMENTED; B-MARKET-TEXT — DECIDED как требование, не запланировано) → решение PO о постановке; триггер: пилот на крупных рынках показывает, что маршрута до точки недостаточно. Зависит от справочника рынков и Backoffice. Реализация не авторизована. |
| **#54** Категории продавца | Продавец группирует свои товары на «Моей витрине» по категориям («Мясо», «Сухофрукты»). | Ничего. Категории есть только в каталоге (Production KB), не у продавца. | Вся функция. Решить: свои категории продавца или общий список KAIDA; видит ли их покупатель; связь с каталогом и свободными названиями; предлагает ли ИИ категорию. | UNSCHEDULED, DOCUMENTED (идея PO на потом: S-CATEGORIES). Триггер вопроса: у продавцов много карточек. В Issue устарела ссылка на «пункт 3 этапа 1» плана (ушёл в историю). |
| **#55** Спрос покупателей (Demand) | Продавец видит, что ищут покупатели; рабочая цепочка D0–D6 (события → агрегаты → ожидания → бесплатные сигналы → платный Demand → оповещения → Business). | D0 — запись поисковых событий (`v0.0.61`), `organic` выключен. | D1 агрегаты и далее — ждут реальных данных (M-D1…M-D4-6, M-PRIVACY, M-READINESS, M-DESIGN-OPEN, M-DEV-OPEN). Порог приватности seller-facing Demand не определён. | GATED: реальное окружение + решение включить organic + purge по расписанию (O-D0-ORG). В Issue устарел раздел «Текущая позиция (2026-10-05)»: S15B и D0 закрыты. |
| **#75** AI-правила seller input | 24 правила, по которым AI из текста, голоса, фото и видео продавца делает черновик Seller Change Set: raw input неизменяем, Product ≠ Offer, AI не пишет Offer напрямую, не выдумывает, confidence + provenance, минимум вопросов, `product_candidate` вместо автосоздания товара. | Опора: Production KB v1 (товары, алиасы, локализованные названия, категории), обязательная цена Offer (#13). Рукой — свободное название вместо каталога. | Весь AI-путь: разбор, проверка дублей у продавца, `product_candidate`, provenance, правила обучения на правках (S-AI-INPUT). | DEFERRED: AI-ввод обязателен для запуска, но в очередь возвращается решением PO. Следующее — контракты S17–S20. |
| **#76** Чувствительность к расстоянию | В ранжировании учитывать, что за обычными огурцами не поедут далеко, а за редким осьминогом — поедут; не жёсткий фильтр. | Ничего. Явные сортировки и «Рядом» поставлены. | Модель чувствительности (гипотеза Issue) и влияние на ranking (B-DISTANCE). | GATED: после данных D0/D1. В Issue устарело «жёсткое ограничение остаётся отдельным фильтром» — радиус и цена от–до сняты в Search Sorting Rev 3. |
| **#79** Price Intelligence | Сравнить цену с рынком Алматы: покупателю «выгодно ли», продавцу «дорого ли я продаю»; median, когорты, защита от выбросов. | Ничего. Нужные основы: разрешение Product (S15B), цена и единица в Offer. | Вся функция (B-PRICE-INTEL). Весь Issue (§1–§32) прочитан и сверен. Не входит в MVP: ранжирование по цене, прогноз цен, автоматическое переустановление цен, рекомендации продавцу, оповещения о конкурентах, аналитика 7/30/90 дней, монетизационные ограничения; этап 2 — перцентили P25–P75, история и график, тренд, оповещения; этап 3 — исследование участия цены в ranking совместно с #76. Production-данные — только в КЗ (residency); краулер и исследовательский контур остаются в `kaida-product-corpus`, не в приложении. 15 открытых вопросов Issue (минимальное число независимых продавцов, иерархия когорт, ключевые атрибуты по категориям, учёт бренда, определение сети филиалов, политика выбросов, порог свежести, взвешивание продавцов, единицы MVP, инвалидация кэшей версией KB, объём хранения, Free против Paid, районные когорты, объяснение расширенной когорты, скидки/акции) закрываются отдельным решением до реализации. | GATED: сопоставимые единицы/фасовка и накопленные актуальные цены; не в ranking на MVP. |
| **#83** Security automation | Triggered tools: Trivy/Hadolint, Syft/SBOM, SLSA, custom Semgrep, OSV. | Baseline CodeQL/Dependency Review/Scorecard; local Trivy/Hadolint completed for R3 with recorded findings and isolated-local exceptions. | Further CI automation and remaining tools under their triggers (O-SEC-AUTO). | GATED; further implementation needs a separate PO decision. No Issue content is changed by closure. |
| **#116** CI-сбой миграционных тестов | Перемежающаяся ошибка «still has active connections» в интеграционном шаге, лечится повторным запуском. | Тест-харнес есть; причина не найдена. | Классификация и исправление (O-CI-FLAKE). Повторения этой ошибки среди 8 красных запусков после 2026-10-06 не найдено (причины там E2E, разные) — это не доказательство исправления. | UNSCHEDULED, DOCUMENTED (решение PO: Development вне R3): решение PO о постановке; правило триажа сбоев — `PROJECT_RULES.md` §7–§8. |

## 4. Решения PO, которых ждёт план

Ничего из этого не блокирует утверждённый порядок и не принимается молча.

| Вопрос | ID | Что нужно решить |
|---|---|---|
| Настоящая аутентификация и доставка OTP | O-AUTH | Способ входа для реальных пользователей; SMS-провайдер (платная инфраструктура отложена). |
| Повторная отправка OTP и таймер | O-OTP-RESEND | CLOSED: accepted local test-delivery implementation at v0.0.74-auth-otp-protection; real delivery remains separate. |
| Защита от злоупотреблений | O-ABUSE | Phone-based login scope approved; broader abuse scope and timing remain undecided. |
| Юридические тексты | O-LEGAL | Политика, согласие рядом с отправкой, раздел об ответственности; кто даёт текст. |
| Пилот | O-PILOT | Режим доступа (по приглашениям / SMS / Telegram-бот), язык пилота, размер, роль оператора. |
| Название товара из каталога на языке покупателя | B-CATNAME-LOCALE | Поставить отдельным slice, снять или переформулировать (Feature Map обещал «внутри S15B», S15B закрыт, обещание не поставлено). |
| Оповещение оператору о карточке вне каталога | B-FREETITLE-ALERT | Feature Map говорит «входит в stage 10», план — «pilot-функция, не добавлять». Кто получает и каким каналом — решает контракт. |
| Постановка в порядок кандидатов | раздел 5 | Любой UNSCHEDULED получает место в порядке только решением PO. |

## 5. Workstreams и задачи

102 remaining tasks plus the retained Q-R3 CLOSED marker: 103 indexed rows (102 previous register records plus B-MARKET-TEXT), with 33 previously archived IDs, 136 total IDs. Q-R3 remains here as a closure marker until the next register/archive maintenance; it is outside the active queue.

Исторические номера stages: 7 = S-AI-INPUT, 8 = S-AI-MOD, 9 = B-INTEREST-FEED (S14), 10C = M-D1/M-D2, 11 = S-OPERATOR + M-READINESS, 11A–11C = K-PLANNING, 12 = K-COMMERCIAL / K-BOOST / K-BUSINESS / K-BACKOFFICE; они не задают очерёдность. Колонки: **Задача** (что и зачем, с главными ограничениями) · **Вид · Состояние** · **Основание требования** · **Зависимости и условия готовности** (формулировки источников) · **Следующее действие**. Полные формулировки ограничений и коды источников — `REQUIREMENTS_REGISTER.md`.

### 5.1 Развёртывание и среда

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| Q-R3 | R3 reproducible deployment preparation without hosting; approved scope completed. | Dev / CLOSED (closure marker) | DECIDED / PO acceptance 2026-10-09; SL:r3-deployment-preparation/SLICE_CONTRACT.md | PR #163, green merged-main CI, v0.0.73-r3-deployment-preparation; security exceptions remain isolated-local-only. | No new task authorized. Next candidate requires PO decision; hosting/public-launch gates remain. |
| O-LIMITS | Границы приёмки R1/R2: проверено только на Windows/Git Bash; backup содержит ПД и сессии; нагрузка записи и переносы между версиями не проверены; backup держится на неизменяемости фото; `pnpm build` на слабой машине нестабилен. Формулировка — `CURRENT_STATE.md`. | Ops · GATED · LIMIT | DECIDED · CS:constraints; OB; LB; SL:backup-restore; SL:local-bootstrap-verification | Всплывёт при R3/развёртывании и хранении backup вне машины | Учесть в контракте R3. |
| O-PAID-INFRA | Любая платная инфраструктура: хостинг, GPU, SMS-провайдер. Core-сценарии обязаны работать без платных внешних SaaS (`PROJECT_RULES.md` §10.1). Кандидаты и оценки (R-AI-HOSTING, O-AUTH) — справочно. | Ops · DEFERRED | DECIDED · EP:п.6; CS; ATT:4cd8274f | Отложено решением PO; условие возврата — решение PO. Кандидаты и оценки (R-AI-HOSTING, O-AUTH) — только справочно | Нет, пока PO не решит. |
| O-D0-ORG | Включать `SEARCH_EVENTS_ORIGIN=organic` только после того, как ежедневный `pnpm search-events:purge` запланирован и проверен. Отдельная Ops-задача, в R3 не входит автоматически. Сейчас purge — CLI без расписания; механизм расписания определит контракт (Q-SCHEDULER). | Ops · GATED | DECIDED · CS; EP:п.7; SL:s15c-d0-search-demand-events | Решение PO: отдельная Operations-задача, не входит в R3 автоматически. Gate: решение включить organic-запись И наличие среды, где можно задать расписание | Нет; поднимается при выборе среды. |
| O-ADDR-IMPORT | Импорт и еженедельное обновление справочника адресов (OSM) в рабочей среде; справочник поставлен (v0.0.44). Ручной ввод адреса остаётся полноценным путём; ODbL/attribution входят в приёмку контракта. | Ops · UNSCHEDULED | DOCUMENTED · ATT:db682e64; SL:address-directory; FM:KAIDA address directory · ВНИМАНИЕ: оценка «не блокер малого пилота» — оценка агента | Среда развёртывания; график и стоимость импорта не проверялись (оценка агента: не блокер малого пилота). | Решение PO вместе с выбором среды. |
| O-TRANSL | Подключение переводчика комментариев (server-side LLM; `SELLER_COMMENT_TRANSLATOR=off` сейчас). Провайдер — улучшение поверх рабочего пути; данные вне КЗ — ограничение residency. | Ops · GATED | DECIDED · FM:localization,Translator deferred; SL:seller-comment-translation | Рядом с MVP, при переезде на собственный сервер (SELLER_COMMENT_TRANSLATOR=off) | Нет. |
| O-SEC-AUTO | Security automation (#83): Trivy/Hadolint, Syft/SBOM, SLSA, custom Semgrep and OSV retain their own triggers and security stops. | Ops / GATED | DECIDED / IO:#83; SA; PO R3 local scans 2026-10-09 | Dockerfile trigger reached in R3; local Trivy/Hadolint performed and assessed. No CI automation added; remaining tools retain their future triggers. | Separate PO decision for further automation/deploy/release; local exceptions do not authorize deployment. |
| O-MONITORING | Базовое журналирование ошибок и мониторинг; наблюдаемость сбоев перевода и битых внешних контактных ссылок. Предложение агента («полезно, не блокер малого пилота»), не утверждено; не проверено, что уже есть в коде. Наблюдаемость переводов и контактных ссылок — пункт P1 удалённой UX_NAVIGATION_STATE_SPEC §6 (история Git). | Ops · UNSCHEDULED | RECOMMENDED · ATT:db682e64; GH:UX_NAVIGATION_STATE_SPEC §6 P1 | Предложение агента (не утверждено PO): «полезно, не блокер малого пилота»; нужна среда развёртывания. Наблюдаемость переводов/контактных ссылок — пункт P1 удалённой спецификации (история Git) | Решение PO. |
| O-SEED-ORDER | Seed после импорта Production KB падает на `products_name_unique`; верная последовательность: миграции → seed → импорт KB. Известное ограничение. | Dev · UNSCHEDULED · LIMIT | DOCUMENTED · CS | Известное ограничение; последовательность: миграции → seed → импорт KB | Решение PO, если мешает R3. |

### 5.2 Допуск реальных пользователей (launch gate)

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| O-LAUNCH | Публичный запуск. Условие: AI-ввод (S17–S20) готов; AI-модерация условием не является. Нужны отдельные решения PO — O-AUTH, O-ABUSE, O-LEGAL, O-PILOT. Ручной путь работает при недоступном AI (`PROJECT_RULES.md` §10.1); ручные требования модерации сохраняются. Других условий запуска не выводилось. | Ops · GATED | DECIDED · FM:AI-first п.12; EP:п.6,п.8; CS:constraints; PR:§10.1,§16; AUD; RD:Авторизация и public launch | S-AI-INPUT; решения раздела 4. | Нет; зависит от решений раздела 4. |
| O-AUTH | Настоящая аутентификация и доставка OTP (S22), SMS-провайдер. Test OTP не production-ready. Требования определяют launch-контракты. | Dev · NEEDS-DECISION | DOCUMENTED · FM:S22; EP:п.6,п.8; PR:§16; UXR:spot-check | Платная инфраструктура отложена; delivery, abuse/rate-limit, секреты и Secure-cookie проверяют отдельные launch-контракты. | Решение PO (раздел 4). |
| O-OTP-RESEND | Resend/timer and server-enforced request/failed-code limits; local test delivery only. | Dev · CLOSED | DECIDED · PO; SL:auth-otp-protection; SL:S2-auth | Manual acceptance PASS; PR #166 merged, branch/main CI green; v0.0.74-auth-otp-protection. | No further local work authorized; real delivery/broader abuse need separate PO decisions. |
| O-OTP-AUTOFILL | Автоподстановка OTP; не имитировать будущий SMS-сценарий. | Dev · GATED | DOCUMENTED · UXD:§7 | Проверять вместе с реальным способом авторизации (O-AUTH) | Нет. |
| O-ABUSE | Source-wide local login OTP protection approved; broader abuse remains separate. | Dev · SCHEDULED | DOCUMENTED · EP:п.8; PR:§16 | Real-user protection and production trust/retention decisions remain separate; local slice contract approved. | Implement approved auth-otp-source-protection only; no broader abuse authorization. |
| O-LEGAL | Юридические тексты: политика, согласие рядом с отправкой, раздел об ответственности (Privacy/ToS в приложении нет). Пока AI недоступен — информационный текст об ответственности продавца при каждой публикации/правке (RV §3.1). Не придумывать юридические обещания. | Ops · NEEDS-DECISION | DOCUMENTED · EP:п.8; UXR:consent GAP; FM:AI-first п.5 | Решение PO; delivery, abuse, секреты, Secure-cookie проверяются отдельно. | Решение PO. |
| O-PILOT | Объём пилота, allowlist, операторская доставка OTP и прочие pilot-функции. Вопросы агента (не решения): режим доступа, язык пилота, юридический текст, размер, роль оператора. | Ops · NEEDS-DECISION | DOCUMENTED · EP:п.8; GS · ВНИМАНИЕ: вопросы о режиме доступа, языке, юридическом тексте, размере и роли оператора — вопросы агента, не решения | Отдельные решения PO. | Решение PO. |
| O-PRELAUNCH-COPY | Убрать или скрыть до запуска служебное: «Предложения и цены в этой версии вымышлены», тестовый код в окне входа, отключённые AI-пункты. Не создавать видимость работающего AI. | Dev · GATED | RECOMMENDED · UXA:§5; UXA:§2.1 | Привязано к решению о запуске (O-LAUNCH, O-AUTH); не отдельное требование раньше | Нет. |

### 5.3 Ввод продавца и AI

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| S-AI-INPUT | AI Input S17–S20 (текст, голос, фото, видео → Seller Change Set, правила #75). Обязателен для запуска, но отложен. AI не пишет Offer напрямую; raw input неизменяем; Product ≠ Offer; без выдумывания; ручной путь работает без AI; провайдеры вне КЗ непригодны для production. Хранение исходных медиа (BR §8.6) PO не утверждено. | Dev · DEFERRED | DECIDED · FM:S17–S20,AI Input; EP:п.6; IO:#75; BR:§21–22; AT | Условие возврата в очередь — решение PO. | Решение PO о старте; затем контракты S17–S20. |
| S-AI-MOD | S32: AI-модерация новых карточек и правок. Не условие запуска; ручные требования модерации сохраняются, публикация без модерации не разрешена. Целевая модель — Feature Map п.5. | Dev · DEFERRED | DECIDED · FM:S32,AI-first п.5; EP:п.6; BR:§21.12 | Решение PO; зависит от S-AI-INPUT. | Нет. |
| R-AI-HOSTING | Кандидаты хостинга и локального AI-рантайма и внутренний benchmark на 150–300 сообщениях продавцов. Цены и характеристики со слов внешнего чата, не проверены; не решение. Серверная валидация обязательна. | Research · GATED | RECOMMENDED · ATT:4cd8274f; AT | Платная инфраструктура отложена; возврат при старте AI-ввода/деплоя. | Нет. |
| B-SEMANTIC | Семантическое разрешение Product / AI-кандидаты (EmbeddingGemma, Jev, Liquid, Qwen-class). Обязательный evaluation gate: сравнение с deterministic baseline на RU/KK/смешанном корпусе; Jev — только на синтетике (residency); лицензия LFM ограничена по выручке. | Research · GATED | RECOMMENDED · AT; FM:Search System target; SS:§26 | Триггеры пересмотра: старт S17–S20, Search slice с явной потребностью в semantic resolution, мультимодальный seller input, работа по #75, production-server AI benchmark | Нет. |
| S-TG-CHANNEL | S21: Telegram как канал seller input (та же логика ввода). | Dev · GATED | DOCUMENTED · FM:S21 | После S-AI-INPUT / MVP | Нет. |
| S-MANUAL-STEP | Ручной ввод при отложенном AI: лишний шаг выбора способа ввода. Нужна ревизия принятого решения (неактивные AI-методы приняты сознательно). Не создавать видимость работающего AI. | Dev · UNSCHEDULED | RECOMMENDED · UXD:§4.4; FM:AI-first п.1–2; UXA:§2.1 | Нужна явная ревизия принятого решения (неактивные AI-методы приняты сознательно) | Решение PO. |

### 5.4 Кабинет продавца, доверие и операции

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| S-ACTUALITY-WORDS | Слова актуальности: «Товар есть, цена та же» как название действия; «Всё актуально» одним тапом с главного экрана (механику 2/7/14 не менять; критерий обзора — секунды в день на подтверждение). Не проверено, что уже в интерфейсе. | Dev · UNSCHEDULED | RECOMMENDED · UXA:§2.4 | Не проверено, что уже в интерфейсе; изменение формулировок закрытых slices | Решение PO. |
| S-FORM-SIMPL | Упрощение форм продавца: одно имя вместо двух на первом экране; понятный тип точки; подпись «Заполнить вручную · 2GIS · Google Maps · Яндекс Карты»; единый паттерн действий карточки; пакетное добавление как таблица на desktop. Пустые черновики автоудалять нельзя (риск потери данных). | Dev · UNSCHEDULED | RECOMMENDED · UXA:§2.5–2.9 | Нужны кадры/решения PO; затрагивает закрытые contracts; desktop — в последнюю очередь (B-DESKTOP) | Решение PO. |
| S-CONTACT-DEFAULT | Контакты точки «по умолчанию» (показать мой номер, подтянуть номер входа, проверка номера). Расширение point-contacts-hours; номер входа и скопированные контакты повторно не проверяются. | Dev · UNSCHEDULED | DOCUMENTED · HO29:§5; EP:insertion | Расширение point-contacts-hours; без кадра и контракта | Решение PO. |
| S-TG-CONTACT | Telegram/Instagram-контакт точки через бот KAIDA, привязка к стабильному ID аккаунта (смена username не ломает контакт). Контракт: «отдельный шаг до запуска». Сейчас значения лежат в БД и не показываются, а в главном описании сервиса Telegram всё ещё упомянут (F8). | Dev · UNSCHEDULED | DOCUMENTED · SL:point-contacts-hours; FM:AI-first п.7; CODE:i18n | Контракт point-contacts-hours: «отдельный шаг до запуска»; макет S13: привязка к стабильному ID аккаунта — смена username не ломает контакт; требует внешнего бота и публичного адреса — ср. O-LAUNCH | Решение PO. |
| B-TG-PROMISE | Малая коррекция: убрать знак Telegram из демо First Entry и неиспользуемый ключ `home.description`. Контракт контактов не менять; подключение Telegram — отдельно (S-TG-CONTACT). | Dev · UNSCHEDULED | DECIDED (регистрация одобрена PO как несрочная коррекция) · UXA:§4.1; SL:point-contacts-hours; CODE:FirstEntryScreen | Прямая команда PO; демо принято PO как иллюстрация. | Ждать команды PO. |
| S-NOTIF-INBOX | Уведомления продавца (inbox): обработка, модерация, актуальность, жалобы, апелляции; входы в «Ещё». Частично поставлены напоминания об актуальности (browser push, v0.0.36). | Dev · UNSCHEDULED | DOCUMENTED · BR:§7.1,§4.1; RV:§3.1 | Частично поставлено: напоминания об актуальности (browser push + блок в приложении, v0.0.36); остальные события зависят от S-AI-INPUT, S-AI-MOD, S-REVIEWS, S-ARCHIVE | Решение PO. |
| S-REMOVAL-NOTIFY | Уведомить продавца о снятии карточки оператором (inbox, push, колокол; AI-S18 в макете). | Dev · UNSCHEDULED | DOCUMENTED · SL:operator-post-check | Вне этапа 1; нужен канал уведомлений | Решение PO. |
| S-ARCHIVE | Архив карточек: раздел архива с датой переноса и остатком срока, восстановление, исчезновение через 30 дней, ручное «Удалить». Сейчас есть только стадия актуальности `archived` (≥ 336 ч). Открытые вопросы — реестр. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; SJ; BR:§11,§12,§22; DM:§1.2; FM:cross-cutting; CODE:actuality.ts; MK:S15,S17 | Server jobs; пересмотр R2 (фото неизменяемы) и политики хранения. | Решение PO. |
| S-REVIEWS | Отзывы, рейтинг, жалоба на карточку целиком (решение PO). Не показывать fake rating/reviews. Нужны identity, antifraud, privacy, evidence, audit и moderator contracts; предложения брифа дизайнеру не утверждены. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; FM:AI-first п.9; BR:§14,§21.15; SL:UX1A-app-shell | Триггер для вопроса PO: утверждён trust use case, antifraud и moderation semantics | Решение PO. |
| S-CATEGORIES | Группировка товаров продавца по категориям на «Моей витрине» (#54). | Dev · UNSCHEDULED | DOCUMENTED · IO:#54; FM:Backlog capabilities | Триггер для вопроса PO: у продавцов много карточек. Решить: чьи категории, видит ли покупатель, связь с каталогом и свободными названиями, предлагает ли ИИ | Решение PO (чьи категории и т.д. — раздел 3). |
| S-VIDEO | M2: публичное видео предложения (до 5 фото + 1 видео). Исходное видео для AI приватно и не подставляется в публичное. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; FM:Media; BR | Триггер для вопроса PO: видео нужно покупателю, а не только как вход для ИИ | Решение PO. |
| S-PHOTO-CLEANUP | Очистка неприкреплённых фото; CDN. Правило R2 «фото неизменяемы и не удаляются»: любой slice удаления/замены фото сначала пересматривает R2. Диск растёт до очистки — записано, не решено. | Dev · UNSCHEDULED | DOCUMENTED · SL:offer-photos (§5); CS:R2 | ВАЖНО: правило R2 «фото неизменяемы и не удаляются» — любой slice удаления/замены фото сначала пересматривает R2 | Решение PO. |
| S-PERF | S33: статистика продавца (просмотры, открытия, маршрут, контакты; Pro-разрезы). Proxy-действие не называть продажей. | Dev · UNSCHEDULED | DOCUMENTED · FM:S33; UXD:§7; CM:§8; UXA:§4.9 | Отдельные события, privacy и определения метрик; часть Pro | Решение PO. |
| S-OPERATOR | S16: остаток Operations после этапа 1, MVP boundary review и Demand readiness assessment. Блокировки продавца целиком нет (S-BLOCK-SELLER). Предложение агента (не требование): оценить достаточность ручной модерации на ожидаемом объёме. | Dev · UNSCHEDULED | DOCUMENTED · FM:S16,MVP boundary; EP:stage 11; BR:§10 · ВНИМАНИЕ: проверка достаточности ручной модерации — предложение агента, не требование | MVP boundary review после committed core contour; Demand readiness assessment не обязан блокировать MVP | Решение PO. |
| S-BLOCK-SELLER | Блокировка продавца целиком оператором (сейчас только снятие карточки). Предложение агента; не блокер малого пилота. | Dev · UNSCHEDULED | RECOMMENDED · ATT:db682e64; SL:operator-post-check | Предложение агента (не утверждено PO); Backoffice Seller operations или S-OPERATOR | Решение PO. |
| B-CATNAME-LOCALE | Название товара из каталога на языке покупателя для карточки, привязанной к каталогу. Нужно решение: поставить отдельным slice, снять или переформулировать. | Dev · NEEDS-DECISION | DECIDED · FM:AI-first п.10 (решение PO 2026-09-29); CODE:buyer-offer-projection | Feature Map: «вводится внутри S15B». S15B закрыт; проекция показывает слова продавца на всех языках (комментарий в коде) — требование не поставлено | Решение PO (раздел 4). |
| B-FREETITLE-ALERT | Оповещение оператору о карточке, не привязанной к каталогу. До решения карточки видны в ленте пост-проверки; кто получает и каким каналом — решает Slice Contract. | Dev · NEEDS-DECISION | DECIDED · FM:AI-first п.10 (решение PO 2026-09-29); EP:п.8; CS:constraints | Feature Map: «входит в stage 10»; EP п.8 и CS: оповещения о free-title — pilot-функция, не добавлять без решения PO. До решения карточки видны в ленте пост-проверки оператора | Решение PO (раздел 4). |

### 5.5 Рынки и адреса

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| B-MARKET-NAV | Навигация внутри рынков (#10): справочник рынков → SVG-схема → `MarketPlace` → привязка точки, позже маршрут от входа. Схемы ведёт KAIDA; рынок не центр архитектуры; #10 не делится. Реализация не авторизована. Подробности — Issue #10. | Dev · UNSCHEDULED | DOCUMENTED · IO:#10; EP:insertion; FM:Market navigation; AUD:Проблема №4 | Справочник рынков, устойчивые ID мест, управление (Backoffice); триггер — пилот показывает нехватку маршрута. | Решение PO. |
| B-MARKET-TEXT | Описание места внутри выбранного рынка в карточке точки до схем (комментарий PO к #10, 2026-10-08): рынок из справочника + необязательные павильон/сектор, ряд, место, ориентир; принадлежит точке; не приравнивать к проверенному `MarketPlace`. Если нужны изменения закрытых контрактов — СТОП и отдельный Slice Contract. | Dev · UNSCHEDULED | DECIDED · IO:#10 (комментарий PO 2026-10-08: «planned requirement only. Not scheduled») | Справочник рынков; текущее покрытие — V-MARKET-TEXT. | Решение PO о постановке; при необходимости изменить закрытые контракты — СТОП и отдельный Slice Contract. |

### 5.6 Поиск покупателя

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| B-FILTERS | Дополнительные фильтры (радиус, диапазон цены, тип точки, фото/контакты, rating). Радиус, цена от–до, «Фильтры» и sort=cheaper сняты Rev 3; не добавлять без нового решения PO. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; IC:#12; BJ; SL:buyer-screens-mockup | Триггер для вопроса PO: конкретный filter use case и data/usefulness-основа | Решение PO. |
| B-CHIPS | Динамические популярные canonical-Product чипы (≤5, curated fallback), бывшая 6G. Сырые и unresolved запросы чипами не становятся. | Dev · GATED | DECIDED · EP:register 6G; FM:Search learning; GS:G5 | Readiness-gate: достаточные проверенные D0/D1 данные; числовой порог не задан | Нет. |
| B-LIVE-HOME | Живой главный экран: выдача сразу на Search Home (ближайшее при геолокации, иначе популярное). Поставлено: Search Home и curated-чипы (v0.0.49), D0 (v0.0.61), «Может, вы искали…» (v0.0.70). Кнопка поиска: PO решил «только → в поле». Правила хранения и приватность запросов уже действуют в D0. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; HO29:§5 | Частично поставлено: Search Home и curated-чипы (v0.0.49), D0-события (v0.0.61), «Может, вы искали…» (typo, v0.0.70). Остаток — выдача на главной и популярное; зависит от B-CHIPS | Решение PO. |
| B-SIMILAR | Похожие товары при неизвестном запросе («Посмотреть похожие товары», блок «Похожие предложения»). В UI не найдено; не проверено по коду. Не смешивать визуально fallback по словам с каталожной выдачей; никакой semantic/AI-интерпретации в fallback; не выдавать технический 404 для нормального zero-result. | Dev · UNSCHEDULED | DOCUMENTED · SS:§2,§8,§17.3–17.4 | В UI-строках не найдено (поиск по messages.ts: «похож»/«similar»); поведение в коде не проверялось; исправление опечатки (v0.0.70) и пустые состояния (v0.0.69) — другие механизмы | Решение PO. |
| B-WORDFORMS-EXT | Расширение словаря словоформ (колбаса, печенье, джем, халва, манты, ирга, калина …). Предложенная политика (не принята): потолок 500 слов, операторская команда предложения, проверка через PR; изменение словаря — только PR с воспроизводимо пересозданным файлом; семантических расширений нет. | Dev · DEFERRED | DECIDED · SL:search-word-forms (§4,§12); ATT:758416a0 · ВНИМАНИЕ: политика потолка 500 слов — предложение, не принято | Расширение отложено решением PO; условие возврата — реальные названия продавцов и решение PO | Нет. |
| B-KK-MORPH | Морфология казахского для поиска (вне scope word forms и typo; Kazakh остаётся на прежнем пути). | Dev · UNSCHEDULED | DOCUMENTED · SL:search-word-forms (§Вне scope); SL:search-typo-suggestions | Вне scope word forms и typo; Kazakh остаётся на прежнем пути | Решение PO. |
| B-FUZZY-SUGGEST | Подсказки каталога при вводе с учётом опечаток (fuzzy, trigram). Принятое автоисправление v0.0.70 работает при нуле результатов и подсказки не заменяет; расширение — отдельным решением PO. | Dev · UNSCHEDULED | DOCUMENTED · SS:§6,§21 | Решение PO сверх объёма v0.0.70. | Решение PO. |
| B-TYPO-KK | Исправление казахской орфографии и замен согласных у слов из 5–7 букв (в v0.0.70 не поддерживается; охват RU, слова с казахскими буквами не исправляются; fuzzy-расширения сверх принятого — только отдельным решением PO). | Dev · UNSCHEDULED | DOCUMENTED · SL:search-typo-suggestions (§H); CS | Не поддерживается в v0.0.70; fuzzy-расширения сверх принятого — только отдельным решением PO | Решение PO. |
| B-TYPO-MEAS | Парный замер задержки автоисправления на данных до границы словаря (критерий «добавка p95 ≤ 150 мс» полностью не подтверждён; «0 ложных исправлений» ограничено документированными корпусами). Без изменений production-кода. | Research · UNSCHEDULED · FOLLOW-UP | DOCUMENTED · SL:search-typo-suggestions (§8); CS | Записано как ограничение: критерий «добавка p95 ≤ 150 мс» полностью не подтверждён; «0 ложных исправлений» ограничено документированными корпусами | Решение PO. |
| B-DISTANCE | Чувствительность товара/категории к расстоянию в ranking (#76). Не влияет скрыто под явными сортировками; не жёсткий фильтр (редкий товар в 17 км показывается); модель — гипотеза Issue. | Dev · GATED | DOCUMENTED · IO:#76; FM:Backlog capabilities | После S15B + данные D0/D1 | Нет. |
| B-SEARCH-ENGINE | Оценка и выбор поискового движка. Не вводить vector DB / внешний semantic SaaS без измеренной потребности. | Research · DEFERRED | DECIDED · EP:п.6; CS | Отложено решением PO; условие возврата — отдельное решение PO | Нет. |
| B-BUYER-LOC | Ручной выбор местоположения покупателя; геолокация — только по действию пользователя. | Dev · UNSCHEDULED | RECOMMENDED · UXD:§7; UXA:§1,§4.2 | Нет места | Решение PO. |

### 5.7 Экраны и опыт покупателя

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| B-MORE-MY | Вкладка «Ещё» → «Моё/Профиль»: Избранное, Вход, Язык, «Я продаю». Предложение экспертного обзора, не решение PO; меняет IA и закрытые контракты. Избранное Offer — отдельная возможность (B-FAV-OFFER); интерес к Product ≠ избранное Offer. | Dev · UNSCHEDULED | RECOMMENDED · UXA:§1,§6.1 | Предложение экспертного UX-обзора, не решение PO. Меняет IA покупателя и затрагивает закрытые контракты (inline-язык, «Ещё»); нужны кадр и контракт | Решение PO. |
| B-NEARBY-DEADENDS | «Рядом»: тупики — как включить геолокацию, ручной выбор района/рынка, «Искать по названию». Экспертное мнение по скриншотам; не гарантирует поведение покупателей. | Dev · UNSCHEDULED | RECOMMENDED · UXA:§1,§4.2; UXD:§7 · ВНИМАНИЕ: экспертное мнение по скриншотам | Ручной выбор места — самостоятельный сценарий с влиянием на Search/Nearby (B-BUYER-LOC); автозапуск «Рядом» по тапу — по коду, кликом не проверялось | Решение PO. |
| B-HOME-APPETITE | Search Home: круглые фото в чипах; полоса «Свежее сегодня» (гипотеза); заглушка по категориям; сжатая шапка. Не добавлять иконки/иллюстрации скрыто. | Dev · UNSCHEDULED | RECOMMENDED · UXA:§5 | Нужны кадры и иллюстрации/фото; «Свежее сегодня» — гипотеза, отмеченная в обзоре как открытый вопрос; чипы из реально существующих предложений — B-CHIPS | Решение PO. |
| B-READABILITY | Читаемость второстепенного текста: подписи 12 px серым → 13–14 px и темнее; проверка на реальном телефоне (вывод «всё по 12 px» неверен). | Dev · UNSCHEDULED | RECOMMENDED · UXA:§5; UXD:§4.5 | Проверка на реальном телефоне — уже стандартная верификация UI-slice (EP); конкретный slice не назначен | Решение PO. |
| B-RESULTS-META | Счётчик результатов в обычном поиске; «обновлено X ч назад» (гипотеза). Подтверждение актуальности ≠ доказательство свежести товара. | Dev · UNSCHEDULED | RECOMMENDED · UXA:§4.3–4.4,§7 | Гипотезы обзора; в «Рядом» счётчик есть | Решение PO. |
| B-UNIFY-SEARCH | Унифицировать точки входа поиска (HeaderSearch vs SearchForm), не меняя закрытую семантику. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; UXR:spot-check №4 | Нет места; триггера нет | Решение PO. |
| B-FAV-OFFER | Избранное Offer; отслеживание наличия (= D2); уведомления (= B-NOTIFY). Интерес к Product ≠ избранное Offer. | Dev · UNSCHEDULED | DOCUMENTED · UXD:§7; HO29:§5; BJ · ВНИМАНИЕ: часть источников — экспертный обзор UX (UXD) | Отслеживание наличия = D2; уведомления = B-NOTIFY; «где смотреть избранное» — вопрос без кадра | Решение PO. |
| B-UX-INTERESTS | Обнаруживаемость существующих интересов покупателя; семантика интересов сохраняется (не избранное, без уведомлений). | Dev · UNSCHEDULED | RECOMMENDED · UXD:§4.5; UXA:§1 | Нет места | Решение PO. |
| B-ILLUS | Иллюстрации и тексты остальных пустых состояний (первая витрина, нет черновиков, пустой архив, ошибка загрузки). Превью, RU/KK-тексты и размеры утверждает PO; без пустой корзины и грустных лиц. Пустой поиск поставлен (v0.0.69). | Dev · UNSCHEDULED | RECOMMENDED · UXD:§5 | Состояния пустого поиска поставлены (v0.0.69); не проверено, что из остального уже есть в интерфейсе | Решение PO. |
| B-PROMO | Промо-баннер над строкой поиска (акции, новинки). Вёрстка покупателя не должна мешать вставке. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; FM:cross-cutting; SL:buyer-screens-mockup | Нужны кадр дизайнера, владелец содержимого (оператор), правила маркировки рекламы, связь с Boost (S28–S29) | Решение PO. |
| B-FE-OPEN | First Entry: недавние запросы на повторном визите, финальный слоган (мобильная часть поставлена: v0.0.38, v0.0.48). | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; HO29:§5 | Нет места | Решение PO. |
| B-THEME | Тёмная/светлая тема (переключатель в «Ещё»). Палитру агент не придумывает. | Dev · UNSCHEDULED | DOCUMENTED · EP:insertion; HO29:§5 | Нужны тёмные токены и кадры дизайнера | Решение PO. |
| B-DESKTOP | Desktop ≥ 1280 (First Entry, hero/sidebar), масштабная переделка навигации. PO: desktop и казахская вычитка — в последнюю очередь; граница доставки — mobile + RU. | Dev · DEFERRED | DECIDED · EP:insertion; HO29:§5; UXD:§7; MEM | PO: desktop и казахская вычитка — в последнюю очередь; условие возврата — решение PO | Нет. |

### 5.8 Discovery и уведомления покупателя

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| B-INTEREST-FEED | S14: лента «Для вас» по явным интересам покупателя. Без скрытого профилирования; интерес к Product ≠ избранное Offer ≠ уведомления. | Dev · UNSCHEDULED | DOCUMENTED · FM:S14; BJ; SS | Зависимости S7, S13 закрыты; место в порядке не назначено (committed stage в Feature Map) | Решение PO о месте. |
| B-NOTIFY | S23: уведомление покупателю о новом Offer по интересу. Не обещать внешние уведомления до отдельного канал-slice. | Dev · GATED | DOCUMENTED · FM:S23; BJ; GS:G6 | Ждёт B-INTEREST-FEED и политики уведомлений; внешний канал доставки (push в браузере есть только для напоминаний продавцу) | Нет. |
| B-RECS | S24/S30/S31: рекомендации (детерминированный feed без ML), behavioral ranking, влияние редкости. | Dev · GATED | DOCUMENTED · FM:S24,S30,S31; SS:§26 | B-INTEREST-FEED + накопленные данные | Нет. |

### 5.9 Каталог и знания о товарах

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| C-OPS | Контролируемая эволюция каталога: query → анализ → controlled Product/alias/Category change; безопасное создание Product из free-title (NEW_PRODUCT_CANDIDATE, moderator-assisted). Запрос никогда не создаёт Product автоматически. Не проверено, как сейчас добавляется Product вне импортёра. | Dev · GATED | DOCUMENTED · FM:Search learning; BR:§21.7; IO:#75; BO:§4; SS:§11 | Backoffice Catalog Operations (K-BACKOFFICE) после 11A–11C; сейчас — импортёр и PR | Нет. |
| C-REVIEW105 | 105 кандидатов REVIEW стартового каталога не импортированы (82 GRANULARITY_REVIEW, 23 KK_REVIEW); вне экспорта также 77 PROVISIONAL_AI и 4 PROVISIONAL_USER. Нельзя молча импортировать REVIEW. | Dev · UNSCHEDULED | DOCUMENTED · EP:S15A(hist); FM:Initial Product Catalog; XLS; SL:production-kb-importer | Плана нет; рост каталога — через C-OPS. | Решение PO. |
| C-PARENT-HIERARCHY | Иерархия Product (`parent_product_id`) вынесена из Export v1; вернуть отдельным slice, когда появится пользовательская задача. Атрибутные определения (WORKING_I3) тоже не в v1 (относятся к будущей системе атрибутов Offer). | Dev · UNSCHEDULED | DOCUMENTED · ATT:88d883b1; KBC; CORP:docs/production_kb_export_v1.md | Вернуть отдельным slice, когда появится конкретная пользовательская задача; первый импортёр иерархию как downstream contract не использует | Решение PO. |
| C-OFFICIAL-CROSSWALK | Слой сопоставления Product ↔ официальные классификаторы (КПВЭД и др.) в kaida-product-corpus; не онтология KAIDA, merge корпуса — по отдельному разрешению. | Research · UNSCHEDULED | DOCUMENTED · ATT:610671e5; XLS:Sources; CORP:docs/official_source_reconciliation.md | Отдельный слой в репозитории kaida-product-corpus; не меняет семантику Product KB | Решение PO. |
| C-KB-V2 | Будущий KB export v2 без смены Product ID; версия сборки отдельно от schema version. | Dev · UNSCHEDULED | DOCUMENTED · ATT:25bbed34 | Нет плана; нужен внешний репозиторий kaida-product-corpus | Решение PO. |
| C-CORPUS-LOOP | Цикл разбора unresolved-названий в kaida-product-corpus (12 877 названий; решения append-only). Неизвестные названия не создают глобальных Products; PROVISIONAL_* не approved. | Ops · UNSCHEDULED | DOCUMENTED · ATT:610671e5; ATT:88d883b1 | Внешний репозиторий; связан с C-OPS. | Решение PO. |
| O-CORPUS-BACKUP | Корпус наблюдений (`data/raw`, `data/extracted/observations.csv`) не хранится в Git корпуса — только локально; резервирование не запланировано. Не путать с backup R2. | Ops · UNSCHEDULED · LIMIT | DOCUMENTED · CORP:README | README корпуса: «A GitHub checkout alone does not contain the current data/raw pages or the full local observations history» | Решение PO. |

### 5.10 Demand, Price Intelligence и Growth

Порядок развития Demand фиксирован: **instrumentation → production-like accumulation → internal validation → free seller signals → paid KAIDA Demand.** Search и interest нельзя выдавать продавцу за число людей, явно ожидающих товар (решение PO 2026-09-30): поиск/просмотр → интерес → явное ожидание появления — три разных силы намерения; общий `buyer_interests` не доказывает ожидание. Продавцу никогда не передаются отдельные события, запросы, ID пользователей/сессий, история и точные координаты; редкие cohorts подавляются; пока порог не определён, seller-facing Demand для таких групп не показывается.

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| M-D1 | D1 Search Learning / Demand Aggregates (internal). Численные критерии не придумывать. | Dev · GATED | DECIDED · FM:D1; DM:§46; GS:G5; IO:#55 | Production-like накопление D0 в реальном окружении; O-D0-ORG; внутренняя валидация | Нет. |
| M-D2 | D2 Availability Watches («Сообщить, когда появится»): watch = явное разрешение уведомить; generic interest ≠ watch. | Dev · GATED | DECIDED · FM:D2; SS:§10,§24; GS:G4,G6; DM | Отдельный watch-contract; M-D1; для внешней доставки — канал уведомлений | Нет. |
| M-D3 | D3 Seller Free Demand Signals: сначала бесплатно; инварианты приватности DM §42 (нет individual buyer и raw log, paid не снимает privacy, supply только buyer-visible). Закладывать события цепочки signal → reaction → Product added → buyer-visible Offer → supply. | Dev · GATED | DECIDED · FM:D3; GS:G7; DM:§35; IO:#55 | Валидные агрегаты + Demand readiness gate (DM §35: 10 условий); privacy-порог (M-PRIVACY) | Нет. |
| M-D4-6 | D4 KAIDA Demand (Pro), D5 alerts, D6 Business Demand. Отдельной подписки на Demand нет. | Dev · GATED | DECIDED · FM:D4–D6; DM:§36; CM | D3 value proof + отдельное willingness-to-pay evidence; policy уведомлений; Business model | Нет. |
| M-PRIVACY | Минимальный порог аудитории (privacy suppression) для seller-facing Demand. До определения порога такие группы не показываются. | Research · GATED | DOCUMENTED · IO:#55; CM:§11.7; DM:§22 | Фиксируется после реальных объёмов и проверки риска деанонимизации | Нет. |
| M-DESIGN-OPEN | Открытые presentation details Demand (9 пунктов: exact counts в Free, число free opportunities, периоды, радиусы, detail screen, paywall, позиция teaser, trend, push vs digest). | Research · GATED | DOCUMENTED · DM:§43 | После накопления данных, перед ТЗ дизайнеру | Нет. |
| M-DEV-OPEN | Решения перед ТЗ разработчику Demand (20 пунктов DM §44: event schema, dedupe, watch entity, порог, retention, residency и др.); не проверено, какие закрыты S15B/D0. | Research · GATED | DOCUMENTED · DM:§44 | Перед контрактами D1–D4; часть уже закрыта S15B/D0 | Нет. |
| M-READINESS | Demand readiness assessment (10 условий) и readiness для paid Demand; рядом с MVP boundary review, не обязан блокировать MVP. | Research · GATED | DECIDED · DM:§35–36; FM:MVP boundary; EP:stage 11 | Рядом с stage 11; не обязан блокировать MVP | Нет. |
| B-PRICE-INTEL | Price Intelligence (#79): сравнение цены с рынком Алматы для покупателя и продавца (median, сопоставимые когорты, защита от выбросов). В MVP не входят ranking по цене, прогноз цен, рекомендации продавцу, оповещения, аналитика 7/30/90; данные только в КЗ. Правила — Issue #79 §1–§32 и реестр. | Dev · GATED | DOCUMENTED · IO:#79; FM:Backlog capabilities | Product resolution (S15B), сопоставимые единицы/фасовка, накопленные актуальные цены; до реализации — решение по backend schema, cohort contract, minimum sample, freshness. | Нет. |
| G-0 | Growth G0: Launch Cell (компактная территория и категории); не запускать широко по Алматы до неё. | Ops · GATED · STRATEGY | DOCUMENTED · GS:G0 | Стабильные buyer/seller core flows; реальные пользователи; kill/revise-критерий задан в GS | Нет. |
| G-1 | Growth G1: Supply Seeding (≈100–200 продавцов, ручное онбординг; числа — ориентиры; операторы могут помогать вводить данные). | Ops · GATED · STRATEGY | DOCUMENTED · GS:G1 | G0; рабочие онбординг и lifecycle Offer | Нет. |
| G-2 | Growth G2: Seller QR. | Dev · GATED · STRATEGY | DOCUMENTED · GS:G2 | Стабильный публичный адрес seller/Offer и реальное использование | Нет. |
| G-8 | Growth G8: KAIDA Bounty; сначала ручной эксперимент; риски: fraud, дубли, self-referral, экономика, платежи/учёт; не автоматизировать. | Ops · GATED · STRATEGY | DOCUMENTED · GS:G8 | Доказанный цикл G4–G6; сначала ручной эксперимент | Нет. |
| G-9-10 | Growth G9 Demand Radar и G10 SEO Demand Pages. Не массово генерировать пустые страницы. | Dev · GATED · STRATEGY | DOCUMENTED · GS:G9,G10 | G5 + объём данных; плотность свежих Offers, стабильные публичные страницы | Нет. |

Стратегия роста (`GROWTH_STRATEGY.md`) — **STRATEGY BACKLOG, не разрешение на реализацию**; не меняет порядок и gates этого файла; Demand workstream S15C / D0–D5 владеет реализацией G3–G7.

### 5.11 Коммерция и Backoffice

Порядок planning gates (не один большой backlog): `11A Backoffice Requirement Inventory / Operations / Permissions / Domain invariants → 11B Commercial & Monetization Readiness → 11C MVP/Later + IA/UX + capability gaps + slice dependency graph → 12 отдельные approved vertical slices`. Эти стадии — planning/readiness, не implementation; они не разрешают Billing UI, provider, subscriptions, billing tables, Boost, Business или seller-facing paid Demand. Stage 12 — не один релиз; каждый workflow проходит свои зависимости и обычный vertical-slice loop. Идентификаторы S25–S29 сохраняются ради истории; линейная схема `hard cap → subscription → bulk → promotion` stale. Целевая упаковка: **Pro = AI + full Demand + Performance**; **Boost** — независимая от Pro разовая покупка маркированного охвата; **Business** — организационный масштаб; Editorial Featured ≠ Paid Promotion.

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| K-PLANNING | Stages 11A–11C: инвентаризация Backoffice → операции → роли → domain invariants → Commercial Readiness → MVP/Later → IA/UX → gap audit → граф slices. Planning, не implementation. | Research · GATED | DECIDED · EP:stages 11A–12; BO; CM; FM:Backoffice | После MVP boundary review; IA/UX не начинается до этих артефактов | Нет. |
| K-COMMERCIAL | Commercial foundation (S26) и Pro (S27): server-side EffectiveEntitlements, downgrade не удаляет данные, 1 Seller = 1 CommercialAccount. Sellable Pro — только при минимальной готовности AI, full Demand и Performance. Реализация не авторизована. | Dev · GATED | DECIDED · FM:S26,S27; CM; EP | K-PLANNING; Pro = AI + D4 paid-readiness + Performance. | Нет. |
| K-BOOST | Boost (S28) и маркированная доставка (S29): отдельная цепочка, не требует Pro; без auction/CPC/CPM, не меняет organic ranking, не гарантирует продажи. V1 — релевантность товару/категории, география, период. | Dev · GATED | DECIDED · FM:S28,S29; CM; EP | K-PLANNING; sponsored-surface policy; Purchase/payment foundation | Нет. |
| K-BUSINESS | Business v1: роли сотрудников → multi-location → bulk/XLS/CSV → cross-location аналитика + aggregated Demand → audit/history + квоты → later API/1C/ERP. Organization и API/1C/ERP — отдельные later slices. | Dev · GATED | DECIDED · FM:Business chain; CM; EP | K-PLANNING; общие Seller/Location/Offer/Change Set domains | Нет. |
| K-PRICING | Открытые коммерческие решения PO: цены, квоты, trial/grace/cancel, refund, платёжный провайдер KZ, пакеты Boost, порог privacy. «M6/M7» нигде не определены (Q-M67); сроки заранее не придумывать. | Research · GATED | DOCUMENTED · CM:§11 | Принимаются «в M6/M7» после AI unit economics, реальных Demand data, willingness-to-pay, Boost inventory и исследования платежей в КЗ | Нет. |
| K-BACKOFFICE | Операционные slices Backoffice: Catalog Operations первым, затем Seller/Location/Offer, модерация, отчёты, Editorial Featured; commercial/Promotion/Billing support — после shared domain foundation. Нет mega-slice; роли operator/moderator/admin. | Dev · GATED | DECIDED · BO:§4; FM:Backoffice; EP | K-PLANNING (11C dependency audit) | Нет. |

### 5.12 Качество, локализация и документация

| ID | Задача | Вид · Состояние | Основание требования | Зависимости и условия готовности (по источникам) | Следующее действие |
|---|---|---|---|---|---|
| O-KK-PROOF | KK-вычитка всех KK-строк продукта и каталога носителем языка (`verified_at` не ставить). Казахский текст предварительный и не merge-gate (`PROJECT_RULES.md` §18.5). Review-пакет не включает строки, добавленные позже. | Ops · UNSCHEDULED · FOLLOW-UP | DECIDED · CS; SL:localization-foundation; SL:catalog-localization; KKR; HO29:§8; FM:localization; SL:post-publication-buyer-preview; SL:pre-publication-buyer-preview | Отложено решениями PO; ждёт носителя. | Решение PO. |
| O-OC-LIC | Лицензия OpenCorpora (CC BY-SA, словарь словоформ): перепроверить по первоисточнику и сохранить копию с датой до публичного распространения (сайт был недоступен). Лицензионный гейт закрыт решением PO на основании заявления pymorphy3-dicts-ru. | Research · UNSCHEDULED · FOLLOW-UP | DECIDED · CS; SL:search-word-forms (§12); WFP | До публичного распространения; сайт был недоступен при проверке. Тема legal | Решение PO. |
| O-TZ | Tz-база старых устройств может давать для Asia/Almaty смещение +6 вместо +5 в часах работы; расчёт не менялся по решению PO; статус и «сегодня» на таких устройствах могут сдвинуться на час. | Research · UNSCHEDULED · LIMIT | DECIDED · CS; SL:card-opening-hours (§6) | Расчёт не менялся по решению PO | Решение PO. |
| O-DOC-DEBT | Документационный долг: битые ссылки (F5), устаревшие status-строки контрактов (F6), устаревшее будущее время в journeys (F7, Q-SJ-VOLUME), комментарии в коде со ссылкой на удалённый DESIGN_SYSTEM.md. Ничего не править молча; код-комментарии — отдельной задачей. Перечень — расхождения F2, F4–F7. | Ops · UNSCHEDULED · FOLLOW-UP | DOCUMENTED · UXR; SL; BJ; SJ; CODE; HO25:§6 | Перечень — расхождения F2, F4–F7 в реестре | Решение PO. |
| O-CI-FLAKE | CI-сбой «still has active connections» в миграционных тестах (#116). Правило триажа — `PROJECT_RULES.md` §7–§8: сначала классификация, тест не ослаблять ради зелёного CI. Root cause не установлен. | Dev · UNSCHEDULED | DOCUMENTED · IO:#116; PR:§7,§8 | Решение PO: Development вне R3. | Решение PO. |
| O-TEST-GUIDE | Правило для тестов: spec с assert на «кто публикует баранину» не должен зависеть от параллельных публикаторов (необязательный follow-up из #130). | Dev · UNSCHEDULED · FOLLOW-UP | DOCUMENTED · IC:#130 | Не сделано, помечено необязательным | Решение PO. |

## 6. Зависимости, которые неприятно обнаружить поздно

Наблюдения из источников; это **не требования запуска**.

| Тема | Что именно | Задачи |
|---|---|---|
| Условия запуска | AI-ввод обязателен; актуальность поставлена; до допуска реальных пользователей нужны решения O-AUTH, O-ABUSE, O-LEGAL, O-PILOT. | O-LAUNCH, S-AI-INPUT |
| Удаление данных и R2 | R2 держится на правиле «фото неизменяемы и не удаляются»; очистка фото, архив с удалением и срок хранения audit требуют пересмотра R2 и политики хранения. Backup содержит ПД и сессии. | S-PHOTO-CLEANUP, S-ARCHIVE, O-LIMITS |
| Расписание фоновых задач | Purge D0 до включения organic — требование; сейчас purge — CLI без расписания; есть лишь in-process таймер напоминаний. Что считать механизмом расписания — решает контракт O-D0-ORG; scheduler в R3 автоматически не входит. | O-D0-ORG, S-ARCHIVE |
| Реальное окружение — предпосылка данных | D1, динамические чипы, Demand readiness и Growth G0/G1 ждут production-like трафика; dev/test/synthetic не спрос. | M-D1, B-CHIPS, M-READINESS, G-0, G-1 |
| Telegram-подтверждение контакта | Контракт point-contacts-hours: подключение через бот KAIDA — отдельный шаг до запуска; сейчас Telegram скрыт, но упомянут в описании сервиса (F8). | S-TG-CONTACT, B-TG-PROMISE |
| Внешняя доставка уведомлений | Есть только browser push напоминаний продавцу; для «товар появился», D5 и снятия карточки канал не определён. | B-NOTIFY, M-D2, M-D4-6, S-REMOVAL-NOTIFY |
| Переводчик и AI — data residency | Реальный LLM-переводчик подключается при переезде на свой сервер; провайдеры вне КЗ непригодны для production; Jev — только на синтетике. | O-TRANSL, B-SEMANTIC, S-AI-INPUT |
| KK-вычитка накапливается | Каждый slice добавляет KK-строки; казахский текст предварительный и не merge-gate (§18.5). | O-KK-PROOF |
| Коммерческие решения — после исследований | Цены, квоты, trial/refund, платёжный провайдер КЗ, Boost inventory — после AI unit economics, Demand data и willingness-to-pay. | K-PRICING, K-COMMERCIAL |
| Backoffice: планирование до IA/UX | Catalog Operations — первый vertical, но 11A–11C предшествуют; пока каталог растёт импортёром и PR. Market navigation (#10) зависит от управления схемами. | K-PLANNING, K-BACKOFFICE, C-OPS, B-MARKET-NAV |
| Оценка поиска/AI требует корпуса заранее | RU/KK/смешанный корпус, опечатки, Product-vs-Offer, near-duplicates; возможности KK ограничены. | B-SEMANTIC, B-TYPO-KK |
| CI-стабильность | #116 даёт красные проверки на несвязанных PR (по описанию); правило merge-on-green требует повторного запуска. | O-CI-FLAKE |
| Лицензия словаря | Заявление pymorphy3-dicts-ru принято PO; копия лицензии с датой не сохранена. | O-OC-LIC |

### Открытые расхождения документов

Полный текст, закрытые расхождения и закрытые решения — снимок `REQUIREMENTS_SOURCE_MAP.md` §9. Здесь — то, что ещё требует действия или решения.

| ID | Суть | Где разрешается |
|---|---|---|
| F5 | Ссылки документов на удалённые или никогда не существовавшие файлы | O-DOC-DEBT |
| F6 | Строки статуса закрытых контрактов не отражают закрытие; в `CURRENT_STATE.md` строка «Issue #12 остаётся OPEN» устарела (#12 закрыт 2026-10-05) | O-DOC-DEBT |
| F7, Q-SJ-VOLUME | BUYER_JOURNEY / SELLER_JOURNEY: будущее время для поставленного; формулировка оси «объём» | O-DOC-DEBT |
| F8 | Знак Telegram в демо First Entry против контракта point-contacts-hours | B-TG-PROMISE, S-TG-CONTACT |
| F9 | Feature Map «оповещение оператору о карточке вне каталога входит в stage 10» против «pilot-функция, не добавлять» | B-FREETITLE-ALERT |
| F10 | Название из каталога на языке покупателя: S15B закрыт, проекция показывает слова продавца | B-CATNAME-LOCALE |
| F14 / D-EXT | Внешние инструкции ChatGPT-проекта описывают бесплатный лимит ≈10 активных Offers; утверждённый текст замены §9 есть в снимке `REQUIREMENTS_SOURCE_MAP.md` §9; применение к внешнему проекту не подтверждено. Записанное внешнее расхождение, не блокер и не действие, назначенное PO | — |
| Q-M67, Q-DM44 | «M6/M7» не определены; не проверено, какие из 20 решений DM §44 закрыты | K-PRICING; M-DEV-OPEN |
| Q-CATALOG-ADD, Q-ILLUS-DONE, Q-SIMILAR, Q-MEM-STALE | Не проверено по коду; отсутствие UI-строк — подсказка, не доказательство | C-OPS; B-ILLUS; B-SIMILAR |
| Q-SCHEDULER | Какой механизм расписания приемлем для purge D0 / архива | O-D0-ORG |
| Q-PARTIAL-DOCS, Q-DEPENDENCY-REAL | Источники читались частично; зависимости взяты из источников, а не проверены кодом | снимок `REQUIREMENTS_SOURCE_MAP.md` §1, §5 |

## 7. Ключевые зависимости и решения PO (сохранены из предыдущей редакции)

- Geo fallback закрыт checkpoint `v0.0.43-seller-location-geo-fallback`. Address directory идёт **после** geo fallback: подсказки адреса — улучшение поверх пути, который обязан работать без них (`PROJECT_RULES.md` §10.1). Preflight 2026-10-01 подтвердил основу для Almaty pilot: 134,066 OSM-объектов с `addr:housenumber`, из них 129,026 (96.24%) также имеют `addr:street` внутри relation `2465058`; это не гарантия полной адресной базы, поэтому ручной ввод остаётся first-class. Выбран weekly Geofabrik Kazakhstan PBF → изолированный PostgreSQL + `pg_trgm`, без Nominatim/PostGIS/внешнего runtime geocoder; ODbL attribution/provenance/share-alike и стоимость реального импорта входят в acceptance контракта.
- Актуальность живёт на «Моей витрине»; напоминания (#32) — в том же пункте. Search Sorting выполняется после политики актуальности. Контракты 5–6 не объявляют Search-модель финальной; сравнение цены разрешено только для сопоставимой единицы или подтверждённой нормализованной цены.
- AI Input и AI-модерация по `PROJECT_RULES.md` §10.1 — улучшения поверх ручного пути; ручной путь и публикация без предварительной модерации обязаны работать при недоступном AI.
- **S15B** (Search System revision, закрыт): canonical `product_id` — основной путь; resolved Product search не смешивается через OR с seller-title fallback; known Product + zero offers отличается от unknown query; canonical и unresolved demand различаются; query не создаёт Product автоматически; fuzzy — только для suggestions; каталог развивается контролируемой редактурой.
- **S15C / D0–D2:** события создаются только при conscious submit; canonical/unresolved outcome, zero/unmet-context, result count и buyer geo — только если покупатель явно его использовал; privacy-safe session semantics, исключение test/demo/bot traffic; считаются уникальные источники спроса, а не сырые повторы; geography укрупняется, minimum cohort threshold конфигурируем.
- **Demand readiness** оценивается рядом с MVP boundary (stage 11), но не блокирует MVP. D3 можно вставить только после валидных агрегатов и readiness gate; D4 paid — в stage 12 после подтверждения цепочки signal → reaction → Product added → buyer-visible Offer → supply и отдельного willingness-to-pay evidence; D5, D6 — позже.
- **Commercial correction (решение PO 2026-09-30):** Free сохраняет полноценную ручную правдивую витрину; старый S25 с hard active-Offer cap помечен REVIEW REQUIRED; модель «первые N бесплатно» удалена; вернуться можно только по pilot evidence и новому явному решению PO.
- **Независимые chains stage 12:** Pro (AI ready + D4 + Performance → commercial minimum → Pro gates → Billing → sellable lifecycle); Demand (S15B → S15C → internal validation → D3 → value proof → willingness-to-pay → D4 в Pro → D6 в Business; отдельной Demand-подписки нет); Boost (отдельная цепочка); Business (roles → multi-location → bulk → analytics → audit/quotas → later integrations); Backoffice (Catalog Operations первым).
- Commercial access рассчитывается server-side по модели `CommercialAccount → Plan → Entitlements → Limits → Usage → Overrides → BillingState → Purchases / PromotionCampaigns → EffectiveEntitlements` — это conceptual dependency, а не список таблиц для создания. Backoffice не получает собственной business logic.
- Business v1 начинается с employees/roles и multi-location scope одного Seller поверх общих доменов; Organization и API/1C/ERP — отдельные later slices.

## 8. Владельцы фактов, перепроверка и выбор следующей работы

**Кто чем владеет.** У каждого типа информации один владелец; остальные документы ссылаются на него, а не копируют.

| Факт | Владелец |
|---|---|
| Что осталось сделать, порядок, состояние, зависимости, решения, ждущие PO, соответствие Issues | **этот файл** |
| Verified checkpoint (tag, SHA, CI), активная работа, технический handoff, операционные ограничения | `docs/agents/CURRENT_STATE.md` |
| Процесс, verification, устойчивые boundaries, роли документов | `docs/PROJECT_RULES.md` |
| Что читать и критичные входные инструкции | `AGENTS.md` (короткий роутер) |
| Capability map, доменные зависимости, продуктовые решения PO | `docs/product/FEATURE_MAP.md` |
| Точное утверждённое поведение slice | `docs/slices/**/SLICE_CONTRACT.md` |
| Подробное обсуждение незакрытой работы | GitHub Issues |
| ID → источники и полные формулировки ограничений (без состояний и приоритетов) | `docs/product/REQUIREMENTS_REGISTER.md` |
| Закрытая история плана; поставленные и отклонённые записи | `docs/product/EXECUTION_HISTORY.md` |
| Снимок инвентаризации источников и трассировки на 2026-10-09 | `docs/product/REQUIREMENTS_SOURCE_MAP.md` |
| Commercial semantics; Backoffice planning; Demand; Growth; Search spec | соответствующие parent/target-документы (раздел 9) |
| Операционные процедуры | `docs/ops/` |

**Перепроверка (re-evaluation gates).** Проверять задачи в состоянии UNSCHEDULED / NEEDS-DECISION и новые approved requirements: после этапа 1; после актуальности + Search Sorting; после AI Input; после S16 перед решением о MVP/public beta; после Demand readiness assessment; после 11A–11C; после каждого независимо закрытого commercial/Backoffice checkpoint stage 12. Кандидат рассматривается **только на такой границе** и никогда не вклинивается внутрь открытого slice. Утверждённое требование без места в этом файле и в Feature Map получает статус **UNPLACED GAP** и разбирается явно.

**Как выбирать следующую работу.** (1) проверить `main`, последний verified checkpoint/tag и CI; (2) прочитать этот файл; (3) взять первый незакрытый пункт утверждённой очереди (раздел 2) или кандидата, которого PO явно назвал; (4) открыть owning Issue / Feature Map entry / макет; (5) проверить relevant closed contracts; (6) подготовить compact Slice Contract; (7) не менять очередь по старому чату, UX backlog или номеру `Sxx` без решения PO. Наблюдение проходит путь: `observation → Issue / inbox → решение PO → вставка в этот план → Slice Contract → реализация → verified checkpoint`.

## 9. Подчинённые источники

Порядок не задают: `SEARCH_SYSTEM_SPEC_v0.1.md`, `KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md`, `KAIDA.KZ_initial_product_catalog_v0.1.xlsx` (target product sources); `GROWTH_STRATEGY.md`; `KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`; `KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`; `AI_TECH_CANDIDATES.md`; `SELLER_AI_FIRST_DESIGN_BRIEF.md` + `SELLER_AI_FIRST_DESIGN_REVISION_1.md` + макет (`PROJECT_RULES.md` §18.1); `UX_REFERENCE_INDEX.md`; Slice Contracts; GitHub Issues.

Перед началом работы исполнитель самостоятельно проверяет фактический `main`, tags и CI; SHA и run id в этом файле не ведутся.
