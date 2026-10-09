# KAIDA.KZ 2.0 — Requirements Source Map

**Сохранённый снимок инвентаризации на 2026-10-09 (`main` `67113c9`); не второй поддерживаемый реестр.** Не обновляется после каждого slice: живой источник по оставшимся задачам — `EXECUTION_PLAN.md`; `REQUIREMENTS_REGISTER.md` — технический указатель. Править только при повторной инвентаризации, по решению PO или чтобы исправить ошибку снимка. Статусы в §3 и записи в §4 отражают эту дату.

Приложение к `REQUIREMENTS_REGISTER.md`. **Это инвентаризация и трассировка, не очередь и не разрешение на реализацию.** Покрытие описывает фактически проделанное; абсолютной полноты не заявляется.

Уровни покрытия: **FULL** — прочитано целиком; **PARTIAL** — прочитаны названные части; **SCAN** — поиск маркеров (follow-up, отложено, будущее, «отдельный slice»), текст не читался целиком; **HEAD** — только заголовки/статус; **NONE** — существует, не читалось; **N/A** — не планирующий источник. Сводка: FULL: 23 · PARTIAL: 17 · SCAN: 3 · HEAD: 2 · NONE: 0 · N/A: 2.

## 1. Инвентаризация источников

| Код | Расположение | Тип | Покрытие | Что прочитано / не прочитано |
|---|---|---|---|---|
| EP | docs/product/EXECUTION_PLAN.md | очередь | FULL | Прочитан целиком до сокращения (копия — в EXECUTION_HISTORY.md и в предыдущей версии плана) |
| EH | docs/product/EXECUTION_HISTORY.md | история плана | FULL | Создан в этом проходе из EP дословно; новых требований не содержит |
| FM | docs/product/FEATURE_MAP.md | capability map | FULL | Прочитан целиком (строки 1–517); ячейки таблицы S0–S33 просматривались с обрезкой до ≈210 символов |
| PR | docs/PROJECT_RULES.md | правила | FULL | Прочитан целиком (496 строк); правила как требования не регистрируются, регистрируются только упоминания будущего и границы |
| AG | AGENTS.md (корень) | маршрутизатор | FULL | Прочитан целиком |
| CS | docs/agents/CURRENT_STATE.md | операционный снимок | FULL | Прочитан целиком |
| GS | docs/product/GROWTH_STRATEGY.md | стратегия | FULL | G0–G10, правила, порядок, запреты, decision gates |
| AT | docs/product/AI_TECH_CANDIDATES.md | research | PARTIAL | Прочитаны §1, §2, §3 (начало и запрет по residency), §5, §6, §7, §8 и лицензионные строки §4. Не читались построчно: описания моделей Liquid/Qwen-класса в §3–§4 — кандидаты, а не требования; сравнение моделей входит в обязательный benchmark (B-SEMANTIC) |
| SA | docs/architecture/SECURITY_AUTOMATION.md | условия включения | FULL | Активные проверки, таблица триггеров, правило срабатывания |
| ATT | C:\Users\RoboRash\.codex\attachments\* (50 каталогов, 49 файлов) | вложения Codex-сессий (PO) | PARTIAL | Классифицированы по началу текста. Прочитаны полностью/по существу: b6bf50db (коммерческие решения PO), 2e22de33 (инструкция по S15), db682e64 (предложение manual pilot readiness), cbc84fe9, 4cd8274f (хостинг и AI-рантайм), d1b687b0 (решение PO о модели Search), 14323066 (бэклог и расхождения), 758416a0 (word forms). Проверены по маркерам: ещё 17 отчётов о slices (D0, R1, R2, 6a, opening hours, typo, empty states, price/packaging и др. — история, фиксируют follow-up, уже учтённые), 5 промптов репозитория kaida-product-corpus (Production KB Export/Reconciliation), 3 отладочных промпта старого репозитория RashRosh/Kaida.kz. Пропущены как не относящиеся к KAIDA.KZ 2.0 (частный/маркетинговый материал): 26104cdf, a25244be, ce3f1399, d53e2ecd, bcbc6dd7, 3dfe01eb (LinkedIn/Instagram/презентация другого бренда). Собственные отчёты агента (5c16a602, 77cb032c, fe27473c) — не источники |
| DM | docs/product/KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md | продуктовая концепция | FULL | Прочитан целиком (§0–§48), включая §41 flows и §47 |
| SS | docs/product/SEARCH_SYSTEM_SPEC_v0.1.md | target spec | FULL | Прочитан целиком, включая §19.1–§19.4 и §20 (API и SearchResponse: поставлены в S15B/S15C или заменены решениями PO — см. X-CANONICAL-ONLY) |
| CM | docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md | продуктовая концепция | FULL | Прочитан целиком (§1–§11) |
| BO | docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md | планирование | FULL | Прочитан целиком (§1–§10) |
| BR | docs/product/SELLER_AI_FIRST_DESIGN_BRIEF.md | ТЗ дизайнеру | FULL | Прочитан целиком (§0–§23); §19–§20 (формат сдачи и проверка дизайна) — по существу, без построчной сверки |
| RV | docs/product/SELLER_AI_FIRST_DESIGN_REVISION_1.md | ТЗ дизайнеру | FULL | Прочитан целиком (§0–§5) |
| UXR | docs/product/UX_REFERENCE_INDEX.md | UX references | PARTIAL | Прочитаны заголовки, выводы аудита #37 (KEEP/ADAPT/REJECT/GAP), таблицы spot-check, разделы Search filters, Phone/OTP, Seller contacts; описания остальных справочных статей не читались (справочные) |
| UXA | Google Drive: kaida-ux-audit.md (id 1V9XTUq9Y-_ZaEtvKv1KtxGfemSXqH5QB, владелец propenza@gmail.com, изменён 2026-10-07) и папка «screens» (id 1CTva312Cy1FKNNdb9fWRsmwDpAr0qOfv, 178 скриншотов) | экспертный UX/UI-обзор (внешний, доступен) | PARTIAL | kaida-ux-audit.md прочитан целиком (доступен через Drive-коннектор); скриншоты не открывались — текст обзора их описывает. Это экспертная оценка, не исследование пользователей; не утверждённые решения |
| UXC | Google Drive: папка UX-корпуса (id 1y0IGHOKeGmOcgr7fMeO_ZITSDJyUozUa) и 13 файлов, на которые ссылается UX_REFERENCE_INDEX.md | внешний advisory-корпус (доступен) | HEAD | Список содержимого прочитан; статьи не читались: проектно-специфичные решения и аннотации находятся в UX_REFERENCE_INDEX.md (KEEP/ADAPT/REJECT/GAP), а сами статьи — общие гайдлайны без аннотаций проекта |
| UXB | docs/UX_BACKLOG.md | inbox | FULL | Пуст по неповышенным наблюдениям |
| BJ | docs/product/BUYER_JOURNEY.md | journey | FULL | Прочитан целиком |
| SJ | docs/product/SELLER_JOURNEY.md | journey | FULL | Прочитан целиком |
| TF | docs/architecture/TECHNICAL_FOUNDATION_V0.md | архитектура (HISTORICAL) | FULL | Прочитано начало и структура: документ помечен HISTORICAL FOUNDATION (решения старта S0), требований к очереди нет |
| OB | docs/ops/BACKUP_RESTORE.md | runbook | PARTIAL | Прочитаны §2 (механизм согласованности) и §12 (пределы доказательств); остальное — пошаговая инструкция операций, не источник требований |
| LB | docs/ops/LOCAL_BOOTSTRAP.md | runbook | PARTIAL | Прочитан §9 (наблюдения и границы приёмки); остальное — пошаговая инструкция, не источник требований |
| KBC | src/modules/catalog/kb-package/v1/CONTRACT.md | контракт данных | FULL | Прочитан полностью |
| WFP | src/modules/search/word-forms/PROVENANCE.md + ops/word-forms/README.md | provenance | FULL | Прочитаны полностью |
| CTL | docs/agents/KAIDA_CONTROLLER.md | процесс | N/A | Процедура контролёра (стадии проверки, формат verdict): не содержит продуктовых требований; прочитаны заголовки |
| RD | README.md | обзор | PARTIAL | Прочитаны разделы «Источники истины», «Авторизация и public launch»; остальное — установка/запуск |
| MK | docs/product/mockup/seller-ai-first-rev1/ (README, Gaps.dc.html и 68 артбордов) | принятая копия макета (локально) | PARTIAL | README и Gaps.dc.html прочитаны; по всем артбордам выполнен поиск тегов Gap / Open / Proposed с окружающим текстом. Содержимое экранов поставленных функций не читалось |
| KKR | docs/reviews/localization-foundation-kk-review.md (+ .docx) | review-пакет KK | PARTIAL | Прочитаны статус, инструкция, критерии; подсчитано: 265 строк-ключей и 0 заполненных решений в .md и в .docx. Отдельные KK-строки не читались: по указанию PO без дублирования переводов, а нерассмотренные переводы — это сам объём O-KK-PROOF |
| XLS | docs/product/KAIDA.KZ_initial_product_catalog_v0.1.xlsx | данные | PARTIAL | Прочитаны листы README, Sources, структура Products/Categories, Review_queue (105 = 82 GRANULARITY_REVIEW + 23 KK_REVIEW). Строки каталога не копировались |
| CI | .github/workflows/*.yml (6 файлов) | автоматизация | N/A | Не планирующий источник; не читались |
| SL | docs/slices/** (56 каталогов, 99 .md; 113 файлов) | контракты slices | SCAN | Для всех SLICE_CONTRACT.md: строка статуса, поиск follow-up/deferred/«отдельный slice», разделы Out of scope/границы с указанием на будущее. S0–S9: FEATURE_SPEC / IMPLEMENTATION_CONTRACT / VERIFICATION / NOTES (≈40 файлов) не читались, кроме проверки ссылок. Таблица по каталогам — в REQUIREMENTS_SOURCE_MAP.md §3 |
| CNV | Claude artifacts: https://claude.ai/artifact/3z2pznybpsJAJbWGTxgwE4 (живой макет AI-first, версия 1790680691-0123, 83 файла), https://claude.ai/artifact/5KhjaPcLntxAY4Mk2BC9zF (UX spot-check), https://claude.ai/artifact/VEioj7KKfjKfhD1RZpivdQ (Pass 3 + Media Pass — история, X-PASS3), https://claude.ai/code/artifact/28360c15-e7d6-4dba-b157-d97bed612363 (ссылка в canvas.json) | внешние артефакты (доступны) | HEAD | Первые два открываются через Artifact-инструмент (проверено); содержимое живого макета не перечитывалось — принятая копия лежит в репозитории (MK), а более поздние изменения живого макета действуют только после новой приёмки PO (PR §18.1). Остальные не открывались |
| IO | GitHub: 8 открытых Issues (#10, #54, #55, #75, #76, #79, #83, #116) | Issues | PARTIAL | Прочитаны полностью: #10, #54, #55, #83, #116, #75, #76; #79 — §1–§25 на момент снимка; позднее (2026-10-09) прочитан целиком §1–§32 |
| CORP | GitHub: RashRosh/kaida-product-corpus (PUBLIC, main, 85 объектов; теги v0.1.0-kb-foundation, v0.2.0-production-kb-export-v1; открытых Issues нет, PR #1 слит) | внешний репозиторий KB (доступ только на чтение проверен) | PARTIAL | Прочитаны README, docs/official_source_reconciliation.md, docs/production_kb_export_v1.md, kb/README.md, kb/official/README.md; подсчитан состав kb/seed/products.csv (868 Products); KB_PIPELINE_PROMPT.md — заголовки и маркеры. Данные (observed names, mappings, XLS) и код не читались; репозиторий не изменялся |
| GH | Git-история KAIDA.KZ-2.0: удалённые документы (docs/DESIGN_SYSTEM.md, WIREFRAME_BRIEF.md, WIREFRAME_PASS3_REVIEW.md, UX_NAVIGATION_STATE_SPEC.md, slices/seller-offer-workspace, slices/seller-points-contacts) — коммиты 32b88dc (2026-09-25) и a2a4728 | восстановленные источники | PARTIAL | Ограниченный поиск по точному пути: заголовки и маркеры открытого; найден один новый пункт (наблюдаемость переводов и контактных ссылок, P1 UX_NAVIGATION_STATE_SPEC §6); правила DESIGN_SYSTEM уже перенесены в PR §18.4; файлы в текущий план не восстанавливались. S5 IMPLEMENTATION_NOTES.md в истории не найден (ссылка битая с самого начала) |
| IC | GitHub: 21 закрытый Issue | Issues | SCAN | Поиск follow-up/later/out of scope/future/backlog в телах и комментариях; прочитаны строки вокруг совпадений для 13 Issues; #20–#23, #28, #29 — случайные (NOT_PLANNED) |
| AUD | C:\Users\RoboRash\.codex\attachments\2f7753b7-…\Вставленный текст.txt | planning audit (2026-10-08) | FULL | Прочитан целиком; как историческое обсуждение |
| UXD | C:\Users\RoboRash\.codex\.chatgpt-projects\g-p-6aa3…\KAIDA_UX_UI_DECISIONS_AND_BACKLOG.md | UX/UI решения (2026-10-07) | FULL | Прочитан целиком; сверен с закрытыми contracts |
| CPA | C:\Users\RoboRash\.codex\.chatgpt-projects\g-p-6aa3…\AGENTS.md | инструкции ChatGPT-проекта (внешние) | FULL | Прочитан целиком (зеркало инструкций проекта «KAIDA.KZ DEV 2.0»); содержит устаревший §9 про лимит ~10 активных Offers — расхождение F14; sources/ — пустой каталог; tmp/pdf-reader — копия библиотеки, не планирующий источник |
| HO25 | tmp/HANDOFF_2026-09-25_claude_to_codex.md (локально, не в Git) | handoff | PARTIAL | Раздел 6 «Что осталось открытым»; заголовки |
| HO29 | tmp/HANDOFF_2026-09-29_claude_to_next.md (локально, не в Git) | handoff | PARTIAL | Разделы 5 «Очередь и решения PO» и 8 «Известные хвосты» |
| CSB | tmp/CURRENT_STATE.local-backup-before-f6363b.md (локально) | бэкап снимка (2026-10-01/02) | PARTIAL | Прочитаны заголовки, recovery report, blocker, next action, constraints; исторический снимок address-directory |
| MEM | C:\Users\RoboRash\.claude\projects\c--dev-KAIDA-KZ-2-0\memory\ (24 заметки) | заметки агента | PARTIAL | Индекс MEMORY.md и 7 заметок (маркеры open/later/decision); остальные — checkpoint-заметки прошлых сессий, не читались |
| CODE | src/, tests/, ops/ (поиск TODO/FIXME и ссылок на удалённые документы) | код | SCAN | Реальных TODO/FIXME нет; найдены комментарии со ссылкой на удалённый DESIGN_SYSTEM.md (src/app/globals.css, src/modules/sellers/db/sellers.table.ts) |

## 2. Существуют или упомянуты, но не инспектированы

| Точное расположение | Статус / почему | Затронутые записи |
|---|---|---|
| C:\Users\RoboRash\.codex\attachments\<id>\… — 6 файлов не относятся к KAIDA.KZ 2.0: 26104cdf-e9e7-409d-911a-05ff9cc99b45, a25244be-4ccb-4a42-9ffc-5a137c3ba316, ce3f1399-a9ff-4b37-8d1c-59e1f6084460, d53e2ecd-b280-4fe0-b8f3-a7868b001575, bcbc6dd7-ff74-4216-b5de-1133cdfd14d7, 3dfe01eb-1a40-4a4c-835e-0bd7e021d727 | Доступны, намеренно не читались: маркетинговый/частный материал другого бренда (по указанию PO: не читать несвязанное) | Нет |
| C:\Users\RoboRash\.codex\attachments\* — 17 отчётов агента о slices (D0, R1, R2, 6a, opening hours, typo, empty states, price/packaging, word forms и др.) | Доступны, проверены по маркерам follow-up/ограничений (не построчно): это история, а не источники требований | Follow-up уже учтены в O-LIMITS, O-OC-LIC, O-TZ, B-TYPO-MEAS, O-TEST-GUIDE, B-WORDFORMS-EXT |
| C:\Users\RoboRash\.codex\attachments\* — 5 промптов репозитория RashRosh/kaida-product-corpus и 3 отладочных промпта старого репозитория RashRosh/Kaida.kz | Доступны, проверены по маркерам; сами репозитории (kaida-product-corpus, Kaida.kz) недоступны из этой сессии: нужен URL/доступ, если они должны войти в инвентаризацию | C-PARENT-HIERARCHY, C-OFFICIAL-CROSSWALK, C-KB-V2 (kaida-product-corpus); уроки для S-AI-INPUT (Kaida.kz) |
| https://github.com/RashRosh/kaida-product-corpus и https://github.com/RashRosh/Kaida.kz | Не проверялся доступ; репозитории упомянуты в вложениях PO. Внешняя KB-цепочка и старая реализация AI-ввода | C-OFFICIAL-CROSSWALK, C-KB-V2, S-AI-INPUT (уроки) |
| Google Drive, папка «screens» id 1CTva312Cy1FKNNdb9fWRsmwDpAr0qOfv (178 скриншотов) — https://drive.google.com/drive/folders/1CTva312Cy1FKNNdb9fWRsmwDpAr0qOfv | Доступна (метаданные получены); изображения не открывались: текст обзора kaida-ux-audit.md их уже описывает | B-MORE-MY, B-NEARBY-DEADENDS, B-HOME-APPETITE, B-READABILITY, S-FORM-SIMPL |
| Google Drive, папка UX-корпуса id 1y0IGHOKeGmOcgr7fMeO_ZITSDJyUozUa и 13 файлов из UX_REFERENCE_INDEX.md | Доступны (первая страница списка получена); статьи не читались — advisory, классификация KEEP/ADAPT/REJECT/GAP уже в UX_REFERENCE_INDEX.md | O-OTP-RESEND, O-LEGAL (GAP из UXR) |
| https://claude.ai/artifact/5KhjaPcLntxAY4Mk2BC9zF, https://claude.ai/artifact/VEioj7KKfjKfhD1RZpivdQ, https://claude.ai/code/artifact/28360c15-e7d6-4dba-b157-d97bed612363 | Доступны (первый — проверено, 620 KB, не читался построчно); исторические UX-артефакты (spot-check, Pass 3 + Media Pass) — X-PASS3 и UXR уже отражают выводы | X-PASS3 |
| https://claude.ai/artifact/3z2pznybpsJAJbWGTxgwE4 — живой макет AI-first (версия 1790680691-0123, 83 файла) | Доступен (проверено). Принятая копия — docs/product/mockup/seller-ai-first-rev1/ (читались README, Gaps, теги Gap/Open/Proposed). Более поздние изменения живого макета не действуют без новой приёмки PO (PR §18.1) | Требования макета, помеченные Gap/Open/Proposed, уже в записях S-AI-INPUT, S-ARCHIVE, S-REVIEWS, S-TG-CONTACT |
| Файлы, на которые ссылаются документы, но которых нет в репозитории: docs/DESIGN_SYSTEM.md, docs/product/WIREFRAME_BRIEF.md, docs/product/WIREFRAME_PASS3_REVIEW.md, docs/product/UX_NAVIGATION_STATE_SPEC.md, docs/slices/seller-offer-workspace/SLICE_CONTRACT.md, docs/slices/seller-points-contacts/SLICE_CONTRACT.md, docs/slices/S5-offer-management/IMPLEMENTATION_NOTES.md | Недоступны (удалены или не созданы); найти можно только в истории Git, если нужно (не искалось: по указанию PO история не выгружается без идентифицированной потребности) | X-DESIGN-SYSTEM, X-OFFER-WORKSPACE, X-PASS3 (контекст ранних решений) |
| История PR, комментарии PR, review threads GitHub | Не выгружались по указанию PO; открывались только теги/слияния | Нет известных |

## 3. Slice Contracts: статус и свидетельство закрытия

Свидетельство — git tag; «Записи» — записи реестра, ссылающиеся на этот каталог. Статус-строка взята как есть из файла (может устареть — см. расхождение F6).

| Каталог | Файл | Статус-строка в файле | Свидетельство закрытия | Записи реестра |
|---|---|---|---|---|
| S0-search | FEATURE_SPEC.md | ? | v0.0.1-s0 | V-CORE |
| S1-offer-lifecycle | FEATURE_SPEC.md | документа Feature Spec для проектирования S1. Реализация S1 этим документом не начинается. | v0.0.2-s1 | V-CORE |
| S10-buyer-contact-actions | SLICE_CONTRACT.md | CONTRACT APPROVED → IMPLEMENTATION AUTHORIZED **Base:** c3ef0f52685221b488a15404902412f552 | v0.0.11-s10 | V-CORE |
| S11-discovery | SLICE_CONTRACT.md | DESIGN APPROVED CONDITIONALLY; IMPLEMENTATION BLOCKED **Base checkpoint:** v0.0.11-s10 **B | v0.0.12-s11 | V-CORE |
| S12-batch-seller-input | SLICE_CONTRACT.md | DESIGN APPROVED CONDITIONALLY; IMPLEMENTATION BLOCKED **Verified product checkpoint:** v0. | v0.0.13-s12 | V-CORE |
| S13-interests | SLICE_CONTRACT.md | S13 CONTRACT APPROVED / IMPLEMENTATION AUTHORIZED Verified product checkpoint: - tag: v0.0 | v0.0.14-s13 | V-CORE |
| S2-auth | FEATURE_SPEC.md | документа Утверждённый Feature Spec для S2. Реализация начинается только по отдельному раз | v0.0.3-s2 | O-OTP-RESEND, V-CORE |
| S3-seller-location | FEATURE_SPEC.md | APPROVED **Base checkpoint:** v0.0.3-s2 / c5c3934bb22652321c2882017ee3a6dc61f7089e ## 1. U | v0.0.4-s3 | V-CORE |
| S4-seller-input | FEATURE_SPEC.md | APPROVED **Base checkpoint:** v0.0.4-s3 / 80d97bebd5e3427cdae96441df64dad23efdbb30 ## 1. U | v0.0.5-s4 | V-CORE |
| S5-offer-management | FEATURE_SPEC.md | APPROVED **Implementation Contract:** APPROVED **Base checkpoint:** v0.0.5-s4 **Base main: | v0.0.6-s5 | V-CORE |
| S6-catalog-aliases | FEATURE_SPEC.md | DESIGN APPROVED; IMPLEMENTATION BLOCKED pending S6 CONTRACT APPROVED → IMPLEMENTATION AUTH | v0.0.7-s6 | V-CORE |
| S7-real-seller-search | FEATURE_SPEC.md | DESIGN APPROVED; CONTRACT STAGE AUTHORIZED; IMPLEMENTATION BLOCKED **Base checkpoint:** v0 | v0.0.8-s7 | V-CORE |
| S8-location-geo | FEATURE_SPEC.md | DESIGN APPROVED; CONTRACT STAGE AUTHORIZED; IMPLEMENTATION BLOCKED **Base checkpoint:** v0 | v0.0.9-s8 | V-CORE |
| S9-search-ranking | FEATURE_SPEC.md | CONTRACT REVIEW; IMPLEMENTATION BLOCKED **Base checkpoint:** v0.0.9-s8 **Base main:** 23bd | v0.0.10-s9 | V-CORE |
| UX1-marketplace-shell | SLICE_CONTRACT.md | SUPERSEDED BEFORE IMPLEMENTATION Этот объединённый UX1 не реализовывался и не является дей | — (superseded before implementation) | V-UX1, X-UX1 |
| UX1A-app-shell | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED **Verified checkpoint:** v0.0.14-s13 **Verified main  | v0.0.15-ux1a | S-REVIEWS, V-UX1 |
| UX1A1-shell-visual-alignment | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED **Verified base:** v0.0.15-ux1a **Verified main SHA:* | v0.0.16-ux1a1 | V-UX1 |
| UX1A2-auth-modal | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED **Verified base:** v0.0.16-ux1a1 **Verified main SHA: | v0.0.17-ux1a2 | V-UX1 |
| UX1B-marketplace-offer-cards | SLICE_CONTRACT.md | ? | v0.0.18-ux1b | V-UX1 |
| UX1C-nearby-geo-intent | SLICE_CONTRACT.md | DESIGN APPROVED **Base checkpoint:** v0.0.18-ux1b **Base main:** f16703cb5c8057aa34db48b97 | v0.0.19-ux1c | V-UX1, V-GEO |
| UX1D-buyer-offer-actionability | SLICE_CONTRACT.md | DESIGN APPROVED Base checkpoint: v0.0.19-ux1c Base main: b55196412b8ab195ecb7e2e7ee4967e14 | v0.0.20-ux1d | V-UX1 |
| UX2-seller-onboarding | SLICE_CONTRACT.md | APPROVED → IMPLEMENTATION AUTHORIZED **Base checkpoint:** v0.0.20-ux1d **Base main:** d3d4 | v0.0.21-ux2 | V-UX1, V-GEO |
| UX2A-header-responsive | SLICE_CONTRACT.md | APPROVED **Base product checkpoint:** v0.0.21-ux2 **Product checkpoint commit:** 819063ba0 | v0.0.22-ux2a | V-UX1 |
| actuality-reminders | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-28 (decisions in §8; the self-made choices of the draft  | v0.0.36-actuality-reminders | — |
| address-directory | SLICE_CONTRACT.md | ACCEPTED — MERGED **Approved:** 2026-10-01 by direct Product Owner instruction: «Утверждаю | v0.0.44-address-directory | O-ADDR-IMPORT, V-GEO, V-MARKET-TEXT |
| backup-restore | SLICE_CONTRACT.md | Контракт-PR; реализация — после его merge. Часть Local readiness track (EXECUTION_PLAN.md, | v0.0.64-backup-restore | O-LIMITS, V-R1R2 |
| buyer-interest-guest-visibility | SLICE_CONTRACT.md | APPROVED — IMPLEMENTED AND MERGED **Approved:** 2026-09-21, Product Owner (RashRosh). Impl | v0.0.26-buyer-interest-guest-visibility | V-GUEST-INTEREST |
| buyer-screens-mockup | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-29 (decisions a–e in §8; the self-made choices of the dr | v0.0.37-buyer-screens | B-FILTERS, B-PROMO |
| card-editor-suggestion-scroll | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.55-card-editor-suggestion-scroll; PR #101; main ff8f08e3644af216dc | v0.0.55-card-editor-suggestion-scroll | — |
| card-opening-hours | SLICE_CONTRACT.md | Поправки PO, внесённые напрямую: чип «сегодня» убран (группа с сегодняшним днём — жирным), | v0.0.67-card-opening-hours | O-TZ |
| card-price-packaging | SLICE_CONTRACT.md | Rev 3 заменяет rev 1–2 по решениям PO (цена «/ количество», без «за»; ровно 1 единица — бе | v0.0.68-card-price-packaging | — |
| catalog-localization | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-23. Implementation on a dedicated branch per PROJECT_RUL | v0.0.28-catalog-localization | O-KK-PROOF |
| catalog-runtime-loop | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.53-catalog-runtime-loop; PR #93; main c0d1749ba352b662299708e0ce46 | v0.0.53-catalog-runtime-loop | — |
| first-entry-correction | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED (Controller, 2026-10-04; реализация — после записи эт | v0.0.48-first-entry-correction | — |
| first-entry-mobile | SLICE_CONTRACT.md | BUILT on the PO's order «Начинай» (2026-09-29) — the mockup is the source, existing code i | v0.0.38-first-entry-mobile | — |
| inline-language | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED (Controller/PO, 2026-10-04; контракт f74b858 финальны | v0.0.50-inline-language | X-LANG-URL |
| local-bootstrap-verification | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.62-local-bootstrap-verification; PR #124 (contract — PR #123); mai | v0.0.62-local-bootstrap-verification | O-LIMITS, V-R1R2 |
| localization-foundation | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-23. Implementation on a dedicated branch per PROJECT_RUL | v0.0.27-localization-foundation | O-KK-PROOF |
| mandatory-offer-price | SLICE_CONTRACT.md | APPROVED - IMPLEMENTATION AUTHORIZED **Implementation:** AUTHORIZED ## 1. User task Продав | v0.0.23-mandatory-offer-price | — |
| nearby-result-first | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED **Base checkpoint:** v0.0.44-address-directory **Base | v0.0.45-nearby-result-first | — |
| offer-actuality | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-28 (decisions in §8; the self-made choices of the draft  | v0.0.35-offer-actuality | — |
| offer-photos | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-25, with the changes recorded in §8. **Stage 1, item 1** | (нет отдельного тега; закрыт по EP/EH) | S-PHOTO-CLEANUP |
| offer-price-unit | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-23. Implementation remains gated by the order below and  | v0.0.31-offer-price-unit | — |
| operator-post-check | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-27 (decisions a–d in §8; the self-made choices of the dr | v0.0.34-operator-post-check | S-REMOVAL-NOTIFY, S-BLOCK-SELLER |
| point-contacts-hours | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-26 (migration rule and first-point hours template approv | (нет отдельного тега; закрыт по EP/EH) | B-TG-PROMISE, S-TG-CONTACT |
| post-publication-buyer-preview | SLICE_CONTRACT.md | Slice 6a: просмотр **уже опубликованного** предложения («Как видят покупатели»). Просмотр  | v0.0.71-post-publication-buyer-preview | O-KK-PROOF |
| pre-publication-buyer-preview | SLICE_CONTRACT.md | Реализации нет. Выделен из пункта 6 по решению PO (2026-10-09: «продавец должен видеть кар | v0.0.72-pre-publication-buyer-preview | O-KK-PROOF |
| production-kb-importer | SLICE_CONTRACT.md | CLOSED. **Closing evidence:** checkpoint v0.0.52-production-kb-importer-v1; main 5b2171035 | v0.0.52-production-kb-importer-v1 | C-REVIEW105 |
| s15b1-catalog-suggestion-relevance | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.54-catalog-suggestion-relevance; PR #97; main b3432e4219a412ddb82d | v0.0.54-catalog-suggestion-relevance | — |
| s15b2-known-zero | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.56-search-known-zero; PR #105; main 9383150d08943bb50de1d915193878 | v0.0.56-search-known-zero | — |
| s15b3-buyer-autocomplete | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.57-buyer-autocomplete; PR #108; main 89722495a327a444d269af04abb4e | v0.0.57-buyer-autocomplete | — |
| s15b4a-product-as-signal | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.58-product-as-search-signal; PR #111; main 9245765299231ae0fa5887a | v0.0.58-product-as-search-signal | X-CANONICAL-ONLY |
| s15b4b-relevance-sort | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.59-search-relevance-default; PR #114; main 8974acd0b3ecb9a6bcf4354 | v0.0.59-search-relevance-default | — |
| s15c-d0-search-demand-events | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.61-search-demand-events; PRs #120 (contract), #121 (implementation | v0.0.61-search-demand-events | O-D0-ORG |
| search-empty-states | SLICE_CONTRACT.md | Rev 2 = rev 1 + поправка текста: «активных предложений сейчас нет» вместо «активных карточ | v0.0.69-search-empty-states | — |
| search-home-last-state | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED (Controller/PO, 2026-10-04; контракт 49f1496 с двумя  | v0.0.49-search-home-last-state | — |
| search-sort-control-refresh | SLICE_CONTRACT.md | CLOSED. Checkpoint v0.0.60-search-sorting-control; PRs #117 (contract), #118 (implementati | v0.0.60-search-sorting-control | — |
| search-sort-distance | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED (rev 6A — final stage #5 contract; Controller/PO spli | v0.0.46-search-sort-distance | — |
| search-sort-rev3 | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED (Controller/PO, 2026-10-05; одобрено с одной поправко | v0.0.51-search-sort-rev3 | — |
| search-typo-suggestions | SLICE_CONTRACT.md | Подача объяснения изменена по решению PO: две строки текста над результатами в стиле Googl | v0.0.70-search-typo-correction | B-KK-MORPH, B-TYPO-KK, B-TYPO-MEAS |
| search-visibility-without-coordinates | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED (rev 3; финальные коррекции PO 2026-10-03: capability | v0.0.47-search-visibility-without-coordinates | V-GEO |
| search-word-forms | SLICE_CONTRACT.md | — лицензионный гейт закрыт решением PO (§12); сохранение уже допустимых результатов уточне | v0.0.66-search-word-forms | B-WORDFORMS-EXT, B-KK-MORPH, O-OC-LIC |
| seller-cabinet-overview | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-23. Implemented and closed in v0.0.30-seller-cabinet-ove | v0.0.30-seller-cabinet-overview | X-OFFER-WORKSPACE |
| seller-card-point-link | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-29, with the entry rule «everywhere the Seller sees a tr | — | — |
| seller-comment-translation | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-23. Implementation on a dedicated branch per PROJECT_RUL | v0.0.29-seller-comment-translation | O-TRANSL |
| seller-entry-contextual-auth | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED **Base product checkpoint:** v0.0.23-mandatory-offer- | v0.0.24-seller-entry | — |
| seller-location-geo-fallback | SLICE_CONTRACT.md | READY FOR PR — PRODUCT OWNER MANUAL ACCEPTANCE PASSED 2026-10-01 **Approved:** 2026-09-22, | v0.0.43-seller-location-geo-fallback | V-GEO |
| seller-offer-editor | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-23. Decisions are recorded in §8; implementation remains | v0.0.32-seller-offer-editor | — |
| seller-photo-tiles | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-29 (design/permission requests of §6 answered: 1–3 yes;  | v0.0.39-seller-photo-tiles | X-TILE-44 |
| seller-showcase-editor | SLICE_CONTRACT.md | APPROVED — Product Owner, 2026-09-27 (mixed product name and decisions a–g in §8). **Stage | v0.0.33-seller-showcase-editor | — |
| seller-trading-points-workspace | SLICE_CONTRACT.md | APPROVED — IMPLEMENTATION AUTHORIZED **Base main:** 4011dbc55b2229bb731d16d7f8fbff4f8c2626 | v0.0.25-seller-trading-points | V-MARKET-TEXT |

Каталоги без тега и без записей реестра не содержат найденных отложенных требований при проведённом SCAN; это не доказательство их отсутствия.

## 4. Источник → записи реестра

| Код | Записи (раздел источника) |
|---|---|
| EP | Q-R3 (п.2); B-FILTERS (insertion); B-UNIFY-SEARCH (insertion); B-LIVE-HOME (insertion); B-CHIPS (register 6G); B-FREETITLE-ALERT (п.8); B-SEARCH-ENGINE (п.6); B-PROMO (insertion); B-FE-OPEN (insertion); B-DESKTOP (insertion); B-THEME (insertion); B-MARKET-NAV (insertion); S-AI-INPUT (п.6); S-AI-MOD (п.6); S-VIDEO (insertion); S-ARCHIVE (insertion); S-REVIEWS (insertion); S-CONTACT-DEFAULT (insertion); S-OPERATOR (stage 11); O-PAID-INFRA (п.6); O-LAUNCH (п.6,п.8); O-AUTH (п.6,п.8); O-OTP-RESEND (insertion); O-ABUSE (п.8); O-LEGAL (п.8); O-PILOT (п.8); O-D0-ORG (п.7); C-REVIEW105 (S15A(hist)); M-READINESS (stage 11); K-PLANNING (stages 11A–12); K-COMMERCIAL; K-BOOST; K-BUSINESS; K-BACKOFFICE; V-STAGE1; V-S15; V-R1R2; V-UXSEARCH; V-PREVIEW; X-6F (п.6F/6G); X-6G (п.6F/6G); X-S25 (Commercial correction); X-LANG-URL (First Entry); X-SEARCH-BUTTON (First Entry); X-DESIGN-SYSTEM (Отменено) |
| EH | Q-R3; V-STAGE1; V-S15; V-PREVIEW; X-PASS3; X-FILTER-SHEET; X-6F |
| FM | B-INTEREST-FEED (S14); B-NOTIFY (S23); B-RECS (S24,S30,S31); B-CHIPS (Search learning); B-CATNAME-LOCALE (AI-first п.10 (решение PO 2026-09-29)); B-FREETITLE-ALERT (AI-first п.10 (решение PO 2026-09-29)); B-DISTANCE (Backlog capabilities); B-PRICE-INTEL (Backlog capabilities); B-SEMANTIC (Search System target); B-PROMO (cross-cutting); B-MARKET-NAV (Market navigation); S-AI-INPUT (S17–S20,AI Input); S-AI-MOD (S32,AI-first п.5); S-TG-CONTACT (AI-first п.7); S-TG-CHANNEL (S21); S-VIDEO (Media); S-ARCHIVE (cross-cutting); S-REVIEWS (AI-first п.9); S-CATEGORIES (Backlog capabilities); S-MANUAL-STEP (AI-first п.1–2); S-PERF (S33); S-OPERATOR (S16,MVP boundary); O-ADDR-IMPORT (KAIDA address directory); O-LAUNCH (AI-first п.12); O-AUTH (S22); O-LEGAL (AI-first п.5); O-TRANSL (localization,Translator deferred); O-KK-PROOF (localization); C-REVIEW105 (Initial Product Catalog); C-OPS (Search learning); M-D1 (D1); M-D2 (D2); M-D3 (D3); M-D4-6 (D4–D6); M-READINESS (MVP boundary); K-PLANNING (Backoffice); K-COMMERCIAL (S26,S27); K-BOOST (S28,S29); K-BUSINESS (Business chain); K-BACKOFFICE (Backoffice); V-CORE; V-SORT (AI-first п.11); V-S15; X-PASS3 (AI-first); X-FILTER-SHEET (AI-first п.11); X-S25 (S25); X-PHOTO-MANDATORY (AI-first п.4); X-MAP-PIN (address directory) |
| PR | O-LAUNCH (§10.1,§16); O-AUTH (§16); O-ABUSE (§16); O-CI-FLAKE (§7,§8) |
| AG | O-REVIEW-FILE (Git и среда) |
| CS | Q-R3; B-FREETITLE-ALERT (constraints); B-TYPO-KK; B-TYPO-MEAS; B-SEARCH-ENGINE; S-PHOTO-CLEANUP (R2); O-PAID-INFRA; O-LAUNCH (constraints); O-LIMITS (constraints); O-D0-ORG; O-SEED-ORDER; O-KK-PROOF; O-OC-LIC; O-TZ |
| GS | B-NOTIFY (G6); B-CHIPS (G5); O-PILOT; M-D1 (G5); M-D2 (G4,G6); M-D3 (G7); G-0 (G0); G-1 (G1); G-2 (G2); G-8 (G8); G-9-10 (G9,G10); V-S15 (G3); X-GROWTH-DONOTS (§6) |
| AT | R-AI-HOSTING; B-SEMANTIC; S-AI-INPUT |
| SA | O-SEC-AUTO |
| ATT | Q-R3 (db682e64); B-WORDFORMS-EXT (758416a0); R-AI-HOSTING (4cd8274f); O-PAID-INFRA (4cd8274f); O-ADDR-IMPORT (db682e64); O-MONITORING (db682e64); S-BLOCK-SELLER (db682e64); C-PARENT-HIERARCHY (88d883b1); C-OFFICIAL-CROSSWALK (610671e5); C-KB-V2 (25bbed34); C-CORPUS-LOOP (610671e5); C-CORPUS-LOOP (88d883b1); X-CANONICAL-ONLY (d1b687b0) |
| DM | S-ARCHIVE (§1.2); M-D1 (§46); M-D2; M-D3 (§35); M-D4-6 (§36); M-PRIVACY (§22); M-DESIGN-OPEN (§43); M-DEV-OPEN (§44); M-READINESS (§35–36); V-S15 (D0); X-S25 (§40); X-DEMAND-V1 (§25,§38) |
| SS | B-INTEREST-FEED; B-RECS (§26); B-SIMILAR (§2,§8,§17.3–17.4); B-FUZZY-SUGGEST (§6,§21); B-SEMANTIC (§26); C-OPS (§11); M-D2 (§10,§24); V-S15 (§24); X-CANONICAL-ONLY (§1,§4,§7,§19.4,§20) |
| CM | S-PERF (§8); M-D4-6; M-PRIVACY (§11.7); K-PLANNING; K-COMMERCIAL; K-BOOST; K-BUSINESS; K-PRICING (§11); X-S25 (§4) |
| BO | C-OPS (§4); K-PLANNING; K-BACKOFFICE (§4); X-BO-NONGOALS (§8) |
| BR | S-AI-INPUT (§21–22); S-AI-MOD (§21.12); S-NOTIF-INBOX (§7.1,§4.1); S-VIDEO; S-ARCHIVE (§11,§12,§22); S-REVIEWS (§14,§21.15); S-OPERATOR (§10); C-OPS (§21.7); X-MAP-PIN (§21.10) |
| RV | S-NOTIF-INBOX (§3.1) |
| UXR | B-UNIFY-SEARCH (spot-check №4); O-AUTH (spot-check); O-OTP-RESEND (spot-check); O-LEGAL (consent GAP); O-DOC-DEBT; V-UX1; V-GEO (spot-check №1); V-GUEST-INTEREST (spot-check №3); X-UXR-REJECTS (Issue #37 audit conclusions) |
| UXA | B-MORE-MY (§1,§6.1); B-NEARBY-DEADENDS (§1,§4.2); B-HOME-APPETITE (§5); B-READABILITY (§5); B-RESULTS-META (§4.3–4.4,§7); S-ACTUALITY-WORDS (§2.4); S-FORM-SIMPL (§2.5–2.9); O-PRELAUNCH-COPY (§5); O-PRELAUNCH-COPY (§2.1); B-TG-PROMISE (§4.1); B-BUYER-LOC (§1,§4.2); B-UX-INTERESTS (§1); S-MANUAL-STEP (§2.1); S-PERF (§4.9); X-UXD-NOT-ADOPTED (§2.3,§2.10,§3,§6) |
| UXC | — (записей нет) |
| UXB | X-DESIGN-SYSTEM |
| BJ | B-INTEREST-FEED; B-NOTIFY; B-FILTERS; B-FAV-OFFER; O-DOC-DEBT |
| SJ | S-ARCHIVE; O-DOC-DEBT; X-S25 (Деньги) |
| TF | — (записей нет) |
| OB | O-LIMITS |
| LB | O-LIMITS |
| KBC | C-PARENT-HIERARCHY |
| WFP | O-OC-LIC |
| CTL | — (записей нет) |
| RD | O-LAUNCH (Авторизация и public launch) |
| MK | S-ARCHIVE (S15,S17) |
| KKR | O-KK-PROOF; O-REVIEW-FILE |
| XLS | C-REVIEW105; C-OFFICIAL-CROSSWALK (Sources) |
| CI | — (записей нет) |
| SL | B-FILTERS (buyer-screens-mockup); B-TG-PROMISE (point-contacts-hours); B-WORDFORMS-EXT (search-word-forms (§4,§12)); B-KK-MORPH (search-word-forms (§Вне scope)); B-KK-MORPH (search-typo-suggestions); B-TYPO-KK (search-typo-suggestions (§H)); B-TYPO-MEAS (search-typo-suggestions (§8)); B-PROMO (buyer-screens-mockup); S-TG-CONTACT (point-contacts-hours); S-REMOVAL-NOTIFY (operator-post-check); S-PHOTO-CLEANUP (offer-photos (§5)); S-REVIEWS (UX1A-app-shell); O-ADDR-IMPORT (address-directory); O-OTP-RESEND (S2-auth); O-LIMITS (backup-restore); O-LIMITS (local-bootstrap-verification); O-D0-ORG (s15c-d0-search-demand-events); O-TRANSL (seller-comment-translation); S-BLOCK-SELLER (operator-post-check); O-KK-PROOF (localization-foundation); O-KK-PROOF (catalog-localization); O-KK-PROOF (post-publication-buyer-preview); O-KK-PROOF (pre-publication-buyer-preview); O-OC-LIC (search-word-forms (§12)); O-TZ (card-opening-hours (§6)); O-DOC-DEBT; C-REVIEW105 (production-kb-importer); V-CORE (S0..S13); V-UX1 (UX1A..UX2A); V-STAGE1; V-GEO (seller-location-geo-fallback); V-GEO (address-directory); V-GEO (search-visibility-without-coordinates); V-GEO (UX1C-nearby-geo-intent); V-GEO (UX2-seller-onboarding); V-GUEST-INTEREST (buyer-interest-guest-visibility); V-MARKET-TEXT (seller-trading-points-workspace); V-MARKET-TEXT (address-directory); V-R1R2 (local-bootstrap-verification); V-R1R2 (backup-restore); X-OFFER-WORKSPACE (seller-cabinet-overview); X-UX1 (UX1-marketplace-shell); X-LANG-URL (inline-language); X-TILE-44 (seller-photo-tiles (§6.5)); X-CANONICAL-ONLY (s15b4a-product-as-signal) |
| CNV | X-PASS3 (VEioj7KKfjKfhD1RZpivdQ) |
| IO | B-DISTANCE (#76); B-PRICE-INTEL (#79); B-MARKET-NAV (#10); S-AI-INPUT (#75); S-CATEGORIES (#54); O-SEC-AUTO (#83); O-CI-FLAKE (#116); C-OPS (#75); M-D1 (#55); M-D3 (#55); M-PRIVACY (#55) |
| CORP | C-PARENT-HIERARCHY (docs/production_kb_export_v1.md); C-OFFICIAL-CROSSWALK (docs/official_source_reconciliation.md); O-CORPUS-BACKUP (README) |
| GH | O-MONITORING (UX_NAVIGATION_STATE_SPEC §6 P1) |
| IC | B-FILTERS (#12); O-TEST-GUIDE (#130); V-STAGE1 (#13,#31,#32,#35,#36); V-GEO (#34); V-PHONE-GROUP (#42); V-SORT (#12); X-FILTER-SHEET (#12); X-OFFER-WORKSPACE (#27); X-TEMP-ISSUES |
| AUD | B-MARKET-NAV (Проблема №4); O-LAUNCH; V-UXSEARCH |
| UXD | B-NEARBY-DEADENDS (§7); B-READABILITY (§4.5); B-BUYER-LOC (§7); B-FAV-OFFER (§7); B-UX-INTERESTS (§4.5); B-ILLUS (§5); B-DESKTOP (§7); S-MANUAL-STEP (§4.4); S-PERF (§7); O-OTP-AUTOFILL (§7); V-SORT (§3); V-UXSEARCH (§4.1,§4.2,§5,§8); V-PREVIEW (§4.3); X-UXD-NOT-ADOPTED (§3,§6) |
| CPA | X-S25 (§9 (устаревшее описание лимита)) |
| HO25 | O-DOC-DEBT (§6); X-DESIGN-SYSTEM (§6) |
| HO29 | B-LIVE-HOME (§5); B-FAV-OFFER (§5); B-FE-OPEN (§5); B-DESKTOP (§5); B-THEME (§5); S-CONTACT-DEFAULT (§5); O-KK-PROOF (§8); X-SEARCH-BUTTON (§5); X-TILE-44 (§8) |
| CSB | V-MARKET-TEXT (recovery report) |
| MEM | B-DESKTOP; X-PASS3; X-PHOTO-MANDATORY |
| CODE | B-TG-PROMISE (FirstEntryScreen); B-CATNAME-LOCALE (buyer-offer-projection); S-TG-CONTACT (i18n); S-ARCHIVE (actuality.ts); O-DOC-DEBT; V-MARKET-TEXT (locations) |

Источники без записей: UXC, TF, CTL, CI. Для источников со статусом SCAN/HEAD/NONE отсутствие записей означает «ничего не найдено при этом уровне чтения», а не «требований нет».

## 5. Недоступное, неопределённое, потенциально недостающее

### Недоступно
Только то, что действительно недоступно (остальное в §2 доступно, но не читалось по перечисленным причинам): файлы из последней строки таблицы §2 (удалены из репозитория), репозитории kaida-product-corpus и Kaida.kz (доступ не проверялся), история PR (не выгружалась по указанию).

### Неопределённости
- **Q-SJ-VOLUME.** SELLER_JOURNEY.md, «Деньги: лимиты, тариф, продвижение»: «три независимые денежные оси: объём (сколько карточек одновременно), удобство (ускоренный пакетный ввод) и продвижение…». Оси «удобство» (плата за удобный пакетный ввод) и «продвижение» согласуются с решениями PO. Ось «объём» названа без числа и без утверждения о бесплатном лимите; точная формулировка не устанавливает коммерческий cap, поэтому это НЕ противоречие, а формулировка для уточнения при правке journeys (решение PO против hard cap остаётся в силе).
- **Q-M67.** «M6/M7» (CM §11; вложение b6bf50db п.5) нигде в репозитории не определены; PO называет их «отдельными M6/M7 после AI unit economics, реальных Demand-данных, willingness-to-pay, Boost inventory и изучения платежей в КЗ».
- **Q-DM44.** DM §44 перечисляет 20 решений «перед ТЗ разработчику»; не проверено, какие уже закрыты поставленными S15B/D0.
- **Q-PARTIAL-DOCS.** Читались частично (требования в непрочитанных разделах могли не попасть в реестр; это в основном реализованные или справочные разделы): BR §0–§9, §15–§20; CM §1–§3, §6–§9; BO §1–§3; SS кроме §8–§11, §17, §24, §26; AT §2–§5; DM §41, §47; UXR списки KEEP/ADAPT; тела #75/#76/#79 не построчно; живые артефакты и скриншоты не открывались (SOURCE_MAP §2).
- **Q-MEM-STALE.** Заметки памяти упоминают «известные хвосты» seller-offer-editor (необработанная ошибка PRODUCT_NOT_FOUND для «Баран»); не проверено, исправлены ли позднейшими slices — в реестр не внесено.
- **Q-CATALOG-ADD.** Не проверено, как сейчас добавляется Product вне импортёра Production KB (C-OPS).
- **Q-ILLUS-DONE.** Не проверено, какие из остальных пустых состояний (UXD §5) уже есть в интерфейсе (B-ILLUS); отсутствие UI-строк — подсказка, не доказательство.
- **Q-SIMILAR.** Не найдены UI-строки «похожие товары» (B-SIMILAR) — это подсказка; поведение в коде не исследовалось.
- **Q-SCHEDULER.** Какой механизм расписания считать приемлемым для будущих задач (purge D0, архив): in-process таймер напоминаний или внешний cron — решает контракт O-D0-ORG, когда он будет назначен.
- **Q-DEPENDENCY-REAL.** Зависимости в реестре взяты из источников, а не проверены кодом; новых зависимостей не придумано.

### Что нужно от PO, чтобы закрыть пробелы
1. Дать URL/доступ к репозиториям kaida-product-corpus и Kaida.kz, если они должны войти в инвентаризацию.
2. Остальное доступно; конкретных запросов к PO нет.

## 6. Дубликаты, объединённые в записи

- Автоподстановка/повтор OTP, S22, abuse: `O-AUTH`, `O-OTP-RESEND`, `O-OTP-AUTOFILL`, `O-ABUSE` (источники: FM, EP, UXR, UXD).
- Demand D0–D6 / Growth G3–G7 / Issue #55 / SS §10: `M-*` (D1, D2, D3, D4–D6) и `V-S15` (D0 = G3).
- «Посмотреть глазами покупателя»: UXD §4.3 → `V-PREVIEW`.
- Рынок/ряд/место: Issue #10, аудит, FM, EP, форма точки → `B-MARKET-NAV`.
- Отзывы/жалобы: FM п.9, EP, BR §14, §21.15, UX1A, макет → `S-REVIEWS`.

## 7. Контрольный список трассировки (проверено генератором: каждая запись существует)

Чтобы при дедупликации не потерялся ни один действенный пункт, ниже перечислены найденные пункты источников и записи, в которых они учтены (147 пунктов). **Список доказывает отображение только выявленных пунктов; он не доказывает абсолютную полноту инвентаризации** — оставшиеся ограничения чтения перечислены в §1 (покрытие PARTIAL/SCAN/HEAD) и §5.

| Источник | Пункт | Запись |
|---|---|---|
| EP insertion | Market internal navigation (#10) | B-MARKET-NAV |
| EP insertion | Additional Search filters | B-FILTERS |
| EP insertion | M2 публичное видео | S-VIDEO |
| EP insertion | Отзывы, рейтинг, жалоба на карточку | S-REVIEWS |
| EP insertion | Архив и удаление | S-ARCHIVE |
| EP insertion | OTP resend + timer | O-OTP-RESEND |
| EP insertion | Промо-баннер | B-PROMO |
| EP insertion | First Entry: остаток | B-FE-OPEN |
| EP insertion | First Entry: десктоп | B-DESKTOP |
| EP insertion | Тёмная тема | B-THEME |
| EP insertion | Контакты точки по умолчанию | S-CONTACT-DEFAULT |
| EP insertion | Избранное покупателя | B-FAV-OFFER |
| EP insertion | Живой главный экран / популярное | B-LIVE-HOME |
| EP insertion | Unify buyer Search entry points | B-UNIFY-SEARCH |
| EP п.6 | AI Input отложен | S-AI-INPUT |
| EP п.6 | AI-модерация отложена | S-AI-MOD |
| EP п.6 | Платная инфраструктура | O-PAID-INFRA |
| EP п.6 | Оценка поискового движка | B-SEARCH-ENGINE |
| EP п.7 | organic-запись и purge D0 | O-D0-ORG |
| EP п.7 | D1 и динамические чипы | M-D1 |
| EP п.7 | динамические чипы | B-CHIPS |
| EP п.8 | реальная аутентификация / OTP | O-AUTH |
| EP п.8 | защита от злоупотреблений | O-ABUSE |
| EP п.8 | юридические тексты | O-LEGAL |
| EP п.8 | объём пилота / allowlist / operator OTP | O-PILOT |
| EP п.8 | оповещения о free-title | B-FREETITLE-ALERT |
| EP stage 7/8/9 | AI Input / AI-модерация / S14 | B-INTEREST-FEED |
| EP stage 10C | D1 и основа D2 | M-D2 |
| EP stage 11 | S16 + MVP boundary + Demand readiness | S-OPERATOR |
| EP stage 11 | Demand readiness assessment | M-READINESS |
| EP stages 11A–11C | Backoffice/Commercial planning | K-PLANNING |
| EP stage 12 | Pro / Boost / Business / Backoffice | K-COMMERCIAL |
| EP stage 12 | Boost | K-BOOST |
| EP stage 12 | Business | K-BUSINESS |
| EP stage 12 | Backoffice slices | K-BACKOFFICE |
| EP R3 | R3 развёртывание (ON HOLD) | Q-R3 |
| FM S14/S16/S33 | S14, S16, S33 | S-PERF |
| FM S17–S20 | AI Input | S-AI-INPUT |
| FM S21 | Telegram как канал | S-TG-CHANNEL |
| FM S22 | реальный SMS | O-AUTH |
| FM S23 | уведомления покупателю | B-NOTIFY |
| FM S24/S30/S31 | рекомендации | B-RECS |
| FM S25 | hard cap (снят) | X-S25 |
| FM S26–S27 | commercial foundation и Pro | K-COMMERCIAL |
| FM S28–S29 | Boost | K-BOOST |
| FM S32 | AI-модерация | S-AI-MOD |
| FM D1–D6 | Demand D1/D2/D3/D4–D6 | M-D3 |
| FM D4–D6 | paid Demand | M-D4-6 |
| FM п.10 | название каталога на языке покупателя | B-CATNAME-LOCALE |
| FM п.10 | оповещение оператору о free-title | B-FREETITLE-ALERT |
| FM п.9 | жалоба на карточку целиком | S-REVIEWS |
| FM localization | подключение переводчика | O-TRANSL |
| FM п.7 | Telegram-подтверждение контакта | S-TG-CONTACT |
| CS | KK-вычитка | O-KK-PROOF |
| CS | лицензия OpenCorpora | O-OC-LIC |
| CS | tz-база устройств | O-TZ |
| CS | замер задержки typo | B-TYPO-MEAS |
| CS | ограничения R1/R2 | O-LIMITS |
| CS | seed после импорта KB | O-SEED-ORDER |
| CS | KK-исправление опечаток | B-TYPO-KK |
| GS G0 | Launch Cell | G-0 |
| GS G1 | Supply Seeding | G-1 |
| GS G2 | Seller QR | G-2 |
| GS G3 | Demand Capture = D0 | V-S15 |
| GS G4/G6 | Я хочу это / Товар появился | M-D2 |
| GS G5/G7 | агрегация / сигнал продавцу | M-D3 |
| GS G8 | Bounty | G-8 |
| GS G9–G10 | Demand Radar / SEO | G-9-10 |
| GS §6 | чего не делать на запуске | X-GROWTH-DONOTS |
| SA | триггеры Trivy/Syft/SLSA/Semgrep/OSV | O-SEC-AUTO |
| AT | семантический resolution, evaluation gate, residency | B-SEMANTIC |
| Issue #10 | навигация по рынкам | B-MARKET-NAV |
| Issue #54 | категории продавца | S-CATEGORIES |
| Issue #55 | Demand | M-D1 |
| Issue #75 | правила AI-разбора | S-AI-INPUT |
| Issue #76 | чувствительность к расстоянию | B-DISTANCE |
| Issue #79 | Price Intelligence | B-PRICE-INTEL |
| Issue #83 | security automation | O-SEC-AUTO |
| Issue #116 | CI flake | O-CI-FLAKE |
| Issue #42 | группировка телефона | V-PHONE-GROUP |
| Issue #130 | правило для тестов | O-TEST-GUIDE |
| Issue #32 | внешний канал напоминаний | B-NOTIFY |
| Issue #12 | будущие фильтры | B-FILTERS |
| DM §43 | presentation details Demand | M-DESIGN-OPEN |
| DM §44 | 20 решений перед ТЗ разработчику | M-DEV-OPEN |
| DM §22 | privacy-порог | M-PRIVACY |
| DM §38 | вне Demand v1 | X-DEMAND-V1 |
| DM §35–36 | readiness gates | M-READINESS |
| CM §11 | открытые коммерческие решения | K-PRICING |
| BO §3–§9 | планирование Backoffice | K-PLANNING |
| BO §8 | non-goals планирования | X-BO-NONGOALS |
| BR §8.6 | хранение исходных медиа 7 дней | S-AI-INPUT |
| BR §12 | архив, 30 дней | S-ARCHIVE |
| BR §14 | отзывы/жалобы/апелляции | S-REVIEWS |
| BR §21–22 | contract gaps и открытые технические решения | S-AI-INPUT |
| BR §7.1 AI-S18 | inbox уведомлений | S-NOTIF-INBOX |
| SS §6–§7 | fuzzy-подсказки Product | B-FUZZY-SUGGEST |
| SS §8/§17 | похожие товары | B-SIMILAR |
| SS §10 | unresolved interest | M-D2 |
| SS §11 | пополнение каталога продавцом | C-OPS |
| SS §1/§4 | canonical-only | X-CANONICAL-ONLY |
| UXD §4.4 | лишний шаг при ручном вводе | S-MANUAL-STEP |
| UXD §4.5 | интересы / читаемость / Telegram в демо | B-UX-INTERESTS |
| UXD §4.5 | читаемость | B-READABILITY |
| UXD §5 | остальные пустые состояния | B-ILLUS |
| UXD §7 | ручное местоположение | B-BUYER-LOC |
| UXD §7 | статистика продавца | S-PERF |
| UXD §7 | автоподстановка OTP | O-OTP-AUTOFILL |
| UXD §6 | не принято автоматически | X-UXD-NOT-ADOPTED |
| UXD §8 | словоформы/опечатки | V-UXSEARCH |
| UXA §1 | Ещё → Моё | B-MORE-MY |
| UXA §1 | тупики «Рядом» | B-NEARBY-DEADENDS |
| UXA §2.4 | слова актуальности | S-ACTUALITY-WORDS |
| UXA §2.5–2.9 | упрощение форм | S-FORM-SIMPL |
| UXA §5 | аппетит главной | B-HOME-APPETITE |
| UXA §4.3–4.4 | счётчик/время обновления | B-RESULTS-META |
| UXA §5 | служебное до запуска | O-PRELAUNCH-COPY |
| UXA §4.1 | Telegram в демо | B-TG-PROMISE |
| AUD | разделение #10 | B-MARKET-NAV |
| AUD | правило для регрессий #116 | O-CI-FLAKE |
| AUD | Growth как операции | G-1 |
| SL offer-photos §5 | очистка неприкреплённых фото, CDN | S-PHOTO-CLEANUP |
| SL operator-post-check | уведомление продавца о снятии | S-REMOVAL-NOTIFY |
| SL point-contacts-hours | Telegram/Instagram | S-TG-CONTACT |
| SL search-word-forms | расширение словаря | B-WORDFORMS-EXT |
| SL search-word-forms | морфология казахского | B-KK-MORPH |
| SL buyer-screens | отзывы/промо/M2 | S-REVIEWS |
| UXR #37 | REJECT-список аудита | X-UXR-REJECTS |
| UXR spot-check | OTP resend/consent GAP | O-OTP-RESEND |
| UXR spot-check | consent/Privacy GAP | O-LEGAL |
| HO29 | плитки 36×44 | X-TILE-44 |
| HO25/CODE | ссылки на DESIGN_SYSTEM | O-DOC-DEBT |
| KKR | пакет KK на проверку | O-KK-PROOF |
| XLS | 105 REVIEW | C-REVIEW105 |
| CORP | иерархия, crosswalk, v2, loop, backup корпуса | C-PARENT-HIERARCHY |
| CORP | crosswalk | C-OFFICIAL-CROSSWALK |
| CORP | v2 | C-KB-V2 |
| CORP | unresolved loop | C-CORPUS-LOOP |
| CORP | корпус только локально | O-CORPUS-BACKUP |
| GH UX_NAVIGATION_STATE_SPEC | наблюдаемость перевода/контактных ссылок | O-MONITORING |
| ATT db682e64 | блокировка продавца | S-BLOCK-SELLER |
| ATT db682e64 | мониторинг | O-MONITORING |
| ATT db682e64 | импорт справочника адресов | O-ADDR-IMPORT |
| ATT 4cd8274f | хостинг/AI-рантайм | R-AI-HOSTING |
| ATT b6bf50db | коммерческие решения | K-COMMERCIAL |
| SJ money | ось «объём» (устарело) | X-S25 |
| RD | public launch проверки | O-LAUNCH |

## 8. Предложенная правка SECURITY_AUTOMATION.md (D-SA; применена в локальном черновике)

Было (раздел «Правило срабатывания»): исполнитель обязан до production deploy/release: 1. остановить инфраструктурный шаг; 2. создать маленькую maintenance-задачу на нужную automation; 3. установить только инструмент(ы) сработавшего триггера; 4–6. прогнать, зафиксировать, продолжить.

Стало: пункт 1 (стоп) без изменений; пункт 2 — «предложить PO маленькую maintenance-задачу …»; пункт 3 — «после авторизации PO установить …»; добавлена фраза: «Сработавший триггер — повод вынести решение PO и сам не разрешает реализацию; обязательный стоп безопасности сохраняется».

## 9. Расхождения, решения PO и неопределённости (снимок 2026-10-09, дословно из реестра)

_Перенесено из `REQUIREMENTS_REGISTER.md` на `67113c9`. Открытые пункты ведёт `EXECUTION_PLAN.md` (§6, «Открытые расхождения документов»); этот раздел не обновляется._

#### Фактические (установлены по репозиторию; исправление не применялось молча)

| № | Что расходится | Что сделано / где отражено |
|---|---|---|
| F1 | Старые блоки плана «Verified base» и «Последний verified product checkpoint» называли main eba91aa, v0.0.62 и v0.0.65 одновременно при фактическом v0.0.72. | Исправлено сокращением плана; факты checkpoint — только в CURRENT_STATE.md |
| F2 | Раздел плана «Правки экранов продавца после ручного просмотра PO» называл контракты seller-photo-tiles и seller-card-point-link «DRAFT»; оба APPROVED и реализованы (v0.0.39, v0.0.41). | Исправлено в черновике: поставленное перенесено в EXECUTION_HISTORY.md, остаток оставлен (D-INSERT выполнено) |
| F3 | Открытый Issue #116 отсутствовал в «ISSUE REGISTER» плана. | Исправлено в черновике: строка #116 добавлена (UNSCHEDULED Development, вне R3) |
| F4 | Разделы плана «Аналитика поиска и живой главный экран покупателя» и «Стартовая страница сервиса — First Entry» описывали как будущее то, что поставлено (D0 v0.0.61, Search Home v0.0.49, First Entry mobile v0.0.38/v0.0.48, typo v0.0.70). | Исправлено в черновике: поставленное перенесено в историю, остаток оставлен |
| F5 | Ссылки на отсутствующие файлы: UX_REFERENCE_INDEX.md → docs/DESIGN_SYSTEM.md, docs/product/WIREFRAME_BRIEF.md; UX2-seller-onboarding → DESIGN_SYSTEM.md; localization-foundation и seller-cabinet-overview → UX_NAVIGATION_STATE_SPEC.md, WIREFRAME_PASS3_REVIEW.md; seller-cabinet-overview → slices/seller-offer-workspace и seller-points-contacts; seller-location-geo-fallback → WIREFRAME_BRIEF.md; S5 → IMPLEMENTATION_NOTES.md; контракты S0–S9 ссылаются на src-файлы, которых нет в текущем дереве; комментарии кода (src/app/globals.css, src/modules/sellers/db/sellers.table.ts) ссылаются на DESIGN_SYSTEM.md. Прежнее утверждение «битых ссылок нет» относилось только к плану, Feature Map, PROJECT_RULES, AGENTS и CURRENT_STATE и заменено этим пунктом. | Открыто; в реестре — O-DOC-DEBT; ничего не правилось |
| F6 | Строки статуса закрытых контрактов не отражают закрытие: S6–S9, S11, S12, S1–S2, pre-publication-buyer-preview («Реализации нет»), search-typo-suggestions, seller-trading-points-workspace и др. | Открыто; все эти slices закрыты тегами (REQUIREMENTS_SOURCE_MAP §3); O-DOC-DEBT |
| F7 | BUYER_JOURNEY/SELLER_JOURNEY используют будущее время для поставленного («Позже … сортировка по цене», «позже — и цену» в ранжировании). | Открыто; O-DOC-DEBT |
| F8 | Telegram показан как контакт в демо-примере First Entry (src/app/(buyer)/_ui/FirstEntryScreen.tsx, строки 199–203: телефон + знак WhatsApp 127a… + знак Telegram 24ad…), хотя контракт point-contacts-hours: «Telegram and Instagram no longer appear anywhere», Telegram — «added later with a KAIDA bot». Ключ messages.ts home.description («Звонок, WhatsApp, Telegram — без посредников») определён, но не используется ни одним компонентом. | Открыто; S-TG-CONTACT; решение — D-TG в таблице ниже |
| F9 | Feature Map (AI-first п.10): оповещение оператору о карточке вне каталога «входит в stage 10»; EP п.8 и CURRENT_STATE: оповещения о free-title — pilot-функция, не добавлять без решения PO. | Открыто; B-FREETITLE-ALERT (NEEDS-DECISION) |
| F10 | Feature Map (AI-first п.10): показ названия из каталога на языке покупателя «вводится внутри S15B»; S15B закрыт, а проекция показывает слова продавца на всех языках. | Открыто; B-CATNAME-LOCALE (NEEDS-DECISION) |
| F11 | docs/reviews/localization-foundation-kk-review.docx отслеживался Git, а AGENTS.md и handoff называют его личным неотслеживаемым файлом PO. Файл добавлен коммитом 0c41f2a (автор RashRosh, «docs: no-photo reminder copy; opening-hours state icon») — коммит не про него. | Исправлено в этом PR: снят с индекса (index-only), локальная копия и .md-пакет сохранены; D-REVIEW-FILE |
| F12 | EP п.6 и CURRENT_STATE говорили «запуск без AI-ввода/AI-модерации не утверждён»; решение PO: условием запуска является AI-ввод, AI-модерация — нет. | Исправлено в черновике (EP, CURRENT_STATE, Feature Map п.12) |
| F13 | BR §10 (ТЗ дизайнеру) предписывает обязательную автоматическую модерацию до buyer visibility; FM п.5 допускает публикацию сразу с пост-проверкой, а решение PO не делает AI-модерацию условием запуска. | Действует FM п.5 + решение PO; BR — историческое ТЗ, не менялось |
| F14 | Внешние инструкции ChatGPT-проекта (CPA §9) описывают бесплатный лимит ≈10 активных Offers; решение PO отменило hard cap. | ОТКРЫТОЕ ВНЕШНЕЕ РАСХОЖДЕНИЕ, не блокер: репозиторий не затронут; одобренный текст замены есть (D-EXT), применение PO — PENDING, не подтверждено; внешний проект этим PR НЕ менялся. Действует решение PO об отсутствии hard cap |
| F15 | DM §1.2 называет «архив» существующим; в коде найдена только стадия актуальности archived (≥ 336 ч); раздел архива, восстановление, 30-дневный срок и «Удалить» не найдены (отсутствие UI-строк — лишь подсказка, но поиск в коде ничего не показал). | S-ARCHIVE уточнён; DM не менялся |
| F16 | Моё прежнее утверждение, что кадр «Gaps» макета недоступен, было неверным: Gaps.dc.html лежит в репозитории (docs/product/mockup/seller-ai-first-rev1/) и прочитан вместе с тегами Gap/Open/Proposed по всем артбордам. | Исправлено в инвентаризации |
| F18 | BR §9.1 (ТЗ дизайнеру): «Настроить данные по точкам» открывает overrides цены, единицы, фасовки, media и комментария; Feature Map п.6 (решение PO): название, фото и комментарий общие для всех точек, отдельно по точке меняется только цена. | Действует Feature Map (PR §18.1: решения PO сильнее brief); BR не менялся |
| F17 | Предложение агента о manual pilot readiness (вложение db682e64) говорит, что напоминания об актуальности «требуют внешнего cron»; в коде есть и in-process таймер (каждые 15 мин, при наличии push-ключей), и защищённый endpoint для ручного/внешнего запуска. | Учтено в O-D0-ORG; требование purge не изменено |

#### Решения PO по расхождениям документов (4; D-KK, D-TG, D-REVIEW-FILE разрешены в этом PR, применение D-EXT во внешнем проекте — pending)

Все четыре решения одобрены PO; ни одно не блокирует консолидацию документации. Другие нерешённые вопросы — это записи реестра со статусом NEEDS-DECISION (7: B-CATNAME-LOCALE, B-FREETITLE-ALERT, O-AUTH, O-OTP-RESEND, O-ABUSE, O-LEGAL, O-PILOT); они продуктовые, остаются явными решениями в backlog и не блокируют консолидацию документации. Всего зафиксировано находок: 18 (из них исправлено в черновике или закрыто: 11); нерешённых решений PO по расхождениям: 4.

| Решение | Конфликтующая формулировка A (место, авторитет) | Конфликтующая формулировка B (место, авторитет) | Минимальное предлагаемое разрешение |
|---|---|---|---|
| D-KK | FEATURE_MAP.md, раздел Localization (решение PO 2026-09-23): «Kazakh KAIDA-owned strings and Kazakh catalog names may be drafted by an LLM but are verified by a native Kazakh speaker before merge». | PROJECT_RULES.md §18.5 (решение PO 2026-10-04): «Desktop visual acceptance, kk visual acceptance и качество казахского текста не являются gate текущих slices… казахский текст предварительный»; контракт localization-foundation: native review «does not block implementation or merge». | ПРИМЕНЕНО в этом PR (одобрено PO): Feature Map теперь говорит, что казахский текст остаётся предварительным до проверки носителем, в текущей границе доставки это не gate merge, а вычитка остаётся невыполненной работой (O-KK-PROOF). |
| D-TG | Демо First Entry (FirstEntryScreen.tsx, строка 203) показывает знак Telegram; ключ messages.ts home.description определён, но не используется. | point-contacts-hours (APPROVED PO 2026-09-26) §8: «Telegram and Instagram no longer appear anywhere»; Telegram «added later with a KAIDA bot that proves the account». | ЗАРЕГИСТРИРОВАНО (одобрено PO): B-TG-PROMISE — несрочная продуктовая коррекция (UNSCHEDULED); изменений интерфейса и контракта контактов в этом PR нет. |
| D-REVIEW-FILE | AGENTS.md:147: «Никогда не коммитить личные файлы PO: docs/reviews/localization-foundation-kk-review.docx, scripts/, tmp/, .vscode/». | Git отслеживал .docx (добавлен 0c41f2a вместе с несвязанными правками). Проверка зависимостей: ссылок на .docx из отслеживаемых документов нет, кроме запрета в AGENTS.md; содержимое — форма «☐ OK / Исправление» для тех же 265 строк, что и .md, оба без заполненных решений. | ПРИМЕНЕНО в этом PR (одобрено PO): index-only удаление .docx; локальная копия сохранена; .md-пакет остаётся в репозитории; правило AGENTS.md сохраняется. |
| D-EXT | Внешние инструкции ChatGPT-проекта «KAIDA.KZ DEV 2.0» (зеркало C:\Users\RoboRash\.codex\.chatgpt-projects\g-p-6aa3…\AGENTS.md), §9: «1. Объём. Бесплатный тариф ограничивает число активных Offers. Рабочее значение около 10 допустимо как гипотеза…». | Решение PO (вложение b6bf50db, п.13): «не вводить hard commercial assortment cap… Любое возвращение commercial assortment cap требует отдельного PO decision»; FEATURE_MAP S25, CM §4, DM §40, PR §17. Проверено: в src нет ограничения числа активных Offers (есть только технический лимит точек на карточку). | Текст замены §9 УТВЕРЖДЁН PO для применения во внешних инструкциях; СТАТУС ПРИМЕНЕНИЯ: PENDING (не подтверждён), внешний проект этим PR не менялся, не блокер. Текст: «## 9. Монетизация
Коммерческая модель и упаковка — в docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md (не дублировать здесь). Устойчивые правила: hard commercial cap на число активных Offers не используется (допустимы только technical, anti-abuse и fair-use limits); подписка продавца и платное продвижение Offer — независимые направления и не смешиваются; платное продвижение не нарушает органическую релевантность.» |

#### Закрытые решения PO этого прохода

- **D-AI-SCOPE.** Условием запуска является только AI-ввод (S17–S20); AI-модерация (S32) нет; ручные требования модерации сохраняются; публикация без модерации не разрешена.
- **Q-AI-FALLBACK.** Не конфликт: AI-ввод должен быть доступен к запуску, ручные core-сценарии остаются рабочими при недоступности AI-сервиса (PR §10.1 сохраняется).
- **Q-MOD-LAUNCH.** Оценка достаточности ручной модерации при запуске — предложенная проверка готовности в S-OPERATOR, не требование и не блокер.
- **D-VOCAB.** Семь статусов приняты; REJECTED включает superseded с явной заменой; UNCLASSIFIED удалена (добавлена необязательная метка NON-GOAL для ограниченных по объёму исключений).
- **D-INSERT.** Поставленные части разделов «Insertion candidates» перенесены в EXECUTION_HISTORY.md, оставшиеся требования сохранены в плане.
- **D-CI.** #116 — UNSCHEDULED Development вне R3; правило триажа сбоев (PR §7–§8) сохранено в записи.
- **D-SA.** Обязательные стопы безопасности сохраняются; триггер — повод для решения PO и не разрешает реализацию. Предложенная правка текста — REQUIREMENTS_SOURCE_MAP.md §7 (применена в черновике SECURITY_AUTOMATION.md).
- **D-MARKET.** #10 оставлен целым; текущее текстовое покрытие — отдельная запись V-MARKET-TEXT без оценки достаточности.
- **D-ARCH.** Зависимость от закрытой работы по актуальности снята; невыполненные требования архива сохранены (S-ARCHIVE).
- **D-MEM.** Операционные ограничения ведёт CURRENT_STATE.md; реестр их индексирует.
- **D-ATTACH.** Связанные с проектом вложения прочитаны/проверены; несвязанный частный материал пропущен.
- **D-OWNERS.** Дополнительный столбец владельца не нужен; существующие явно назначенные владельцы и ссылки сохранены.
- **D-PURGE.** Purge D0 — отдельная Operations-задача, gate: решение включить organic-запись и среда с расписанием; в R3 автоматически не входит.
- **D7.** Planning audit и UX/UI-обсуждение переданы и учтены.

#### Неопределённости и пробелы проверки

- **Q-SJ-VOLUME.** SELLER_JOURNEY.md, «Деньги: лимиты, тариф, продвижение»: «три независимые денежные оси: объём (сколько карточек одновременно), удобство (ускоренный пакетный ввод) и продвижение…». Оси «удобство» (плата за удобный пакетный ввод) и «продвижение» согласуются с решениями PO. Ось «объём» названа без числа и без утверждения о бесплатном лимите; точная формулировка не устанавливает коммерческий cap, поэтому это НЕ противоречие, а формулировка для уточнения при правке journeys (решение PO против hard cap остаётся в силе).
- **Q-M67.** «M6/M7» (CM §11; вложение b6bf50db п.5) нигде в репозитории не определены; PO называет их «отдельными M6/M7 после AI unit economics, реальных Demand-данных, willingness-to-pay, Boost inventory и изучения платежей в КЗ».
- **Q-DM44.** DM §44 перечисляет 20 решений «перед ТЗ разработчику»; не проверено, какие уже закрыты поставленными S15B/D0.
- **Q-PARTIAL-DOCS.** Читались частично (требования в непрочитанных разделах могли не попасть в реестр; это в основном реализованные или справочные разделы): BR §0–§9, §15–§20; CM §1–§3, §6–§9; BO §1–§3; SS кроме §8–§11, §17, §24, §26; AT §2–§5; DM §41, §47; UXR списки KEEP/ADAPT; тела #75/#76/#79 не построчно; живые артефакты и скриншоты не открывались (SOURCE_MAP §2).
- **Q-MEM-STALE.** Заметки памяти упоминают «известные хвосты» seller-offer-editor (необработанная ошибка PRODUCT_NOT_FOUND для «Баран»); не проверено, исправлены ли позднейшими slices — в реестр не внесено.
- **Q-CATALOG-ADD.** Не проверено, как сейчас добавляется Product вне импортёра Production KB (C-OPS).
- **Q-ILLUS-DONE.** Не проверено, какие из остальных пустых состояний (UXD §5) уже есть в интерфейсе (B-ILLUS); отсутствие UI-строк — подсказка, не доказательство.
- **Q-SIMILAR.** Не найдены UI-строки «похожие товары» (B-SIMILAR) — это подсказка; поведение в коде не исследовалось.
- **Q-SCHEDULER.** Какой механизм расписания считать приемлемым для будущих задач (purge D0, архив): in-process таймер напоминаний или внешний cron — решает контракт O-D0-ORG, когда он будет назначен.
- **Q-DEPENDENCY-REAL.** Зависимости в реестре взяты из источников, а не проверены кодом; новых зависимостей не придумано.

#### Что не входит в этот проход

Скрипт проверки консистентности — после утверждения структуры. Предполагаются **локальные структурные** проверки без сети: уникальные ID, допустимые значения вида/статуса/метки, наличие источника и зависимости у каждой записи, существование ссылок на файлы, соответствие маршрутизатора файлам (разовый прототип таких проверок уже выполнен при генерации этого файла). Состояние Issues — опциональная неблокирующая локальная команда, не зависимость CI. Изменения продукта, контрактов, создание/разделение Issues, коммиты — не авторизованы.
