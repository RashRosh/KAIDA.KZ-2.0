# Когда мокать

Мокать только на **границах системы**:

- внешние сервисы: доставка OTP (`OtpDelivery` в `src/modules/identity/delivery`), web push, карты и геокодинг;
- время и случайность;
- файловое хранилище (иногда).

Не мокать:

- PostgreSQL: integration-тесты KAIDA идут на реальной тестовой БД (`pnpm db:test:prepare`);
- свои модули и внутренних collaborators;
- всё, что контролирует сам проект.

Граница внешних зависимостей проекта описана в `docs/PROJECT_RULES.md` §10.1.

## Как сделать границу удобной для мока

**1. Передавать внешнюю зависимость снаружи**

```typescript
// Легко подменить в тесте
function sendOtp(phone: string, sms: SmsClient) {
  return sms.send(phone, code());
}

// Трудно подменить
function sendOtp(phone: string) {
  const sms = new ProviderClient(process.env.SMS_KEY);
  return sms.send(phone, code());
}
```

**2. Конкретные функции вместо универсального fetch**

```typescript
// ХОРОШО: каждую операцию можно подменить отдельно
const geo = {
  geocode: (address: string) => fetch(`/geocode?q=${encodeURIComponent(address)}`),
  reverse: (lat: number, lon: number) => fetch(`/reverse?lat=${lat}&lon=${lon}`),
};

// ПЛОХО: мок вынужден содержать условную логику
const geo = {
  fetch: (endpoint: string, options?: RequestInit) => fetch(endpoint, options),
};
```

Так у каждого мока одна форма ответа, в настройке теста нет условий, видно, какие операции задействованы, и типы проверяются для каждой операции.
