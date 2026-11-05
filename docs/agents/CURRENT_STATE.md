# Current state — после закрытия D3 (2026-11-05)

## Current task

- Миграция дизайна: D2 (выдача поиска) и D3 (страница предложения B08) **закрыты**. Следующий экран не выбран.
- Main: `1d053107442d8825eea5ea21999b3746d3dafd42` (merge PR #210). Checkpoint: annotated `v0.0.88-design-offer` → этот commit. Проверить `git ls-remote --tags origin v0.0.88-design-offer`: облачная сессия не может отправить tag (push тегов закрыт прокси), его отправляет PO.
- Предыдущие checkpoints: `v0.0.87-design-search` → `7cb100cc…`, `v0.0.86-text-switch-on` → `dcd26adb…`; закрытые slices повторно не реализовывать.

## Last completed / verification

- D3: страница предложения B08 — шапка «Назад · Предложение» без нижней навигации, квадратная галерея, без фото / ошибка фото с «Повторить», цена 32/36 с сердцем (сохранено + подпись, занято, ошибка), давность D2, карточка точки с полной неделей, «Связаться», «От продавца», «Пожаловаться на карточку», «Отслеживать товар» (сохранён до решения PO), нижняя панель маршрута, недоступное предложение и ошибка загрузки B08.ST08; предпросмотр продавца — то же тело, inert. [Контракт](../slices/design-offer/SLICE_CONTRACT.md).
- Приёмка PO 2026-11-05 по скриншотам девяти состояний (360 px) без правок.
- Branch CI 42107328267 (verify) / CodeQL 42107328389 success; merged-main CI: verify 42115933030, CodeQL 42115932791 success.
- D2: выдача B03/B04, [контракт](../slices/design-search-sort/SLICE_CONTRACT.md); checkpoint `v0.0.87-design-search`.
- Единственная визуальная authority — два Artifact в [DESIGN_BASELINE](../product/DESIGN_BASELINE.md). Полный аудит 87 досок/91 файла ещё НЕ завершён: [покрытие](../product/DESIGN_SOURCE_AUDIT.md).
- `/welcome` (D1) отложен PO целиком; стрелку при вводе сохранить. Home/Nearby/Favourites/Seller/Operator не мигрированы; экран предпросмотра продавца вокруг тела (S10–S11) не мигрирован.

## Next action

1. Убедиться, что tag `v0.0.88-design-offer` есть на origin.
2. Согласовать с PO следующий цельный экран (предложенный порядок: B09–B10 Избранное → B07 Рядом → …); составить его Slice Contract. Порядок — только [EXECUTION_PLAN](../product/EXECUTION_PLAN.md). Конфликт закрытого поведения — STOP с объяснением.

## Администратору / перенос среды

- Это передача кода, не production deployment. `127.0.0.1:3500` — preview на текущем компьютере; ссылка/сессии/локальная БД не переносятся через GitHub.
- Запуск: README и [LOCAL_BOOTSTRAP](../ops/LOCAL_BOOTSTRAP.md); версии брать из `.node-version` / `package.json`. Развёртывание: [DEPLOYMENT](../ops/DEPLOYMENT.md), [BACKUP_RESTORE](../ops/BACKUP_RESTORE.md); ограничения Test OTP и production gates сохраняются. Секреты и доступы передаются отдельно, не коммитятся.
- D2 не меняет инфраструктуру, миграции БД или production-настройки. Источники — живые ссылки: при необходимости авторизации использовать браузер PO, не подменять старым макетом.

## Evidence / локальные ограничения

- CI screenshots/report: artifact `13404847181` в указанном run, retention до2026-11-12. После expiry воспроизвести через tests/e2e/design-search-results.spec.ts; fixtures хранятся в Git. Локальные sibling verification-evidence не являются переносимым Git evidence.
- Synthetic preview fixture opt-in: tests/fixtures/design-search/prepare-preview.ts, только loopback55439/kaida_design. Не использовать вместо реальных Offers.
- Текущий clone: design-migration. Оригинальный C:/dev/KAIDA.KZ-2.0 dirty, не трогать; sources/ read-only. Локальные кластеры55439/55440 содержат только test data; не путать их с рабочей средой администратора.
