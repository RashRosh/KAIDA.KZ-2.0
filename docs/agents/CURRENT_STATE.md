# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-06.
- `origin/main`: `0232c2d07af55deb9b874a12b994f97f86849783`; checkpoint `v0.0.61-search-demand-events` (S15C/D0, PR #121);
  merged-main `KAIDA verify` run `37527531918` SUCCESS. Manual acceptance PASS. Предыдущие: `v0.0.60` (sorting control), `v0.0.59` (S15B-4b), `v0.0.58` (S15B-4a).
- Production KB v1 (682 / 210 / 35) — runtime-база; runtime loop Seller → Buyer доказан тестами (production-код не менялся).
  E2E-БД ставит KB через global setup существующим импортёром; пакет защищён `.gitattributes` (`-text`).

## Current task

Нет активного slice.

## Next action

1. S15B и S15C/D0 закрыты. Следующий шаг — по `EXECUTION_PLAN.md` (D1 и AI Input не начаты, контрактов нет). **Предусловие деплоя D0:** `SEARCH_EVENTS_ORIGIN=organic` не включать, пока ежедневный `pnpm search-events:purge` не настроен и не проверен; dev/test/synthetic-события — не спрос. Отдельно открыто: Issue #116 (CI flake «active connections»), KK-вычитка строк сортировки.
2. Далее: S15C/D0 → накопление demand → AI Input / AI-модерация.

## Current constraints

- Старые 6F и 6G **не авторизованы** в прежнем виде: 6F снята до реализации (цель — в S15C/D0 после S15B), 6G
  переосмыслена как readiness-gated canonical-Product чипы. Не начинать D1, 6F/6G, AI (без контракта).
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`.
- `next-env.d.ts` перегенерируется next dev/build — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN.
- Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
