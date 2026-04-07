# Ozon Logistics API — Документация

> Дата обновления: 3 апреля 2026 г.

---

## Содержание

- [Причины отмены](#причины-отмены)
  - [Причины отмены заказа](#причины-отмены-заказа)
  - [Причины отмены отправления](#причины-отмены- отправления)
- [Доставка](#доставка)
  - [Проверить доступность доставки](#проверить-доступность-доставки)
  - [Получить доступные варианты доставки](#получить-доступные-варианты-доставки)
  - [Отрисовать точки на карте](#отрисовать-точки-на-карте)
  - [Получить информацию о точке самовывоза](#получить-информацию-о-точке-самовывоза)
  - [Получить список точек самовывоза](#получить-список-точек-самовывоза)
- [Заказы](#заказы)
  - [Отменить заказ](#отменить-заказ)
  - [Проверить возможность отмены заказа](#проверить-возможность-отмены-заказа)
  - [Получить статус отмены заказа](#получить-статус-отмены-заказа)
  - [Создать заказ](#создать-заказ)
- [Отправления](#отправления)
  - [Отменить отправление](#отменить-отправление-из-заказа)
  - [Проверить статус отмены отправления](#проверить-статус-отмены-отправления)
  - [Получить маркировки экземпляров](#получить-маркировки-экземпляров-из-отправления)

---

## Причины отмены

### Причины отмены заказа

`POST /v1/cancel-reason/list-by-order`

Возвращает возможные причины отмены для заказа.

#### Request Body

```json
{
  "order_number": "string" // required — Номер заказа
}
```

#### Response `200`

```json
{
  "reasons": [
    {
      "id": 0,
      "name": "string"
    }
  ]
}
```

#### Идентификаторы причин отмены

| id  | Причина                               |
| --- | ------------------------------------- |
| 501 | Ozon перенёс срок доставки            |
| 502 | Отменили часть товаров из заказа      |
| 503 | Не применилась скидка или промокод    |
| 504 | Хочу изменить заказ и оформить заново |
| 505 | Слишком долго ждать                   |
| 506 | Нашёл дешевле                         |
| 508 | Не нашёл нужную причину               |
| 710 | Указал неверный адрес                 |

---

### Причины отмены отправления

`POST /v1/cancel-reason/list-by-posting`

Возвращает возможные причины отмены для отправления.

#### Request Body

```json
{
  "posting_number": "string" // required — Номер отправления
}
```

#### Response `200`

```json
{
  "reasons": [
    {
      "id": 0,
      "name": "string"
    }
  ]
}
```

Идентификаторы причин — аналогичны [таблице выше](#идентификаторы-причин-отмены).

---

## Доставка

### Проверить доступность доставки

`POST /v1/delivery/check`

Проверяет доступность доставки Ozon для покупателя. Не учитывает ограничения по сумме покупки, категории товаров и географии.

#### Request Body

```json
{
  "client_phone": "7XXXXXXXXXX" // required — Номер телефона покупателя
}
```

#### Response `200`

```json
{
  "is_possible": true // true, если доставка доступна
}
```

---

### Получить доступные варианты доставки

`POST /v2/delivery/checkout`

Проверяет доступность доставки товаров на указанный адрес или в точку выдачи и отображает сроки доставки.

> **Рекомендация:** проверяйте наличие товаров и маршруты во время оформления заказа, чтобы точно рассчитать сроки доставки.

#### Request Body

```json
{
  "buyer_phone": "string",
  "delivery_schema": "MIX", // "MIX" | "FBO" | "FBS"
  "delivery_type": {
    "courier": {
      "coordinates": {
        "latitude": 0,
        "longitude": 0
      }
    },
    "pick_up": {
      "map_point_id": 0
    }
  },
  "items": [
    // max 1000 items
    {
      "offer_id": "string",
      "quantity": 0,
      "sku": 0
    }
  ]
}
```

| Поле              | Тип    | Описание                             |
| ----------------- | ------ | ------------------------------------ |
| `buyer_phone`     | string | Номер телефона покупателя            |
| `delivery_schema` | string | `MIX` (по умолч.), `FBO`, `FBS`      |
| `delivery_type`   | object | Способ доставки (курьер / самовывоз) |
| `items`           | array  | Информация о товарах (макс. 1000)    |

#### Response `200`

```json
{
  "splits": [
    {
      "delivery_method": {
        "delivery_time_zone_offset": 0,
        "delivery_type": "UNSPECIFIED",
        "id": 0,
        "name": "string",
        "timeslots": [
          {
            "client_date_range": {
              "from": "2019-08-24T14:15:22Z",
              "to": "2019-08-24T14:15:22Z"
            },
            "logistic_date_range": {
              "from": "2019-08-24T14:15:22Z",
              "to": "2019-08-24T14:15:22Z"
            },
            "timeslot_id": 0
          }
        ],
        "unavailable_reason": "UNSPECIFIED",
        "warehouse_time_zone_offset": 0
      },
      "delivery_schema": "UNSPECIFIED",
      "items": [
        {
          "offer_id": "string",
          "quantity": 0,
          "sku": 0
        }
      ],
      "unavailable_reason": "UNSPECIFIED",
      "warehouse_id": 0
    }
  ]
}
```

#### Причины недоступности (`unavailable_reason`)

| Значание                                 | Описание                                         |
| ---------------------------------------- | ------------------------------------------------ |
| `UNSPECIFIED`                            | Доставка доступна                                |
| `UNKNOWN`                                | Неизвестная причина                              |
| `OUT_OF_STOCK`                           | Товар закончился                                 |
| `BANNED_FOR_AREA`                        | Товар заблокирован для области                   |
| `BANNED_FOR_LEGAL`                       | Товар заблокирован для юр. лиц                   |
| `BANNED`                                 | Товар заблокирован                               |
| `BANNED_FOR_NOT_PREMIUM`                 | Блокировка для покупателей без подписки Premium  |
| `DELIVERY_UNAVAILABLE`                   | Доставка недоступна (напр. курьеры перегружены)  |
| `BANNED_FOR_INDIVIDUAL`                  | Товар заблокирован для физ. лиц                  |
| `INVALID_WEIGHT`                         | Вес товара не указан                             |
| `INVALID_MULTIPLICITY`                   | Недопустимая кратность                           |
| `NOT_FOUND_POINTS_DARK_STORES`           | Пункты дарксторов не найдены                     |
| `INVALID_MULTI_WAREHOUSES`               | Неверное распределение по складам                |
| `MIN_PRICE`                              | Сплит не прошёл минимальную цену                 |
| `OZONE_DELIVERY_UNAVAILABLE`             | Доставка Ozon недоступна                         |
| `RFBS_DELIVERY_UNAVAILABLE`              | Доставка rFBS недоступна                         |
| `HACK_COURIER_TAGS`                      | Способ доставки исключён по приоритетному показу |
| `NO_SLA`                                 | Норматив комплектации отсутствует                |
| `DELIVERY_VARIANT_IS_CLOSING`            | Способ доставки в неподходящем статусе           |
| `TPL_NOT_INTEGRATED`                     | Точки без возможности возврата                   |
| `NOT_ALL_WAREHOUSES_ARE_SERVED`          | Доставка со склада отсутствует                   |
| `DELIVERY_SLOTS_NOT_FOUND`               | Таймслоты отсутствуют                            |
| `NO_ROUTE`                               | Маршрут не найден                                |
| `CAPACITY_LIMIT`                         | Капаситет заполнен                               |
| `PACKAGE_MAX_VOLUME_WEIGHT_RESTRICTION`  | Превышен макс. объёмный вес                      |
| `PACKAGE_MAX_WEIGHT_RESTRICTION`         | Превышен макс. физ. вес                          |
| `MAX_COST_RESTRICTION`                   | Превышена макс. стоимость заказа                 |
| `MIN_PACKAGE_WEIGHT_RESTRICTION`         | Ниже мин. физ. вес посылки                       |
| `MIN_COST_RESTRICTION`                   | Ниже мин. стоимости товаров                      |
| `MAX_DIMENSIONS_RESTRICTION`             | Превышены макс. габариты                         |
| `PRODUCT_TYPES_RESTRICTION`              | Ограничение по товарным категориям               |
| `PRODUCT_TAGS_RESTRICTION`               | Ограничение по тегам товаров                     |
| `SELECTED_DELIVERY_METHOD_UNAVAILABLE`   | Выбранный способ доставки стал недоступным       |
| `SELECTED_DELIVERY_TIMESLOT_UNAVAILABLE` | Выбранный таймслот стал недоступным              |
| `MARKETPLACE_UNAVAILABLE`                | Товары нескольких маркетплейсов в заказе         |
| `INVALID_PVZ_FOR_KGT`                    | ПВЗ не подходит для КГТ                          |
| `LEGAL_USER_PREMIUM_SPLIT`               | Юр. лицам запрещена покупка Premium              |
| `USER_ALREADY_HAS_PREMIUM`               | У пользователя уже есть Premium                  |
| `WAIT_FOR_PAY_SUBSCRIPTION`              | Premium не оплачен / не активен                  |
| `ADDRESS_NOT_SET`                        | Адрес не установлен                              |
| `PICKUP_POINT_DISABLED`                  | ПВЗ недоступен                                   |
| `LEGAL_PREORDER`                         | Предзаказ недоступен юр. лицам                   |
| `DELIVERY_TYPE_FOR_PREORDER`             | Тип доставки недоступен для предзаказа           |
| `CROSS_BORDER_PICKUP`                    | CrossBorder-товары не доставляются в ПВЗ         |
| `ORDER_CUSTOMS_TYPES`                    | Ограничения по таможенным типам                  |
| `PACKAGE_MAX_COST`                       | Превышена макс. стоимость посылки                |
| `SUPER_ECONOM`                           | Недоступный «суперэконом»                        |
| `ECONOM_NOT_FULL_QUANT`                  | Неполный квант                                   |
| `EMPTY_DELIVERY_METHODS`                 | Нет доступных способов доставки                  |

---

### Отрисовать точки на карте

`POST /v1/delivery/map`

Возвращает объединённые кластеры точек самовывоза на области из параметра `viewport`.

> Используйте `clusters.viewport`, чтобы получить список точек или мелких кластеров внутри крупного кластера. Для информации о конкретной точке используйте `/v1/delivery/point/info`.

#### Request Body

```json
{
  "viewport": {
    "left_bottom": {
      "lat": 0,
      "long": 0
    },
    "right_top": {
      "lat": 0,
      "long": 0
    }
  },
  "zoom": 0 // 0–19 — масштаб карты
}
```

#### Response `200`

```json
{
  "clusters": [
    {
      "coordinate": {
        "lat": 0,
        "long": 0
      },
      "is_same_building": true,
      "map_point_ids": ["string"],
      "points_count": 0,
      "viewport": {
        "left_bottom": { "lat": 0, "long": 0 },
        "right_top": { "lat": 0, "long": 0 }
      }
    }
  ]
}
```

| Поле               | Тип      | Описание                                    |
| ------------------ | -------- | ------------------------------------------- |
| `coordinate`       | object   | Координаты кластера                         |
| `is_same_building` | boolean  | `true`, если все точки в одном здании       |
| `map_point_ids`    | string[] | Идентификаторы точек на карте               |
| `points_count`     | integer  | Количество точек в кластере                 |
| `viewport`         | object   | Область для получения точек внутри кластера |

---

### Получить информацию о точке самовывоза

`POST /v1/delivery/point/info`

Возвращает подробную информацию о точке самовывоза для пользователя.

#### Request Body

```json
{
  "map_point_ids": ["string"] // max 100 items
}
```

#### Response `200`

```json
{
  "points": [
    {
      "delivery_method": {
        "address": "string",
        "address_details": {
          "city": "string",
          "house": "string",
          "region": "string",
          "street": "string"
        },
        "coordinates": {
          "lat": 0,
          "long": 0
        },
        "delivery_type": {
          "id": 0,
          "name": "string"
        },
        "description": "string",
        "fitting_rooms_count": 0,
        "holidays": [
          {
            "begin": "2019-08-24T14:15:22Z",
            "end": "2019-08-24T14:15:22Z"
          }
        ],
        "holidays_filled": true,
        "images": ["string"],
        "location_id": "string",
        "map_point_id": 0,
        "name": "string",
        "properties": [
          {
            "enabled": true,
            "name": "string"
          }
        ],
        "pvz_rating": 0,
        "storage_period": 0,
        "working_hours": [
          {
            "date": "2019-08-24T14:15:22Z",
            "periods": [
              {
                "max": { "hours": 0, "minutes": 0 },
                "min": { "hours": 0, "minutes": 0 }
              }
            ]
          }
        ]
      },
      "enabled": true
    }
  ]
}
```

---

### Получить список точек самовывоза

`POST /v1/delivery/point/list`

Возвращает координаты всех точек самовывоза без объединения в кластеры.

#### Request Body

```json
{}
```

#### Response `200`

```json
{
  "points": [
    {
      "coordinate": {
        "lat": 0,
        "long": 0
      },
      "map_point_id": 0
    }
  ]
}
```

---

## Заказы

### Отменить заказ

`POST /v1/order/cancel`

Отменяет заказ со всеми отправлениями. Используйте `reasons.id` из метода `/v1/cancel-reason/list-by-order`.

#### Request Body

```json
{
  "order_number": "string", // required
  "reason_id": 0, // required — идентификатор причины
  "reason_message": "string" // optional
}
```

#### Response `200`

```json
{
  "message": "string" // Статус обработки отмены
}
```

---

### Проверить возможность отмены заказа

`POST /v1/order/cancel/check`

Возвращает возможность отмены заказа для покупателя.

#### Request Body

```json
{
  "order_number": "string" // required
}
```

#### Response `200`

```json
{
  "cancellable": true,
  "order_number": "string",
  "posting_groups": [
    {
      "posting_numbers": ["string"]
    }
  ],
  "postings": [
    {
      "cancellable": true,
      "posting_number": "string",
      "why_not_cancellable": "string"
    }
  ]
}
```

---

### Получить статус отмены заказа

`POST /v1/order/cancel/status`

#### Request Body

```json
{
  "order_number": "string" // required
}
```

#### Response `200`

```json
{
  "order_number": "string",
  "posting_number": ["string"],
  "state": "string"
}
```

---

### Создать заказ

`POST /v2/order/create`

Создаёт заказ для покупателя и получателя в системе Ozon. Передайте вариант доставки из ответа метода `/v2/delivery/checkout`.

> В ответе могут быть не все отправления. Используйте:
>
> - `/v2/posting/fbo/list` — для схемы FBO
> - `/v3/posting/fbs/list` — для схемы FBS

#### Request Body

```json
{
  "buyer": {
    "first_name": "string",
    "last_name": "string",
    "middle_name": "string",
    "phone": "string"
  },
  "delivery": {
    // courier { coordinates: { latitude, longitude } }
    // или pick_up { map_point_id }
  },
  "delivery_schema": "MIX", // required — "MIX" | "FBO" | "FBS"
  "recipient": {
    "recipient_first_name": "string",
    "recipient_last_name": "string",
    "recipient_middle_name": "string",
    "recipient_phone": "string"
  },
  "splits": [
    {
      "delivery_method": {
        "delivery_method_id": 0,
        "delivery_type": "COURIER",
        "logistic_date_range": {
          "from": "2019-08-24T14:15:22Z",
          "to": "2019-08-24T14:15:22Z"
        },
        "price": {
          "currency_code": "string",
          "nanos": 0,
          "units": 0
        },
        "timeslot_id": 0
      },
      "items": [
        {
          "offer_id": "string",
          "price": {
            "currency_code": "string",
            "nanos": 0,
            "units": 0
          },
          "quantity": 0,
          "sku": 0
        }
      ],
      "warehouse_id": 0
    }
  ]
}
```

#### Response `200`

```json
{
  "order_number": "string",
  "postings": ["string"]
}
```

---

## Отправления

### Отменить отправление из заказа

`POST /v1/posting/cancel`

Отменяет отправление из заказа. Используйте `reasons.id` из метода `/v1/cancel-reason/list-by-posting`.

#### Request Body

```json
{
  "posting_number": "string", // required
  "reason_id": 0, // required — идентификатор причины
  "reason_message": "string" // optional
}
```

#### Response `200`

```json
{
  "message": "string"
}
```

---

### Проверить статус отмены отправления

`POST /v1/posting/cancel/status`

#### Request Body

```json
{
  "posting_number": "string" // optional
}
```

#### Response `200`

```json
{
  "order_number": "string",
  "posting_number": ["string"],
  "state": "string"
}
```

---

### Получить маркировки экземпляров из отправления

`POST /v1/posting/marks`

Возвращает статусы выдачи экземпляров и коды маркировки «Честный ЗНАК» для каждого отправления.

> Укажите в чеке и выведите из оборота маркировки экземпляров из параметра `issued_exemplars` в ответе.

#### Request Body

```json
{
  "posting_numbers": ["string"]
}
```

#### Response `200`

```json
{
  "invalid_postings": ["string"],
  "issued_exemplars": [
    {
      "exemplar_id": 0,
      "mandatory_marks": ["string"],
      "posting_number": "string",
      "sku": 0
    }
  ],
  "non_issued_exemplars": [
    {
      "exemplar_id": 0,
      "posting_number": "string",
      "sku": 0
    }
  ]
}
```

| Поле                   | Описание                                    |
| ---------------------- | ------------------------------------------- |
| `invalid_postings`     | Список неверных идентификаторов отправлений |
| `issued_exemplars`     | Выданные покупателям экземпляры товаров     |
| `non_issued_exemplars` | Не выданные покупателям экземпляры товаров  |

---

## Общая схема API

```
Базовый URL: https://api-seller.ozon.ru

Авторизация: Bearer ACCESS_TOKEN (передаётся в заголовке Authorization)
Content-Type: application/json
```

### Быстрая навигация по эндпоинтам

| Метод | Путь                                | Описание                            |
| ----- | ----------------------------------- | ----------------------------------- |
| POST  | `/v1/cancel-reason/list-by-order`   | Причины отмены для заказа           |
| POST  | `/v1/cancel-reason/list-by-posting` | Причины отмены для отправления      |
| POST  | `/v1/delivery/check`                | Проверить доступность доставки      |
| POST  | `/v2/delivery/checkout`             | Получить варианты доставки          |
| POST  | `/v1/delivery/map`                  | Кластеры точек на карте             |
| POST  | `/v1/delivery/point/info`           | Информация о точке самовывоза       |
| POST  | `/v1/delivery/point/list`           | Список всех точек самовывоза        |
| POST  | `/v1/order/cancel`                  | Отменить заказ                      |
| POST  | `/v1/order/cancel/check`            | Проверить возможность отмены заказа |
| POST  | `/v1/order/cancel/status`           | Статус отмены заказа                |
| POST  | `/v2/order/create`                  | Создать заказ                       |
| POST  | `/v1/posting/cancel`                | Отменить отправление                |
| POST  | `/v1/posting/cancel/status`         | Статус отмены отправления           |
| POST  | `/v1/posting/marks`                 | Маркировки экземпляров отправления  |
| POST  | `/v3/product/info/list`             | Получить товары по SKU/offer_id     |

---

## Товары

### Получить информацию о товарах по идентификаторам

`POST /v3/product/info/list`

Метод для получения информации о товарах по их идентификаторам. Используется для резолва `offer_id` по `sku`.

> **Важно**: В одном запросе можно передать не больше 1000 товаров по параметрам offer_id, product_id и sku в сумме.

#### Авторизация

Использует OAuth Bearer токен (как и остальные методы Ozon Logistics API).

```
Authorization: Bearer ACCESS_TOKEN
```

#### Request Body

```json
{
  "sku": ["3419170304"]
}
```

| Поле       | Тип              | Описание                                            |
| ---------- | ---------------- | --------------------------------------------------- |
| offer_id   | Array of strings | Артикул продавца (идентификатор в системе продавца) |
| product_id | Array of strings | Идентификатор товара в системе Ozon (product_id)    |
| sku        | Array of strings | Идентификатор товара в системе Ozon (SKU)           |

> Передаётся массив **одного типа** идентификаторов. В нашем случае — `sku`.

#### Response `200`

```json
{
  "items": [
    {
      "id": 123456,
      "name": "Название товара",
      "offer_id": "ARTICLE-001",
      "sku": 3419170304,
      "price": "1990.00",
      "old_price": "2500.00",
      "currency_code": "RUB",
      "stocks": { "coming": 0, "present": 10, "reserved": 2 },
      "is_archived": false,
      "is_kgt": false,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2026-03-20T15:30:00Z"
    }
  ]
}
```

Ключевые поля ответа:

| Поле     | Тип     | Описание                                          |
| -------- | ------- | ------------------------------------------------- |
| offer_id | string  | **Артикул продавца** — нужен для checkout и order |
| sku      | integer | SKU товара в системе Ozon                         |
| name     | string  | Название товара                                   |
| price    | string  | Цена с учётом скидок                              |
| stocks   | object  | Остатки (present, reserved, coming)               |

#### Использование в проекте

```
Tilda (sku: 3419170304)
  → Бэкенд: resolveOfferIds([3419170304])
    → POST /v3/product/info/list { sku: ["3419170304"] }
    → Ответ: offer_id = "ARTICLE-001"
    → Кешируется в Map<number, string>
  → Подставляется в /v2/delivery/checkout и /v2/order/create
```

**Код**: `src/services/ozon-logistics/product.ts`

#### Ошибки

| Код | Описание          |
| --- | ----------------- |
| 400 | Неверный параметр |
| 403 | Доступ запрещён   |
| 404 | Товар не найден   |
| 500 | Внутренняя ошибка |
