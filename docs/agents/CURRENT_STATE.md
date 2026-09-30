# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`, очередь — в
`docs/product/EXECUTION_PLAN.md`. Перед работой перепроверь git/GitHub: этот файл может устареть.

- Проверено: 2026-09-30.
- `origin/main`: `fd11a48` (merge PR #66), merged-main CI run `36706008273` green.
- Последний annotated product checkpoint: `v0.0.41-card-point-link` на `fd11a48`.
- Checkpoint tail `v0.0.37`–`v0.0.41` закрыт; PR #66 merged.
- Текущая локальная ветка: `docs/commercial-backoffice-pipeline` от `origin/main`.

## Current task

Docs/planning pass по Product Owner direction, без production implementation:

1. зафиксировать общую Commercial Entitlements Model для Free / Pro / Boost / Business;
2. пометить старую hard-cap форму S25 stale / review required;
3. встроить independent dependency chains Pro / Demand / Boost / Business;
4. зафиксировать Backoffice как client общего backend/domain;
5. поставить Commercial & Monetization Readiness до Backoffice IA/UX;
6. разложить будущий Backoffice на operational vertical-slice families;
7. обновить только future planning, не переставляя committed near queue.

## Fixed near queue

1. Seller Location geo fallback;
2. KAIDA address directory;
3. Nearby result-first;
4. Search filters closer/fresher/distance;
5. Search filters cheaper/price range;
6. AI Input;
7. AI moderation;
8. Discovery / `Для вас`;
9. S15A → S15B → S15C;
10. S16 remainder + MVP/Demand readiness;
11. future Commercial/Backoffice planning gates and readiness-gated slices.

Текущий docs pass не разрешает начинать следующий product slice. Казахская вычитка и отдельная desktop-работа
остаются отложенными по решению PO и не затрагиваются.

## Product-source boundaries

- Commercial parent source: `docs/product/KAIDA.KZ_COMMERCIAL_ENTITLEMENTS_MODEL_v0.1.md`.
- Backoffice parent planning source: `docs/product/KAIDA.KZ_BACKOFFICE_DEVELOPMENT_PIPELINE_v1.1.md`.
- Free сохраняет полноценную ручную правдивую витрину; hard commercial active-Offer cap удалён из текущего
  monetization direction и может вернуться только по evidence + новому явному PO decision.
- S25 old hard-cap form — `REVIEW REQUIRED`, не implementation-ready.
- Первая commercial scope: `1 Seller = 1 CommercialAccount`; Organization/polymorphic owner сейчас не вводятся.
- Pro = AI + full Demand + Performance; capability readiness независима, но sellable Pro ждёт минимум всех трёх.
- Boost — one-off purchase независимо от Pro; organic ranking и Editorial Featured не используются как shortcut;
  v1 без auction/CPC/CPM и без guarantee of sales.
- Business minimum = employees/roles, multi-location, bulk/XLS/CSV, cross-location analytics, aggregated Demand,
  audit/history и higher quotas; API/1C/ERP/integrations позже.
- Backoffice не содержит business/commercial logic; первый future operational vertical — Catalog Operations, затем
  остальные slices по dependency audit. Minimum roles: operator/moderator/admin.
- S15C разрешает D0/D1 и необходимую основу D2; D3/D4 остаются readiness-gated.
- Demand: actionable signals = Free, full = Pro, aggregated multi-location = Business; отдельной подписки нет.

Открыты: pricing, численные AI/batch quotas, trial/grace/cancel, refund, payment provider, Boost prices/packages/
frequency caps/inventory и exact Demand privacy threshold. Они не блокируют текущий docs pass.

## Next action

Docs diff/link consistency audit завершён; решения и открытые decisions показаны Product Owner. Ближайшее действие —
только по прямому поручению PO выполнить commit → push → PR → merge → merged-main verification → annotated docs
checkpoint. После закрытия этого docs checkpoint первый product stage по очереди — Seller Location geo fallback;
его implementation не начинать без отдельного разрешения PO.

## Do not include

- личные `next-env.d.ts`, `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`, `.pnpm-store/`;
- implementation, migrations, seeds, APIs, UI, Billing, payment provider, Boost или Business;
- KK proofreading или desktop changes.
