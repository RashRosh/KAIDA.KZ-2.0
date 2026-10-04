# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-05 (6-я сессия).
- `origin/main`: `45859bc` (контракт Stage 6 Rev 3 слит, PR #89). Последний checkpoint-тег: `v0.0.50-inline-language`.

## Current task

**Stage 6 Rev 3 — explicit Search sorting** (`docs/slices/search-sort-rev3/SLICE_CONTRACT.md`, APPROVED) — реализован на
ветке `slice/search-sort-rev3` (PR #90): popover из трёх критериев (`Расстояние / Цена / Актуальность`) с направлением вместо
листа «Фильтры» и радиуса; выбранный критерий — первичный порядок, без tier и весов; цена — номинальная KZT;
`sort=distance` требует координат (иначе `400`), геолокация только по явному выбору «Расстояние», при отказе —
актуальность и краткое сообщение; публичный API `sort`/`direction`; состояние последнего поиска вкладки — запрос +
sort + direction. Manual acceptance **PASS**, branch CI green. После green merged-main CI создаётся annotated tag
`v0.0.51-search-sort-rev3` на merge-коммите; до создания тег не считать существующим.
Дальше 6F/6G (Query Log, динамические чипы) — контракт ещё не подготовлен, реализацию не начинать без решения PO.

## Verification (local)

Unit 343/343, integration 204/204, typecheck и eslint чистые; новые E2E (mobile RU, `search-sort-rev3`) и обновлённые
`s9`/6C-сценарии зелёные; полный E2E зелёный после обновления проверок, утверждавших старый порядок, лист и подпись.
Устаревшие unit-тесты Stage 5 (веса, оценки, радиус) удалены.

## Next action

1. Merged-main CI → tag `v0.0.51-search-sort-rev3`.
2. 6F: подготовить Slice Contract, ждать утверждения.

## Current constraints

- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
- Неиспользуемые ключи `more.languageTitle`, `more.languageNote`, `more.done` и ключи листа «Фильтры»/радиуса остаются в каталогах.
- Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
