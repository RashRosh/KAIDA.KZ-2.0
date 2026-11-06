# Current state — после закрытия D4 (2026-11-06)

## Current task

- Миграция дизайна: D2 (выдача поиска), D3 (страница предложения B08) и D4 (Избранное B09/B10) **закрыты**. Следующий экран не выбран.
- Main: `78e6700a34c840bf8c1f1be2b912d7bd02be61b7` (merge PR #212). Checkpoint: annotated `v0.0.89-design-favourites` → этот commit. Облачная сессия не может отправить tag (push тегов закрыт прокси): его создала и отправила сессия Remote Control на ПК PO, на origin проверен (tag object `09171f9d…`); проверка — `git ls-remote --tags origin v0.0.89-design-favourites`.
- Предыдущие checkpoints: `v0.0.88-design-offer` → `1d053107…`, `v0.0.87-design-search` → `7cb100cc…`, `v0.0.86-text-switch-on` → `dcd26adb…`; закрытые slices повторно не реализовывать.

## Last completed / verification

- D4: Избранное B09/B10 — шапка «Избранное» 26/32 со счётчиком, раздел нижней навигации D2 (без стрелки в «Ещё»), карточка записи (фото 88, название, цена, точка, продавец, давность D2, «Убрать из избранного»), недоступная запись (sunken, «Сейчас недоступно», без цены/адреса/контактов/перехода), гость, пусто, загрузка, ошибка списка с «Повторить», ошибка удаления с «Убрать ещё раз». Не перенесены (нет данных): «Цена изменилась», причины недоступности, «Снова доступно», расстояние. [Контракт](../slices/design-favourites/SLICE_CONTRACT.md).
- Приёмка PO 2026-11-06 по скриншотам шести состояний (360 px, 2x) без правок; вопрос PO о «толстых» шрифтах: шрифты совпадают с Artifact, эффект давали снимки в 1x — acceptance-скриншоты теперь снимаются в 2x.
- Branch CI 42179669573 (verify) / CodeQL 42179669620 success; merged-main CI: verify 42181002051, CodeQL 42181002020 success.
- D3: страница предложения B08, [контракт](../slices/design-offer/SLICE_CONTRACT.md); checkpoint `v0.0.88-design-offer`. D2: выдача B03/B04, [контракт](../slices/design-search-sort/SLICE_CONTRACT.md); checkpoint `v0.0.87-design-search`.
- Единственная визуальная authority — два Artifact в [DESIGN_BASELINE](../product/DESIGN_BASELINE.md). Полный аудит 87 досок/91 файла ещё НЕ завершён: [покрытие](../product/DESIGN_SOURCE_AUDIT.md).
- `/welcome` (D1) отложен PO целиком; стрелку при вводе сохранить. Home/Nearby/«Ещё»/Seller/Operator не мигрированы; экран предпросмотра продавца вокруг тела (S10–S11) не мигрирован.

## Next action

1. Согласовать с PO следующий цельный экран (предложенный порядок: B07 Рядом → …); составить его Slice Contract. Порядок — только [EXECUTION_PLAN](../product/EXECUTION_PLAN.md). Конфликт закрытого поведения — STOP с объяснением.

## Администратору / перенос среды

- Это передача кода, не production deployment. `127.0.0.1:3500` — preview на текущем компьютере; ссылка/сессии/локальная БД не переносятся через GitHub.
- Запуск: README и [LOCAL_BOOTSTRAP](../ops/LOCAL_BOOTSTRAP.md); версии брать из `.node-version` / `package.json`. Развёртывание: [DEPLOYMENT](../ops/DEPLOYMENT.md), [BACKUP_RESTORE](../ops/BACKUP_RESTORE.md); ограничения Test OTP и production gates сохраняются. Секреты и доступы передаются отдельно, не коммитятся.
- D2 не меняет инфраструктуру, миграции БД или production-настройки. Источники — живые ссылки: при необходимости авторизации использовать браузер PO, не подменять старым макетом.

## Evidence / локальные ограничения

- CI screenshots/report: artifact `13404847181` в указанном run, retention до2026-11-12. После expiry воспроизвести через tests/e2e/design-search-results.spec.ts; fixtures хранятся в Git. Локальные sibling verification-evidence не являются переносимым Git evidence.
- Synthetic preview fixture opt-in: tests/fixtures/design-search/prepare-preview.ts, только loopback55439/kaida_design. Не использовать вместо реальных Offers.
- Текущий clone: design-migration. Оригинальный C:/dev/KAIDA.KZ-2.0 dirty, не трогать; sources/ read-only. Локальные кластеры55439/55440 содержат только test data; не путать их с рабочей средой администратора.
