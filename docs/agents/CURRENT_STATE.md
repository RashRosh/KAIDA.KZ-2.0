# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-07.
- `origin/main`: `9ed1ba40c17dfda212fe17d2c9a43be67f862d0e` (closing docs PR #122; `KAIDA verify` run `37529680150` SUCCESS, CodeQL `37529680341` SUCCESS).
- Последний product checkpoint: `v0.0.61-search-demand-events` на `0232c2d07af55deb9b874a12b994f97f86849783` (S15C/D0, PR #121; merged-main run `37527531918` SUCCESS). Manual acceptance PASS. Предыдущие: `v0.0.60`, `v0.0.59`, `v0.0.58`.
- Production KB v1 (682 Products / 210 aliases / 35 categories) — runtime-база; `pnpm db:seed` её **не** ставит, только `pnpm db:import:production-kb`.

## Current task

Решение PO 2026-10-07: «Local readiness track» (`EXECUTION_PLAN.md`, пункт 5). **R1 — Clean local bootstrap verification**: контракт `docs/slices/local-bootstrap-verification/SLICE_CONTRACT.md` APPROVED (PO 2026-10-07). Docs PR #123 слит (`main` `801370193c25571040de53139ccba4a1813b469c`). Реализация R1 — ветка `slice/local-bootstrap-verification` (runbook `docs/ops/LOCAL_BOOTSTRAP.md`, `ops/local-bootstrap/`, README): готова к приёмке PO, не слита, не тегирована.

## Next action

1. PO принимает отчёт R1. До явного PASS R1 не мержить и не тегировать.
2. После PASS: implementation PR → аудит итогового дерева → merge на green → merged-main CI → тег → минимальный closing docs PR → STOP.
3. Далее по плану: R2 (backup/restore PostgreSQL + фото), R3 (подготовка развёртывания без хостинга), R4 (агент предлагает следующий non-AI slice PO).

## Current constraints

- Не начинать: D1, AI Input, AI-модерация, платная инфраструктура, 6F/6G, fuzzy, оценка поискового движка, Issue #116, KK-вычитка (отдельно). Публичный запуск без AI не разрешён.
- Не добавлять без решения PO: настоящую аутентификацию/доставку OTP, abuse-защиту, юридические тексты, операторскую доставку OTP, allowlist, оповещения о free-title и прочие pilot-функции.
- D0: `SEARCH_EVENTS_ORIGIN=organic` не включать, пока ежедневный `pnpm search-events:purge` не настроен и не проверен; `dev` / `test` / `synthetic` — не реальный спрос.
- R1 и далее: не читать/менять dev-БД `kaida`/`kaida_test`, том `postgres_data`, порт 5432 и `.data/photos` рабочей копии; секреты не в Git.
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`; `next-env.d.ts` перегенерируется — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN. `FEATURE_MAP.md`: S15B закрыт, S15C — только D0 (D1+ data-gated).
- Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
