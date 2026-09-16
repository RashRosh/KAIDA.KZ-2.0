# KAIDA.KZ 2.0 agent instructions

Before doing any work in this repository, read and follow:

- `docs/PROJECT_RULES.md`
- `docs/product/EXECUTION_PLAN.md`
- `docs/product/FEATURE_MAP.md`

`EXECUTION_PLAN.md` is the canonical source for the **current execution order** and inserted/reprioritized stages. `FEATURE_MAP.md` is the longer-range capability/dependency map. Do not start a later capability only because it appears next numerically in Feature Map if `EXECUTION_PLAN.md` says otherwise.

Do not treat chat memory or copied status text as a substitute for current repository state.

## KAIDA Controller mode

If the user asks to:

- `Проверь <slice>`;
- `Запусти KAIDA Controller`;
- review a Slice Contract;
- review implementation against an approved Slice Contract;
- decide whether a slice is ready for manual acceptance, merge or checkpoint;
- act as independent controller/reviewer;

then also read and follow:

- `docs/agents/KAIDA_CONTROLLER.md`

In Controller mode:

- independently inspect the current repository, relevant contracts, diff, CI and checkpoint evidence;
- do not redesign the slice;
- do not implement product changes;
- do not expand verification without a real risk reason;
- do not start the next slice automatically;
- give an explicit gate verdict for the exact SHA being reviewed.

## Normal implementation mode

Outside Controller mode, `docs/PROJECT_RULES.md` remains authoritative. Work in small vertical slices, preserve closed contracts, keep scope minimal, and do not modify `main` directly unless the project process explicitly allows it.
