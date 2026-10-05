# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-05.
- `origin/main`: `dba8cd8` (docs после `c0d1749`); checkpoint `v0.0.53-catalog-runtime-loop` (PR #93);
  merged-main `KAIDA verify` run `37305378999` SUCCESS. Manual acceptance PASS.
- Production KB v1 (682 / 210 / 35) — runtime-база; runtime loop Seller → Buyer доказан тестами (production-код не менялся).
  E2E-БД ставит KB через global setup существующим импортёром; пакет защищён `.gitattributes` (`-text`).

## Current task

DRAFT-контракт S15B-1 (`docs/slices/s15b1-catalog-suggestion-relevance/SLICE_CONTRACT.md`) на ревью. Production-код не начат.

## Next action

1. Review/approval S15B-1; затем реализация (только ранжирование подсказок каталога).
2. Остальной S15B малыми vertical slices после аудита кода (buyer autocomplete — отдельный slice).
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
