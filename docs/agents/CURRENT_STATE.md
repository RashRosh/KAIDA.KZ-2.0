# Current verified state

Короткий операционный snapshot. Перед работой сверить его с фактическими git/GitHub; история хранится в Git/PR/CI, не здесь.

## Verified base

- Проверено: 2026-10-05.
- `origin/main`: `5b2171035c058f8337671b30222c7a247cb33b79`; checkpoint `v0.0.52-production-kb-importer-v1`;
  merged-main `KAIDA verify` run `37293540946` SUCCESS.
- Production KB Importer v1 — CLOSED. Runtime-каталог KAIDA PostgreSQL: 682 Products, 210 aliases, 35 categories;
  UUID Product / FK Offer сохранены; внешних KB/corpus зависимостей нет.
- Stage 6 Rev 3 закрыт на `v0.0.51-search-sort-rev3`.

## Current task

Docs-нормализация после Production KB v1 (ветка `docs/replan-after-production-kb-v1`) и подготовка DRAFT-контракта
**Catalog-backed Seller → Buyer runtime loop** (`docs/slices/catalog-runtime-loop/SLICE_CONTRACT.md`). Это
integration/user-flow proof, не импорт каталога и не S15B. Реализация не начата и не авторизована.

## Next action

1. Controller/PO review docs-нормализации и DRAFT-контракта runtime loop.
2. После `APPROVED — IMPLEMENTATION AUTHORIZED` — реализовать только реально найденный gap (или минимальное
   regression/E2E/manual proof, если путь уже работает).
3. Далее: S15B малыми vertical slices после аудита кода → S15C/D0 → накопление demand → AI Input / AI-модерация.

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
