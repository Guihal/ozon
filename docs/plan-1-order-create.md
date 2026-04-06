# Этап 1 — Создание заказа в Ozon после оплаты

## Цель

После успешной оплаты на Тильде → webhook приходит на наш сервер → создаём заказ в Ozon через `/v2/order/create`.

## Текущее состояние

- `POST /v1/order/create` — принимает любой body, логирует в `cache/order-create.log` с IP/headers
- `POST /v1/delivery/tilda/success` — аналогично, логирует в `cache/tilda-callbacks.log`
- Формат данных от Тильды **пока неизвестен** — нужно получить реальный запрос

## Задачи

### 1.1. Получить формат webhook от Тильды

- [ ] Настроить webhook в Тильде на `POST /v1/order/create`
- [ ] Сделать тестовый заказ
- [ ] Изучить `cache/order-create.log` — формат body, заголовки, IP

### 1.2. Сохранять checkout-данные при выборе доставки

Проблема: для `/v2/order/create` нужны `splits` из `/v2/delivery/checkout` (delivery_method_id, timeslot_id, warehouse_id, logistic_date_range). Сейчас они не сохраняются.

**Вариант A — повторный checkout при создании заказа:**

- При получении webhook → вызвать `/v2/delivery/checkout` с данными из Тильды
- Использовать свежие splits для `/v2/order/create`
- Плюс: данные всегда актуальные
- Минус: лишний запрос, таймслот мог измениться

**Вариант B — кэшировать checkout при выборе ПВЗ:**

- При вызове `/v1/delivery/price` → сохранять полный ответ `/v2/checkout` в БД с ключом (phone + map_point_id)
- При создании заказа — использовать сохранённые splits
- Плюс: быстрее, данные соответствуют тому, что видел пользователь
- Минус: данные могут устареть

**Рекомендация:** Вариант A — повторный checkout. Проще, надёжнее, не требует управления кэшем.

### 1.3. Реализовать создание заказа

Файл: `src/services/ozon-logistics/order.ts` (новый)

```typescript
// Примерная структура
interface CreateOrderRequest {
  phone: string; // телефон из webhook
  firstName: string;
  lastName: string;
  mapPointId?: number; // для ПВЗ
  coordinates?: { lat: number; long: number }; // для курьера
  items: { sku: number; quantity: number; offer_id: string }[];
}

async function createOzonOrder(req: CreateOrderRequest) {
  // 1. Вызвать /v2/delivery/checkout для получения splits
  // 2. Проверить что splits доступны (unavailable_reason === "UNSPECIFIED")
  // 3. Вызвать /v2/order/create с данными покупателя и splits
  // 4. Вернуть order_number
}
```

### 1.4. Маппинг данных Тильды → Ozon

После получения реального формата webhook:

- [ ] Маппинг полей покупателя (имя, телефон)
- [ ] Маппинг товаров (SKU, quantity, offer_id)
- [ ] Маппинг адреса/ПВЗ (map_point_id или координаты)

### 1.5. Сохранение результата

- [ ] Логировать `order_number` и `postings` из ответа Ozon
- [ ] Опционально: таблица `orders` в SQLite для отслеживания статусов

## Ozon API

### `/v2/order/create` — Request

```json
{
  "buyer": {
    "first_name": "Иван",
    "last_name": "Иванов",
    "phone": "79991234567"
  },
  "delivery": {
    "pick_up": { "map_point_id": 123456 }
  },
  "delivery_schema": "MIX",
  "recipient": {
    "recipient_first_name": "Иван",
    "recipient_last_name": "Иванов",
    "recipient_phone": "79991234567"
  },
  "splits": [
    {
      "delivery_method": {
        "delivery_method_id": 0,
        "delivery_type": "PICKUP",
        "logistic_date_range": { "from": "...", "to": "..." },
        "timeslot_id": 0
      },
      "items": [{ "offer_id": "ART-001", "quantity": 1, "sku": 12345 }],
      "warehouse_id": 0
    }
  ]
}
```

### Response

```json
{
  "order_number": "ORD-123",
  "postings": ["POST-001"]
}
```

## Зависимости

- Формат webhook от Тильды (блокер — нужен реальный запрос)
- Рабочий OAuth токен
- Товары должны быть загружены в Ozon Seller с корректными SKU/offer_id

## Файлы для изменения

| Файл                                   | Действие                                            |
| -------------------------------------- | --------------------------------------------------- |
| `src/services/ozon-logistics/order.ts` | Создать — логика создания заказа                    |
| `src/services/ozon-logistics/types.ts` | Добавить типы для order/create                      |
| `src/modules/delivery/delivery.ts`     | Обновить `/order/create` — вызывать createOzonOrder |
| `src/utils/typedApiClient.ts`          | Добавить `/v2/order/create` в endpoint map          |
