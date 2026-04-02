# useFetch — Обертка над Ozon API с унифицированной обработкой ошибок

## 📚 Содержание

1. [Введение](#введение)
2. [Основные концепции](#основные-концепции)
3. [API документация](#api-документация)
4. [Типы ошибок](#типы-ошибок)
5. [Примеры использования](#примеры-использования)
6. [Best Practices](#best-practices)
7. [Частые ошибки](#частые-ошибки)
8. [Миграция из старого кода](#миграция-из-старого-кода)

---

## Введение

`useFetch` — это функция-обертка над API клиентами Ozon (`OzonApiClient` и `OzonOAuthClient`). Она обеспечивает:

✅ **Унифицированную обработку результатов** — каждый ответ оборачивается в объект `{ status: 'ok' | 'error', response }`

✅ **Детектирование ошибок по двум форматам** — использует утиную типизацию для распознавания формата ошибки

✅ **Автоматическое логирование** — ошибки логируются через систему `logger`, сервер не падает

✅ **Полную типизацию** — TypeScript знает точный тип результата в зависимости от статуса

✅ **Отсутствие брошенных исключений** — функция всегда возвращает результат, никогда не выбрасывает ошибку

---

## Основные концепции

### Структура результата

```typescript
type ApiResult<T> = 
  | { status: "ok"; response: T }
  | { status: "error"; response: OzonErrorType }
```

- **`status: "ok"`** — запрос выполнен успешно
  - `response` имеет тип из `OzonApiEndpointMap` (например, `CheckDeliveryResponse`)
  
- **`status: "error"`** — произошла ошибка
  - `response` имеет тип `OzonErrorType` (один из двух форматов ошибок Ozon)

### Два формата ошибок Ozon

Озон может вернуть ошибку в двух форматах. `useFetch` распознает оба через утиную типизацию:

**Формат 1: Стандартная ошибка API**
```json
{
  "code": 400,
  "message": "Invalid phone number",
  "details": []
}
```

**Формат 2: Ошибка с инцидентом**
```json
{
  "incidentId": "fab_20260216233542_01KHMCYKDD8VKJ9NPFBRY55NYZ",
  "supportURL": "https://www.ozon.ru/complaint/support/?incident_id=..."
}
```

### Утиная типизация (Type Guards)

`useFetch` использует утиную типизацию для определения формата ошибки:

```typescript
// Проверяет наличие полей code и message
if (error.type === "api_error") {
  // это первый формат
  console.log(error.code, error.message);
}

// Проверяет наличие полей incidentId и supportURL
if (error.type === "incident_error") {
  // это второй формат
  console.log(error.incidentId, error.supportURL);
}
```

---

## API документация

### Функция `useFetch`

```typescript
async function useFetch<T>(
  fn: () => Promise<T>
): Promise<ApiResult<T>>
```

**Параметры:**
- `fn` — async функция, результат которой нужно обернуть

**Возвращаемое значение:**
- `Promise<ApiResult<T>>` — объект с `status` и `response`

**Характеристики:**
- Никогда не выбрасывает исключение
- Автоматически логирует ошибки
- Проверяет оба формата ошибок Ozon
- Полностью типизирована для TypeScript

### Helper функции

#### `isSuccess<T>(result: ApiResult<T>): boolean`

Проверяет, был ли результат успешным:

```typescript
if (isSuccess(result)) {
  // result.response имеет правильный тип
  console.log(result.response.is_possible);
}
```

#### `isError<T>(result: ApiResult<T>): boolean`

Проверяет, была ли ошибка:

```typescript
if (isError(result)) {
  // result.response имеет тип OzonErrorType
  console.log(result.response.message);
}
```

---

## Типы ошибок

### Тип `OzonApiError`

```typescript
interface OzonApiError {
  type: "api_error";
  code: number;
  message: string;
  details?: Array<Record<string, unknown>>;
}
```

**Примеры:**
- `code: 400` — неверный параметр
- `code: 401` — не авторизирован
- `code: 429` — превышен лимит запросов
- `code: 500` — внутренняя ошибка сервера

### Тип `OzonIncidentError`

```typescript
interface OzonIncidentError {
  type: "incident_error";
  incidentId: string;
  supportURL: string;
}
```

Этот формат используется для серьезных проблем, требующих контакта со службой поддержки.

### Union type `OzonErrorType`

```typescript
type OzonErrorType = OzonApiError | OzonIncidentError;
```

---

## Примеры использования

### Пример 1: Базовое использование

```typescript
import { useFetch, isSuccess } from "./utils/useFetch";
import { OzonApiClient } from "./utils/typedApiClient";
import { getAccessToken } from "./utils/getAccessToken";
import { ozonConfig } from "./config/env";

const token = getAccessToken();
if (!token) return;

const client = new OzonApiClient(ozonConfig.apiUrl, token);

const result = await useFetch(() =>
  client.call("/v1/delivery/check", { client_phone: "79991234567" })
);

if (isSuccess(result)) {
  console.log("✅ Доставка возможна:", result.response.is_possible);
  // TypeScript знает все поля CheckDeliveryResponse
} else {
  console.error("❌ Ошибка:", result.response);
  // Ошибка уже залогирована в useFetch
}
```

### Пример 2: Обработка разных типов ошибок

```typescript
const result = await useFetch(() =>
  client.call("/v1/delivery/point/info", { map_point_ids: ["123"] })
);

if (result.status === "error") {
  const error = result.response;
  
  if (error.type === "api_error") {
    console.error(`API Error (${error.code}): ${error.message}`);
    if (error.details) {
      console.error("Details:", error.details);
    }
  } else {
    console.error(`Incident: ${error.incidentId}`);
    console.error(`Support: ${error.supportURL}`);
  }
} else {
  console.log(`✅ Получено ${result.response.points.length} точек`);
}
```

### Пример 3: Последовательные вызовы

```typescript
// Получаем список точек
const listResult = await useFetch(() =>
  client.call("/v1/delivery/point/list", {})
);

if (!isSuccess(listResult)) {
  console.error("❌ Ошибка получения списка");
  return;
}

// Используем результат первого вызова
const mapPointIds = listResult.response.points
  .slice(0, 5)
  .map(p => String(p.map_point_id));

// Получаем информацию о точках
const infoResult = await useFetch(() =>
  client.call("/v1/delivery/point/info", { map_point_ids: mapPointIds })
);

if (isSuccess(infoResult)) {
  infoResult.response.points.forEach(point => {
    console.log(`✅ ${point.delivery_method.name}`);
  });
}
```

### Пример 4: Параллельные вызовы

```typescript
const [deliveryCheck, pointsList] = await Promise.all([
  useFetch(() =>
    client.call("/v1/delivery/check", { client_phone: "79991234567" })
  ),
  useFetch(() =>
    client.call("/v1/delivery/point/list", {})
  ),
]);

if (isSuccess(deliveryCheck)) {
  console.log("✅ Доставка возможна:", deliveryCheck.response.is_possible);
}

if (isSuccess(pointsList)) {
  console.log("✅ Получено точек:", pointsList.response.points.length);
}
```

### Пример 5: OAuth авторизация

```typescript
import { OzonOAuthClient } from "./utils/typedApiClient";

const oauthClient = new OzonOAuthClient(ozonConfig.oauthTokenUrl);

const tokenResult = await useFetch(() =>
  oauthClient.call({
    grant_type: "authorization_code",
    code: authCodeFromCallback,
    client_id: ozonConfig.clientId,
    client_secret: ozonConfig.clientSecret,
  })
);

if (isSuccess(tokenResult)) {
  const token = tokenResult.response;
  console.log("✅ Токен получен:", token.access_token);
  // Сохраняем токен
} else {
  console.error("❌ Ошибка авторизации");
  // Ошибка уже залогирована
}
```

### Пример 6: Использование в Elysia маршруте

```typescript
import { Elysia } from "elysia";

export function setupDeliveryRoutes(app: Elysia) {
  return app.post("/api/check-delivery", async (context) => {
    const { phone } = context.body as { phone: string };

    const token = getAccessToken();
    if (!token) {
      return {
        success: false,
        error: "No authorization token",
      };
    }

    const client = new OzonApiClient(ozonConfig.apiUrl, token);

    // useFetch гарантирует, что исключение не будет выброшено
    const result = await useFetch(() =>
      client.call("/v1/delivery/check", { client_phone: phone })
    );

    if (isSuccess(result)) {
      return {
        success: true,
        is_possible: result.response.is_possible,
      };
    } else {
      return {
        success: false,
        error:
          result.response.type === "api_error"
            ? result.response.message
            : `Incident: ${result.response.incidentId}`,
      };
    }
  });
}
```

---

## Best Practices

### ✅ DO: Всегда проверяйте результат

```typescript
const result = await useFetch(() => client.call(...));

if (isSuccess(result)) {
  // работаем с результатом
} else {
  // обрабатываем ошибку
}
```

### ✅ DO: Используйте helper функции

```typescript
// Правильно
if (isSuccess(result)) {
  console.log(result.response.field);
}

// Менее удобно
if (result.status === "ok") {
  console.log((result.response as CheckDeliveryResponse).field);
}
```

### ✅ DO: Различайте типы ошибок

```typescript
if (isError(result)) {
  if (result.response.type === "api_error") {
    // обрабатываем API ошибку
  } else {
    // обрабатываем инцидент
  }
}
```

### ✅ DO: Логируйте дополнительную информацию при необходимости

```typescript
import { log } from "./utils/logger";

if (isError(result)) {
  // useFetch уже залогировал основную информацию
  // Добавляем контекст если нужно
  log(`Context: Проверка доставки для ${phone}`);
}
```

### ❌ DON'T: Не игнорируйте ошибки

```typescript
// Неправильно
const result = await useFetch(() => client.call(...));
console.log(result.response.field); // может быть error!

// Правильно
if (isSuccess(result)) {
  console.log(result.response.field);
}
```

### ❌ DON'T: Не используйте try-catch для useFetch

```typescript
// Неправильно
try {
  const result = await useFetch(() => client.call(...));
  // ... код
} catch (error) {
  // это не будет вызвано, useFetch не выбрасывает ошибки
}

// Правильно
const result = await useFetch(() => client.call(...));
if (isError(result)) {
  // обрабатываем ошибку
}
```

### ❌ DON'T: Не проверяйте только status

```typescript
// Менее информативно
if (result.status === "error") {
  console.log(result.response); // что это? API ошибка или инцидент?
}

// Лучше
if (isError(result)) {
  if (result.response.type === "api_error") {
    console.log(result.response.code, result.response.message);
  } else {
    console.log(result.response.incidentId);
  }
}
```

---

## Частые ошибки

### Ошибка 1: Обращение к полям ошибки без проверки типа

```typescript
// ❌ Ошибка компиляции
const result = await useFetch(() => client.call(...));
if (isError(result)) {
  console.log(result.response.message); // message не существует в OzonIncidentError!
}

// ✅ Правильно
if (isError(result)) {
  if (result.response.type === "api_error") {
    console.log(result.response.message);
  }
}
```

### Ошибка 2: Забыли проверить успешность перед обращением к полям

```typescript
// ❌ Ошибка
const result = await useFetch(() => client.call(...));
console.log(result.response.is_possible); // может быть error!

// ✅ Правильно
if (isSuccess(result)) {
  console.log(result.response.is_possible);
}
```

### Ошибка 3: Ожидание исключения вместо проверки результата

```typescript
// ❌ Неправильно (исключение не будет выброшено)
try {
  const result = await useFetch(() => client.call(...));
  // если произойдет ошибка, она будет в result.response
  // но не выброшена как Exception
} catch (error) {
  // эта строка никогда не выполнится
}

// ✅ Правильно
const result = await useFetch(() => client.call(...));
if (isError(result)) {
  console.error(result.response);
}
```

### Ошибка 4: Неправильная типизация в Elysia обработчике

```typescript
// ❌ Неправильно
app.post("/api/test", ({ body }) => {
  // body имеет тип unknown
  const { phone } = body; // TypeScript ошибка
});

// ✅ Правильно
app.post("/api/test", (context) => {
  const { phone } = context.body as { phone: string };
});
```

---

## Миграция из старого кода

### Старый способ с try-catch

```typescript
// Старый код
try {
  const response = await client.call("/v1/delivery/check", data);
  console.log("✅ Успех:", response);
} catch (error) {
  console.error("❌ Ошибка:", error);
}
```

### Новый способ с useFetch

```typescript
// Новый код
const result = await useFetch(() =>
  client.call("/v1/delivery/check", data)
);

if (isSuccess(result)) {
  console.log("✅ Успех:", result.response);
} else {
  console.error("❌ Ошибка:", result.response);
  // Ошибка уже залогирована в useFetch!
}
```

### Преимущества миграции

| Аспект | Старый способ | Новый способ |
|--------|---------------|-------------|
| Логирование | Необходимо писать вручную | Автоматическое |
| Типизация ошибок | Нет | Полная (два формата) |
| Обработка разных ошибок | Сложная | Простая (switch по type) |
| Риск выброса исключения | Высокий | Нулевой |
| Код обработчика | Сложный | Читаемый |

---

## Заключение

`useFetch` — это безопасная и удобная обертка над Ozon API, которая:

1. **Гарантирует безопасность** — сервер никогда не упадет из-за необработанного исключения
2. **Упрощает код** — не нужно писать try-catch или вручную логировать ошибки
3. **Улучшает типизацию** — TypeScript знает точный тип результата
4. **Обрабатывает оба формата ошибок** — автоматически детектирует и парсит их
5. **Следует архитектуре проекта** — использует существующие `logger` и `OzonApiClient`

Используйте эту обертку для всех вызовов Ozon API в вашем проекте.