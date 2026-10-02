# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-03 (4-я сессия).
- `slice/search-sort-distance` от `origin/main = 0bdfc3a`; checkpoint tag `v0.0.45-nearby-result-first` на `0bdfc3a`.

## Current task

**Stage #5 — «Фильтры» поиска (Issue #12).** Контракт **rev 6A — final stage #5 contract, APPROVED** (Controller/PO split decision 2026-10-03: stage #5 сохраняет закрытую UX1D eligibility без изменений — geo-less Offers остаются вне реального Search pipeline; defensive `locationGeo=null` ветка ranking — pure-function robustness, не acceptance behavior; `buyerVisibleOffersPredicate`/offer-page/route не изменяются; никаких `geoKnown`/`routeAvailable` в этом slice). Реализация rev 5 в worktree уже соответствует rev 6A — production diff не менялся. **Ревизия UX1D выделена в отдельный slice** `search-visibility-without-coordinates` (identity≠координаты, capability `routeAvailable` предпочтительнее `geoKnown`, UX1D AC1/AC6/matrix/§S8/карточные AC к ревизии): draft-контракт НЕ в репозитории (убран по решению PO как преждевременный) — полный текст сохранён в agent handoff memory (`next-slice-contract-search-visibility-without-coordinates`); воссоздать файл после полного закрытия stage #5 и APPROVED PO. Не начинается до закрытия stage #5. Следующий шаг: отчёт PO; commit/push/PR/merge/tag/close — только по отдельному разрешению.

## Last completed

- Реализация по rev 5: SearchRankingPolicy config (`src/modules/search/config/search-ranking-policy.config.ts`, env-based, fail-fast, defaults 0.70/0.30 и 0.30/0.70); weighted ranking (`search-ranking.ts`: freshnessScore по tier-границам actuality policy, distanceScore=1/(1+км), weightedScore, tie-breakers, geo-less без distance component); client radius filter (`radius-filter.ts`, pagination-boundary comment); API additive `sort` GET/POST + derived `distanceMeters` (только при buyer location); SearchScreen UI по B07 без ценового блока (кнопка «Фильтры» с counter-dot, Sheet radiogroup/chips, applied chips, summary, empty-filtered, banner geo-intent/retry, pin-кнопка удалена); i18n ru+kk; Sheet closeLabel параметр.
- Full verification: unit 332/332, integration 197/197 (включая weighted ordering по БД через s9/s11 fixtures), typecheck, build, targeted E2E (s9+s11+ux2a+search+buyer-screens+first-entry, `--workers=1`) 48 passed, full E2E **155 passed / 3 skipped** (повторный прогон; в первом 2 seller-теста упали и прошли в реране — pre-existing parallel flake, вне slice).
- **Lint**: репозиторий green (`eslint . --ignore-pattern tmp/**`, 0 problems); штатный `pnpm lint` локально FAIL только из-за local-only `tmp/` — та же environment-only limitation, закрывается clean branch CI.
- Адаптированы существующие тесты (легитимные ревизии по §3 контракта): s9/s10/s11 privacy-ассерты (distanceMeters разрешён, raw coords запрещены), s9/s11 ordering под weighted semantics, s9 e2e переписан с pin-toggle на «Фильтры»-flow (+radius/empty-filtered/kk), ux2a — «Фильтры» вместо pin.

## Blocker / notes

- **Mimosa pre-commit scanner ложно блокирует создание новых test-файлов с `pool.query($n)`** (не распознаёт node-postgres плейсхолдеры; весь SQL в тестах репозитория статический+параметризованный). Отдельный integration flip-тест заблокирован hook'ом в 2 попытках; flip доказан unit-тестами + s9/s11 integration fixtures. Решение PO по Mimosa — вне slice.
- Contract §2.6 nuance для отчёта PO: geo-less Offers в location-aware Search исключались закрытой UX1D eligibility и до slice (repo-level); §2.6 не меняет это — он про ranking-слой (без distance component).

## Next action

1. Отчитаться PO; ждать разрешения на slice-коммит (production + контракт + CURRENT_STATE + тесты) → push → PR → branch CI → manual acceptance (сценарий §9 контракта).
2. Merge/tag/Issue #12 — только по отдельному разрешению PO.

## Current constraints

- Не пересматривать контракт rev 5; stage #6 (цена) не трогать; dead-string cleanup запрещён; DB/Backoffice для weights не создавать.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`.
- `next-env.d.ts` перегенерируется next dev/build — возвращать к HEAD.
