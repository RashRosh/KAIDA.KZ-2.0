# KAIDA.KZ 2.0 — Agent Router

Этот файл — короткая навигация и критичные входные инструкции, не product spec и не roadmap. Правила и роли документов живут в `docs/PROJECT_RULES.md` (§2); здесь только: что читать.

## Перед любой работой

Сначала самостоятельно проверь фактический repository state: текущий `main`, relevant branch/PR, последний verified checkpoint/tag и CI evidence. Затем прочитай:

1. `docs/PROJECT_RULES.md` — процесс, verification, устойчивые boundaries, роли документов (§2), handoff (§21), reasoning effort (§22);
2. `docs/product/EXECUTION_PLAN.md` — общий production plan: текущее положение, утверждённый порядок, все оставшиеся workstreams и задачи с состоянием, зависимостями и следующим действием, соответствие открытым Issues. **Единственный источник очерёдности; не разрешение на реализацию;**
3. `docs/agents/CURRENT_STATE.md` — операционный снимок текущей задачи; сверь с git/GitHub, он может устареть;
4. `docs/product/FEATURE_MAP.md` — обзор capabilities и зависимостей (по необходимости);
5. `docs/product/REQUIREMENTS_REGISTER.md` — только когда нужен индекс требований: ID → источники → вспомогательные подробности. Требования по существу остаются в первоисточниках (спецификациях, контрактах, Issues). Состояний, приоритетов и порядка там нет (всё это в плане).

`docs/product/EXECUTION_HISTORY.md` (архив) и `docs/product/REQUIREMENTS_SOURCE_MAP.md` (снимок инвентаризации) читать только когда нужна история или трассировка источника.

Не используй chat memory, старый README, historical status line или номер следующего `Sxx` как замену актуальному `EXECUTION_PLAN.md`.

## Handoff

`CURRENT_STATE.md` — общая память между агентами; сессия может оборваться в любой момент. Порядок обновления и compactness policy — `PROJECT_RULES.md` §21. Кратко: сверь snapshot с git/CI в начале сессии; обнови `Current task` / `Next action` до существенного шага и после законченного шага; не копируй в snapshot историю и очередь. Фактический код и git сильнее snapshot.

## Если готовится или реализуется slice

Прочитай утверждённый `docs/slices/**/SLICE_CONTRACT.md`, contracts закрытых slices, которые реально затрагивает изменение, и detailed GitHub Issue, если на него ссылается запись реестра. Slice Contract определяет точное поведение и acceptance; Issue, Feature Map и макет не расширяют его scope молча. Какие документы обновлять при закрытии — `PROJECT_RULES.md` §19.1.

## Commercial / Monetization / Backoffice

Перед planning или implementation, связанными с Free / Pro / Boost / Business, тарифами, entitlements, usage, Billing, Promotion или административными workflows, прочитай `docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`, `docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md` и, если затронут Demand, `docs/product/KAIDA_DEMAND_PRODUCT_CONCEPT_v0.1.md`. Это parent planning sources, а не разрешение на реализацию (`PROJECT_RULES.md` §17).

## UI / UX

Перед UI/UX Slice Contract прочитай `docs/PROJECT_RULES.md` §18.1 (какой макет главный), §18.4 (обязательные UI-правила), §18.6 (как собираются экраны продавца), `docs/product/UX_REFERENCE_INDEX.md` и только релевантные внешние references (advisory). Отдельного документа дизайн-системы нет: стиль задаёт принятый макет.

## KAIDA Controller

Если PO просит `Проверь <slice>`, `Запусти KAIDA Controller`, проверить contract, diff, readiness к manual acceptance/merge/checkpoint — прочитай `docs/agents/KAIDA_CONTROLLER.md`. Controller не проектирует и не реализует slice, он проверяет exact repository evidence и даёт gate verdict.

Не создавай параллельный roadmap или второй набор инструкций без объективной необходимости: у каждого типа информации один владелец (`PROJECT_RULES.md` §2).

## Git и среда

- Product Owner — нетехнический, пишет по-русски. Commit, push, PR, merge, tag — только по его прямому поручению.
- Никогда не коммитить личные файлы PO: `docs/reviews/localization-foundation-kk-review.docx`, `scripts/`, `tmp/`, `.vscode/`. Идентификаторы моделей в коммиты и документы не писать.
- Облачный контейнер: `dockerd` запускать вручную, затем `docker compose up -d --wait`; `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:test:prepare` (пересоздаёт тестовую БД). E2E идёт на production build (`pnpm build`, затем `pnpm test:e2e`; серверы 3100/3101). Integration с `ECONNREFUSED 5432` = БД не запущена. Операционные процедуры — `docs/ops/`.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
