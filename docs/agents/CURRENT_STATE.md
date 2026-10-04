# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-05 (6-я сессия).
- `origin/main`: `e07e3de` (контракт 6D слит, PR #87). Последний checkpoint-тег: `v0.0.49-search-home-last-state`.

## Current task

**Stage 6D — Inline language in «Ещё»** — реализован (`slice/inline-language`, PR #88): строка «Язык» с компактной
таблеткой `РУС | ҚАЗ` из макета у покупателя и продавца, применяется сразу, без листа. Manual acceptance **PASS**, branch
CI green. После green merged-main CI создаётся annotated tag `v0.0.50-inline-language` на merge-коммите; до создания
тег не считать существующим.

Дальше — **Stage 6 Rev 3** (сортировка `Расстояние / Цена / Актуальность` с направлением, один vertical slice): контракт
ещё не подготовлен, реализацию не начинать без решения PO. Затем 6F/6G (Query Log, динамические чипы).

## Next action

1. Merged-main CI → tag `v0.0.50-inline-language`.
2. Stage 6 Rev 3: подготовить Slice Contract, ждать утверждения.

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
- Неиспользуемые ключи `more.languageTitle`, `more.languageNote`, `more.done` остаются в каталогах (локальная `tmp/` PO на них ссылается).
