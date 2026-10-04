# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-04 (6-я сессия).
- `origin/main`: `415a25a` (stage 5A закрыт; checkpoint `v0.0.47-search-visibility-without-coordinates` создан и запушен).

## Current task

**Corrective sequence 6A → 6B → 6C → 6D → 6 (Search sort Rev 3) → 6F → 6G** (порядок и решения PO — `EXECUTION_PLAN.md`,
«Текущий repository gate»). Stage #6 Rev 2 отклонён на manual acceptance (2026-10-04): ветка
`slice/search-price-sort-range-contract` (`b26573a` / `977dbf0` / head `f9dd7cf`, CI `37205826673` green) — неизменный
evidence; PR/merge/tag нет. Rev 3 строится от актуального `main`, не поверх `f9dd7cf`.

- **6A** (docs, `PROJECT_RULES.md` §18.4–18.5, `EXECUTION_PLAN.md`, `FEATURE_MAP.md`, пометка в `first-entry-mobile`):
  подготовлен на ветке `docs/process-ux-rules-maintenance`, ждёт PO/Controller review.
- **6B** (`docs/slices/first-entry-correction/SLICE_CONTRACT.md`): подготовлен, ждёт PO/Controller review.
  Реализации нет.

## Next action

1. PO/Controller review 6A и 6B; без одобрения ничего не реализовывать, не пушить, PR/merge/tag не делать.
2. После одобрения — реализация 6B от актуального `main` после merge 6A.

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Текущая граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
