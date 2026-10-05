# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-05.
- `origin/main`: `c0d1749ba352b662299708e0ce466c2916bababa`; checkpoint `v0.0.53-catalog-runtime-loop` (PR #93);
  merged-main `KAIDA verify` run `37305378999` SUCCESS. Manual acceptance PASS.
- Production KB v1 (682 / 210 / 35) — runtime-база; runtime loop Seller → Buyer доказан тестами (production-код не менялся).
  E2E-БД ставит KB через global setup существующим импортёром; пакет защищён `.gitattributes` (`-text`).

## Current task

Нет активного slice. Идёт docs-reconciliation Issues (`docs/issue-reconciliation`, не PR-ится до rebase на актуальный main).

## Next action

1. Docs-only PR reconciliation Issues (после rebase).
2. S15B малыми vertical slices после аудита кода; первый кандидат — catalog suggestion relevance / reachability
   (подсказки: алфавит, top-5; «бар» не доводит до «Баранина»). S15B ещё не начата.
3. Далее: S15C/D0 → накопление demand → AI Input / AI-модерация.

## Current constraints

- Старые 6F и 6G **не авторизованы** в прежнем виде: 6F снята до реализации (цель — в S15C/D0 после S15B), 6G
  переосмыслена как readiness-gated canonical-Product чипы. Не начинать S15B, S15C, 6F/6G, AI.
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
- Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
