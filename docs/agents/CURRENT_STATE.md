# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-06.
- `origin/main`: `9245765299231ae0fa5887a0c6288211df8079b9`; checkpoint `v0.0.58-product-as-search-signal` (S15B-4a, PR #111);
  merged-main `KAIDA verify` run `37432078991` SUCCESS. Manual acceptance PASS. Предыдущие: `v0.0.57` (S15B-3), `v0.0.56` (S15B-2), `v0.0.55`.
- Production KB v1 (682 / 210 / 35) — runtime-база; runtime loop Seller → Buyer доказан тестами (production-код не менялся).
  E2E-БД ставит KB через global setup существующим импортёром; пакет защищён `.gitattributes` (`-text`).

## Current task

Нет активного slice.

## Next action

1. S15B-4b (`docs/slices/s15b4b-relevance-sort/SLICE_CONTRACT.md`, APPROVED, реализация): «По соответствию» по умолчанию, уровни L1/L2/L3, допуск E1 без изменений. Затем Search sorting control UX refresh (отдельно, до S15C). Прежний S15B-4 отменён. Search sorting control UX refresh — deferred (см. план).
2. Далее: S15C/D0 → накопление demand → AI Input / AI-модерация.

## Current constraints

- Старые 6F и 6G **не авторизованы** в прежнем виде: 6F снята до реализации (цель — в S15C/D0 после S15B), 6G
  переосмыслена как readiness-gated canonical-Product чипы. Не начинать S15C, sorting UX refresh, 6F/6G, AI.
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
- Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
