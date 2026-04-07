# Ozon Logistics API - Документация для разработчиков

## Описание проекта

Backend API для интеграции с Ozon Seller API и Ozon Логистикой. Обеспечивает OAuth авторизацию, автоматическое управление токенами, резолв товаров и работу с методами Ozon API. Фронтенд — патч для Tilda (tilda-map-patch.html), который встраивается на сайт и управляет корзиной/доставкой.

## Технологический стек

- **Runtime**: Bun
- **Framework**: Elysia
- **Language**: TypeScript
- **Architecture**: Modular REST API
- **Database**: SQLite (Bun built-in)
- **Frontend**: Tilda + JS-патч (tilda-map-patch.html)

## Структура проекта

```
ozon/
├── src/
│   ├── config/
│   │   └── env.ts                  # Конфигурация и переменные окружения
│   ├── db/
│   │   └── index.ts                # SQLite база (sku_mapping, orders)
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.ts             # OAuth авторизация
│   │   └── delivery/
│   │       └── delivery.ts         # Модуль доставки (endpoints)
│   ├── services/
│   │   ├── pickup-points-cache.ts  # Кеш ПВЗ (SQLite FTS)
│   │   └── ozon-logistics/
│   │       ├── checkout.ts         # Checkout (цена/сроки доставки)
│   │       ├── delivery.ts         # Проверка доступности, карта
│   │       ├── mapper.ts           # Маппинг данных
│   │       ├── order.ts            # Создание заказа
│   │       ├── product.ts          # Резолв offer_id через /v3/product/info/list
│   │       └── types.ts            # Типы Ozon API
│   ├── scripts/
│   │   └── tilda-map-patch.html    # JS-патч для Tilda (фронтенд)
│   ├── utils/
│   │   ├── geocode.ts              # Геокодирование адресов
│   │   ├── getAccessToken.ts       # Управление OAuth токенами
│   │   ├── htmlResponses.ts        # HTML шаблоны для OAuth
│   │   ├── logger.ts               # Логирование с уровнями
│   │   ├── mailer.ts               # Email-уведомления (SMTP)
│   │   ├── ozonFetch.ts            # Типизированный fetch к Ozon API
│   │   ├── rateLimiter.ts          # Rate limiting
│   │   ├── requestQueue.ts         # Очередь запросов при 401
│   │   └── useFetch.ts             # Обёртка для безопасных запросов
│   └── index.ts                    # Точка входа
├── t/                              # Исходники Tilda JS (для справки)
├── .env                            # Переменные окружения
├── package.json
└── tsconfig.json
```

## Бизнес-логика доставки

### Общий Flow (фронтенд → бэкенд)

```
Tilda (tilda-map-patch.html)
  │
  ├─ 1. Проверка телефона ──────────► POST /v1/delivery/check
  │     Блокирует заказ если Ozon не доставляет на этот номер
  │
  ├─ 2a. ПВЗ: выбор точки ─────────► POST /v1/delivery/map (карта)
  │     │                            GET /v1/delivery/pvz (поиск по тексту)
  │     └─ Checkout ────────────────► POST /v1/delivery/price
  │        offer_id резолвится на бэке через /v3/product/info/list
  │
  ├─ 2b. Курьер: ввод адреса
  │     │  Геокод (Nominatim) на фронте
  │     │  Если не находит — блокирует заказ
  │     └─ Checkout ────────────────► POST /v1/delivery/courier/price
  │        offer_id резолвится на бэке через /v3/product/info/list
  │
  └─ 3. Оплата (Tilda) ────────────► POST /v1/order/create
        Webhook от Tilda с данными заказа
```

### State Machine (фронтенд)

Кнопка «Оплатить» заблокирована пока ВСЕ условия не выполнены:

- `phoneChecked` — телефон проверен через Ozon API
- `deliverySelected` — выбран ПВЗ или введён адрес курьера (геокод ок)
- `checkoutPassed` — checkout вернул `success: true`

При любой ошибке — сообщение через стандартные методы Tilda (`tcart__errorHandler`).

### Сообщения об ошибках

| Ситуация              | Сообщение                                                    |
| --------------------- | ------------------------------------------------------------ |
| Телефон не введён     | «Введите номер телефона»                                     |
| Ozon не доставляет    | «Доставка Ozon недоступна для этого номера»                  |
| Не выбран способ      | «Выберите пункт выдачи или введите адрес доставки»           |
| Checkout не прошёл    | «Доставка недоступна для выбранных товаров»                  |
| Геокод не нашёл адрес | «Не удалось определить адрес. Проверьте правильность ввода.» |

