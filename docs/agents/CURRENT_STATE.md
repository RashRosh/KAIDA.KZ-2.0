# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-07.
- `origin/main`: `7892d22b01cf2499d80a7cfbe92ba8dd0cba46e0` (R1, PR #124) плюс closing docs PR; `KAIDA verify` run `37573885183` SUCCESS, CodeQL и OpenSSF Scorecard SUCCESS.
- Последний checkpoint: `v0.0.63-d0-e2e-marker-fix` (test-only fix Issue #125: буквенный маркер в D0 E2E; причина — случайный hex-маркер с цифровой серией ≥6 отсекался фильтром телефонов D0). Предыдущий product checkpoint: `v0.0.62-local-bootstrap-verification` (R1, `7892d22`).
- Production KB v1 (682 / 210 / 35) — runtime-база; ставится `pnpm db:import:production-kb`. Demo-последовательность: миграции → `pnpm db:seed` → импорт KB; seed после импорта KB (без предшествующего seed) падает на `products_name_unique` — известное ограничение.

## Current task

R2 (backup/restore БД и фото): контракт `docs/slices/backup-restore/SLICE_CONTRACT.md` — подход утверждён PO 2026-10-07; контракт-PR на ветке `docs/r2-backup-restore-contract`. Реализации нет.

## Next action

1. Ручная приёмка PO (§9 контракта): агент держит изолированные источник (:3201) и цель (:3202), после приёмки — очистка по runbook §11, затем merge и tag по команде PO.
2. Далее по `EXECUTION_PLAN.md`: R2 → R3 → R4 (агент предлагает следующий non-AI slice PO). UX/UI-обсуждение собрано отдельно для позднего pipeline review и в R-трек не входит.

## Current constraints

- Не начинать: D1, AI Input, AI-модерация, платная инфраструктура, 6F/6G, fuzzy, оценка поискового движка, Issue #116, KK-вычитка (отдельно). Публичный запуск без AI не разрешён.
- Не добавлять без решения PO: настоящую аутентификацию/доставку OTP, abuse-защиту, юридические тексты, операторскую доставку OTP, allowlist, оповещения о free-title и прочие pilot-функции.
- D0: `SEARCH_EVENTS_ORIGIN=organic` не включать, пока ежедневный `pnpm search-events:purge` не настроен и не проверен; `dev` / `test` / `synthetic` — не реальный спрос. Поведение D0 не менять без решения PO.
- Границы приёмки R1: свежий запуск проверен только через Git Bash на Windows; PowerShell, Linux и CI-воспроизведение не проверены; нужен `IDENTITY_OTP_HMAC_SECRET_HEX`; `pnpm build` на слабой машине падал перемежающимся образом, причина не установлена.
- Проверки bootstrap/R2 не трогают dev-БД `kaida`/`kaida_test`, том `postgres_data`, порт 5432 и `.data/photos` рабочей копии; секреты не в Git.
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`; `next-env.d.ts` перегенерируется — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN. Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
