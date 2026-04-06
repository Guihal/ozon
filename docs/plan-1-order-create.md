# Этап 1 — Создание заказа в Ozon после оплаты

## Цель

После успешной оплаты на Тильде → webhook приходит на наш сервер → создаём заказ в Ozon через `/v2/order/create`.

## Текущее состояние

- `POST /v1/order/create` — принимает любой body, логирует в `cache/order-create.log` с IP/headers, проверяет `Api-Key` заголовок
- `POST /v1/delivery/tilda/success` — аналогично, логирует в `cache/tilda-callbacks.log`
- ✅ Формат webhook от Тильды **получен** (см. ниже)

## Задачи

### 1.1. ~~Получить формат webhook от Тильды~~ ✅

- [x] Настроить webhook в Тильде на `POST /v1/order/create`
- [x] Сделать тестовый заказ
- [x] Изучить `cache/order-create.log` — формат body, заголовки, IP

#### Реальный формат webhook от Тильды

```json
{
  "Name": "Тест Тестов",
  "Phone": "+79998887766",
  "Email": "test@test.ru",
  "payment": {
    "sys": "robokassa",
    "systranid": "0",
    "orderid": "1173042542",
    "products": [
      {
        "name": "УМНАЯ РАСЧЕСКА XL",
        "quantity": 3,
        "amount": 0,
        "externalid": "k9gjeIlUdA36PVIfCbbt",
        "img": "https://static.tildacdn.com/...",
        "pack_m": "480",
        "pack_x": "32",
        "pack_y": "21",
        "pack_z": "7",
        "price": 0,
        "sku": "3419170304"
      }
    ],
    "amount": "0",
    "subtotal": "0",
    "delivery": "Ozon до пвз",
    "delivery_price": 0,
    "delivery_fio": "тестовое имя",
    "delivery_city": "Таганрог",
    "delivery_address": "RU: Point: Россия, Ростовская, Ростов-на-Дону, улица Народного Ополчения, 213 (Пункт Ozon: Россия, 213), Таганрог",
    "delivery_comment": "тестовый комментарий",
    "delivery_pickup_id": "86597",
    "delivery_zip": ""
  },
  "COOKIES": "...",
  "formid": "form2126172641",
  "formname": "Cart"
}
```

**Дополнительные поля верхнего уровня:** `ma_name`, `ma_email`, `ma_phone`, `ma_id` — данные из Member Area Тильды.

**Особенности:**

- ✅ **`sku: "3419170304"`** — Ozon SKU прямо в webhook! Таблица маппинга **не нужна**.
- `delivery_pickup_id: "86597"` — внутренний ID Тильды, **НЕ** Ozon `map_point_id` (у Ozon формат `1655508112`)
- `delivery_address` — содержит структурированный текст с адресом ПВЗ
- `delivery_fio` — ФИО получателя
- `pack_m/x/y/z` — вес (г) и габариты (см) товара
- `quantity` — число (не строка), `amount/price` — могут быть 0 или строкой
- **Для передачи `map_point_id`** добавлен hidden input `ozon_map_point_id` в `tilda-map-patch.html`

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

- [x] Маппинг полей покупателя (имя, телефон)
- [ ] Маппинг товаров (SKU, quantity, offer_id) — **требуется таблица маппинга**
- [ ] Маппинг адреса/ПВЗ (map_point_id или координаты) — **требуются hidden inputs + геокодирование**

#### Маппинг покупателя

| Тильда поле | Ozon поле                              | Преобразование                     |
| ----------- | -------------------------------------- | ---------------------------------- |
| `Name`      | `buyer.first_name` + `buyer.last_name` | Разбить по пробелу                 |
| `Phone`     | `buyer.phone`                          | Убрать `+`, оставить `7XXXXXXXXXX` |
| `Email`     | —                                      | Ozon не принимает email            |

#### Маппинг товаров — Таблица `sku_mapping`

**Проблема:** `payment.products[].externalid` из Тильды (например `"GK78pIJ2hXdZej4sLSls"`) — это внутренний ID Тильды, а не Ozon `offer_id` или `sku`. Прямого автоматического маппинга нет.

**Решение:** Создать таблицу маппинга в SQLite:

```sql
CREATE TABLE IF NOT EXISTS sku_mapping (
  tilda_externalid TEXT PRIMARY KEY,
  ozon_sku INTEGER NOT NULL,
  ozon_offer_id TEXT NOT NULL,
  product_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Заполнение:**

- **Вариант 1 (ручной):** Админский endpoint `POST /admin/sku-mapping` для добавления маппингов
- **Вариант 2 (CSV-импорт):** Загрузка CSV файла с маппингами
- **Вариант 3 (по имени):** Автоматический поиск по названию товара в Ozon (ненадёжно)

**Рекомендация:** Вариант 1 — ручной маппинг через endpoint. Товаров немного, маппинг делается один раз.

```typescript
// При создании заказа:
const ozonItem = db
  .query(
    "SELECT ozon_sku, ozon_offer_id FROM sku_mapping WHERE tilda_externalid = ?",
  )
  .get(product.externalid);