### Резолв offer_id (product.ts)

Tilda передаёт `sku` (число, Ozon SKU). Для Ozon API нужен `offer_id` (артикул продавца).

1. Фронт передаёт `{ sku: 3419170304, quantity: 2 }`
2. Бэкенд вызывает `resolveOfferIds([3419170304])` → `/v3/product/info/list`
3. Получает `offer_id` из ответа Ozon API
4. Подставляет в checkout/order запросы
5. Результат кешируется в памяти (Map<sku, offer_id>)

**Важно**: НЕ использовать SKU как offer_id — это разные идентификаторы.

### Очередь запросов (requestQueue.ts)

При 401:

1. Пробует refresh token
2. Если refresh ок — повторяет запрос
3. Если refresh не удался — ставит запрос в очередь + шлёт email
4. **Ошибки API (code: 3, 400+) НЕ являются ошибками авторизации** — пробрасываются наверх

## Архитектурные принципы

### 1. Модульность

- Каждый модуль в отдельной директории
- Модули регистрируются в index.ts через `.use()`
- Prefix для маршрутов модуля

### 2. Конфигурация

- Все настройки через переменные окружения
- Валидация обязательных переменных при старте
- Автоматическое определение IP и порта

### 3. Безопасность

- OAuth токены сохраняются в файл (не в БД)
- Автоматическое обновление токенов
- Dev-only endpoints защищены проверкой `isProd`

### 4. Обработка ошибок

- Логирование всех ошибок в консоль
- Возврат понятных сообщений клиенту
- HTML ответы для OAuth callback

## Система авторизации

### OAuth Flow

1. **Получение URL авторизации**

   ```
   GET /auth/url
   ```

   Возвращает URL для открытия в браузере.

2. **Callback обработка**

   ```
   GET /auth/callback?code=...&state=...
   ```

   Автоматически обменивает code на токен.

3. **Автоматическое обновление**
   - Токен обновляется реактивно: при получении 401 через `requestQueue.ts`
   - При 401 сначала пробует refresh_token, при успехе — повторяет запрос
   - Если refresh не удался — запрос ставится в очередь + email-уведомление
   - При перезапуске токен загружается из файла

4. **Токен передается в заголовках в модуле Delivery: Authorization: Bearer ACCESS_TOKEN**

### Управление токенами

- **Хранение**: `ozon_token.json` в директории utils
- **Автообновление**: реактивное через `requestQueue.ts` при 401
- **Очередь запросов**: при неудачном refresh — запросы сохраняются на диск (`request_queue.json`) и повторяются после авторизации
- **Dev endpoints**: `/auth/status`, `/auth/reset`, `/auth/refresh`

## Переменные окружения

### Обязательные

```env
OZON_LOGISTICS_CLIENT_ID=your_client_id
OZON_LOGISTICS_CLIENT_SECRET=your_client_secret
```

### Опциональные

```env
OZON_LOGISTICS_API_URL=https://api-seller.ozon.ru
OZON_LOGISTICS_AUTH_URL=https://api-seller.ozon.ru
OZON_LOGISTICS_REDIRECT_URI=http://YOUR_IP:PORT/auth/callback
OZON_LOGISTICS_IS_PROD=false
OZON_LOGISTICS_TIMEOUT=10000
PORT=3000
```

### Автоматическое определение

- Если `OZON_LOGISTICS_REDIRECT_URI` не задан, формируется автоматически
- IP определяется из сетевых интерфейсов
- Порт берётся из переменной `PORT`

## Правила разработки

### Код-стайл

1. **TypeScript**
   - Строгая типизация
   - Интерфейсы для всех структур данных
   - Экспорт типов через `export type`

2. **Функции**
   - JSDoc комментарии для публичных функций
   - Явные типы параметров и возвращаемых значений
   - Обработка ошибок через try-catch

3. **Модули**
   - Elysia instance с prefix
   - Чейнинг методов `.get()`, `.post()`
   - Валидация через `t.Object()`

### Логирование

```typescript
// Успешные операции
console.log("✅ Операция успешна");
console.log(`   Параметр: ${value}`);

// Ошибки
console.error("❌ Ошибка:", error);

// Информационные сообщения
console.log("🔄 Обмен code на токен...");
```

