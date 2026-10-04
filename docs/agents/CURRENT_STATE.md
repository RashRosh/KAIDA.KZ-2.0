# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-04 (5-я сессия, закрытие stage 5A).
- `origin/main`: `3763373` (repair merge PR #78; до него stage 5A merge `419e60e` — PR #77, slice `444b44f`, contract `fc7c717`).
- Merged-main CI на `3763373`: run `37199326198` — SUCCESS. Branch CI: `37191449657`/`37198879235` (на `186ec21`) — SUCCESS.
- Checkpoint annotated tag `v0.0.47-search-visibility-without-coordinates`: **авторизован PO, создаётся сразу после green CI этого docs-коммита на его SHA и пушится на remote. До фактического создания тег не считать существующим.**
- На момент записи последний фактически существующий verified checkpoint — `v0.0.46-search-sort-distance` на `c676cbe`.

## Current task

**Stage 5A — Search visibility for addressed Locations without coordinates — CLOSED** (PR #77 + repair PR #78, merged `3763373`, manual acceptance PASS). Это явная ревизия geo-eligibility части UX1D: address/identity — prerequisite ordinary Search visibility; coordinates — prerequisite только geo-dependent behavior (`routeAvailable`, радиус, Nearby). **NEXT = stage #6** (Поиск: сортировка «дешевле» и цена от–до, Issue #12 — остаётся OPEN, им владеет #12). Реализацию stage #6 не начинать без решения PO.

## Last completed

- Реализация rev 3: `buyerVisibleOffersPredicate` → generic (lifecycle + not-removed); `buyerGeoVisibleOffersPredicate` (geo overlay) для Nearby/route (поведение не менялось); Search/Offer page на generic; `routeAvailable: boolean` (always-present capability, выводится из route prerequisite) в Search DTO и buyer Offer DTO; «Маршрут» в карточке/Offer page только при `routeAvailable`; seller `buyerVisible` без `locationHasGeo`; «Ближе» — группировка geo-known → geo-less.
- Verification: unit 334/334, integration 197/197, typecheck, build, targeted E2E 45 passed, full E2E 155 passed / 3 skipped; repository lint green (штатный `pnpm lint` блокируется только local-only `tmp/` — environment-only limitation, закрывается clean CI).
- Инцидент закрытия: первый merged-main CI на `419e60e` упал из-за моего тест-бага (ассерт полагался на порядок batch items — S9 §10 hazard); исправлен order-агностично (`186ec21`, PR #78), стабильность 5×integration 197/197. Production semantics не менялись.
- Manual acceptance PO: **PASS** (stage 5A).

## Blocker / notes

- Mimosa pre-commit scanner: полный скан локально не завершается (`scanner_enobufs`); ложно блокирует создание новых test-файлов с `pool.query($n)`. Требуется решение PO (полный audit + настройка).

## Next action

1. Дождаться green CI этого docs-коммита → создать и запушить annotated tag `v0.0.47-search-visibility-without-coordinates` на его SHA.
2. После checkpoint — ждать решения PO о старте stage #6 (Issue #12). Не начинать самостоятельно.

## Current constraints

- Issue #12 не закрывать (владеет stage #5, 5A-контекст и #6).
- Stage #6 не реализовывать без решения PO.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит, при расхождении возвращать к HEAD.
