# KAIDA.KZ 2.0

Новая разработка KAIDA.KZ с чистого листа.

Старый код KAIDA.KZ не является архитектурной основой и не переносится автоматически. Старые ТЗ и материалы допускаются только как источник продуктовых требований и исторических решений.

## Суть продукта

KAIDA.KZ помогает покупателю:

1. найти, где сейчас продаётся нужный товар;
2. узнать о появлении интересного товара;
3. увидеть интересные товары рядом;
4. получить рекомендации того, что потенциально может его заинтересовать.

Центральная сущность продукта: **Offer**, актуальное предложение продавца.

Базовая цепочка:

`Seller Input → обработка / нормализация → Offer → Search / Matching / Discovery → действие покупателя`

П1 = покупатель. П2 = продавец.

## Принцип разработки

Проект собирается маленькими независимыми vertical slices. Каждый slice должен давать одно законченное пользовательское поведение и проходить UI → API → бизнес-логику → БД → тесты → ручную проверку.

`main` должен оставаться заведомо рабочей версией.

## Текущее состояние

Сейчас утверждены:

- правила разработки проекта;
- Feature Map KAIDA.KZ 2.0;
- Technical Foundation v0;
- Feature Spec S0;
- S0 Implementation Contract v1.0;
- Execution Prompt для реализации S0.

**Код S0 ещё не реализован.**

Следующий рабочий шаг: реализация только `S0 First Search` в ветке `slice/s0-search`.

## Документы

- [`docs/PROJECT_RULES.md`](docs/PROJECT_RULES.md)
- [`docs/product/FEATURE_MAP.md`](docs/product/FEATURE_MAP.md)
- [`docs/architecture/TECHNICAL_FOUNDATION_V0.md`](docs/architecture/TECHNICAL_FOUNDATION_V0.md)
- [`docs/slices/S0-search/FEATURE_SPEC.md`](docs/slices/S0-search/FEATURE_SPEC.md)
- [`docs/slices/S0-search/IMPLEMENTATION_CONTRACT.md`](docs/slices/S0-search/IMPLEMENTATION_CONTRACT.md)
- [`docs/slices/S0-search/EXECUTION_PROMPT.md`](docs/slices/S0-search/EXECUTION_PROMPT.md)

## Контрольная точка S0

После полного прохождения Definition of Done рабочая версия S0 должна получить tag:

`v0.0.1-s0`

До этого tag создавать нельзя.
