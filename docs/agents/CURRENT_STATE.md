# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-03 (4-я сессия, закрытие stage #5).
- `origin/main`: `aadb6b2` (`Merge PR #74` — Search filters stage #5; slice-коммит `9634178`); этот docs-коммит фиксирует закрытие.
- Merged-main CI на `aadb6b2`: run `37071285541` — SUCCESS; branch CI на `9634178` green (`37067949468`/`37067991791`).
- Checkpoint annotated tag `v0.0.46-search-sort-distance`: **авторизован PO, создаётся сразу после green CI этого docs-коммита на его SHA и пушится на remote. До фактического создания тег не считать существующим.**
- На момент записи последний фактически существующий verified checkpoint — `v0.0.45-nearby-result-first` на `0bdfc3a`.

## Current task

**Stage #5 (Search filters, Issue #12) — CLOSED** (PR #74, merged `aadb6b2`, manual acceptance PASS). **Новое решение PO 2026-10-03: перед stage #6 вставлен stage 5A** — «Search visibility for addressed Locations without coordinates» (identity ≠ coordinates; явная ревизия geo-eligibility UX1D). **NEXT = stage 5A contract preparation.** **Issue #12 остаётся OPEN** — владеет stage #5 и stage #6, не закрывать. Stage #6 (Дешевле + цена от–до) — после 5A.

## Last completed

- Stage #5 по контракту rev 6A: SearchRankingPolicy config seam (env, fail-fast, defaults 0.70/0.30 / 0.30/0.70), weighted ranking (абсолютные score, tie-breakers, без result-set normalization), клиентский radius-фильтр (pagination boundary), API additive `sort` + derived `distanceMeters`, UI по B07 без ценового блока (counter-dot, sheet, chips, summary, empty-filtered, geo-intent/denial-retry, pin удалена), i18n ru+kk. UX1D eligibility сохранена без изменений (geo-less вне Search pipeline; ревизия — stage 5A).
- Verification: unit 332/332, integration 197/197, typecheck, build, targeted E2E 48 passed, full E2E 155 passed / 3 skipped; repository lint green (штатный `pnpm lint` локально блокируется только local-only `tmp/` — environment-only limitation, закрывается clean CI).
- Manual acceptance PO: **PASS**.

## Blocker / notes

- Mimosa pre-commit scanner: полный скан локально не завершается (`scanner_enobufs`); ложно блокирует создание новых test-файлов с `pool.query($n)`. Требуется решение PO (полный audit + настройка).
- Draft-контракт stage 5A **восстановить из agent handoff memory** (`next-slice-contract-search-visibility-without-coordinates`) только после checkpoint closure — в репозитории его нет по решению PO.

## Next action

1. Дождаться green CI этого docs-коммита → создать и запушить annotated tag `v0.0.46-search-sort-distance` на его SHA.
2. После checkpoint: по решению PO — восстановить draft stage 5A и готовить контракт к APPROVED. Реализацию 5A не начинать без APPROVED.

## Current constraints

- Issue #12 не закрывать (владеет stage #5 и #6).
- Stage 5A не реализовывать до APPROVED PO.
- Не commit/push/merge/tag сверх закрывающей последовательности.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит, при расхождении возвращать к HEAD.
