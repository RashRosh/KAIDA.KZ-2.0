# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-04 (6-я сессия).
- `origin/main`: `9607163` (контракт 6C слит, PR #85). Последний checkpoint-тег: `v0.0.48-first-entry-correction`.

## Current task

**Stage 6C — Search Home + last Search state** (`docs/slices/search-home-last-state/SLICE_CONTRACT.md`, APPROVED).
Реализована на ветке `slice/search-home-last-state` (реализация `606ccec`): Search Home (поле по центру, ≤5 чипов, без
ленты), чипы остаются после поиска, последний поиск вкладки (запрос + сортировка/радиус stage 5) в `sessionStorage`,
`Поиск` в навигации ведёт на `/?q=…` и результаты запрашиваются заново, нормализация geo-состояния без координат.
Ждёт branch CI и PO manual acceptance (mobile RU). PR/merge/tag — только после PASS. 6D, Stage 6 Rev 3, Query Log и
динамические чипы не начинать. Stage 6B закрыт (`v0.0.48-first-entry-correction`).

## Verification (local)

Unit 344/344, integration 197/197, typecheck и eslint чистые; новые 10 E2E (mobile RU) зелёные; полный E2E зелёный, кроме
редкой локальной нестабильности редактора продавца (`offer-actuality`, не связана с поиском). Два существующих E2E
обновлены: после входа «/» восстанавливает последний поиск (адрес `/?q=…`), UX1D стартует с чистой вкладкой.

## Next action

1. Branch CI на финальном SHA → отчёт PO. STOP до manual acceptance.
2. После PASS: PR реализации, merge, checkpoint. Затем 6D — отдельным решением PO.

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
