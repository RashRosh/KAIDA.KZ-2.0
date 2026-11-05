# Current state — передача D2 (2026-11-05)

## Current task

- Миграция дизайна: реализована только выдача поиска D2. Ждём ручную приёмку PO; следующий экран не выбран.
- Продолжать из ветки `slice/design-baseline-search-sort`, [draft PR207](https://github.com/RashRosh/KAIDA.KZ-2.0/pull/207). В main этих изменений ещё нет.
- Main: `a0b6fb159a76ffb899ae47daee69d0d30ffb893e`. Последний checkpoint: annotated `v0.0.86-text-switch-on` → `dcd26adba9fe124a37a800df047810d6b30ae481`; remote refs проверены. S-TEXT-SWITCH-ON повторно не реализовывать.
- Проверенный runtime D2: `dc3d6ecb2143ed08dc9377bd9caa26d27b938966`. Текущий follow-up меняет только документацию; код тот же.

## Last completed / verification

- Выдача B03/B04: карточки, hearts через существующий favourites flow,4nav, typography/SVG/spacing, реальная давность, сортировка, geo/loading/error/correction. [Контракт](../slices/design-search-sort/SLICE_CONTRACT.md), [визуальная сверка и адаптации](../slices/design-search-sort/VISUAL_REVIEW.md).
- [Полный CI42004819351](https://github.com/RashRosh/KAIDA.KZ-2.0/actions/runs/42004819351) SUCCESS: lint/types/migrations/seed/build;731unit,435integration,343E2E PASS,73намеренных project skips. CodeQL42004819048 / dependency42004819159 SUCCESS. Локальные targeted54 и final motion/state6 PASS. Прежние падения не являются текущими blockers.
- Сверены normal/denied/loading/error/correction, размеры, press/reduced-motion и реальный preview. Это проверка агента, не приёмка PO. Merge/tag D2 и deploy не выполнялись.
- Единственная визуальная authority — два Artifact в [DESIGN_BASELINE](../product/DESIGN_BASELINE.md). Старые visual targets superseded, продуктовые contracts сохранены. Полный аудит87досок/91файла ещё НЕ завершён: [точное покрытие](../product/DESIGN_SOURCE_AUDIT.md).
- `/welcome` полностью отложен PO; стрелку при вводе сохранить. [Заметка](../slices/design-first-entry/SLICE_CONTRACT.md). Home/Nearby/Offer/Favourites/Seller/Operator целиком не мигрированы.

## Next action

1. Сверить ветку/PR/CI с этим snapshot; не начинать заново перенос выдачи.
2. Получить ручную приёмку PO по сценарию D2 целиком. Если замечания — исправить этот же slice и выполнить необходимые проверки.
3. После приёмки и поручения PO: diff audit → merge → merged-main CI → annotated checkpoint по PROJECT_RULES. До этого следующий slice не начинать.
4. Перед дальнейшей миграцией завершить аудит источников и согласовать с PO следующий цельный экран; составить его Slice Contract. Порядок принадлежит только [EXECUTION_PLAN](../product/EXECUTION_PLAN.md). Не выбирать экран по старому ТЗ или номеру Sxx. Конфликт закрытого поведения — STOP с объяснением.

## Администратору / перенос среды

- Это передача кода, не production deployment. `127.0.0.1:3500` — preview на текущем компьютере; ссылка/сессии/локальная БД не переносятся через GitHub.
- Запуск: README и [LOCAL_BOOTSTRAP](../ops/LOCAL_BOOTSTRAP.md); версии брать из `.node-version` / `package.json`. Развёртывание: [DEPLOYMENT](../ops/DEPLOYMENT.md), [BACKUP_RESTORE](../ops/BACKUP_RESTORE.md); ограничения Test OTP и production gates сохраняются. Секреты и доступы передаются отдельно, не коммитятся.
- D2 не меняет инфраструктуру, миграции БД или production-настройки. Источники — живые ссылки: при необходимости авторизации использовать браузер PO, не подменять старым макетом.

## Evidence / локальные ограничения

- CI screenshots/report: artifact `13404847181` в указанном run, retention до2026-11-12. После expiry воспроизвести через tests/e2e/design-search-results.spec.ts; fixtures хранятся в Git. Локальные sibling verification-evidence не являются переносимым Git evidence.
- Synthetic preview fixture opt-in: tests/fixtures/design-search/prepare-preview.ts, только loopback55439/kaida_design. Не использовать вместо реальных Offers.
- Текущий clone: design-migration. Оригинальный C:/dev/KAIDA.KZ-2.0 dirty, не трогать; sources/ read-only. Локальные кластеры55439/55440 содержат только test data; не путать их с рабочей средой администратора.
