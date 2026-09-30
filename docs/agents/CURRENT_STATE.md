# Current verified state

Короткий операционный снимок. Долговечные правила — в `AGENTS.md` и `docs/PROJECT_RULES.md`, очередь — в
`docs/product/EXECUTION_PLAN.md`. Перед работой перепроверь git/GitHub: этот файл может устареть.

- Проверено: 2026-09-30.
- `origin/main`: `4567eff` (merge PR #67), merged-main CI green.
- Последний annotated product checkpoint: `v0.0.36-actuality-reminders` на `5375bab`.
- После checkpoint в `main` вошли PR #63, #64, #65 и #67; недостающие checkpoint tags — первый repository gate.
- PR #66 открыт и mergeable, но его успешные checks старше актуального `main`; перед merge нужен refresh и новый CI.
- Текущая локальная ветка: `docs/search-demand-planning` от `origin/main`.

## Current task

Docs/planning pass, без product implementation:

1. зафиксировать Search System Spec v0.1 как target source, не Slice Contract;
2. зафиксировать KAIDA Demand concept v0.1;
3. добавить Initial Product Catalog v0.1 как неизменённый editorial input artifact;
4. расширить S15 на S15A Catalog bootstrap, S15B Search System revision и S15C Demand Data Foundation;
5. обновить `FEATURE_MAP.md`, `EXECUTION_PLAN.md` и Issue #55.

## Fixed near queue

1. missing checkpoint tags;
2. PR #66;
3. Seller Location geo fallback;
4. KAIDA address directory;
5. Nearby result-first;
6. Search filters closer/fresher/distance;
7. Search filters cheaper/price range;
8. AI Input;
9. AI moderation;
10. Discovery / `Для вас`;
11. S15A → S15B → S15C.

Catalog и KAIDA Demand не вставляются раньше этой очереди. Казахская вычитка и отдельная desktop-работа отложены по
решению PO и в этом pass не затрагиваются.

## Product-source boundaries

- Catalog workbook: 787 candidates, 682 `YES`, 105 `REVIEW`; это не migration/seed. Draft KK не verified, а
  `candidate_code` не `Product.id`.
- Search Spec требует будущей сверки с кодом и contract revisions closed S0/S6/S7/S9/S13.
- S15C разрешает только D0/D1 и необходимую основу D2; seller Demand UI/paid Demand позже и по readiness gates.
- Решение PO 2026-09-30: `buyer_interests` не равен explicit «Сообщить, когда появится»; различаются search/view,
  interest и explicit waiting.
- Решение PO 2026-09-30: active-product limit выключен на пилоте, но остаётся configurable future monetization option;
  значение определяется по статистике.
- Решение PO 2026-09-30: `Category` остаётся полноценной сущностью; Excel `category_code` только маппится на простой
  неглубокий рубрикатор KAIDA.

## Next action

Проверить docs diff и ссылки. Issue #55 синхронизирован с решениями PO. Commit, push и PR — только по прямому
поручению PO.

## Do not include

- личные `next-env.d.ts`, `next.config.ts`, `.vscode/`, `scripts/`, `tmp/`;
- реализацию, migrations, seeds, APIs или UI;
- KK proofreading или desktop changes.
