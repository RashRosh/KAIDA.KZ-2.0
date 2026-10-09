# KAIDA.KZ 2.0 — Agent Router

Этот файл не является product spec или roadmap. Его задача — сказать агенту, **какие источники читать для конкретной работы**.

## Перед любой работой

Сначала самостоятельно проверь фактический repository state: текущий `main`, relevant branch/PR, последний verified checkpoint/tag и CI evidence.

Затем прочитай:

1. `docs/PROJECT_RULES.md` — процесс, verification и устойчивые product/architecture boundaries;
2. `docs/product/EXECUTION_PLAN.md` — единственный канонический текущий порядок работ;
3. `docs/product/FEATURE_MAP.md` — долгосрочные capabilities и зависимости;
4. `docs/agents/CURRENT_STATE.md` — операционный снимок текущей задачи (сверь с git/GitHub, он может устареть).

По необходимости (планирование, поиск «где живёт требование», разбор backlog):

- `docs/product/REQUIREMENTS_REGISTER.md` — индекс требований: вид работы, статус, зависимости, ссылки на владельца. **Индекс, не очередь и не разрешение на реализацию:** статус в реестре не заменяет `EXECUTION_PLAN.md` и прямую команду PO;
- `docs/product/EXECUTION_HISTORY.md` — закрытая история плана; не источник очередности, читать только когда нужен исторический контекст.

Не используй chat memory, старый README, historical status line или номер следующего `Sxx` как замену актуальному `EXECUTION_PLAN.md`.

## Persistent work state / handoff между агентами

`docs/agents/CURRENT_STATE.md` — общая операционная память между агентами и сессиями. Считай, что текущая сессия может оборваться в любой момент из-за usage/context limits, поэтому не откладывай handoff на конец сессии.

В начале каждой сессии:

1. сверяй `CURRENT_STATE.md` с фактическими `git status`, `git diff`, последними commits, relevant branch/PR, checkpoint/tag и CI;
2. читай текущий Slice Contract, если работа относится к slice;
3. если snapshot устарел, сначала исправь его по repository evidence, не продолжай работу из предположения;
4. не перепроектируй закрытую работу и не перепроверяй старые checkpoints без конкретной причины.

Перед каждым следующим **существенным** шагом, если его потеря сделает восстановление неоднозначным:

- обнови `Current task` / `Next action` до начала действия;
- кратко зафиксируй ожидаемый результат и существенные ограничения текущего шага;
- не превращай файл в подробный план или лог.

После завершения логически законченного шага или repository gate:

- обнови `Last completed`;
- обнови фактический verification status/evidence;
- зафиксируй следующий `Next action` **до** начала следующего существенного шага.

`CURRENT_STATE.md` хранит только текущее восстановимое состояние: verified base, active branch/task, last completed, verification, blocker при наличии, next action и локальные ограничения. История и длинная очередь туда не копируются: текущей очередью владеет только `EXECUTION_PLAN.md`.

### Compactness policy для `CURRENT_STATE.md`

`CURRENT_STATE.md` — **overwrite-style operational snapshot, а не append-only log**.

При каждом обновлении snapshot:

- удаляй superseded facts, закрытые blockers, obsolete failures, duplicate CI evidence и historical diagnosis, которые больше не влияют на следующий шаг;
- не сохраняй старую попытку только потому, что она когда-то была важна: Git history, PR, Issues и CI artifacts уже являются историческим источником;
- если старый failure всё ещё причинно объясняет текущий blocker, оставь только краткую ссылку на него и актуальный вывод;
- при переходе к новому slice или новой активной задаче перепиши snapshot под новую работу, не перетаскивай историю предыдущего slice;
- держи файл примерно в пределах **50–80 строк и не более ~6 KB**; если он вышел за этот предел, сожми его **до следующего существенного шага**;
- компактность не имеет права скрывать незакрытый risk, непроверенную работу, dirty worktree или STOP condition.

Фактический код всегда сильнее snapshot: намерение предыдущего агента читается из `CURRENT_STATE.md`, а реально успевшие изменения — из git diff/status/commits. Не утверждай, что незакоммиченная или непроверенная работа уже находится в remote/CI.

## Reasoning effort policy

Используй минимальный достаточный reasoning effort, если текущий клиент позволяет им управлять:

- `low` — механические docs/copy changes и узкие детерминированные правки без product/architecture решения;
- `medium` — default для обычной реализации уже утверждённого Slice Contract и понятных тестовых исправлений;
- `high` — DB migration, public API, auth/security/privacy, concurrency/atomicity, data loss, external service, contract revision, архитектурное решение или неясный regression;
- `high` / `xhigh` — Controller, closed-contract audit, checkpoint readiness и сложный cross-module review; `xhigh` только если поддерживается клиентом и сложность это оправдывает;
- `max` — только по явной объективной причине, когда более низкий уровень уже недостаточен.

