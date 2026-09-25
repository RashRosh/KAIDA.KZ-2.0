# KAIDA.KZ 2.0 — UX Observation Inbox

Этот файл **не является roadmap, product contract или вторым Issue tracker**.

Его единственная задача — временно удерживать UX/UI-наблюдения, которые ещё не получили отдельного Product Owner decision / GitHub Issue.

## Правила

- Новое наблюдение можно кратко записать сюда, если оно ещё не готово стать Issue.
- Как только решение принято и работа получает Issue или место в `EXECUTION_PLAN.md`, подробности отсюда удаляются.
- Закрытые/DONE пункты здесь не архивируются — для истории достаточно Git history, Issues и Slice Contracts.
- Текущая очередь всегда берётся из `docs/product/EXECUTION_PLAN.md`.
- Какой макет главный и обязательные UI-правила — `docs/PROJECT_RULES.md` §18.1 и §18.4.
- Перед UI/UX Slice Contract использовать `docs/product/UX_REFERENCE_INDEX.md` и релевантные external references.

## Текущие неповышенные наблюдения

Нет.

## Уже повышенные UX-направления

Подробности больше не дублируются здесь:

- Search sorting / geo trigger / visible distance → Issue #12;
- Nearby result-first correction → Issue #34;
- актуальность (бывш. freshness) и напоминания → Issues #31/#32;
- AI-first витрина продавца → `SELLER_AI_FIRST_DESIGN_BRIEF.md`, ревизия 1, `EXECUTION_PLAN.md` этап 1;
- controlled choice вместо свободного ввода (бывш. `UX-OBS-001`) → единица цены (`offer-price-unit`), справочник адресов
  (`FEATURE_MAP.md`);
- системные состояния (бывш. `UX-OBS-002`) → `PROJECT_RULES.md` §18.4.

Закрытые UX stages остаются историческим evidence в tags, Slice Contracts и Git history и не поддерживаются здесь как live backlog.