### Обработка ошибок

```typescript
try {
  // Операция
} catch (error) {
  console.error("❌ Описание:", error);
  return {
    success: false,
    error: error instanceof Error ? error.message : "Неизвестная ошибка",
  };
}
```

### HTML ответы

Использовать функции из `htmlResponses.ts`:

```typescript
const html = generateSuccessHTML({ expires_in, scope });
return createHTMLResponse(html);
```

Не встраивать HTML напрямую в код!

## API Endpoints

### Auth Module (`/auth`)

| Method | Path             | Description              | Mode     |
| ------ | ---------------- | ------------------------ | -------- |
| GET    | `/auth/url`      | Получить URL авторизации | All      |
| GET    | `/auth/callback` | OAuth callback           | All      |
| GET    | `/auth/status`   | Статус токена            | Dev only |
| POST   | `/auth/reset`    | Сброс токена             | Dev only |
| POST   | `/auth/refresh`  | Обновление токена        | Dev only |

### Delivery Module (`/v1`)

| Method | Path                         | Description                                     |
| ------ | ---------------------------- | ----------------------------------------------- |
| POST   | `/v1/delivery/check`         | Проверка телефона — доступна ли доставка Ozon   |
| POST   | `/v1/delivery/price`         | Checkout ПВЗ — цена/сроки, резолвит offer_id    |
| POST   | `/v1/delivery/courier/price` | Checkout курьер — цена/сроки, резолвит offer_id |
| POST   | `/v1/delivery/map`           | Проксирование карты — кластеры ПВЗ из Ozon API  |
| GET    | `/v1/delivery/pvz`           | Поиск ПВЗ по тексту (локальная SQLite FTS БД)   |
| GET    | `/v1/delivery/pvz/all`       | Все ПВЗ из кеша                                 |
| GET    | `/v1/delivery/pvz/status`    | Статус кеша ПВЗ                                 |
| POST   | `/v1/order/create`           | Создание заказа в Ozon (webhook от Tilda)       |
| POST   | `/v1/delivery/tilda/success` | Callback от Tilda после оплаты                  |

### Admin Endpoints (Dev only)

| Method | Path                    | Description                   |
| ------ | ----------------------- | ----------------------------- |
| POST   | `/v1/admin/sku-mapping` | Добавить/обновить маппинг SKU |
| GET    | `/v1/admin/sku-mapping` | Посмотреть маппинг SKU        |
| GET    | `/v1/admin/orders`      | Список заказов                |

### Root

| Method | Path | Description  |
| ------ | ---- | ------------ |
| GET    | `/`  | Health check |

## Развертывание

### Development

```bash
# Установка зависимостей
bun install

# Запуск в dev режиме
bun run dev
```

### Production

```bash
# Установка зависимостей
bun install

# Запуск
bun run start
```

### Firewall

```bash
# Открыть порт
sudo ufw allow PORT/tcp
sudo ufw reload
```

### Привилегированные порты (< 1024)

Для портов < 1024 требуется:

```bash
# Вариант 1: Запуск с sudo
sudo bun run src/index.ts

# Вариант 2: capabilities (рекомендуется)
sudo setcap 'cap_net_bind_service=+ep' $(which bun)
```

## Тестирование

### Проверка авторизации

1. Открыть `http://YOUR_IP:PORT/auth/url`
2. Скопировать URL из ответа
3. Открыть в браузере
4. Авторизоваться в Ozon
5. Увидеть HTML страницу с результатом

### Проверка токена

```bash
curl http://YOUR_IP:PORT/auth/status
```

## Известные ограничения

1. **Ozon Redirect URI**
   - Требует двухзначный порт (< 100)
   - Для портов >= 100 нужен reverse proxy

2. **Firewall**
   - Порт должен быть открыт в UFW
   - Проверить NAT на роутере

3. **Mixed Content**
   - Браузер блокирует HTTP с HTTPS страниц
   - Решение: открыть callback URL напрямую

## Troubleshooting

### Токен не получен

1. Проверить логи сервера
2. Проверить `redirect_uri` в настройках Ozon
3. Проверить доступность сервера извне

### Порт недоступен

1. Проверить firewall: `sudo ufw status`
2. Проверить NAT на роутере
3. Проверить прослушивание: `ss -tlnp | grep :PORT`

### OAuth ошибки

1. `redirect_uri does not match` — проверить URL в настройках Ozon
2. `invalid_client` — проверить client_id и client_secret
3. `invalid_grant` — код авторизации истёк или использован