Это routing policy, а не повод изображать техническое переключение. Если клиент не умеет менять effort программно или нужный уровень недоступен, не заявляй, что переключение произошло; работай в доступном режиме и отмечай рекомендуемый уровень только если это существенно для качества проверки.

## Если готовится или реализуется конкретный slice

Дополнительно прочитай:

- утверждённый `docs/slices/**/SLICE_CONTRACT.md`, если он уже существует;
- contracts закрытых slices, которые реально затрагивает изменение;
- detailed GitHub Issue, если текущий этап ссылается на него.

Slice Contract определяет точное поведение и acceptance. Issue/Feature Map/макет не имеют права молча расширять его scope.

## Commercial / Monetization / Backoffice work

Перед planning или implementation, связанными с Free / Pro / Boost / Business, тарифами, entitlements, usage,
Billing, Promotion или административными workflows, дополнительно прочитай:

- `docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`;
- `docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`;
- `docs/product/KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md`, если затронут Demand.

Эти документы — parent product/planning sources, а не разрешение на реализацию. Backoffice остаётся клиентом общего
backend/domain, Commercial & Monetization Readiness предшествует его IA/UX, а каждый implementation workflow требует
своего места в `EXECUTION_PLAN.md` и отдельного Slice Contract.

## UI / UX work

Перед подготовкой или реализацией UI/UX Slice Contract дополнительно прочитай:

- `docs/PROJECT_RULES.md` §18.1 (какой макет сейчас главный) и §18.4 (обязательные UI-правила);
- для продавца — `docs/product/SELLER_AI_FIRST_DESIGN_BRIEF.md`, `SELLER_AI_FIRST_DESIGN_REVISION_1.md` и сам макет;
- `docs/product/UX_REFERENCE_INDEX.md` и только релевантные внешние UX references для текущей user task.

Отдельного документа дизайн-системы нет: визуальный стиль задаёт принятый макет. Внешние references — advisory
(`KEEP / ADAPT / REJECT / GAP`, `PROJECT_RULES.md` §18).

Экраны продавца собираются из разметки и классов макета, а не из своих стилей:

- `src/app/seller/kaida.css` — механический порт `docs/product/mockup/seller-ai-first-rev1/kaida.css` (всё под `.kaida`,
  `/_blob/<id>` → `/kaida/icons/<id>.svg`); вручную не править — пере-генерировать из макета;
- `src/app/seller/kaida-app.css` — только рамка экрана и реальные контролы (input/select/checkbox);
- `src/app/seller/_kaida/ui.tsx` — общие блоки (`Phone`, `Bar`, `Nav`, `Sheet`, `Toast`, `Check`, …);
- иконки берутся из макета (`public/kaida/icons`), новые рисованные иконки не добавляются.

Если `EXECUTION_PLAN.md` содержит незакрытый обязательный UX/design maintenance gate, следующий UI/UX product slice не начинается до закрытия этого gate.

## KAIDA Controller mode

Если пользователь просит `Проверь <slice>`, `Запусти KAIDA Controller`, проверить contract, diff, readiness к manual acceptance/merge/checkpoint или выступить независимым контролёром — дополнительно прочитай:

- `docs/agents/KAIDA_CONTROLLER.md`.

Controller не проектирует и не реализует slice. Он проверяет exact repository evidence и даёт gate verdict.

## Главное правило

У каждого типа информации один владелец:

- процесс и boundaries → `PROJECT_RULES.md`;
- текущая очередь → `EXECUTION_PLAN.md`;
- индекс требований (вид / статус / зависимости / ссылка на владельца) → `REQUIREMENTS_REGISTER.md`; закрытая история плана → `EXECUTION_HISTORY.md`;
- долгосрочная capability map → `FEATURE_MAP.md`;
- commercial semantics Free / Pro / Boost / Business → `KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`;
- Backoffice planning/decomposition → `KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`;
- визуальный стиль и композиция → принятый макет (`PROJECT_RULES.md` §18.1); обязательные UI-правила → `PROJECT_RULES.md` §18.4;
- unresolved detailed work → GitHub Issues;
- exact slice behavior → Slice Contract;
- текущее состояние работы → `docs/agents/CURRENT_STATE.md` (коротко, без истории).

Не создавай параллельный roadmap или второй набор инструкций без объективной необходимости.

## Git и среда

- Product Owner — нетехнический, пишет по-русски. Commit, push, PR, merge, tag — только по его прямому поручению.
- Никогда не коммитить личные файлы PO: `docs/reviews/localization-foundation-kk-review.docx`, `scripts/`, `tmp/`,
  `.vscode/`. Идентификаторы моделей в коммиты и документы не писать.
- Облачный контейнер: `dockerd` запускать вручную, затем `docker compose up -d --wait`; `pnpm db:migrate`,
  `pnpm db:seed`, `pnpm db:test:prepare` (пересоздаёт тестовую БД). E2E идёт на production build
  (`pnpm build`, затем `pnpm test:e2e`; серверы 3100/3101). Integration с `ECONNREFUSED 5432` = БД не запущена.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
