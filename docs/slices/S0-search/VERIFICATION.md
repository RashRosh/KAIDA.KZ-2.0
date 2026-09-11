# S0 verification

Статус: **NOT READY: manual acceptance pending**.

## Локальная проверка

| Проверка | Фактический результат |
| --- | --- |
| Node / package manager | Node 24.19.0, pnpm 11.19.0 |
| Установка из lockfile | PASS |
| lint | PASS |
| typecheck | PASS |
| unit | PASS: 18 тестов, 3 файла |
| drizzle-kit generate | Сгенерирована 0000_s0_first_search.sql, SQL просмотрен |
| drizzle-kit check | PASS |
| production build | PASS: / и /api/search |
| E2E discovery | Найдены 14 сценариев, по 7 mobile и desktop; это не запуск E2E |
| YAML Compose / workflow | Разбираются без ошибок; локальный Docker не запускался |
| PostgreSQL, migrations, seed, integration, полный verify | Здесь не запускались: Docker недоступен; согласован запуск в CI |
| Manual mobile / desktop | NOT VERIFIED: нет PostgreSQL; Cloud Browser также блокирует localhost (ERR_BLOCKED_BY_CLIENT) |

## GitHub Actions

Ожидается фактический запуск workflow `S0 verify` после push. Наличие workflow не является свидетельством прохождения тестов. Результат и ссылка будут зафиксированы после завершения run.

Workflow использует реальный `postgres:18`, создаёт отдельную `kaida_test` штатным SQL, проверяет пустую `kaida` и запускает полный `pnpm verify`.

## Незавершённая ручная приёмка

- Mobile около 390 px: баранина, говядина без цены, единорог, пустой query, отсутствие старой карточки, читаемость и touch.
- Desktop около 1440 px: основной поиск, повтор после reload, клавиатура/фокус, отсутствие горизонтального scroll.
- Реальное пользовательское прохождение с подключённым PostgreSQL.

E2E и его скриншоты не помечаются как выполненная ручная приёмка. До неё запрещены merge в main, tag v0.0.1-s0 и начало S1.

## Отклонения

Только согласованный перенос проверок с PostgreSQL из текущего окружения в GitHub Actions и отложенная manual acceptance. Стек и scope S0 сохранены. Дополнительные служебные файлы описаны в IMPLEMENTATION_NOTES.md.
