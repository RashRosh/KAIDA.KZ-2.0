# S0: реализация и согласованное исключение

Рабочая ветка: `slice/s0-search`. База реализации: `83297f4eca0cfc93d2aee14192b7de591fff0842`. Старый репозиторий KAIDA.KZ не использовался.

## План файлов и границы

1. Foundation: package/lockfile, Next.js, TypeScript, ESLint, Docker Compose, env example.
2. Четыре владельца таблиц: Catalog, Sellers, Locations, Offers. Общая регистрация schema, client, migration и seed.
3. Search: runtime contract, application use case, read repository и один HTTP route.
4. Одна страница с SearchForm и OfferCard, CSS Modules и базовые CSS variables.
5. Unit, integration PostgreSQL 18, E2E mobile/desktop, полный verify, CI, README.

Дополнительные служебные файлы, объяснённые до создания: `next-env.d.ts` (генерируемые типы Next.js), `.node-version` (Node 24) и `pnpm-workspace.yaml` (разрешённые install scripts инфраструктурных зависимостей). Они не меняют продуктовый scope, публичный API или будущие slices.

## Технические решения внутри S0

- Exact match через параметризованное SQL-сравнение `lower(name) = lower(query)` без LIKE/ILIKE и подстановок.
- Цена остаётся decimal string в БД, API и форматировании UI; nullable price не преобразуется в 0.
- Ограничения БД исключают отрицательную, NaN и бесконечную цену и требуют трёхбуквенный код валюты при заданной сумме.
- Seed использует фиксированные UUID/даты и upsert только своих тестовых записей.
- Test reset проверяет URL, фактическое имя `kaida_test` и PostgreSQL 18. Development database не очищается.
- Repeat migration и repeat seed проверяются в `db:test:prepare`.
- API ошибки имеют безопасный JSON. Loading запрещает повторную отправку, прежние результаты очищаются.
- UI: товар и цена рядом, продавец и адрес ниже. Desktop использует две колонки, mobile одну.

## Исключение окружения, согласовано 2026-09-11

Здесь отсутствует Docker и запрещены пространства изоляции (`unshare: Operation not permitted`). Пользователь разрешил выполнить проверки с реальным PostgreSQL 18 в GitHub Actions.

Не разрешены замена БД, изменение стека, снижение контрактов тестов, фиктивная manual acceptance, merge в main или создание контрольного tag.

Зелёный CI не завершает ручную приёмку. Статус: **NOT READY: manual acceptance pending**. Фактические проверки и незакрытые пункты фиксируются отдельно в `VERIFICATION.md`.
