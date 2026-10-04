# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-04 (6-я сессия).
- `origin/main`: `9607163` (контракт 6C слит, PR #85). Последний checkpoint-тег: `v0.0.48-first-entry-correction`.

## Current task

**Stage 6C — Search Home + last Search state** (`docs/slices/search-home-last-state/SLICE_CONTRACT.md`, APPROVED).
Реализована (`slice/search-home-last-state`, PR #86): Search Home, чипы после поиска, последний поиск вкладки в
`sessionStorage`, `Поиск` ведёт на `/?q=…`. Manual acceptance **PASS**, branch CI green. После green merged-main CI
создаётся annotated tag `v0.0.49-search-home-last-state` на merge-коммите; до создания тег не считать существующим.
Следом 6D (inline-язык в `Ещё`) — контракт ещё не утверждён, реализацию не начинать.

## Verification (local)

Unit 344/344, integration 197/197, typecheck и eslint чистые; новые 10 E2E (mobile RU) зелёные; полный E2E зелёный, кроме
редкой локальной нестабильности редактора продавца (`offer-actuality`, не связана с поиском). Два существующих E2E
обновлены: после входа «/» восстанавливает последний поиск (адрес `/?q=…`), UX1D стартует с чистой вкладкой.

## Next action

1. Merged-main CI → tag `v0.0.49-search-home-last-state`.
2. 6D: подготовить Slice Contract, ждать утверждения.

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
