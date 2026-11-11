# Current state — D6 «Главная поиска» (B02): контракт утверждён (2026-11-11)

## Current task

- D6 — главная поиска (Search Home, B02) по новому дизайну. Решение PO 2026-11-11: поведение главной сохраняется, меняется только вид. [Контракт](../slices/design-search-home/SLICE_CONTRACT.md) утверждён PO 2026-11-11; реализация разрешена.
- Порядок — только `docs/product/EXECUTION_PLAN.md`.

## Checkpoint

- Последний checkpoint: `v0.0.90-design-nearby` → `main` `7cfed6f` (D5 «Рядом» закрыт 2026-11-10, PR #214; merged-main CI verify 42875946418 / CodeQL 42875946340 success).
- `e1b4d93` — docs-коммит закрытия D5 поверх checkpoint.

## Last completed / verification

- D5 «Рядом» (B07): приёмка PO 2026-11-10, см. [контракт D5](../slices/design-nearby/SLICE_CONTRACT.md).
- Холст экранов 2026-11-11 в версии `1794254812-c359` разбит PO на семь страниц; 87 досок и их имена сохранились ([baseline](../product/DESIGN_BASELINE.md)).
- Известный флейк: `tests/e2e/search-typo-correction.spec.ts` изредка падает в полном параллельном прогоне (изолированно проходит); кандидат на отдельную maintenance-задачу.

## Next action

1. Реализация D6 на ветке slice по контракту: presentation ветки Search Home в `SearchScreen`, подсказки на главной строками, строки i18n; E2E `design-search-home` со скриншотами трёх состояний (360 px, 2x).
2. Сверка с живым B02, полный прогон, branch CI, скриншоты PO на приёмку. Merge/tag — только по gate `PROJECT_RULES.md` §6.

## Evidence / локальные ограничения

- Копия исходника доски B02 (`Main.dc.html`, версия `1794254812-c359`) — локальный evidence, по прецеденту D5 в Git не включается.
- Не мигрированы: `/welcome` B01 (отложен PO), «Ещё» B11, «Жалоба» B12–B14, «Вход» A01–A02, продавец S01–S30, оператор O01–O06.
