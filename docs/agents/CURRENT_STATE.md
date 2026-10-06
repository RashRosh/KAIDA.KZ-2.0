# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-06.
- `origin/main`: `8974acd0b3ecb9a6bcf43542a28bf0c8df3fc525`; checkpoint `v0.0.59-search-relevance-default` (S15B-4b, PR #114);
  merged-main `KAIDA verify` run `37447048125` SUCCESS. Manual acceptance PASS. Предыдущие: `v0.0.58` (S15B-4a), `v0.0.57` (S15B-3), `v0.0.56`.
- Production KB v1 (682 / 210 / 35) — runtime-база; runtime loop Seller → Buyer доказан тестами (production-код не менялся).
  E2E-БД ставит KB через global setup существующим импортёром; пакет защищён `.gitattributes` (`-text`).

## Current task

Нет активного slice.

## Next action

1. Search sorting control UX refresh (до S15C): контракт ещё не написан; финальное решение PO записано в `EXECUTION_PLAN.md` («Deferred UX»): relevance по умолчанию без пункта «По соответствию», три явные сортировки, «Сбросить сортировку», внешний вид по design workflow (§18). Search sorting control UX refresh — deferred (см. план).
2. Далее: S15C/D0 → накопление demand → AI Input / AI-модерация.

## Current constraints

- Старые 6F и 6G **не авторизованы** в прежнем виде: 6F снята до реализации (цель — в S15C/D0 после S15B), 6G
  переосмыслена как readiness-gated canonical-Product чипы. Не начинать S15C, sorting UX refresh (до контракта), 6F/6G, AI.
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
- Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
