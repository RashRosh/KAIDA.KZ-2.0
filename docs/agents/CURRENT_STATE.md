# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-06.
- `origin/main`: `89722495a327a444d269af04abb4e23f9727abfc`; checkpoint `v0.0.57-buyer-autocomplete` (S15B-3, PR #108);
  merged-main `KAIDA verify` run `37420287841` SUCCESS (rerun после флейка seller-showcase-editor). Manual acceptance PASS. Предыдущие: `v0.0.56` (S15B-2), `v0.0.55`, `v0.0.54`.
- Production KB v1 (682 / 210 / 35) — runtime-база; runtime loop Seller → Buyer доказан тестами (production-код не менялся).
  E2E-БД ставит KB через global setup существующим импортёром; пакет защищён `.gitattributes` (`-text`).

## Current task

Нет активного slice.

## Next action

1. S15B-4a (`docs/slices/s15b4a-product-as-signal/SLICE_CONTRACT.md`, DRAFT на approval): Product как сигнал, без relevance-порядка; затем S15B-4b. Прежний S15B-4 отменён. Search sorting control UX refresh — deferred (см. план).
2. Далее: S15C/D0 → накопление demand → AI Input / AI-модерация.

## Current constraints

- Старые 6F и 6G **не авторизованы** в прежнем виде: 6F снята до реализации (цель — в S15C/D0 после S15B), 6G
  переосмыслена как readiness-gated canonical-Product чипы. Не начинать S15B-4a (до approval), S15B-4b, S15C, 6F/6G, AI.
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
- Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
