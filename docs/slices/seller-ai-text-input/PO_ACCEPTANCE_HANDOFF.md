# PR #188 — handoff для решения Рашита о merge

**Репозиторий:** RashRosh/KAIDA.KZ-2.0  
**PR:** [#188](https://github.com/RashRosh/KAIDA.KZ-2.0/pull/188) — feat(seller): text input integration slice 1  
**Код slice (до doc-commit):** `acb44b32e9c61fa9bbdcdf671390516c57f50d0d`  
**Дата пакета приёмки:** 2026-10-20  
**Merge:** не выполнялся. **PO PASS** этим документом не объявляется.

---

## Что проверяет Рашит (кратко)

При `SELLER_TEXT_INPUT=fake` продавец видит **«Написать списком»**, разбор в **черновики**, экран **review** (multi / skipped / uncertain) и существующий **CardEditor**; публикация — только через **«Проверить и опубликовать»**. Парсер **fake** (фикстуры), без live LLM. Production default: `SELLER_TEXT_INPUT=off`.

---

## 1. Ручная визуальная проверка (для Рашита)

Цель: убедиться, что UI понятен на **mobile** и **desktop**, без опоры на автотесты.

**Артефакты:** `docs/slices/seller-ai-text-input/evidence/` (12 PNG, ~344 KiB суммарно).

| Файл | Что смотреть |
|------|----------------|
| `*-01-source-sheet.png` | Точка входа «Написать списком», отключённые каналы, «Заполнить вручную» |
| `*-02-text-compose.png` | Экран ввода списка |
| `*-03-review-multi.png` | Два черновика после `[fixture:e2e-multi]` |
| `*-04-review-skipped.png` | Блок «Не распознано» после `[fixture:e2e-skipped]` |
| `*-05-review-uncertain.png` | Notice по unit после `[fixture:e2e-uncertain]` |
| `*-06-card-editor.png` | CardEditor для каталога (Баранина), без лишних verification UI |

**Повтор съёмки (локально):** `pnpm exec tsx docs/slices/seller-ai-text-input/evidence/capture-acceptance.mts`  
Нужны: сервер `127.0.0.1:3100` с `SELLER_TEXT_INPUT=fake`, `pnpm build`, test Postgres (`DATABASE_URL` / `TEST_DATABASE_URL`). Скрипт использует тестовые номера E2E-диапазона, **не пишет OTP/токены в файлы**, удаляет созданные записи до и после прогона.

**Приватность артефактов:** в committed PNG нет телефонов, OTP, cookies, session id и абсолютных путей; на skipped-скрине виден только маркер фикстуры `[fixture:e2e-skipped]` в тексте сценария.

**Не снято скриншотом (ожидается решение Рашита по коду / отдельному прогону):**

- `SELLER_TEXT_INPUT=off` — кнопка скрыта, `/seller/text-input` → 404 (проверка в unit/integration, без UI-capture в этом пакете).
- Полный путь «разбор → confirm → buyer видит offer» — см. раздел 2 (CI E2E).

---

## 2. Сценарии, подтверждённые E2E / integration в CI

На head slice-кода `acb44b3` зелёный **KAIDA verify** (включая `tests/e2e/seller-text-input.spec.ts`, `tests/integration/seller-text-input.test.ts`, unit `seller-text-input`).

| Сценарий | Слой | Примечание |
|----------|------|------------|
| Fake parse → drafts, HTTP 201 | integration | фикстуры catalog / free-title / multi / skipped / uncertain |
| Нет offer до confirm | E2E + integration | SQL count |
| Редактирование черновика в CardEditor | E2E | без auto-publish |
| Publish после confirm → ровно 1 offer | E2E | отдельный тест |
| Сетевой сбой parse + повтор без дублей | E2E + integration | |
| `SELLER_TEXT_INPUT=off` → API/route недоступны | integration + unit | |
| Эвристика простого текста (без fixture token) | unit | |
| Упаковка / unit / pack | unit + integration (`e2e-free-title`) | |

Ссылки на CI для `acb44b3` (до doc-commit; после push см. checks нового SHA в PR):

| Check | Run |
|--------|-----|
| KAIDA verify (PR) | https://github.com/RashRosh/KAIDA.KZ-2.0/actions/runs/39407504186 |
| CodeQL | https://github.com/RashRosh/KAIDA.KZ-2.0/runs/118577210030 |
| Dependency review | https://github.com/RashRosh/KAIDA.KZ-2.0/actions/runs/39407504141 |

---

## 3. Непроверенные или частично проверенные ограничения

| Ограничение | Статус доказательств |
|-------------|----------------------|
| **Ambiguous** catalog match | Поведение в коде/unit; **нет** отдельного E2E/integration fixture |
| Skipped lines в **sessionStorage** | Может пропасть при reload review (контракт); не покрыто E2E reload |
| Live LLM / платные API | Не в scope PR; только `fake` |
| `aiHints` в JSON черновика | Не доказан явный strip при publish; buyer API не отдаёт |
| Text → publish в **одном** E2E | Разбито на два теста; логика контракта сохранена |
| Flaky `contact-default` на CI | Не связан с slice; rerun на `acb44b3` прошёл |

---

## Тестовые строки fake parser (справочник)

| Ввод | Ожидание |
|------|----------|
| `[fixture:e2e-catalog]` | 1 черновик, каталог «Баранина» |
| `[fixture:e2e-free-title]` | свободное название, package unit |
| `[fixture:e2e-multi]` | 2 черновика |
| `[fixture:e2e-skipped]` | черновик + skip «Виноград» |
| `[fixture:e2e-uncertain]` | черновик + uncertain notice |

---

## Scope / production safety (код PR)

- Default `off` — `seller-text-input.config.ts`, `.env.example`
- Миграций БД и изменений `EXECUTION_PLAN.md` в PR нет
- Rollback: revert merge, `SELLER_TEXT_INPUT=off`, удалить черновики в UI

---

## Замечания review (не blocker)

| Уровень | Замечание |
|---------|-----------|
| medium | Нет integration/E2E на **ambiguous** catalog |
| low | `aiHints` не доказан strip при publish |
| low | Flaky `contact-default` на CI (вне slice) |

---

## Вердикт

**READY FOR RASHIT PO ACCEPTANCE** — пакет evidence и разделение «ручное / CI / ограничения» для решения о merge; технический gate на коде slice (`acb44b3`) был зелёный. Формальный **PO PASS** и **merge** — только после решения Рашита.

**Merge не выполнялся.**
