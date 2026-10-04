# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-04 (6-я сессия).
- `origin/main`: `d98a365` (6A PR #80 и контракт 6B PR #81 слиты). Последний checkpoint-тег: `v0.0.47-search-visibility-without-coordinates`.

## Current task

**Corrective sequence 6A → 6B → 6C → 6D → 6 (Search sort Rev 3) → 6F → 6G** (порядок и решения PO — `EXECUTION_PLAN.md`,
«Текущий repository gate»). Stage #6 Rev 2 отклонён на manual acceptance: ветка `slice/search-price-sort-range-contract`
(`f9dd7cf`) — неизменный evidence.

- **6A** — закрыт (PR #80). Контракт 6B — в `main` (PR #81).
- **6B First Entry correction** — реализован на ветке `slice/first-entry-correction` (реализация `cc94d7e`):
  `/welcome` = First Entry, `/` = Search, постоянный intro-маркер, без языкового экрана, переключатель языка на
  First Entry. Ждёт branch CI и PO manual acceptance (mobile RU). PR/merge/tag — только после PASS.

## Verification (local)

Unit 338/338, integration 197/197, typecheck и eslint чистые, полный E2E (mobile + desktop) зелёный после обновления
проверок, которые утверждали старое «`/` = First Entry» / языковой экран. Branch CI — см. GitHub.

## Next action

1. Branch CI на финальном SHA → отчёт PO. STOP до manual acceptance.
2. После PASS: PR реализации, merge, затем 6C (Search Home + состояние поиска) — отдельный контракт.

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
