# Current state — после закрытия D2 (2026-11-05)

## Current task

- Миграция дизайна: D2 (цельная выдача поиска) **закрыт**. Следующий экран не выбран.
- Main: `7cb100cc7a66c0659ebf319f59d360cbf597d815` (merge PR #207). Checkpoint: annotated `v0.0.87-design-search` → этот commit. Проверить `git ls-remote --tags origin v0.0.87-design-search`: облачная сессия не смогла отправить tag (push тегов закрыт прокси), его отправляет PO.
- Предыдущий checkpoint `v0.0.86-text-switch-on` → `dcd26adb…`; S-TEXT-SWITCH-ON повторно не реализовывать.

## Last completed / verification

- D2: выдача B03/B04 — карточки, hearts через существующий favourites flow, 4 nav, реальная давность, сортировка, geo/loading/error/correction. [Контракт](../slices/design-search-sort/SLICE_CONTRACT.md), [визуальная сверка](../slices/design-search-sort/VISUAL_REVIEW.md).
- Приёмка PO 2026-11-05 по скриншотам пяти состояний (360 px) с правкой: trigger сортировки и счётчик одинаковы во всех состояниях (вариант B04 outline/up-down убран, da09685).
- Branch CI 42080515695 success; merged-main CI: verify 42083058297, CodeQL 42083058370 success.
- Единственная визуальная authority — два Artifact в [DESIGN_BASELINE](../product/DESIGN_BASELINE.md). Полный аудит 87 досок/91 файла ещё НЕ завершён: [покрытие](../product/DESIGN_SOURCE_AUDIT.md).
- `/welcome` (D1) отложен PO целиком; стрелку при вводе сохранить. Home/Nearby/Offer/Favourites/Seller/Operator не мигрированы.

## Next action

1. Убедиться, что tag `v0.0.87-design-search` есть на origin.
2. Завершить аудит источников и согласовать с PO следующий цельный экран; составить его Slice Contract. Порядок — только [EXECUTION_PLAN](../product/EXECUTION_PLAN.md). Конфликт закрытого поведения — STOP с объяснением.

## Администратору / перенос среды

- Это передача кода, не production deployment. `127.0.0.1:3500` — preview на текущем компьютере; ссылка/сессии/локальная БД не переносятся через GitHub.
- Запуск: README и [LOCAL_BOOTSTRAP](../ops/LOCAL_BOOTSTRAP.md); версии брать из `.node-version` / `package.json`. Развёртывание: [DEPLOYMENT](../ops/DEPLOYMENT.md), [BACKUP_RESTORE](../ops/BACKUP_RESTORE.md); ограничения Test OTP и production gates сохраняются. Секреты и доступы передаются отдельно, не коммитятся.
- D2 не меняет инфраструктуру, миграции БД или production-настройки. Источники — живые ссылки: при необходимости авторизации использовать браузер PO, не подменять старым макетом.

## Evidence / локальные ограничения

- CI screenshots/report: artifact `13404847181` в указанном run, retention до2026-11-12. После expiry воспроизвести через tests/e2e/design-search-results.spec.ts; fixtures хранятся в Git. Локальные sibling verification-evidence не являются переносимым Git evidence.
- Synthetic preview fixture opt-in: tests/fixtures/design-search/prepare-preview.ts, только loopback55439/kaida_design. Не использовать вместо реальных Offers.
- Текущий clone: design-migration. Оригинальный C:/dev/KAIDA.KZ-2.0 dirty, не трогать; sources/ read-only. Локальные кластеры55439/55440 содержат только test data; не путать их с рабочей средой администратора.
