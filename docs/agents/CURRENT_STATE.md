# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`, очередь — в
`docs/product/EXECUTION_PLAN.md`. Перед работой перепроверить git/GitHub: этот файл может устареть.

- Проверено: 2026-10-01.
- `origin/main`: `4348db8` (merge PR #69), merged-main CI run `36767783836` green.
- Последний annotated product checkpoint: `v0.0.42-commercial-backoffice-pipeline` на `4348db8`.
- Текущая локальная ветка: `slice/seller-location-geo-fallback` от `origin/main`.

## Current task

Активный product stage: Seller Location geo fallback. Implementation завершён; Product Owner вручную принял flow
2026-10-01. Ветка готова к push/PR и branch CI.

Scope:

1. сохранить browser geolocation первым способом;
2. добавить вторичное ручное действие для координат или ссылки 2GIS / Google Maps / Яндекс Карт;
3. распарсить значение локально и показать preview;
4. сохранять только после явного подтверждения через существующий owner-scoped S8 endpoint;
5. доказать отсутствие внешних map/geocoding-запросов и утечки raw geo в Search.

Новых API routes, DB migration и backend domain logic не требуется. KAIDA address directory остаётся отдельным
следующим stage 1a. Казахская вычитка и отдельная desktop-доработка отложены решением PO и не затрагиваются.

## Fixed near queue after current slice

1. KAIDA address directory;
2. Nearby result-first;
3. Search filters closer/fresher/distance;
4. Search filters cheaper/price range;
5. AI Input;
6. AI moderation;
7. Discovery / `Для вас`;
8. S15A → S15B → S15C;
9. S16 remainder + MVP/Demand readiness;
10. future Commercial/Backoffice readiness-gated slices.

## Product-source boundaries

- Current exact behavior: `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md`.
- Historical S8 contract remains the source for validation, ownership and Search privacy boundaries.
- Visual composition comes from the accepted seller mockup and existing `SellerTradingPoints` workspace.
- Commercial/Backoffice parent docs remain planning sources only and do not authorize implementation.

## Next action

Commit only the slice files, push the branch, open the PR and wait for branch CI/review. Merge and checkpoint tag
remain separate repository actions after PR evidence.

## Do not include

- personal `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/`;
- address directory, maps SDK/API, external geocoder, new API or migration;
- KK proofreading or separate desktop changes.
