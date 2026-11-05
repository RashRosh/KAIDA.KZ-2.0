# Хорошие и плохие тесты

## Хорошие

**Через реальный интерфейс**, без моков внутренних частей.

```typescript
// ХОРОШО: проверяет наблюдаемое поведение
test('покупатель находит активное предложение рядом', async () => {
  const offer = await publishOffer(seller, { title: 'Молоко', price: 450 });
  const results = await searchNearby({ query: 'молоко', point });
  expect(results.map((r) => r.id)).toContain(offer.id);
});
```

Признаки:

- проверяет то, что важно пользователю или вызывающему коду;
- использует только публичный API;
- переживает внутренний рефакторинг;
- описывает ЧТО, а не КАК;
- одна логическая проверка на тест.

## Плохие

**Привязка к деталям реализации.**

```typescript
// ПЛОХО: проверяет, как устроен код внутри
test('publishOffer вызывает offerRepository.insert', async () => {
  const insert = vi.spyOn(offerRepository, 'insert');
  await publishOffer(seller, draft);
  expect(insert).toHaveBeenCalledOnce();
});
```

Тревожные признаки:

- мок внутренних модулей;
- тест приватных функций;
- проверка числа и порядка вызовов;
- тест ломается при рефакторинге без изменения поведения;
- название описывает КАК, а не ЧТО;
- проверка в обход интерфейса.

```typescript
// ПЛОХО: проверка в обход интерфейса
test('publishOffer сохраняет строку в БД', async () => {
  await publishOffer(seller, draft);
  const rows = await db.select().from(offers).where(eq(offers.sellerId, seller.id));
  expect(rows).toHaveLength(1);
});

// ХОРОШО: проверка через тот же интерфейс
test('опубликованное предложение видно в кабинете продавца', async () => {
  const offer = await publishOffer(seller, draft);
  const mine = await listSellerOffers(seller);
  expect(mine.map((o) => o.id)).toContain(offer.id);
});
```

Исключение: когда Slice Contract прямо требует доказать DB constraint, транзакцию или миграцию (risk flag по §5), проверка на уровне БД и есть публичный seam этого риска.

**Тавтология**: ожидание повторяет реализацию.

```typescript
// ПЛОХО: ожидаемое значение считается так же, как в коде
test('сумма позиций', () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(total(items)).toBe(expected);
});

// ХОРОШО: независимый известный литерал
test('сумма позиций', () => {
  expect(total([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

Имена функций в примерах условные; в коде используй реальные модули проекта.
