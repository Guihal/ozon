# Этап 4 — Безопасность webhook

## Цель

Ограничить доступ к `POST /v1/order/create` только доверенным источникам (Тильда), чтобы предотвратить поддельные заказы.

## Текущее состояние

- `/v1/order/create` принимает `t.Any()` без проверок
- Логируются IP, origin, referer, user-agent, все headers → `cache/order-create.log`
- Реальные IP Тильды **пока неизвестны** — будут видны после первого тестового запроса

## Задачи

### 4.1. Собрать IP-адреса Тильды

- [ ] Сделать тестовый заказ через Тильду
- [ ] Из `cache/order-create.log` извлечь:
  - `x-forwarded-for` / `x-real-ip`
  - `origin` / `referer`
  - Любые специфичные заголовки Тильды

### 4.2. IP Whitelist

Файл: `src/config/env.ts` — добавить переменную:

```env
TILDA_WEBHOOK_ALLOWED_IPS=185.77.96.0/24,185.77.97.0/24
```

```typescript
// В delivery.ts — middleware или guard
function isTrustedSource(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "";

  return ALLOWED_IPS.some((range) => isIpInRange(ip, range));
}
```

### 4.3. Secret Token (альтернатива/дополнение)

Если Тильда поддерживает отправку кастомных headers в webhook:

```env
TILDA_WEBHOOK_SECRET=random-secret-string
```

```typescript
// Проверка
const secret = request.headers.get("x-tilda-secret");
if (secret !== config.tildaWebhookSecret) {
  return { success: false, error: "Unauthorized" };
}
```

### 4.4. Rate Limiting

Защита от brute-force:

```typescript
// Простой rate limiter для /order/create
// Не более 10 запросов в минуту с одного IP
```

### 4.5. Валидация body (после Этапа 1)

Когда формат webhook станет известен — заменить `t.Any()` на строгую Elysia-валидацию:

```typescript
body: t.Object({
  // точные поля из webhook Тильды
  phone: t.String(),
  name: t.String(),
  // ...
});
```

## Порядок внедрения

1. **Сейчас**: логирование (уже сделано)
2. **После первого запроса**: IP whitelist + опционально secret
3. **После стабилизации**: строгая валидация body + rate limiting

## Файлы для изменения

| Файл                               | Действие                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| `src/config/env.ts`                | Добавить `TILDA_WEBHOOK_ALLOWED_IPS`, `TILDA_WEBHOOK_SECRET` |
| `src/modules/delivery/delivery.ts` | Добавить проверку IP/secret в `/order/create`                |
| `.env`                             | Заполнить IP после получения реальных запросов               |
