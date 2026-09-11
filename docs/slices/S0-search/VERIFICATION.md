# S0 verification

Статус: **READY**.

## GitHub Actions

Последний полный проверенный run для рабочей реализации S0:

- workflow: `S0 verify`
- run id: `34602433017`
- commit: `8f9b51d747a451275f6ba6bb0265e597a896c3d7`
- conclusion: **success**
- PostgreSQL: **18.6**

Фактически прошли:

| Проверка | Фактический результат |
| --- | --- |
| install from lockfile | PASS |
| lint | PASS |
| typecheck | PASS |
| migrations | PASS |
| seed | PASS: 2 products, 1 seller, 1 location, 2 offers |
| clean test DB migration | PASS |
| repeat migration / seed | PASS |
| unit | PASS: 18/18 |
| integration | PASS: 21/21 |
| production build | PASS |
| E2E mobile + desktop | PASS: 14/14 |
| full `pnpm verify` | PASS |

Workflow использовал реальный `postgres:18`, создавал отдельные `kaida` и `kaida_test` и не использовал mock DB.

## Manual acceptance

Ручная приёмка выполнена пользователем 2026-09-11 в GitHub Codespaces с реальным PostgreSQL 18 и рабочим браузером.

Проверено:

- Desktop: поиск `баранина` показывает товар, цену `4 200 ₸ / кг`, продавца, Location, адрес и комментарий.
- Desktop: поиск `говядина` показывает Offer и состояние `Цена не указана`.
- Desktop: поиск `единорог` удаляет предыдущую карточку и показывает empty state.
- Desktop: пустой query показывает `Введите название товара.`.
- Desktop: после reload повторный поиск `баранина` работает.
- Keyboard: Tab-navigation и видимый focus state проверены.
- Mobile около 400 px: поиск `баранина` работает, карточка читаема, layout не развален, горизонтального scroll визуально нет.

Результат manual acceptance: **PASS**.

## Отклонения

Единственное согласованное отклонение во время реализации: локальное окружение первого coding-agent не позволяло поднять Docker/PostgreSQL, поэтому полная DB verification была перенесена в GitHub Actions. Это не изменило стек, scope или требования S0.

Manual acceptance после этого была отдельно фактически выполнена в GitHub Codespaces с PostgreSQL 18.

## Итог

S0 выполняет утверждённую пользовательскую задачу end-to-end:

`Browser → UI → API → Search application → PostgreSQL → Offer → UI`

S0 готов к фиксации в `main` и tag `v0.0.1-s0`.
