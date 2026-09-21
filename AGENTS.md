# KAIDA.KZ 2.0 — Agent Router

Этот файл не является product spec или roadmap. Его задача — сказать агенту, **какие источники читать для конкретной работы**.

## Перед любой работой

Сначала самостоятельно проверь фактический repository state: текущий `main`, relevant branch/PR, последний verified checkpoint/tag и CI evidence.

Затем прочитай:

1. `docs/PROJECT_RULES.md` — процесс, verification и устойчивые product/architecture boundaries;
2. `docs/product/EXECUTION_PLAN.md` — единственный канонический текущий порядок работ;
3. `docs/product/FEATURE_MAP.md` — долгосрочные capabilities и зависимости.

Не используй chat memory, старый README, historical status line или номер следующего `Sxx` как замену актуальному `EXECUTION_PLAN.md`.

## Если готовится или реализуется конкретный slice

Дополнительно прочитай:

- утверждённый `docs/slices/**/SLICE_CONTRACT.md`, если он уже существует;
- contracts закрытых slices, которые реально затрагивает изменение;
- detailed GitHub Issue, если текущий этап ссылается на него.

Slice Contract определяет точное поведение и acceptance. Issue/Feature Map/Design System не имеют права молча расширять его scope.

## UI / UX work

Перед подготовкой или реализацией UI/UX Slice Contract дополнительно прочитай:

- `docs/DESIGN_SYSTEM.md`;
- `docs/product/UX_REFERENCE_INDEX.md`;
- только релевантные внешние UX references, перечисленные для текущей user task.

Внешние references — advisory evidence, не источник нового contract. Findings классифицируются как:

- `KEEP` — текущее KAIDA rule уже подходит;
- `ADAPT` — принцип полезен после адаптации под KAIDA;
- `REJECT` — конфликтует с продуктовой моделью/closed contract;
- `GAP` — требует отдельного Product Owner decision.

Если `EXECUTION_PLAN.md` содержит незакрытый обязательный UX/design maintenance gate, следующий UI/UX product slice не начинается до закрытия этого gate.

## KAIDA Controller mode

Если пользователь просит `Проверь <slice>`, `Запусти KAIDA Controller`, проверить contract, diff, readiness к manual acceptance/merge/checkpoint или выступить независимым контролёром — дополнительно прочитай:

- `docs/agents/KAIDA_CONTROLLER.md`.

Controller не проектирует и не реализует slice. Он проверяет exact repository evidence и даёт gate verdict.

## Главное правило

У каждого типа информации один владелец:

- процесс и boundaries → `PROJECT_RULES.md`;
- текущая очередь → `EXECUTION_PLAN.md`;
- долгосрочная capability map → `FEATURE_MAP.md`;
- visual/presentation rules → `DESIGN_SYSTEM.md`;
- unresolved detailed work → GitHub Issues;
- exact slice behavior → Slice Contract.

Не создавай параллельный roadmap или второй набор инструкций без объективной необходимости.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
