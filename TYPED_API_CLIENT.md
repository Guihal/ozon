# Типизированный API Клиент Озона

## Обзор

`OzonApiClient` — это типизированный клиент для работы с API Озона логистики. Он обеспечивает:

- **Автокомплит IDE** для всех endpoint-ов и параметров
- **Type-safe запросы и ответы** — IDE покажет ошибки на этапе разработки
- **Одну точку управления** всеми методами API
- **Автоматическую обработку ошибок** и логирование

## Архитектура

### OzonApiClient

Клиент для работы с основными API методами Озона логистики.

```typescript
const client = new OzonApiClient(baseUrl, token, timeoutMs);
const result = await client.call("/v1/delivery/check", { client_phone: "79991234567" });
```

### OzonOAuthClient

Клиент для работы с OAuth методами получения и обновления токенов.

```typescript
const oauthClient = new OzonOAuthClient(tokenUrl, timeoutMs);
const tokenData = await oauthClient.call({ grant_type: "authorization_code", ... });
```

## Использование

### 1. Проверка доступности доставки

```typescript
import { OzonApiClient } from "../../utils/typedApiClient";
import { getAccessToken } from "../../utils/getAccessToken";
import { ozonConfig } from "../../config/env";

const token = getAccessToken();
if (!token) throw new Error("Требуется авторизация");

const client = new OzonApiClient(ozonConfig.apiUrl, token);
const result = await client.call("/v1/delivery/check", {
  client_phone: "79991234567",
});

console.log(result.is_possible); // Type: boolean
```

### 2. Получение списка точек самовывоза

```typescript
const client = new OzonApiClient(ozonConfig.apiUrl, token);
const result = await client.call("/v1/delivery/point/list", {});

console.log(result.points); // Type: PickupPointItem[]
result.points.forEach(point => {
  console.log(point.coordinate.lat, point.coordinate.long);
});
```

### 3. Получение информации о конкретных точках

```typescript
const client = new OzonApiClient(ozonConfig.apiUrl, token);
const result = await client.call("/v1/delivery/point/info", {
  map_point_ids: ["123", "456", "789"],
});

console.log(result.points); // Type: PickupPointInfoItem[]
result.points.forEach(point => {
  console.log(point.delivery_method.name);
  console.log(point.delivery_method.working_hours);
});
```

## Маппинг Endpoint-ов

Все доступные endpoint-ы и их типы определены в `OzonApiEndpointMap`:

```typescript
type OzonApiEndpointMap = {
  "/v1/delivery/check": {
    request: CheckDeliveryRequest;
    response: CheckDeliveryResponse;
  };
  "/v1/delivery/point/list": {
    request: Record<string, never>;
    response: PickupPointsListResponse;
  };
  "/v1/delivery/point/info": {
    request: PickupPointInfoRequest;
    response: PickupPointsInfoResponse;
  };
};
```

## Добавление новых Endpoint-ов

Чтобы добавить новый endpoint:

### 1. Добавьте типы в `src/services/ozon-logistics/types.ts`

```typescript
export interface MyNewRequest {
  param1: string;
  param2: number;
}

export interface MyNewResponse {
  result: string;
  status: "success" | "error";
}
```

### 2. Расширьте `OzonApiEndpointMap` в `src/utils/typedApiClient.ts`

```typescript
type OzonApiEndpointMap = {
  // ... существующие endpoint-ы
  "/v1/my/new/endpoint": {
    request: MyNewRequest;
    response: MyNewResponse;
  };
};
```

### 3. Используйте новый endpoint

```typescript
const client = new OzonApiClient(ozonConfig.apiUrl, token);
const result = await client.call("/v1/my/new/endpoint", {
  param1: "value",
  param2: 42,
});

console.log(result.status); // IDE знает что есть такое поле
```

## Преимущества Type-Safe API

### Без типизации ❌

```typescript
// Неизвестно какие параметры нужны
const response = await rateLimitedFetch("some/endpoint", {
  method: "POST",
  headers: { /* ... */ },
  body: JSON.stringify({ /* что передать? */ }),
});

// Неизвестно какие поля в ответе
const json = await response.json();
console.log(json.unknown_field); // IDE не покажет ошибку
```

### С типизацией ✅

```typescript
const client = new OzonApiClient(baseUrl, token);
const result = await client.call("/v1/delivery/check", {
  client_phone: "79991234567", // IDE подскажет что нужна строка
  // IDE помечает красным если поле забыли или опечатку
});

console.log(result.is_possible); // IDE знает что это boolean
```

## Обработка Ошибок

Клиент автоматически обрабатывает ошибки и логирует их:

```typescript
try {
  const result = await client.call("/v1/delivery/check", {
    client_phone: "invalid",
  });
} catch (error) {
  console.error("Ошибка API:", error.message);
  // Сообщение об ошибке уже залогировано в консоль
}
```

Логирование происходит внутри:
- `❌ Ozon API Error (endpoint): status errorData` — при ошибке API
- `❌ Error calling endpoint: error` — при других ошибках

## Структура Типов

### CheckDeliveryRequest
```typescript
{
  client_phone: string; // Телефон в формате 7XXXXXXXXXX
}
```

### CheckDeliveryResponse
```typescript
{
  is_possible: boolean;
}
```

### PickupPointsListResponse
```typescript
{
  points: PickupPointItem[];
}
```

### PickupPointItem
```typescript
{
  coordinate: {
    lat: number;
    long: number;
  };
  map_point_id: number;
}
```

### PickupPointsInfoResponse
```typescript
{
  points: PickupPointInfoItem[];
}
```

### PickupPointInfoItem
```typescript
{
  delivery_method: {
    name: string;
    address: string;
    address_details: {
      city: string;
      street: string;
      house: string;
      region: string;
    };
    coordinates: {
      lat: number;
      long: number;
    };
    delivery_type: {
      id: number;
      name: string;
    };
    working_hours: PickupPointWorkingHours[];
    holidays: PickupPointHoliday[];
    properties: PickupPointProperty[];
    // ... и другие поля
  };
  enabled: boolean;
}
```

## FAQ

### Почему используется маппинг типов?

Маппинг `OzonApiEndpointMap` позволяет:
- IDE показывать автокомплит для всех endpoint-ов
- Связывать request и response типы для каждого endpoint-а
- Один раз определить типы, потом использовать везде

### Как добавить timeout для отдельного запроса?

```typescript
const client = new OzonApiClient(baseUrl, token, 5000); // 5 секунд вместо 10
const result = await client.call("/v1/delivery/check", { client_phone: "..." });
```

### Можно ли использовать старый `rateLimitedFetch` напрямую?

Да, но это не рекомендуется. Старый способ не имеет type-safety:

```typescript
// Старый способ (не рекомендуется)
const response = await rateLimitedFetch(url, { /* ... */ });
const data = await response.json(); // Тип unknown

// Новый способ (рекомендуется)
const client = new OzonApiClient(baseUrl, token);
const data = await client.call("/v1/delivery/check", { /* ... */ }); // Тип известен
```

## Миграция с rateLimitedFetch

### Было

```typescript
const response = await rateLimitedFetch(`${baseUrl}/v1/delivery/check`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ client_phone: "79991234567" }),
  signal: AbortSignal.timeout(10000),
});

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error("Error:", response.status, errorData);
  throw new Error(`Error: ${response.status}`);
}

const data = await response.json();
console.log(data.is_possible);
```

### Стало

```typescript
const client = new OzonApiClient(baseUrl, token, 10000);
const data = await client.call("/v1/delivery/check", {
  client_phone: "79991234567",
});
console.log(data.is_possible);
```

Все! Ошибки обрабатываются автоматически, типы проверяются IDE.

## Лучшие Практики

1. **Создавайте отдельный client для каждого API модуля**
   ```typescript
   const deliveryClient = new OzonApiClient(config.apiUrl, token);
   const warehouseClient = new OzonApiClient(config.warehouseUrl, token);
   ```

2. **Переиспользуйте token из getAccessToken()**
   ```typescript
   const token = getAccessToken();
   if (!token) throw new Error("Token required");
   ```

3. **Не создавайте client в каждой функции**
   ```typescript
   // Плохо
   export async function method1() {
     const client = new OzonApiClient(...);
     const result = await client.call(...);
   }
   export async function method2() {
     const client = new OzonApiClient(...); // Дублирование
     const result = await client.call(...);
   }

   // Хорошо
   const client = new OzonApiClient(...);
   export async function method1() {
     const result = await client.call(...);
   }
   export async function method2() {
     const result = await client.call(...);
   }
   ```

4. **Обрабатывайте ошибки в вызывающем коде**
   ```typescript
   try {
     const result = await client.call("/v1/delivery/check", {...});
   } catch (error) {
     // Специфичная обработка для вашего use case
     res.status(500).json({ error: "Delivery check failed" });
   }
   ```

## Ссылки

- [`typedApiClient.ts`](./ozon/src/utils/typedApiClient.ts) — исходный код
- [`types.ts`](./ozon/src/services/ozon-logistics/types.ts) — определение всех типов
- [`delivery.ts`](./ozon/src/services/ozon-logistics/delivery.ts) — примеры использования