# KAIDA.KZ 2.0 — UX Observation Inbox

Этот файл **не является roadmap, product contract или вторым Issue tracker**.

Его единственная задача — временно удерживать UX/UI-наблюдения, которые ещё не получили отдельного Product Owner decision / GitHub Issue.

## Правила

- Новое наблюдение можно кратко записать сюда, если оно ещё не готово стать Issue.
- Как только решение принято и работа получает Issue или место в `EXECUTION_PLAN.md`, подробности отсюда удаляются.
- Закрытые/DONE пункты здесь не архивируются — для истории достаточно Git history, Issues и Slice Contracts.
- Текущая очередь всегда берётся из `docs/product/EXECUTION_PLAN.md`.
- Visual rules всегда берутся из `docs/DESIGN_SYSTEM.md`.
- Перед UI/UX Slice Contract использовать `docs/product/UX_REFERENCE_INDEX.md` и релевантные external references.

## Текущие неповышенные наблюдения

### UX-OBS-001 — Controlled choice вместо свободного ввода

**Область:** Seller forms / data entry
**Статус:** OBSERVATION — проверить в ближайших seller workspace Slice Contracts / UX audit.

Когда допустимые значения заранее известны системе, не заставлять пользователя вводить их произвольно.

Направление для проверки:

- unit и другие короткие конечные множества → controlled select/chips;
- address → search/autocomplete, а не фиктивный dropdown;
- free text оставлять только там, где значение действительно произвольное.

Это observation, а не разрешение менять API/domain model без Slice Contract.

### UX-OBS-002 — Системные состояния (loading/offline/server error) без владельца

**Область:** Все экраны, buyer и seller
**Статус:** OBSERVATION — источник: `docs/product/UX_REFERENCE_INDEX.md`, «Follow-up spot-check (2026-09-22)»,
finding #3.

Сейчас `docs/DESIGN_SYSTEM.md` фиксирует только `--error` цвет-токен и то, что loading блокирует повторный
submit. Скелетоны, offline/stale-cache поведение и градация серьёзности ошибки сервера (весь экран / локальный
блок / тост) не описаны ни в одном Slice Contract или Design System разделе, при этом это сквозной, а не
locale-specific вопрос.

Направление для проверки — не разрешение реализовывать без Slice Contract:

- форма скелетона должна повторять форму итогового контента (без сдвига при подстановке данных);
- offline — показывать последние загруженные данные с меткой давности вместо пустого экрана, если кэш есть;
- ошибка сервера — full-screen только если экран без данных бессмысленен, иначе локальный блок/тост;
- ввод пользователя (черновик seller-формы) не должен теряться при потере сети.

## Уже повышенные UX-направления

Подробности больше не дублируются здесь:

- Search sorting / geo trigger / visible distance → Issue #12;
- Seller Offer Workspace → Issue #27;
- Nearby result-first correction → Issue #34;
- Seller contextual entry/auth → Issue #35;
- Trading Points Workspace → Issue #36;
- UX reference audit / Design System reconciliation → Issue #37;
- Seller freshness policy/reminder → Issues #31/#32;
- real Offer media → M1 in `EXECUTION_PLAN.md` / future Slice Contract.

Buyer actionability, UX1A–UX2A и другие уже закрытые UX stages остаются историческим evidence в tags, Slice Contracts и Git history и не поддерживаются здесь как live backlog.