## Обновление токенов

### Автоматическое обновление (реактивное)

- При любом запросе к Ozon API, если ответ 401 — `requestQueue.ts` перехватывает
- Автоматически пробует `refresh_token` через `fetchAccessToken('refresh_token', ...)`
- При успешном refresh — повторяет исходный запрос с новым токеном
- При неудачном refresh — запрос сохраняется в очередь на диск + email-уведомление
- Очередь реплеится после успешной авторизации
- Ошибки API (code: 3, HTTP 400+) НЕ считаются ошибками авторизации и пробрасываются наверх

### Ручное обновление (dev only)

```bash
POST /auth/refresh
```

## Безопасность

### Производственный режим

Установить `OZON_LOGISTICS_IS_PROD=true`:

- Отключаются dev-only endpoints
- Ограничивается доступ к управлению токенами

### Рекомендации

1. Не коммитить `.env` файл
2. Использовать HTTPS в production
3. Ограничить доступ к портам по IP
4. Регулярно обновлять client_secret

## Статус реализации

### ✅ Полностью реализовано

#### API Endpoints (17/17)

- **Auth**: GET `/auth/url`, GET `/auth/callback`, GET `/auth/status`, POST `/auth/reset`, POST `/auth/refresh`
- **Delivery**: POST `/v1/delivery/check`, POST `/v1/delivery/price`, POST `/v1/delivery/courier/price`, POST `/v1/delivery/map`, GET `/v1/delivery/pvz`, GET `/v1/delivery/pvz/all`, GET `/v1/delivery/pvz/status`
- **Order**: POST `/v1/order/create`, POST `/v1/delivery/tilda/success`
- **Admin**: POST `/v1/admin/sku-mapping`, GET `/v1/admin/sku-mapping`, GET `/v1/admin/orders`
- **Root**: GET `/`

#### OAuth Flow

- Генерация URL авторизации с CSRF state (TTL 10 мин, одноразовый)
- Callback обработка с обменом code на токен
- Хранение токена в файле, загрузка при старте
- Реактивное обновление при 401 через requestQueue
- Очередь запросов с персистентностью на диск
- Email-уведомления при неудачном refresh

#### Delivery Flow

- Проверка телефона через Ozon API
- Карта ПВЗ (проксирование кластеров)
- Поиск ПВЗ по тексту (SQLite FTS5)
- Checkout ПВЗ и курьер (с резолвом offer_id)
- Геокодирование через Nominatim (Russia-only)
- Создание заказа (webhook от Tilda)

#### Сервисы

- **Product resolver** — SKU → offer_id через `/v3/product/info/list`, кеш в памяти
- **Pickup points cache** — SQLite FTS5, batch-загрузка, ежедневный cron (14:00), viewport-запросы
- **Request queue** — 401 → refresh → retry/queue, очередь на диске
- **Rate limiter** — Bottleneck, 10 req/s, макс 1000 в очереди
- **Mailer** — SMTP, 3 типа писем, дебаунс (5 мин / 30 сек / 10 мин)
- **Geocoder** — Nominatim, 1 req/s, timeout 10s
- **Logger** — уровни log/warn/error/critical, critical → email

#### База данных

- `sku_mapping` — Tilda externalid → Ozon SKU + offer_id
- `orders` — история заказов
- `pickup_points` — кеш ПВЗ
- `pickup_points_fts` — FTS5 виртуальная таблица

#### Фронтенд (tilda-map-patch.html)

- State machine: `phoneChecked`, `deliverySelected`, `checkoutPassed`
- Блокировка кнопки «Оплатить» до выполнения всех условий
- Все сообщения об ошибках по спецификации
- Выбор ПВЗ на карте + поиск по тексту
- Ввод адреса курьера с геокодированием
- Hidden-поля для webhook (`ozon_map_point_id`, `ozon_delivery_type`)

### ⚠️ Не реализовано / требует доработки

1. **Tilda success callback** (`POST /v1/delivery/tilda/success`) — эндпоинт только логирует webhook, но не обрабатывает данные. Нужно определить бизнес-логику: что делать после успешной оплаты (обновить статус заказа, уведомить и т.д.)

## Контакты и поддержка

При возникновении вопросов обращаться к документации Ozon API:

- https://docs.ozon.ru/sellers/
- https://seller.ozon.ru/app/appstore/
