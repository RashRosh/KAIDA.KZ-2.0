# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-04 (6-я сессия).
- `origin/main`: `fa77612` (merge PR #80 — 6A, docs-only; CI green). Последний checkpoint-тег: `v0.0.47-search-visibility-without-coordinates`.

## Current task

**Corrective sequence 6A → 6B → 6C → 6D → 6 (Search sort Rev 3) → 6F → 6G** (порядок и решения PO — `EXECUTION_PLAN.md`,
«Текущий repository gate»). Stage #6 Rev 2 отклонён на manual acceptance: ветка `slice/search-price-sort-range-contract`
(`f9dd7cf`) — неизменный evidence.

- **6A** — закрыт (merged, PR #80).
- **6B First Entry correction** — контракт `docs/slices/first-entry-correction/SLICE_CONTRACT.md` APPROVED —
  IMPLEMENTATION AUTHORIZED. Production-реализации ещё нет.

## Next action

1. Смержить docs-only PR с контрактом 6B в `main`.
2. Реализация 6B на новой ветке `slice/first-entry-correction` от актуального `main`; строго по контракту, без 6C/6D/Stage 6 Rev 3.
3. Targeted + full regression + branch CI → STOP до PO manual acceptance (PR/merge/tag реализации — только после PASS).

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