if (!ozonItem) {
  throw new Error(
    `Нет маппинга для товара: ${product.externalid} (${product.name})`,
  );
}
```

#### Маппинг доставки — Hidden Inputs + Геокодирование

**Проблема для ПВЗ:** Тильда webhook НЕ передаёт `map_point_id` — только текстовый адрес. Нужно передать через hidden input в форме корзины.

**Проблема для курьера:** Тильда НЕ хранит координаты для адресной доставки на клиенте. В `tdelivery.js` координаты есть только для ПВЗ (`dataset.coordinates`). Для адреса хранятся только текстовые поля (`city`, `street`, `house`). **Требуется серверное геокодирование.**

**Hidden inputs (в `tilda-map-patch.html`):**

| Input name           | Значение                   | Источник                        |
| -------------------- | -------------------------- | ------------------------------- |
| `ozon_map_point_id`  | ID точки ПВЗ               | `changePickupHandler` → dataset |
| `ozon_delivery_type` | `"pickup"` или `"courier"` | Выбранный способ доставки       |

**Серверное геокодирование для курьера:**

При получении webhook с `delivery_address` (адресная доставка):

1. Вызвать API геокодирования (DaData / Yandex Geocoder)
2. Получить `lat` / `long` из ответа
3. Передать координаты в Ozon `/v2/order/create` → `delivery.address.coordinates`

```typescript
// Примерная реализация с DaData
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; long: number }> {
  const res = await fetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${DADATA_API_KEY}`,
      },
      body: JSON.stringify({ query: address, count: 1 }),
    },
  );
  const data = await res.json();
  const suggestion = data.suggestions[0];
  return {
    lat: parseFloat(suggestion.data.geo_lat),
    long: parseFloat(suggestion.data.geo_lon),
  };
}
```

**Решение:** используем **Nominatim (OpenStreetMap)** — бесплатный, без API-ключа.

```typescript
// src/utils/geocode.ts
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
    {
      q: address,
      format: "json",
      countrycodes: "ru",
      limit: "1",
    },
  )}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "OzonLogisticsIntegration/1.0" },
  });
  const data = await res.json();
  if (!data.length) return null; // не нашли → email-уведомление
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}
```

**Ограничения Nominatim:** 1 запрос/сек, обязательный User-Agent. Слабый парсинг неструктурированных адресов РФ.

**При неудаче геокодирования** → отправляем email с данными заказа (общая система ошибок, п. 1.6), дальше ручной режим.

Если покрытие окажется недостаточным — переключение на DaData (10 000 бесплатных запросов/день).

### 1.5. Цена доставки

**Решение:** цена доставки = 0 (бесплатная для клиента).

Ozon API `/v2/delivery/checkout` не возвращает стоимость доставки. В `/v2/order/create` цена передаётся продавцом. Ozon списывает логистику с баланса продавца по тарифу независимо от указанной цены.

```typescript
price: { currency_code: "RUB", units: 0, nanos: 0 }
```

### 1.6. Обработка ошибок — email-уведомления

**Решение:** при любой ошибке создания заказа → отправлять email с полной информацией, дальше ручной режим.

Сценарии:

- `/v2/order/create` вернул ошибку (out of stock, delivery unavailable и т.д.)
- `/v2/order/create` timeout (заказ мог создаться в Ozon — нужна ручная проверка)
- Геокодирование адреса не нашло координаты (курьерская доставка)
- Дубль webhook от Тильды

Письмо содержит:

- Данные покупателя (ФИО, телефон, email)
- Список товаров (название, количество, SKU)
- Способ доставки и адрес/ПВЗ
- Причина ошибки
- Полный body webhook от Тильды (для ручного создания)

```typescript
// src/utils/mailer.ts — добавить функцию
async function sendOrderErrorEmail({
  error: string,
  webhookBody: any,
  buyer: { name: string, phone: string, email: string },
  items: { name: string, quantity: number, sku: string }[],
  delivery: { type: string, address: string },
}) {
  // Формат: человекочитаемый HTML
  // Тема: "⚠️ Ошибка создания заказа — {ФИО} — {причина}"
}
```

**Используется общая система с геокодированием** — один email-шаблон для всех ошибок при создании заказа.

### 1.7. Сохранение результата

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

- ~~Формат webhook от Тильды~~ ✅ получен
- Рабочий OAuth токен
- Товары должны быть загружены в Ozon Seller с корректными SKU/offer_id
- **Таблица маппинга `sku_mapping`** заполнена (tilda_externalid → ozon_sku + ozon_offer_id)
- **API ключ DaData** (для геокодирования курьерской доставки)
- **Hidden inputs** в `tilda-map-patch.html` для передачи `map_point_id` и `delivery_type`

## Файлы для изменения

| Файл                                   | Действие                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| `src/services/ozon-logistics/order.ts` | Создать — логика создания заказа                                  |
| `src/services/ozon-logistics/types.ts` | Добавить типы для order/create                                    |
| `src/modules/delivery/delivery.ts`     | Обновить `/order/create` — вызывать createOzonOrder               |
| `src/utils/typedApiClient.ts`          | Добавить `/v2/order/create` в endpoint map                        |
| `src/db/index.ts`                      | Добавить таблицу `sku_mapping`                                    |
| `src/modules/delivery/delivery.ts`     | Добавить `POST /admin/sku-mapping`                                |
| `src/scripts/tilda-map-patch.html`     | Добавить hidden inputs: `ozon_map_point_id`, `ozon_delivery_type` |
| `src/utils/geocode.ts`                 | Создать — геокодирование через Nominatim (OpenStreetMap)          |
| `src/utils/mailer.ts`                  | Добавить `sendOrderErrorEmail()` — уведомление об ошибках         |
