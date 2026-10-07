# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-08.
- `origin/main`: `7d1e721c479edf9e3450c94ac3d9c3df1d6551eb` (merge PR #137, search word forms); `KAIDA verify` main run `37679370719` SUCCESS, CodeQL SUCCESS; плюс docs-PR закрытия.
- Последний checkpoint: `v0.0.66-search-word-forms` (`7d1e721`): Search находит другую грамматическую форму слова по проверенному офлайн-словарю (`src/modules/search/word-forms`, генератор `ops/word-forms`), без миграций, независимо от языка интерфейса; новый уровень relevance L3 (старый L3 = L4). Предыдущие: `v0.0.65-search-by-product-fixture`, `v0.0.64-backup-restore` (R2), `v0.0.63`, `v0.0.62` (R1).
- Production KB v1 (682 / 210 / 35) — runtime-база; ставится `pnpm db:import:production-kb`. Demo-последовательность: миграции → `pnpm db:seed` → импорт KB; seed после импорта KB (без предшествующего seed) падает на `products_name_unique` — известное ограничение.

## Current task

Блок UX/search, пункт 2 (card opening-hours readability): контракт `docs/slices/card-opening-hours/SLICE_CONTRACT.md` утверждён и слит (PR #139). Реализация на ветке `feat/card-opening-hours`: статус словами на карточке, сгруппированное расписание на странице Offer, без изменения расчёта и данных. Ждёт ручной приёмки PO; не сливать и не тегировать до приёмки. Follow-up по word forms: перепроверить лицензию OpenCorpora до публичного распространения. Известное ограничение opening hours: tz-база старых устройств может давать для Asia/Almaty смещение +6 вместо +5 (статус сдвинется на час); расчёт не меняется по решению PO.

## Next action

1. Ручная приёмка PO по `SLICE_CONTRACT.md` §10; затем merge, tag, закрывающий docs-PR. Порядок блока (PO 2026-10-07): ~~word forms~~ → opening hours → price and packaging → empty states → typo suggestions → post-publication buyer preview → R3 (`EXECUTION_PLAN.md`).

## Current constraints

- Не начинать: D1, AI Input, AI-модерация, платная инфраструктура, 6F/6G, **typo/fuzzy matching** (ограничение не снято; word forms — отдельная задача: допускаются исследование и подготовка контракта, реализация после утверждения), оценка и выбор поискового движка, Issue #116, KK-вычитка (отдельно). Публичный запуск без AI-ввода и AI-модерации **не утверждён** (до отдельного решения PO).
- Верификация каждого UI-slice блока UX/search включает читаемость на реальном телефоне, длинные KK-подписи и крупный системный шрифт; консолидированный UX/UI-документ — история обсуждения, его неутверждённые предложения не принимаются молча.
- Не добавлять без решения PO: настоящую аутентификацию/доставку OTP, abuse-защиту, юридические тексты, операторскую доставку OTP, allowlist, оповещения о free-title и прочие pilot-функции.
- D0: `SEARCH_EVENTS_ORIGIN=organic` не включать, пока ежедневный `pnpm search-events:purge` не настроен и не проверен; `dev` / `test` / `synthetic` — не реальный спрос. Поведение D0 не менять без решения PO.
- Границы приёмки R1: свежий запуск проверен только через Git Bash на Windows; PowerShell, Linux и CI-воспроизведение не проверены; нужен `IDENTITY_OTP_HMAC_SECRET_HEX`; `pnpm build` на слабой машине падал перемежающимся образом, причина не установлена.
- Границы приёмки R2: проверено через Git Bash на Windows; PowerShell, Linux, неограниченная нагрузка записи, перенос между версиями PostgreSQL/приложения, push при смене VAPID-ключа не проверены; backup содержит ПД и действующие сессии (отзыва сессий нет); корректность backup без остановки записи держится на правиле «фото неизменяемы и не удаляются» — любой slice удаления/замены фото сначала пересматривает R2.
- Проверки bootstrap/R2 не трогают dev-БД `kaida`/`kaida_test`, том `postgres_data`, порт 5432 и `.data/photos` рабочей копии; секреты не в Git.
- Выбор товара из каталога у продавца не обязателен; free-title путь не менять.
- Не коммитить: `.mimosa/`, `.pnpm-store/`, `.vscode/`, `scripts/`, `tmp/`, `e2e.pid`, `docs/slices/search-sort-distance/.mimosa/`; `next-env.d.ts` перегенерируется — в коммит не входит.
- Граница доставки: mobile + русский (`PROJECT_RULES.md` §18.5).
- Mimosa pre-commit scanner может ложно блокировать новые test-файлы с `pool.query($n)`; не менять код ради него.
- Issue #12 остаётся OPEN. Nearby (S11) использует `compareActualityTier` и `distanceMetersForRanking` из модуля ранжирования Search — не менять их поведение.
