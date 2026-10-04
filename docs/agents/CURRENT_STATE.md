# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-04 (6-я сессия).
- `origin/main`: `e07e3de` (контракт 6D слит, PR #87). Последний checkpoint-тег: `v0.0.49-search-home-last-state`.

## Current task

**Stage 6D — Inline language in «Ещё»** (`docs/slices/inline-language/SLICE_CONTRACT.md`, APPROVED).
Реализована на ветке `slice/inline-language` (реализация `f1ab8c1`): два варианта `Русский | Қазақша` на месте в `Ещё`
покупателя и продавца, применяются сразу, активный отмечен `aria-pressed`, без листа/радио/«Готово»; E2E меняют язык
через общий помощник `chooseLanguageInMore`. Ждёт branch CI и PO manual acceptance (mobile RU). PR/merge/tag — только
после PASS. Stage 6 Rev 3, Query Log и динамические чипы не начинать.

## Verification (local)

Unit 344/344, integration 197/197, eslint чистый; новый E2E (покупатель и продавец, mobile RU) зелёный; полный E2E
зелёный (единичные нестабильности локальной машины на несвязанных тестах проходят при повторе).
Неиспользуемые ключи `more.languageTitle`, `more.languageNote`, `more.done` оставлены: локальная папка PO `tmp/` (в git
нет) на них ссылается и ломает локальный `next build`.

## Next action

1. Branch CI на финальном SHA → отчёт PO. STOP до manual acceptance.
2. После PASS: PR реализации, merge, checkpoint. Затем Stage 6 Rev 3 — отдельным решением PO.

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
