# Current state — D5 «Рядом» (B07) закрыт (2026-11-10)

## Current task

- D5 «Рядом» (B07) **CLOSED**: приёмка PO 2026-11-10 по скриншотам шести состояний (360 px, 2x), PO rework применён (ST05 — белый текст без подчёркивания; ST06 «Повторить» — по началу текста, 34px; иконки `refresh`/`aim` — QingIcon `System/refresh.svg` / `Map/crosshair-3.svg`, Apache-2.0).
- Следующий экран не выбран. Порядок — только `docs/product/EXECUTION_PLAN.md`; до прямой команды PO и утверждённого Slice Contract реализация не начинается.

## Checkpoint

- `main` = `7cfed6f`; annotated tag `v0.0.90-design-nearby` указывает на него.
- Merged-main CI на `7cfed6f`: KAIDA verify 42875946418 (10m52s) success, CodeQL 42875946340 success.
- PR #214 (ветка `slice/design-nearby`): branch CI 42777479253 / 42777825395 success.
- `7cfed6f` — отдельный фикс тестовой «мины времени»: фиксированная T0 = 2026-10-27 в `text-price-update` / `text-switch-on` истекла 10 ноября (14-дневное окно актуальности), из-за чего 23 интеграционных теста падали на любом коммите, включая прежний main. T0 теперь относительная (36 часов назад); проверки и продуктовые гарантии не менялись.

## Last completed / verification

- local: unit 731 ✅, integration 435 ✅, design-nearby E2E 6/6 ✅, s11-nearby-discovery 10/10 ✅, lint/typecheck/production build ✅.
- STOP по `lastConfirmedAt` решён PO 2026-11-10 (вариант 1): optional `lastConfirmedAt` ISO в Nearby-ответе — та же additive public metadata, что в D2 для Search; ranking/eligibility/радиус/privacy не менялись.
- Известный флейк: `tests/e2e/search-typo-correction.spec.ts` изредка падает в полном параллельном прогоне (изолированно проходит), к D5 не относится; кандидат на отдельную maintenance-задачу.

## Next action

1. Ожидать выбора PO: какой экран мигрируется следующим. Очерёдность — только `docs/product/EXECUTION_PLAN.md`. Затем Slice Contract, реализация, приёмка, merge и checkpoint по `PROJECT_RULES.md` §6.

## Evidence / локальные ограничения

- Исходники досок B07 (1/2, 2/2) и `tokens.json` дизайн-системы — `docs/slices/design-nearby/verification-evidence-source/` (локальный evidence, по прецеденту D2 в Git не включён; iframe-версия `1793830896-9a07` совпадает с baseline).
- Контролёр-вердикт формально не получен: независимая сессия дважды блокировалась на системном подтверждении команд, проверка выполнена исполнителем с явной пометкой о независимости.
