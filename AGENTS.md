# KAIDA.KZ 2.0 — Agent Router

Этот файл не является product spec или roadmap. Он только говорит агенту, **какие источники читать для конкретной задачи**.

## Always

Перед любой работой:

1. проверить фактический `main`, latest verified checkpoint/tag и relevant CI;
2. прочитать `README.md` для актуального overview;
3. прочитать `docs/PROJECT_RULES.md`;
4. прочитать `docs/product/EXECUTION_PLAN.md`.

Не доверять copied SHA/status из чата, если repository state уже изменился.

`EXECUTION_PLAN.md` — единственный источник текущей очередности. Не начинать capability только потому, что она следующая по номеру в Feature Map.

## Planning / next slice

Дополнительно читать:

- `docs/product/FEATURE_MAP.md` — dependencies/long-range capability map;
- relevant GitHub Issue;
- closed Slice Contracts, которые использует или пересматривает следующая работа.

Для product slice готовить один компактный Slice Contract согласно `PROJECT_RULES.md`.

## UI / UX work

До подготовки или implementation UI/UX Slice Contract дополнительно читать:

- `docs/DESIGN_SYSTEM.md`;
- `docs/product/UX_REFERENCE_INDEX.md`;
- только релевантные внешние UX references из index;
- `docs/UX_BACKLOG.md` только как inbox новых, ещё не promoted observations.

External references — advisory evidence. Использовать `KEEP / ADAPT / REJECT / GAP`.

Нельзя менять closed contract/API/privacy/business rule только потому, что generic UX guide рекомендует другой pattern.

Если `EXECUTION_PLAN.md` содержит открытый mandatory UX/design maintenance gate, сначала закрыть его.

## Implementation mode

- работать маленьким vertical slice;
- сохранять closed contracts;
- минимизировать diff;
- не рефакторить соседние части без необходимости;
- использовать risk-based tests;
- не считать реализацию готовой без required CI/manual/checkpoint evidence.

## Controller mode

Если пользователь просит `Проверь <slice>`, `Запусти KAIDA Controller`, review contract/implementation/merge/checkpoint, дополнительно читать:

- `docs/agents/KAIDA_CONTROLLER.md`.

Controller не проектирует slice заново, не пишет product code и не начинает следующий slice автоматически.

## Source ownership reminder

- project overview → `README.md`;
- process/stable architecture → `PROJECT_RULES.md`;
- current order → `EXECUTION_PLAN.md`;
- long-range map → `FEATURE_MAP.md`;
- unresolved detailed requirements → GitHub Issues;
- visual/presentation → `DESIGN_SYSTEM.md`;
- UX references/audit → `UX_REFERENCE_INDEX.md`;
- exact slice behavior → `docs/slices/**`;
- independent review procedure → `KAIDA_CONTROLLER.md`.

Не создавать параллельный roadmap или второй живой product spec без объективной необходимости.
