# Этап 2 — Курьерская доставка (по адресу)

## Цель

Добавить второй способ доставки: курьером по адресу. Сейчас работает только доставка до ПВЗ.

## Текущее состояние

- `OZON_COURIER_ID = "2127610442"` объявлен в `tilda-map-patch.html`, но нигде не используется
- `checkout.ts` → `getDeliveryPrice()` работает только с `pick_up.map_point_id`
- В Тильде есть встроенный UI для адресной доставки (автокомплит через Яндекс Карты)
- Ozon API `/v2/delivery/checkout` поддерживает `delivery_type.courier.coordinates`

## Задачи

### 2.1. Backend — endpoint для курьерского checkout

Файл: `src/services/ozon-logistics/checkout.ts`

```typescript
interface CourierDeliveryRequest {
  latitude: number;
  longitude: number;
  items: { sku: number; quantity: number; offer_id: string }[];
  buyerPhone?: string;
}

async function getCourierDeliveryPrice(req: CourierDeliveryRequest) {
  // Вызвать /v2/delivery/checkout с:
  // delivery_type: { courier: { coordinates: { latitude, longitude } } }
  // Вернуть сроки и доступность
}
```

Endpoint в `delivery.ts`:

```
POST /v1/delivery/courier/price
Body: { latitude, longitude, items, buyerPhone? }
```

### 2.2. Frontend — патч Тильды для курьерской доставки

В `tilda-map-patch.html`:

1. **Перехватить выбор курьерской доставки** — при переключении radio на службу `OZON_COURIER_ID`
2. **Слушать ввод адреса** — после автокомплита Тильды получить координаты
3. **Вызвать `/v1/delivery/courier/price`** — с координатами из геокодера
4. **Обновить цену и сроки** — аналогично `updateOzonPrice()` для ПВЗ

```javascript
// Примерная логика
async function updateCourierPrice(serviceId, lat, lng) {
  const res = await fetch(`${BACKEND}/v1/delivery/courier/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: lat,
      longitude: lng,
      items: getCartItems(),
      buyerPhone: getPhone(),
    }),
  });
  const data = await res.json();
  if (data.success) {
    // обновить цену в service
  }
}
```

### 2.3. Геокодинг адреса → координаты

Варианты:

**A. Использовать координаты из Яндекс Карт Тильды:**

- Тильда уже делает геокодинг при автокомплите адреса
- Нужно перехватить результат и достать координаты
- Координаты могут быть в `deliveryState` или в скрытых инпутах

**B. Серверный геокодинг:**

- Передавать текстовый адрес на бэк
- Бэк делает геокодинг через Яндекс/OpenStreetMap API
- Менее предпочтительно — лишний API-ключ и запросы

**Рекомендация:** Вариант A — координаты уже есть на клиенте после автокомплита Тильды.

### 2.4. Обновить создание заказа (Этап 1)

При создании заказа через `/v2/order/create`:

- Если способ доставки «курьер» → `delivery: { courier: { coordinates: { latitude, longitude } } }`
- Если «ПВЗ» → `delivery: { pick_up: { map_point_id } }`

## Ozon API

### `/v2/delivery/checkout` — курьер

```json
{
  "delivery_schema": "MIX",
  "delivery_type": {
    "courier": {
      "coordinates": {
        "latitude": 55.7558,
        "longitude": 37.6173
      }
    }
  },
  "items": [{ "sku": 12345, "quantity": 1, "offer_id": "ART-001" }]
}
```

Response — тот же формат splits с timeslots.

## Зависимости

- Этап 1 (создание заказа) — желательно, но не блокер для checkout
- Способ получения координат из автокомплита Тильды

## Файлы для изменения

| Файл                                      | Действие                                                       |
| ----------------------------------------- | -------------------------------------------------------------- |
| `src/services/ozon-logistics/checkout.ts` | Добавить `getCourierDeliveryPrice()`                           |
| `src/modules/delivery/delivery.ts`        | Добавить endpoint `POST /v1/delivery/courier/price`            |
| `src/scripts/tilda-map-patch.html`        | Патч для курьерской доставки (перехват адреса, вызов endpoint) |
