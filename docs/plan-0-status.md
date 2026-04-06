# Этап 0 — Текущий статус реализации

## Что уже работает

### Backend (Elysia + Bun)

| Endpoint                          | Файл                                                                   | Описание                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /v1/delivery/check`         | `modules/delivery/delivery.ts` → `services/ozon-logistics/delivery.ts` | Проверка доступности доставки по телефону. Вызывает Ozon `/v1/delivery/check`                    |
| `POST /v1/delivery/price`         | `modules/delivery/delivery.ts` → `services/ozon-logistics/checkout.ts` | Получение сроков доставки до ПВЗ. Вызывает Ozon `/v2/delivery/checkout` с `pick_up.map_point_id` |
| `GET /v1/delivery/pvz?q=`         | `modules/delivery/delivery.ts` → `services/pickup-points-cache.ts`     | Поиск ПВЗ по текстовому запросу (FTS5 SQLite)                                                    |
| `GET /v1/delivery/pvz/all`        | —                                                                      | Все ПВЗ из кэша                                                                                  |
| `GET /v1/delivery/pvz/status`     | —                                                                      | Статус кэша (кол-во точек, дата обновления)                                                      |
| `POST /v1/delivery/map`           | —                                                                      | ПВЗ по viewport карты (координаты + zoom)                                                        |
| `POST /v1/delivery/tilda/success` | —                                                                      | Callback от Тильды — **только логирует** в `cache/tilda-callbacks.log`                           |
| `POST /v1/order/create`           | —                                                                      | Приём запроса на создание заказа — **только логирует** в `cache/order-create.log` с headers/IP   |
| `GET /auth/url`                   | `modules/auth/auth.ts`                                                 | OAuth redirect                                                                                   |
| `GET /auth/callback`              | —                                                                      | OAuth callback + auto-refresh                                                                    |

### Инфраструктура

- **Кэш ПВЗ**: SQLite с FTS5, ежедневное обновление в 14:00, batch-загрузка при старте
- **OAuth**: автообновление токена за 24ч до истечения, сохранение в файл
- **Типизированный API-клиент**: `OzonApiClient` с маппингом endpoint → request/response типов

### Frontend (tilda-map-patch.html)

| Функция                            | Описание                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Патч `changePickupHandler`         | При выборе ПВЗ → заполняет hidden inputs Тильды + вызывает `updateOzonPrice()`        |
| Патч `changeSearchboxInputHandler` | Перехватывает поиск ПВЗ → запрос к `/v1/delivery/pvz?q=`                              |
| Заглушка `getPickupList`           | Блокирует стандартный API Тильды для ПВЗ                                              |
| Патч `mapInit`                     | При boundschange → загрузка точек через `/v1/delivery/map`                            |
| Проверка телефона                  | `blur` на `input[name="phone"]` → `POST /v1/delivery/check` → alert при недоступности |

## Что НЕ работает

1. **Создание заказа в Ozon** — webhook только логирует, нет вызова `/v2/order/create`
2. **Курьерская доставка** — нет ни backend endpoint, ни frontend патча
3. **Блокировка кнопки покупки** — при неуспешном check только alert, кнопка не блокируется
4. **Цена доставки** — `checkout.ts` возвращает `price: 0`, т.к. `/v2/checkout` не отдаёт цену
5. **Сохранение checkout-данных** — splits из `/v2/checkout` не сохраняются для создания заказа
6. **Безопасность webhook** — принимает запросы с любых IP без валидации
