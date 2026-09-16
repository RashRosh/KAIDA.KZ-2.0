# KAIDA.KZ — UX Observation Inbox

Этот файл больше **не является вторым roadmap или detailed UX issue tracker**.

Его единственная задача — временно удерживать UX/UI-наблюдение, которое ещё не прошло Product Owner decision и не получило собственного GitHub Issue.

## Workflow

`наблюдение → краткая запись здесь → Product Owner decision → GitHub Issue / REJECTED → удалить из inbox`

После promotion в Issue подробности живут в Issue. После реализации история живёт в closed Slice Contract, checkpoint/tag и Git history.

Не хранить здесь:

- текущую execution order — она только в `docs/product/EXECUTION_PLAN.md`;
- подробные требования уже существующих Issues;
- DONE-архив закрытых UX slices;
- Design System rules;
- feature specs;
- current checkpoint/status проекта.

Перед UI/UX Slice Contract агент проверяет:

1. `docs/product/EXECUTION_PLAN.md`;
2. relevant GitHub Issue;
3. `docs/DESIGN_SYSTEM.md`;
4. `docs/product/UX_REFERENCE_INDEX.md`;
5. только затем этот inbox на новые ещё не promoted observations.

## Current inbox

На момент normalization активных неперенесённых UX observations нет.

Уже утверждённые UX/product gaps находятся в Issues #12, #27, #31, #32, #34, #35, #36, #37 и других соответствующих Issues.

Если появляется новая проблема во время manual walkthrough, добавить сюда коротко:

```text
### UX-OBS-YYYYMMDD-N — короткое название
Area: ...
Observation: ...
Why it matters: ...
Related closed contract / screen: ...
Status: NEW
```

Не проектировать решение глубже, пока Product Owner не решит: `promote / reject / merge with existing issue`.
